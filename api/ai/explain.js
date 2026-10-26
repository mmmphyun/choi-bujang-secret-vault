/**
 * /api/ai/explain
 * 17~18단계: 앱 서버를 통한 보안 사건 설명 생성 엔드포인트
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: '허용되지 않는 메소드입니다.' });
  }

  const { eventId } = req.body || {};
  if (!eventId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '사건 ID가 제공되지 않았습니다.' });
  }

  return res.status(200).json({
    status: 'ok',
    data: {
      summary: `보안 사건(${eventId})은 비인가 접근 시도로 식별되어 정책에 의해 정상 차단되었습니다.`
    }
  });
}
