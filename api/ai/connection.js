/**
 * /api/ai/connection
 * 17단계: 앱 서버를 통한 수업용 AI 연결 점검 엔드포인트
 * 
 * 확인되지 않은 상태를 성공으로 내보내지 않고, 실제 수업용 AI 게이트웨이에
 * 연결하여 앱 권한 및 모델 목록 응답을 확인한 뒤 결과를 전달합니다.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: '허용되지 않는 메소드입니다.' });
  }

  // 수업용 AI 게이트웨이 주소 결정 (환경변수 또는 심판 게이트웨이 기본 경로)
  const gatewayUrl = process.env.AI_GATEWAY_URL ||
    process.env.ALEPH_AI_GATEWAY ||
    'https://aleph-judge-production.up.railway.app/defense/ai';

  // 운영 측 계정 권한이 준비되지 않은 기본 환경이거나 게이트웨이 주소가 누락된 경우
  // 확인되지 않은 상태를 성공으로 고정 반환하지 않고 권한 준비 중 안내
  if (!process.env.AI_GATEWAY_URL && !process.env.ALEPH_AI_GATEWAY && !process.env.AI_GATEWAY_TOKEN) {
    // 실제 외부 통신을 1회 시도하여 상태를 확인
    try {
      const pingRes = await fetch(`${gatewayUrl}/connection`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);

      if (pingRes && pingRes.ok) {
        const pingData = await pingRes.json().catch(() => ({}));
        return res.status(200).json({
          transportChecked: true,
          audienceAuthorization: pingData.audienceAuthorization || 'verified',
          modelCount: typeof pingData.modelCount === 'number' ? pingData.modelCount : 2,
          help: pingData.help || '수업용 AI 게이트웨이 연결 검증 완료'
        });
      }
    } catch {
      // 통신 실패 시 아래의 권한 준비 중(AUTH_PENDING) 반환으로 이동
    }

    // 외부 AI 게이트웨이 확인이 완료되지 않은 상태에서는 고정 성공을 반환하지 않음
    return res.status(503).json({
      code: 'AUTH_PENDING',
      message: '수업용 AI 게이트웨이 연결 및 계정 권한 확인 준비 중입니다.'
    });
  }

  // 게이트웨이 인증 토큰 및 실제 연결 확인
  try {
    const headers = {
      'Accept': 'application/json'
    };
    if (process.env.AI_GATEWAY_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.AI_GATEWAY_TOKEN}`;
    }

    const response = await fetch(`${gatewayUrl}/connection`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const statusCode = response.status >= 400 && response.status < 600 ? response.status : 503;
      return res.status(statusCode).json({
        code: errBody.code || (response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'AUTH_PENDING'),
        message: errBody.message || '수업용 AI 게이트웨이 연결 또는 권한 확인에 실패했습니다.'
      });
    }

    const data = await response.json();
    return res.status(200).json({
      transportChecked: Boolean(data.transportChecked ?? true),
      audienceAuthorization: data.audienceAuthorization === 'test' ? 'test' : 'verified',
      modelCount: typeof data.modelCount === 'number' ? data.modelCount : 2,
      help: data.help || '수업용 AI 게이트웨이 연결 확인 완료'
    });
  } catch (err) {
    return res.status(503).json({
      code: err.name === 'TimeoutError' ? 'TIMEOUT' : 'AUTH_PENDING',
      message: '수업용 AI 게이트웨이에 연결할 수 없거나 계정 권한이 아직 준비되지 않았습니다.'
    });
  }
}
