/**
 * /api/ai/connection
 * 17단계: 앱 서버를 통한 수업용 AI 연결 점검 엔드포인트
 * 
 * 확인되지 않은 상태나 누락된 필드를 성공으로 임의 보정하지 않고,
 * 실제 수업용 AI 게이트웨이 응답의 권한(test/verified)과 모델 수(number)를 엄격히 검증하여 전달합니다.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: '허용되지 않는 메소드입니다.' });
  }

  // 수업용 AI 게이트웨이 주소 결정
  const gatewayUrl = process.env.AI_GATEWAY_URL ||
    process.env.ALEPH_AI_GATEWAY ||
    'https://aleph-judge-production.up.railway.app/defense/ai';

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
    }).catch(() => null);

    // 게이트웨이 통신 실패 또는 비정상 응답 시 성공으로 보정하지 않고 오류 반환
    if (!response || !response.ok) {
      const errBody = response ? await response.json().catch(() => ({})) : {};
      const statusCode = (response && (response.status === 401 || response.status === 403)) ? response.status : 503;
      return res.status(statusCode).json({
        code: errBody.code || (response && (response.status === 401 || response.status === 403) ? 'UNAUTHORIZED' : 'AUTH_PENDING'),
        message: errBody.message || '운영 측 수업용 AI 게이트웨이 연결 및 계정 권한 확인 준비 중입니다.'
      });
    }

    const data = await response.json().catch(() => null);

    // 게이트웨이 응답 필드 엄격 검증: 권한 종류(test/verified)나 모델 수가 누락되면 성공으로 임의 보정하지 않음
    const isValidAuth = data && (data.audienceAuthorization === 'test' || data.audienceAuthorization === 'verified');
    const isValidModelCount = data && typeof data.modelCount === 'number';

    if (!isValidAuth || !isValidModelCount) {
      return res.status(503).json({
        code: 'AUTH_PENDING',
        message: '게이트웨이 응답에서 계정 권한(audienceAuthorization) 또는 모델 수(modelCount)가 확인되지 않았습니다.'
      });
    }

    // 실제로 검증된 값만 전달
    return res.status(200).json({
      transportChecked: Boolean(data.transportChecked),
      audienceAuthorization: data.audienceAuthorization,
      modelCount: data.modelCount,
      help: data.help || '수업용 AI 게이트웨이 연결 확인 완료'
    });
  } catch (err) {
    return res.status(503).json({
      code: err.name === 'TimeoutError' ? 'TIMEOUT' : 'AUTH_PENDING',
      message: '수업용 AI 게이트웨이에 연결할 수 없거나 계정 권한이 아직 준비되지 않았습니다.'
    });
  }
}
