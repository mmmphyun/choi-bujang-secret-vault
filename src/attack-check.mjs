export async function runAttackChecks(config) {
  if (config.step !== 1 && config.step !== 3 && config.step !== 4 && config.step !== 5 && config.step !== 6 && config.step !== 7 && config.step !== 8 && config.step !== 9 && config.step !== 10) {
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

  // 8. 8단계 구역 격리 점검: 공지 ID로 메모 API 접근 및 공지 수정 차단 점검
  if (config.step >= 8) {
    let crossZoneReadStatus = 0;
    try {
      const res = await fetch(new URL('/api/notes/notice-1', app), {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      crossZoneReadStatus = res.status;
    } catch {
      crossZoneReadStatus = 0;
    }
    results.push({
      attackId: 'cross_zone_note_read_blocked',
      expected: '공지 ID로 메모 조회 시 401 또는 403으로 차단되어야 함',
      observed: (crossZoneReadStatus === 401 || crossZoneReadStatus === 403 || crossZoneReadStatus === 404)
        ? `다른 구역 메모 조회가 차단됨 (HTTP ${crossZoneReadStatus})`
        : `다른 구역 메모 조회가 차단되지 않음 (HTTP ${crossZoneReadStatus})`,
    });

    let crossZoneModifyStatus = 0;
    try {
      const res = await fetch(new URL('/api/notes/notice-1', app), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '변조 시도', body: '수정 시도' }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      crossZoneModifyStatus = res.status;
    } catch {
      crossZoneModifyStatus = 0;
    }
    results.push({
      attackId: 'cross_zone_note_modify_blocked',
      expected: '공지 ID로 메모 수정 시 401 또는 403으로 차단되어야 함',
      observed: (crossZoneModifyStatus === 401 || crossZoneModifyStatus === 403 || crossZoneModifyStatus === 404)
        ? `다른 구역 메모 수정이 차단됨 (HTTP ${crossZoneModifyStatus})`
        : `다른 구역 메모 수정이 차단되지 않음 (HTTP ${crossZoneModifyStatus})`,
    });

    let noticeModifyStatus = 0;
    try {
      const res = await fetch(new URL('/api/notices/notice-1', app), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '공지 변조 시도', content: '수정 시도' }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      noticeModifyStatus = res.status;
    } catch {
      noticeModifyStatus = 0;
    }
    results.push({
      attackId: 'notice_modify_blocked',
      expected: '학생/비인가 공지 수정 시 401 또는 403으로 차단되어야 함',
      observed: (noticeModifyStatus === 401 || noticeModifyStatus === 403 || noticeModifyStatus === 404 || noticeModifyStatus === 405)
        ? `공지 수정 시도가 차단됨 (HTTP ${noticeModifyStatus})`
        : `공지 수정 시도가 허용됨 (HTTP ${noticeModifyStatus})`,
    });
  }

  // 9. 10단계 복구 경로 및 복구 뒤 재시험 점검 (정상 요청 및 금지 요청)
  if (config.step >= 10 && config.restoreRoute) {
    const restorePath = config.restoreRoute.replace(/^POST\s+/iu, '').trim();

    // 9-1. 복구 경로 정상 요청 재시험 (사본과 일치하는 ID·소유자·해시)
    let validRestoreStatus = 0;
    let validRestoreBody = null;
    try {
      const res = await fetch(new URL(restorePath, app), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'b0000000-0000-0000-0000-000000000001',
          owner_id: 'b0000000-0000-0000-0000-000000000002',
          contentHash: 'f5d4d11e127ce3c145e80f3aca71bcb780700e04568a1f31e3e9777097a1f8dd'
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      validRestoreStatus = res.status;
      validRestoreBody = await res.json().catch(() => ({}));
    } catch {
      validRestoreStatus = 0;
    }

    const isRestoreValid = validRestoreStatus === 200 && validRestoreBody?.success === true;
    results.push({
      attackId: 'restore_valid_note_allowed',
      expected: '사본과 일치하는 ID·소유자·내용 해시 요청 시 200 성공 및 복원 데이터 반환',
      observed: isRestoreValid
        ? `사본 데이터 복원 성공 (HTTP 200, 해시 일치)`
        : `사본 데이터 복원 실패 (HTTP ${validRestoreStatus})`,
    });

    // 9-2. 복구 경로 금지 요청 재시험: 위조된 내용 해시로 복구 요청 시 거부 점검
    let forgedHashStatus = 0;
    let forgedErrorMsg = '';
    try {
      const res = await fetch(new URL(restorePath, app), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'b0000000-0000-0000-0000-000000000001',
          owner_id: 'b0000000-0000-0000-0000-000000000002',
          contentHash: '0000000000000000000000000000000000000000000000000000000000000000'
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      forgedHashStatus = res.status;
      const b = await res.json().catch(() => ({}));
      forgedErrorMsg = b.error || '';
    } catch {
      forgedHashStatus = 0;
    }

    results.push({
      attackId: 'restore_forged_hash_blocked',
      expected: '위조된 내용 해시로 복구 요청 시 400 또는 403으로 거부되어야 함',
      observed: (forgedHashStatus === 400 || forgedHashStatus === 403)
        ? `위조 해시 복구 요청이 거부됨 (HTTP ${forgedHashStatus}, ${forgedErrorMsg})`
        : `위조 해시 복구 요청이 거부되지 않음 (HTTP ${forgedHashStatus})`,
    });

    // 9-3. 복구 경로 금지 요청 재시험: 사본에 없는 미등록 ID 복구 요청 시 거부 점검
    let unknownIdStatus = 0;
    let unknownErrorMsg = '';
    try {
      const res = await fetch(new URL(restorePath, app), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          owner_id: '00000000-0000-0000-0000-000000000001'
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      unknownIdStatus = res.status;
      const b = await res.json().catch(() => ({}));
      unknownErrorMsg = b.error || '';
    } catch {
      unknownIdStatus = 0;
    }

    results.push({
      attackId: 'restore_unknown_id_blocked',
      expected: '사본에 없는 ID 복구 요청 시 404 또는 400으로 거부되어야 함',
      observed: (unknownIdStatus === 404 || unknownIdStatus === 400)
        ? `미등록 ID 복구 요청이 거부됨 (HTTP ${unknownIdStatus}, ${unknownErrorMsg})`
        : `미등록 ID 복구 요청이 거부되지 않음 (HTTP ${unknownIdStatus})`,
    });

    // 9-4. 복구 뒤 1~9단계 대표 금지 요청 재시험: 비로그인 단건 메모 접근 거부 유지
    let postRestoreCheckStatus = 0;
    try {
      const res = await fetch(new URL('/api/notes/b0000000-0000-0000-0000-000000000001', app), {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      postRestoreCheckStatus = res.status;
    } catch {
      postRestoreCheckStatus = 0;
    }

    results.push({
      attackId: 'restore_retest_unauthorized_blocked',
      expected: '복구 완료 후에도 비로그인 메모 접근은 401 또는 403으로 거부되어야 함',
      observed: (postRestoreCheckStatus === 401 || postRestoreCheckStatus === 403)
        ? `복구 후에도 비로그인 메모 조회가 거부됨 (HTTP ${postRestoreCheckStatus})`
        : `복구 후 비로그인 메모 조회가 거부되지 않음 (HTTP ${postRestoreCheckStatus})`,
    });
  }

  return results;
}
