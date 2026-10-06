export async function runAttackChecks(config) {
  if (config.step !== 2) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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

  let apiNotesVisible = false;
  let apiStatus = 0;
  try {
    const res = await fetch(new URL('/api/notes', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    apiStatus = res.status;
    if (res.ok) {
      const data = await res.json();
      apiNotesVisible = Array.isArray(data.notes) && data.notes.length > 0;
    }
  } catch {
    apiNotesVisible = false;
  }

  results.push({
    attackId: 'public_api_notes_exposed',
    expected: '공개 /api/notes 호출 시 메모 조회가 가능하나 인증 없는 약점이 관찰됨',
    observed: apiNotesVisible
      ? '서버 API를 통해 메모가 조회되며 누구나 호출 가능한 상태가 관찰됨'
      : `서버 API 호출 실패 또는 메모 없음 (HTTP ${apiStatus})`,
  });

  return results;
}
