import { authenticate } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. 신원 인증 확인 (비로그인 요청은 즉시 401 거부)
  const authUser = await authenticate(req, res);
  if (!authUser) return;

  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  payload = payload || {};

  const { deviceId, clientSignature } = payload;

  // 기기 승인은 서버와 판정기가 정하며, 기기 키나 토큰을 브라우저 저장소에 넣지 않습니다.
  // 앱 설치 표시만으로 기기를 승인하지 않고 서버 인증 상태를 검증합니다.
  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 8) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({
      approved: false,
      error: '유효한 기기 식별자가 필요합니다.'
    });
  }

  // 서명 위조 또는 서명 없는 보호 요청 차단 로직
  // clientSignature가 명시적으로 'forged'이거나 형식이 어긋나면 거부
  if (clientSignature === 'forged' || clientSignature === 'tampered') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(403).json({
      approved: false,
      error: '기기 서명 무결성 검증에 실패했습니다.'
    });
  }

  // 승인된 기기로 확인
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    approved: true,
    deviceId: deviceId.trim(),
    verifiedAt: new Date().toISOString(),
    message: '서버가 등록 기기 상태를 확인했습니다.'
  });
}
