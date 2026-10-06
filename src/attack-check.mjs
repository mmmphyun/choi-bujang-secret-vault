export async function runAttackChecks(config) {
  if (config.step !== 1 && config.step !== 3 && config.step !== 4 && config.step !== 5) {
    throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  }
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

  if (config.step === 1) {
    const res = await fetch(new URL('/data.json', app), { redirect: 'error' });
    const text = await res.text();
    const hasMarker = text.includes(config.sampleMarker);
    return [{
      attackId: 'anonymous_sample_marker',
      expected: '공개 data.json에서 확인 표시가 보여야 함',
      observed: hasMarker ? '확인 표시가 보임' : '보이지 않음',
    }];
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

  // 2. 비로그인 GET /api/notes 접근 차단 점검 (3단계 방어 유지)
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

  // 3. 비로그인 POST /api/notes 추가 차단 점검 (3단계 방어 유지)
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

  // 4. 비로그인 단건 GET /api/notes/:id 차단 점검 (4단계)
  let singleGetStatus = 0;
  let singleGetBody = '';
  try {
    const res = await fetch(new URL('/api/notes/00000000-0000-0000-0000-000000000000', app), {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    singleGetStatus = res.status;
    const body = await res.json().catch(() => ({}));
    singleGetBody = body.error || '';
  } catch {
    singleGetStatus = 0;
  }

  results.push({
    attackId: 'anonymous_single_get_blocked',
    expected: '비로그인 단건 GET 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: (singleGetStatus === 401 || singleGetStatus === 403)
      ? `비로그인 단건 조회가 거부됨 (HTTP ${singleGetStatus}, ${singleGetBody})`
      : `비로그인 단건 조회가 거부되지 않음 (HTTP ${singleGetStatus})`,
  });

  // 5. 비로그인 단건 PUT /api/notes/:id 차단 점검 (4단계)
  let singlePutStatus = 0;
  let singlePutBody = '';
  try {
    const res = await fetch(new URL('/api/notes/00000000-0000-0000-0000-000000000000', app), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '변조 시도', body: '수정 시도' }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    singlePutStatus = res.status;
    const body = await res.json().catch(() => ({}));
    singlePutBody = body.error || '';
  } catch {
    singlePutStatus = 0;
  }

  results.push({
    attackId: 'anonymous_single_put_blocked',
    expected: '비로그인 PUT 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: (singlePutStatus === 401 || singlePutStatus === 403)
      ? `비로그인 수정이 거부됨 (HTTP ${singlePutStatus}, ${singlePutBody})`
      : `비로그인 수정이 거부되지 않음 (HTTP ${singlePutStatus})`,
  });

  // 6. 비로그인 단건 DELETE /api/notes/:id 차단 점검 (4단계)
  let singleDelStatus = 0;
  let singleDelBody = '';
  try {
    const res = await fetch(new URL('/api/notes/00000000-0000-0000-0000-000000000000', app), {
      method: 'DELETE',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    singleDelStatus = res.status;
    const body = await res.json().catch(() => ({}));
    singleDelBody = body.error || '';
  } catch {
    singleDelStatus = 0;
  }

  results.push({
    attackId: 'anonymous_single_delete_blocked',
    expected: '비로그인 DELETE 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: (singleDelStatus === 401 || singleDelStatus === 403)
      ? `비로그인 삭제가 거부됨 (HTTP ${singleDelStatus}, ${singleDelBody})`
      : `비로그인 삭제가 거부되지 않음 (HTTP ${singleDelStatus})`,
  });

  // 7. 원본 자료 API 직접 조회 차단 점검 (5단계)
  if (config.step >= 5 && config.originalApiUrl) {
    let originalStatus = 0;
    let originalHasNotes = false;
    let originalError = '';
    try {
      const res = await fetch(config.originalApiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      originalStatus = res.status;
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        originalHasNotes = true;
      } else if (data && typeof data === 'object') {
        originalError = data.message || data.error || data.msg || '';
      }
    } catch (e) {
      originalError = e.message || '요청 실패';
    }

    results.push({
      attackId: 'anonymous_original_api_blocked',
      expected: '원본 API 직접 GET 요청 시 비인가(401/403) 또는 자료 미노출이어야 함',
      observed: (!originalHasNotes && (originalStatus === 401 || originalStatus === 403 || originalStatus === 400 || originalStatus === 404 || originalError))
        ? `원본 자료 직접 조회가 차단됨 (HTTP ${originalStatus}, ${originalError || '자료 0건'})`
        : (originalHasNotes ? '원본 자료가 비인가 상태로 직접 조회됨' : `응답 상태 HTTP ${originalStatus}`),
    });
  }

  return results;
}
