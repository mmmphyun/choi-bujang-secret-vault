export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: '인증 서버 설정이 누락되었습니다.' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  payload = payload || {};

  const { email, password } = payload;
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해 주세요.' });
  }

  try {
    const authEndpoint = new URL('/auth/v1/token?grant_type=password', supabaseUrl);
    const response = await fetch(authEndpoint, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error_description || data.msg || data.message || '로그인에 실패했습니다.';
      return res.status(response.status).json({ error: message });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch {
    return res.status(500).json({ error: '인증 처리 중 서버 오류가 발생했습니다.' });
  }
}
