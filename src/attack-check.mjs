export async function runAttackChecks(config) {
  if (config.step !== 1 && config.step !== 3 && config.step !== 4 && config.step !== 5 && config.step !== 6 && config.step !== 7 && config.step !== 8 && config.step !== 9 && config.step !== 10 && config.step !== 11 && config.step !== 12) {
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

  // 1. 정적 /data.json 메모 노출 여부 점검 (격리 환경 요청 미기록 시 not_run 처리)
  results.push({
    attackId: 'anonymous_static_notes',
    expected: '정적 /data.json에 메모 내용이 없어야 함',
    observed: 'not_run',
  });

  // 2. 비로그인 GET /api/notes 접근 차단 점검 (격리 환경 요청 미기록 시 not_run 처리)
  results.push({
    attackId: 'anonymous_notes_get_blocked',
    expected: '비로그인 GET 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: 'not_run',
  });

  // 3. 비로그인 POST /api/notes 추가 차단 점검 (격리 환경 쓰기 요청 제한으로 not_run 처리)
  results.push({
    attackId: 'anonymous_notes_post_blocked',
    expected: '비로그인 POST 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: 'not_run',
  });

  // 4. 비로그인 단건 GET /api/notes/:id 차단 점검 (격리 환경 요청 미기록 시 not_run 처리)
  results.push({
    attackId: 'anonymous_single_get_blocked',
    expected: '비로그인 단건 GET 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: 'not_run',
  });

  // 5. 비로그인 단건 PUT /api/notes/:id 차단 점검 (격리 환경 쓰기 요청 제한으로 not_run 처리)
  results.push({
    attackId: 'anonymous_single_put_blocked',
    expected: '비로그인 PUT 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: 'not_run',
  });

  // 6. 비로그인 단건 DELETE /api/notes/:id 차단 점검 (격리 환경 쓰기 요청 제한으로 not_run 처리)
  results.push({
    attackId: 'anonymous_single_delete_blocked',
    expected: '비로그인 DELETE 요청 시 401 또는 403 JSON 오류로 거부되어야 함',
    observed: 'not_run',
  });

  // 7. 원본 자료 API 직접 조회 차단 점검 (격리 환경 요청 미기록 시 not_run 처리)
  if (config.step >= 5 && config.originalApiUrl) {
    results.push({
      attackId: 'anonymous_original_api_blocked',
      expected: '원본 API 직접 GET 요청 시 비인가(401/403) 또는 자료 미노출이어야 함',
      observed: 'not_run',
    });
  }

  // 8. 8단계 구역 격리 점검: 공지 ID로 메모 API 접근 및 공지 수정 차단 점검
  if (config.step >= 8) {
    results.push({
      attackId: 'cross_zone_note_read_blocked',
      expected: '공지 ID로 메모 조회 시 401 또는 403으로 차단되어야 함',
      observed: 'not_run',
    });

    results.push({
      attackId: 'cross_zone_note_modify_blocked',
      expected: '공지 ID로 메모 수정 시 401 또는 403으로 차단되어야 함',
      observed: 'not_run',
    });

    results.push({
      attackId: 'notice_modify_blocked',
      expected: '학생/비인가 공지 수정 시 401 또는 403으로 차단되어야 함',
      observed: 'not_run',
    });
  }

  // 9. 10단계 복구 경로 및 복구 뒤 재시험 점검 (정상 요청 및 금지 요청)
  if (config.step >= 10 && config.restoreRoute) {
    results.push({
      attackId: 'restore_valid_note_allowed',
      expected: '사본과 일치하는 ID·소유자·내용 해시 요청 시 200 성공 및 복원 데이터 반환',
      observed: 'not_run',
    });

    results.push({
      attackId: 'restore_forged_hash_blocked',
      expected: '위조된 내용 해시로 복구 요청 시 400 또는 403으로 거부되어야 함',
      observed: 'not_run',
    });

    results.push({
      attackId: 'restore_unknown_id_blocked',
      expected: '사본에 없는 ID 복구 요청 시 404 또는 400으로 거부되어야 함',
      observed: 'not_run',
    });

    results.push({
      attackId: 'restore_retest_unauthorized_blocked',
      expected: '복구 완료 후에도 비로그인 메모 접근은 401 또는 403으로 거부되어야 함',
      observed: 'not_run',
    });
  }

  // 10. 11단계: 설치형 웹앱 manifest 및 기기 승인 검증 점검
  if (config.step >= 11) {
    results.push({
      attackId: 'pwa_manifest_valid',
      expected: '배포 사이트의 /manifest.json이 200 응답 및 standalone 설정을 포함해야 함',
      observed: 'not_run',
    });

    results.push({
      attackId: 'unauthenticated_device_verify_blocked',
      expected: '비로그인 기기 승인 요청 시 401 Unauthorized로 거부되어야 함',
      observed: 'not_run',
    });
  }

  // 11. 12단계: 탈환 작전실 요약 API 정상 응답 및 가상 메모 본문 미노출 점검
  if (config.step >= 12) {
    results.push({
      attackId: 'ops_summary_verified',
      expected: '작전실 요약 API가 가상 메모 본문 없이 판정기·탐지·회수·복구 메타데이터만 반환해야 함',
      observed: 'not_run',
    });
  }

  return results;
}
