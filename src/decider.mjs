// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required']);

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

  // 3. 정상 요청 승인
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered'],
  };
}

