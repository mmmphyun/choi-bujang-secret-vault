export async function runAttackChecks(config) {
  if (config.step !== 3) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }

  const results = [];

  // 1. 정적 /data.json 메모 노출 여부 점검 (2단계 방어 유지)
  let staticHasNotes = false;
  try {
    const res = await fetch(new URL('/data.json', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      staticHasNotes = Array.isArray(data.notes) && data.notes.length > 0;
    }
  } catch {
    staticHasNotes = false;
  }

  results.push({
    attackId: 'anonymous_static_notes',
    expected: '정적 /data.json에 메모 내용이 없어야 함',
    observed: staticHasNotes ? '정적 파일에 여전히 메모가 남아있음' : '정적 파일에서 메모가 성공적으로 제거됨',
  });

  // 2. 비로그인 GET /api/notes 접근 차단 점검 (3단계 방어)
  let getStatus = 0;
  let getErrorBody = '';
  try {
    const res = await fetch(new URL('/api/notes', app), {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    getStatus = res.status;
    const body = await res.json().catch(() => ({}));
    getErrorBody = body.error || '';
  } catch {
    getStatus = 0;
  }

  results.push({
    attackId: 'anonymous_notes_get_blocked',
    expected: '비로그인 GET 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: (getStatus === 401 || getStatus === 403)
      ? `비로그인 조회가 거부됨 (HTTP ${getStatus}, ${getErrorBody})`
      : `비로그인 조회가 거부되지 않음 (HTTP ${getStatus})`,
  });

  // 3. 비로그인 POST /api/notes 추가 차단 점검 (3단계 방어)
  let postStatus = 0;
  let postErrorBody = '';
  try {
    const res = await fetch(new URL('/api/notes', app), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '공격 시도 메모', body: '미인증 생성 시도' }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    postStatus = res.status;
    const body = await res.json().catch(() => ({}));
    postErrorBody = body.error || '';
  } catch {
    postStatus = 0;
  }

  results.push({
    attackId: 'anonymous_notes_post_blocked',
    expected: '비로그인 POST 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: (postStatus === 401 || postStatus === 403)
      ? `비로그인 생성이 거부됨 (HTTP ${postStatus}, ${postErrorBody})`
      : `비로그인 생성이 거부되지 않음 (HTTP ${postStatus})`,
  });

  return results;
}
