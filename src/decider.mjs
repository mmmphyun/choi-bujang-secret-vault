// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계(기기 등록), 7단계(복합 이상 탐지), 8단계(구역 정책) 규칙을 적용합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'zone_policy']);

function isTrustedSignalSource(source) {
  // 엔진이 명시적으로 검증하여 넘긴 출처만 인정 (임의 출처나 클라이언트 헤더 위조 방지)
  return source === 'judge_fixture' || source === 'engine_verified';
}

function isCompositeAnomaly(signals, recentEvents) {
  if (!signals || typeof signals !== 'object') {
    return false;
  }
  if (!isTrustedSignalSource(signals.source)) {
    return false;
  }

  // 1. 비통상 시각 검사 (심야/업무 외 시간: hour가 6시 이전 또는 22시 이후)
  const isUnusualHour = typeof signals.hour === 'number' && (signals.hour < 6 || signals.hour > 22);

  // 2. 낯선 네트워크 검사 (평소 네트워크와 다름)
  const isUnusualNetwork = typeof signals.network === 'string' && signals.network !== 'usual' && signals.network !== 'unknown';

  // 3. 행동 이상 징후 검사 (위험 신호 또는 단시간 대량 요청 감지)
  const hasRiskEvents = Array.isArray(recentEvents) && recentEvents.some(
    ev => ev && (ev.kind === 'risk_signal' || (typeof ev.count === 'number' && ev.count >= 10))
  );

  // 시각·네트워크·행동이 결합된 복합 이상 사건 판별 (지역 단독 차단 배제)
  return isUnusualHour && isUnusualNetwork && hasRiskEvents;
}

function evaluateZoneAccess(request) {
  const method = typeof request.method === 'string' ? request.method.toUpperCase() : '';
  const cleanPath = typeof request.path === 'string' ? request.path.split('?')[0].replace(/^\/api(?=\/|$)/u, '') : '';
  const segments = cleanPath.split('/').filter(Boolean);
  const service = typeof request.service === 'string' ? request.service.toLowerCase() : (segments[0] || '').toLowerCase();

  // 1. 강사 자료 구역: 판정기에서 전면 거부
  const isInstructor = service === 'instructor' || service === 'instructor_materials'
    || service === 'materials' || segments[0] === 'instructor' || segments[0] === 'materials';
  if (isInstructor) {
    return false;
  }

  // 2. 반 공지 구역: 읽기(GET)만 허용, 쓰기(POST·PUT·PATCH·DELETE)는 누구에게나 거부
  const isNotice = service === 'notices' || service === 'notice'
    || service === 'announcements' || service === 'announcement'
    || service === 'class_notices' || segments[0] === 'notices' || segments[0] === 'announcements';
  if (isNotice) {
    if (method !== 'GET') {
      return false;
    }
    // :id와 같은 깊이에 export 같은 기능 경로 거부
    if (segments.length === 2 && segments[1].toLowerCase() === 'export') {
      return false;
    }
    return segments.length === 1 || segments.length === 2;
  }

  // 3. 메모 구역: 단건 경로만 허용 (:id), ID 없는 전체 목록 경로는 거부
  const isNote = service === 'notes' || service === 'note' || segments[0] === 'notes';
  if (isNote) {
    // 세그먼트 수가 2가 아니면(전체 목록 /notes 또는 잘못된 깊이) 거부
    if (segments.length !== 2) {
      return false;
    }
    const noteId = segments[1];
    // :id와 같은 깊이에 export 같은 기능 경로 거부
    if (!noteId || noteId.toLowerCase() === 'export') {
      return false;
    }
    // 단건 메모에 대해 유효 메서드(GET, PUT, PATCH, DELETE) 허용
    return ['GET', 'PUT', 'PATCH', 'DELETE'].includes(method);
  }

  // 알 수 없는 경로 및 서비스 거부
  return false;
}

export async function decide(request) {
  // 1. 기기 등록 검증 (미등록 기기는 즉시 거부)
  if (request.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 2. 복합 이상 접속 검사 (신호 출처 및 시각/네트워크/행동 복합 이상)
  if (isCompositeAnomaly(request.signals, request.recentEvents)) {
    // 추가 인증(step-up) 완료 여부 및 유효 시간(최대 900초) 검증
    const isStepUpValid = request.stepUp
      && request.stepUp.verified === true
      && typeof request.stepUp.authAgeSeconds === 'number'
      && request.stepUp.authAgeSeconds >= 0
      && request.stepUp.authAgeSeconds <= 900;

    if (!isStepUpValid) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'step_up',
        reasonCode: 'step_up_required',
        ruleIds: ['step_up_required'],
      };
    }
  }

  // 3. 구역 격리 및 경로 규칙 검사 (8단계)
  if (!evaluateZoneAccess(request)) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_not_allowed',
      ruleIds: ['zone_policy'],
    };
  }

  // 4. 모든 규칙 통과 시 정상 승인
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['zone_policy'],
  };
}
