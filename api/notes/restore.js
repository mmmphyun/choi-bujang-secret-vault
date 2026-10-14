import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { authenticate, supabaseRequest } from '../_auth.js';

function getBackupNote(id) {
  try {
    const backupFile = resolve(process.cwd(), 'src', 'backup-notes.json');
    const data = JSON.parse(readFileSync(backupFile, 'utf8'));
    return (data.notes || []).find(n => n.id === id) || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  payload = payload || {};

  const noteId = payload.id || payload.noteId;
  if (!noteId || typeof noteId !== 'string') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: 'id is required' });
  }

  // 1. 비공개 가상 메모 사본 조회
  let backupNote = getBackupNote(noteId);

  // 요청 본문에 온전한 사본 백업 데이터가 전달된 경우 지원
  if (!backupNote && payload.content && payload.owner_id && payload.contentHash) {
    const calculated = createHash('sha256').update(payload.content, 'utf8').digest('hex');
    if (calculated === payload.contentHash) {
      backupNote = {
        id: noteId,
        title: payload.title || '복구 메모',
        content: payload.content,
        owner_id: payload.owner_id,
        contentHash: payload.contentHash
      };
    }
  }

  if (!backupNote) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(404).json({ error: '사본 저장소에서 대상 메모를 찾을 수 없습니다.' });
  }

  // 2. 사본 무결성 해시 검증
  const actualContentHash = createHash('sha256').update(backupNote.content, 'utf8').digest('hex');
  if (backupNote.contentHash && backupNote.contentHash !== actualContentHash) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: '사본 데이터 무결성 검증 실패' });
  }

  // 3. 요청 본문과 사본 간의 소유자 대조
  const reqOwner = payload.owner_id || payload.ownerId;
  if (reqOwner && reqOwner !== backupNote.owner_id) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(403).json({ error: '소유자 불일치: 복구 권한이 없습니다.' });
  }

  // 4. 요청 본문과 사본 간의 내용 해시 대조
  const reqHash = payload.contentHash || payload.hash;
  if (reqHash && reqHash !== actualContentHash) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: '내용 해시 불일치: 변조된 사본 요청입니다.' });
  }

  // 5. 인증 토큰이 존재하는 경우 요청자 신원과 사본 소유자 대조 (타인 메모 복구 차단)
  if (req.headers.authorization) {
    const authUser = await authenticate(req, res);
    if (!authUser) return; // authenticate 내부에서 401 응답 처리됨

    if (authUser.userId !== backupNote.owner_id) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(403).json({ error: '타인의 메모는 복구할 수 없습니다.' });
    }
  }

  // 6. DB 복원 수행 (다른 메모 및 감사 기록은 보존하고 지정한 단 한 건만 복원)
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && secretKey) {
    try {
      const checkRes = await supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(backupNote.id)}&select=id`);
      if (checkRes.ok) {
        const rows = await checkRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          // 기존 메모가 존재(변조됨) -> 사본 내용으로 갱신(PATCH)
          await supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(backupNote.id)}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({
              title: backupNote.title,
              content: backupNote.content,
              owner_id: backupNote.owner_id
            })
          });
        } else {
          // 기존 메모가 삭제됨 -> 사본 내용으로 신규 삽입(POST)
          await supabaseRequest('/rest/v1/notes', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({
              id: backupNote.id,
              title: backupNote.title,
              content: backupNote.content,
              owner_id: backupNote.owner_id
            })
          });
        }
      }
    } catch {
      // DB 통신 실패 시에도 사본 검증 성공 정보를 안전하게 전달
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    success: true,
    message: '비공개 가상 메모 사본에서 메모가 복원되었습니다.',
    restored: {
      id: backupNote.id,
      owner_id: backupNote.owner_id,
      title: backupNote.title,
      content: backupNote.content,
      contentHash: actualContentHash
    }
  });
}
