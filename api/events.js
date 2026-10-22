/**
 * /api/events
 * 13~15단계 제공 서버 시작 틀: 본인의 최근 감사 기록(access) 및 저장된 XDR 경보(xdr) 제공
 * 관측 범위: 본인 최근 40건 범위 내 기록
 */

// 본인의 감사 기록 및 XDR 사건 데이터 (최대 40건)
const RECENT_SECURITY_EVENTS = [
  {
    id: 'evt-20261022-001',
    kind: 'access',
    at: '2026-10-22T05:10:00.000Z',
    appId: 'notes-vault',
    summary: '정상 승인 기기에서의 메모 단건 조회',
    evidence: [
      { id: 'evi-token-1', text: '인증 공급자(Supabase) 유효 토큰 수신' },
      { id: 'evi-device-1', text: '기기 지문 서명 검증 성공' }
    ],
    rules: [
      { id: 'rule-auth', text: '기본 신원 토큰 유효성 검증' },
      { id: 'device_registered', text: '등록된 기기 접근 허용 정책' }
    ],
    state: {
      access: 'allowed',
      session: 'active',
      device: 'registered'
    },
    supportedActions: []
  },
  {
    id: 'evt-20261022-002',
    kind: 'xdr',
    at: '2026-10-22T05:05:00.000Z',
    appId: 'notes-vault',
    summary: '단시간 대량 읽기 요청 감지 (10분 내 120건 초과 탐지 임계치 접근)',
    evidence: [
      { id: 'evi-rate-1', text: '단일 세션 1분간 25건 연속 조회 감지' }
    ],
    rules: [
      { id: 'burst_read', text: '10분 내 120건 초과 대량 조회 감시 규칙' }
    ],
    state: {
      access: 'denied',
      session: 'step_up_required',
      device: 'registered'
    },
    supportedActions: []
  },
  {
    id: 'evt-20261022-003',
    kind: 'access',
    at: '2026-10-22T04:55:00.000Z',
    appId: null, // 옛 기록 또는 등록 정보와 맞출 수 없는 기록
    summary: '미등록 기기 접속 시도 차단',
    evidence: [
      { id: 'evi-unreg-dev', text: '미확인 브라우저 환경에서 직접 API 접근' }
    ],
    rules: [
      { id: 'device_registered', text: '미등록 기기 접근 차단 정책' }
    ],
    state: {
      access: 'denied',
      session: 'unknown',
      device: 'unregistered'
    },
    supportedActions: []
  },
  {
    id: 'evt-20261022-004',
    kind: 'access',
    at: '2026-10-22T04:30:00.000Z',
    appId: 'ops-dashboard',
    summary: '탈환 작전실 현황 메타데이터 정상 조회',
    evidence: [
      { id: 'evi-ops-access', text: '작전실 요약 엔드포인트 접근' }
    ],
    rules: [
      { id: 'zone_policy', text: '운영 구역 접근 정책 준수' }
    ],
    state: {
      access: 'allowed',
      session: 'active',
      device: 'registered'
    },
    supportedActions: []
  },
  {
    id: 'evt-20261022-005',
    kind: 'xdr',
    at: '2026-10-22T03:50:00.000Z',
    appId: 'notes-vault',
    summary: '회수 대상 세션의 메모 수정 시도 차단 경보',
    evidence: [
      { id: 'evi-revoked-token', text: '블랙리스트 등록 세션 토큰 사용 시도' }
    ],
    rules: [
      { id: 'session_invalidation', text: '회수 세션 접근 차단' }
    ],
    state: {
      access: 'denied',
      session: 'revoked',
      device: 'blocked'
    },
    supportedActions: []
  }
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // 최근 40건 범위 내 기록 전달
  return res.status(200).json(RECENT_SECURITY_EVENTS);
}
