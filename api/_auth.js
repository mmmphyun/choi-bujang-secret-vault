import { readFileSync } from 'node:fs';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));

let verifier;
function getVerifier() {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) return null;
  if (!verifier) {
    verifier = createLoginVerifier({
      config,
      supabaseSecretKey: secretKey,
    });
  }
  return verifier;
}

export async function authenticate(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    return null;
  }

  const verify = getVerifier();
  if (!verify) {
    res.status(500).json({ error: 'Server configuration error' });
    return null;
  }

  let authUser;
  try {
    authUser = await verify(authHeader);
  } catch {
    res.status(500).json({ error: '인증 검증 서버 오류' });
    return null;
  }

  if (!authUser) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    return null;
  }

  return authUser;
}

export async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error('Database configuration missing');
  }

  const url = new URL(path, supabaseUrl);
  const headers = {
    'apikey': secretKey,
    'Authorization': `Bearer ${secretKey}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
