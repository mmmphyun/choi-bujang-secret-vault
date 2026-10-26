/**
 * 15단계: 접속 기록 및 XDR 경보 목록과 상세 보기 확장
 * 대상 함수: createStudentView, renderEvents
 */

/**
 * 상태값(state: access, session, device) 한국어 설명 및 원래 코드 보존 헬퍼
 * @param {'access'|'session'|'device'} type 
 * @param {string} val 
 * @returns {string}
 */
export function formatStateValue(type, val) {
  if (!val || val === 'unknown') {
    return '확인 불가(unknown)';
  }

  // 1. 접속(access) 상태
  if (type === 'access') {
    if (val === 'allowed') return '허용(allowed)';
    if (val === 'denied') return '거부(denied)';
    return `${val}`;
  }

  // 2. 세션(session) 상태 (13단계 계약)
  if (type === 'session') {
    if (val === 'active') return '유효(active)';
    if (val === 'valid') return '유효(valid)';
    if (val === 'expired') return '만료(expired)';
    if (val === 'revoked') return '회수(revoked)';
    if (val === 'step_up' || val === 'step_up_required') return '추가 인증 필요(step_up_required)';
    if (val === 'invalid') return '유효하지 않음(invalid)';
    return `${val}`;
  }

  // 3. 기기(device) 상태 (13단계 계약)
  if (type === 'device') {
    if (val === 'registered') return '등록됨(registered)';
    if (val === 'approved') return '승인됨(approved)';
    if (val === 'unregistered') return '미등록(unregistered)';
    if (val === 'unapproved') return '미승인(unapproved)';
    if (val === 'blocked') return '차단됨(blocked)';
    if (val === 'denied') return '거부됨(denied)';
    return `${val}`;
  }

  return String(val);
}

/**
 * 종류(kind) 레이블 한국어 변환 헬퍼
 * @param {string} kind 
 * @returns {string}
 */
export function formatKind(kind) {
  if (kind === 'access') {
    return '접속 기록 (access)';
  }
  if (kind === 'xdr') {
    return 'XDR 경보 (xdr)';
  }
  return String(kind || '미지정');
}

/**
 * 접속 기록 및 XDR 경보 목록과 상세 정보 렌더링 함수
 * 독립적인 DOM 요소를 생성하여 반환하며, targetContainer가 주어지면 기존 내용을 교체하여 마운트합니다.
 * 
 * @param {Object} params
 * @param {'ok'|'error'|'loading'|'CONTRACT_MISMATCH'} params.status
 * @param {string} [params.mode]
 * @param {Array<Object>} [params.data]
 * @param {Object|string} [params.error]
 * @param {HTMLElement} [targetContainer]
 * @returns {HTMLElement} 생성된 최상위 뷰 요소
 */
export function renderEvents({ status, mode, data, error }, targetContainer) {
  const container = targetContainer ||
    document.getElementById('events-container') ||
    document.getElementById('student-events') ||
    document.querySelector('[data-student-events]');

  // 이전 컨테이너 내용 비우기
  if (container) {
    container.textContent = '';
  }

  // 1. 계약 불일치 상태 처리 (status가 CONTRACT_MISMATCH이거나 error.code가 CONTRACT_MISMATCH인 경우)
  if (status === 'CONTRACT_MISMATCH' || error?.code === 'CONTRACT_MISMATCH') {
    const mismatchEl = document.createElement('div');
    mismatchEl.className = 'events-contract-mismatch';
    const errorMsg = error && typeof error === 'object' && error.message ? `: ${error.message}` : (typeof error === 'string' ? `: ${error}` : '');
    mismatchEl.textContent = `확인 불가(CONTRACT_MISMATCH): 계약 불일치 상태입니다.${errorMsg}`.trim();
    if (container) container.appendChild(mismatchEl);
    return mismatchEl;
  }

  // 2. 로딩 상태 별도 처리 (status 또는 mode가 loading인 경우)
  if (status === 'loading' || mode === 'loading') {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'events-loading';
    loadingEl.textContent = '기록을 불러오는 중입니다...';
    if (container) container.appendChild(loadingEl);
    return loadingEl;
  }

  // 3. 일반 오류 상태 처리
  if (status === 'error') {
    const errorEl = document.createElement('div');
    errorEl.className = 'events-error';
    const errorMsg = error && typeof error === 'object' && error.message ? error.message : String(error || '');
    errorEl.textContent = `기록을 불러오지 못했습니다: ${errorMsg}`.trim();
    if (container) container.appendChild(errorEl);
    return errorEl;
  }

  // 4. status가 ok인 빈 배열 상태 처리 (빈 목록 안내 단독 표시)
  if (status === 'ok' && (!Array.isArray(data) || data.length === 0)) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'events-empty';
    emptyEl.textContent = '표시할 기록이 없습니다';
    if (container) container.appendChild(emptyEl);
    return emptyEl;
  }

  // 데이터 기본 보정
  const eventList = Array.isArray(data) ? data : [];
  if (eventList.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'events-empty';
    emptyEl.textContent = '표시할 기록이 없습니다';
    if (container) container.appendChild(emptyEl);
    return emptyEl;
  }

  // 5. 원본 배열 보존 및 at 기준 최신순 복사 정렬
  const rawEvents = [...eventList].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // 필터 및 상세 선택 상태
  let filterKind = 'all';
  let filterApp = 'all';
  let filterAccess = 'all';
  let selectedDetailId = null;

  // 독립 루트 래퍼 요소 생성
  const rootWrapper = document.createElement('div');
  rootWrapper.className = 'student-events-wrapper';

  // 6. 필터 컨트롤 영역 구성
  const filterSection = document.createElement('section');
  filterSection.className = 'student-events-filters';

  // 1) 기록 종류 필터
  const kindFilterWrap = document.createElement('div');
  kindFilterWrap.className = 'filter-group';
  const kindLabel = document.createElement('label');
  kindLabel.htmlFor = 'student-filter-kind';
  kindLabel.textContent = '기록 종류';
  const kindSelect = document.createElement('select');
  kindSelect.id = 'student-filter-kind';
  kindSelect.setAttribute('aria-label', '기록 종류');
  const kindDefaultOpt = document.createElement('option');
  kindDefaultOpt.value = 'all';
  kindDefaultOpt.textContent = '전체';
  kindSelect.appendChild(kindDefaultOpt);

  const uniqueKinds = Array.from(new Set(rawEvents.map(e => e.kind).filter(Boolean)));
  for (const k of uniqueKinds) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = formatKind(k);
    kindSelect.appendChild(opt);
  }
  kindFilterWrap.appendChild(kindLabel);
  kindFilterWrap.appendChild(kindSelect);

  // 2) 업무 앱 필터
  const appFilterWrap = document.createElement('div');
  appFilterWrap.className = 'filter-group';
  const appLabel = document.createElement('label');
  appLabel.htmlFor = 'student-filter-app';
  appLabel.textContent = '업무 앱';
  const appSelect = document.createElement('select');
  appSelect.id = 'student-filter-app';
  appSelect.setAttribute('aria-label', '업무 앱');
  const appDefaultOpt = document.createElement('option');
  appDefaultOpt.value = 'all';
  appDefaultOpt.textContent = '전체';
  appSelect.appendChild(appDefaultOpt);

  const uniqueApps = Array.from(new Set(rawEvents.map(e => e.appId).filter(Boolean)));
  for (const app of uniqueApps) {
    const opt = document.createElement('option');
    opt.value = app;
    opt.textContent = app;
    appSelect.appendChild(opt);
  }
  appFilterWrap.appendChild(appLabel);
  appFilterWrap.appendChild(appSelect);

  // 3) 접속 상태 필터
  const accessFilterWrap = document.createElement('div');
  accessFilterWrap.className = 'filter-group';
  const accessLabel = document.createElement('label');
  accessLabel.htmlFor = 'student-filter-access';
  accessLabel.textContent = '접속 상태';
  const accessSelect = document.createElement('select');
  accessSelect.id = 'student-filter-access';
  accessSelect.setAttribute('aria-label', '접속 상태');
  const accessDefaultOpt = document.createElement('option');
  accessDefaultOpt.value = 'all';
  accessDefaultOpt.textContent = '전체';
  accessSelect.appendChild(accessDefaultOpt);

  const uniqueAccessStates = Array.from(new Set(rawEvents.map(e => e.state?.access).filter(Boolean)));
  for (const st of uniqueAccessStates) {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = formatStateValue('access', st);
    accessSelect.appendChild(opt);
  }
  accessFilterWrap.appendChild(accessLabel);
  accessFilterWrap.appendChild(accessSelect);

  filterSection.appendChild(kindFilterWrap);
  filterSection.appendChild(appFilterWrap);
  filterSection.appendChild(accessFilterWrap);
  rootWrapper.appendChild(filterSection);

  // 건수 요약 표시 요소
  const countSummary = document.createElement('div');
  countSummary.className = 'events-count-summary';
  rootWrapper.appendChild(countSummary);

  // 목록 컨테이너
  const listContainer = document.createElement('div');
  listContainer.className = 'student-events-list';
  rootWrapper.appendChild(listContainer);

  // 7. 목록 및 상세 렌더링 함수
  function renderList() {
    listContainer.textContent = '';

    // 배열 내부 필터링
    const filteredEvents = rawEvents.filter(ev => {
      if (filterKind !== 'all' && ev.kind !== filterKind) return false;
      if (filterApp !== 'all' && ev.appId !== filterApp) return false;
      if (filterAccess !== 'all' && ev.state?.access !== filterAccess) return false;
      return true;
    });

    countSummary.textContent = `조회 결과: ${filteredEvents.length}건 (전체 ${rawEvents.length}건 중)`;

    if (filteredEvents.length === 0) {
      const emptyFiltered = document.createElement('div');
      emptyFiltered.className = 'events-empty-filtered';
      emptyFiltered.textContent = '필터 조건에 일치하는 기록이 없습니다.';
      listContainer.appendChild(emptyFiltered);
      return;
    }

    for (const ev of filteredEvents) {
      const row = document.createElement('article');
      row.className = 'student-event-row';
      row.setAttribute('data-student-event-id', ev.id);

      // 상단 기본 정보 영역
      const header = document.createElement('header');
      header.className = 'event-header';

      const idSpan = document.createElement('span');
      idSpan.className = 'event-id';
      idSpan.textContent = `사건 ID: ${ev.id}`;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'event-time';
      timeSpan.textContent = `시각: ${ev.at}`;

      const kindSpan = document.createElement('span');
      kindSpan.className = 'event-kind';
      kindSpan.textContent = `종류: ${formatKind(ev.kind)}`;

      const appSpan = document.createElement('span');
      appSpan.className = 'event-app';
      appSpan.textContent = `앱: ${ev.appId ? ev.appId : '앱 확인 불가'}`;

      const summaryP = document.createElement('p');
      summaryP.className = 'event-summary';
      summaryP.textContent = `요약: ${ev.summary || '(요약 없음)'}`;

      header.appendChild(idSpan);
      header.appendChild(timeSpan);
      header.appendChild(kindSpan);
      header.appendChild(appSpan);
      row.appendChild(header);
      row.appendChild(summaryP);

      // 상세 버튼
      const detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'btn-event-detail';
      const detailBtnName = `${ev.id} 상세`;
      detailBtn.setAttribute('aria-label', detailBtnName);
      detailBtn.textContent = detailBtnName;

      detailBtn.addEventListener('click', () => {
        selectedDetailId = selectedDetailId === ev.id ? null : ev.id;
        renderList();
      });
      row.appendChild(detailBtn);

      // 상세 영역 표시
      if (selectedDetailId === ev.id) {
        const detailSec = document.createElement('section');
        detailSec.className = 'student-event-detail';
        detailSec.setAttribute('data-student-event-detail', ev.id);

        const dTitle = document.createElement('h4');
        dTitle.textContent = `[상세] 사건 ID: ${ev.id} (앱: ${ev.appId ? ev.appId : '앱 확인 불가'})`;
        detailSec.appendChild(dTitle);

        // 1) 근거 (evidence)
        const evTitle = document.createElement('h5');
        evTitle.textContent = '근거 (evidence)';
        detailSec.appendChild(evTitle);
        const evUl = document.createElement('ul');
        if (Array.isArray(ev.evidence) && ev.evidence.length > 0) {
          for (const item of ev.evidence) {
            const li = document.createElement('li');
            li.textContent = `[${item.id}] ${item.text}`;
            evUl.appendChild(li);
          }
        } else {
          const li = document.createElement('li');
          li.textContent = '(제시된 근거 없음)';
          evUl.appendChild(li);
        }
        detailSec.appendChild(evUl);

        // 2) 규칙 (rules)
        const rulesTitle = document.createElement('h5');
        rulesTitle.textContent = '규칙 (rules)';
        detailSec.appendChild(rulesTitle);
        const rulesUl = document.createElement('ul');
        if (Array.isArray(ev.rules) && ev.rules.length > 0) {
          for (const item of ev.rules) {
            const li = document.createElement('li');
            li.textContent = `[${item.id}] ${item.text}`;
            rulesUl.appendChild(li);
          }
        } else {
          const li = document.createElement('li');
          li.textContent = '(적용된 규칙 없음)';
          rulesUl.appendChild(li);
        }
        detailSec.appendChild(rulesUl);

        // 3) 세 가지 상태 (state: access, session, device) - 한국어 설명 및 원래 코드 보존
        const stateTitle = document.createElement('h5');
        stateTitle.textContent = '상태 정보 (state)';
        detailSec.appendChild(stateTitle);
        const stateUl = document.createElement('ul');

        const accessLi = document.createElement('li');
        accessLi.textContent = `접속 상태 (access): ${formatStateValue('access', ev.state?.access)}`;
        stateUl.appendChild(accessLi);

        const sessionLi = document.createElement('li');
        sessionLi.textContent = `세션 상태 (session): ${formatStateValue('session', ev.state?.session)}`;
        stateUl.appendChild(sessionLi);

        const deviceLi = document.createElement('li');
        deviceLi.textContent = `기기 상태 (device): ${formatStateValue('device', ev.state?.device)}`;
        stateUl.appendChild(deviceLi);

        detailSec.appendChild(stateUl);

        // 15·16단계 범위: supportedActions가 비어있으면 조치 버튼을 일체 생성하지 않음
        // 미지원 조치가 입력된 경우에만 <action> 미지원 비활성 버튼과 안내 문구 표시 (요청 전송 금지)
        if (Array.isArray(ev.supportedActions) && ev.supportedActions.length > 0) {
          const actionSec = document.createElement('div');
          actionSec.className = 'event-actions-section';

          const actionTitle = document.createElement('h5');
          actionTitle.textContent = '보안 조치 (actions)';
          actionSec.appendChild(actionTitle);

          for (const act of ev.supportedActions) {
            const actBtn = document.createElement('button');
            actBtn.type = 'button';
            actBtn.disabled = true;
            actBtn.setAttribute('aria-disabled', 'true');
            const actBtnName = `${act} 미지원`;
            actBtn.textContent = actBtnName;
            actBtn.setAttribute('aria-label', actBtnName);
            actBtn.className = 'btn-unsupported-action';
            actionSec.appendChild(actBtn);
          }

          const actionNotice = document.createElement('p');
          actionNotice.className = 'action-unsupported-notice';
          actionNotice.textContent = '조치 실행 연결은 준비 중입니다.';
          actionSec.appendChild(actionNotice);

          detailSec.appendChild(actionSec);
        }

        row.appendChild(detailSec);
      }

      listContainer.appendChild(row);
    }
  }

  // 필터 이벤트 바인딩
  kindSelect.addEventListener('change', (e) => {
    filterKind = e.target.value;
    renderList();
  });
  appSelect.addEventListener('change', (e) => {
    filterApp = e.target.value;
    renderList();
  });
  accessSelect.addEventListener('change', (e) => {
    filterAccess = e.target.value;
    renderList();
  });

  // 초기 렌더링
  renderList();

  if (container) {
    container.appendChild(rootWrapper);
  }

  return rootWrapper;
}

/**
 * 제공 시작 틀의 학생 뷰 생성 함수
 * 학생 표시 함수(renderEvents)를 포함하는 객체를 반환합니다.
 * 
 * @returns {{ renderEvents: typeof renderEvents }}
 */
export function createStudentView() {
  return {
    renderEvents,
    renderStatus,
    renderAiConnection,
    renderExplanation
  };
}

/**
 * 기기·세션·알림·진단 상태 렌더링 함수 (16단계)
 * @param {Object} params
 * @param {Object} [params.devices] { status, mode, data?, error? }
 * @param {Object} [params.sessions] { status, mode, data?, error? }
 * @param {Array<Object>} [params.notifications] [{ resource, code, message }]
 * @param {Object} [params.diagnostics] { status, mode, data?, error? }
 * @param {string} [params.mode]
 * @param {HTMLElement} [targetContainer]
 * @returns {HTMLElement} 생성된 최상위 상태 뷰 요소
 */
export function renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}, targetContainer) {
  const container = targetContainer ||
    document.getElementById('status-container') ||
    document.getElementById('student-status') ||
    document.querySelector('[data-student-status]');

  if (container) {
    container.textContent = '';
  }

  const root = document.createElement('div');
  root.className = 'student-status-wrapper';
  root.setAttribute('data-student-status', '');

  // 1. 기기 상태 (devices)
  const devSec = document.createElement('section');
  devSec.className = 'status-section status-devices';
  const devTitle = document.createElement('h3');
  devTitle.textContent = '기기 상태 (devices)';
  devSec.appendChild(devTitle);

  const devStatus = devices?.status;
  const devMode = devices?.mode;
  const devData = devices?.data;
  const devErr = devices?.error;

  if (devStatus === 'loading' || devMode === 'loading') {
    const p = document.createElement('p');
    p.className = 'status-loading';
    p.textContent = '기기 정보를 불러오는 중입니다...';
    devSec.appendChild(p);
  } else if (devStatus === 'error') {
    const p = document.createElement('p');
    p.className = 'status-error';
    const errMsg = devErr && typeof devErr === 'object' && devErr.message ? devErr.message : String(devErr || '');
    const isTimeout = /timeout|시간\s*초과/i.test(errMsg) || /timeout/i.test(String(devErr?.code || ''));
    p.textContent = `기기 목록을 불러오지 못했습니다: ${isTimeout ? '요청 시간이 초과되었습니다. ' : ''}${errMsg}`.trim();
    devSec.appendChild(p);

    const retryP = document.createElement('p');
    retryP.className = 'status-retry-guide';
    retryP.textContent = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.';
    devSec.appendChild(retryP);
  } else if (devStatus === 'ok') {
    const list = Array.isArray(devData) ? devData : [];
    if (list.length === 0) {
      const p = document.createElement('p');
      p.className = 'status-empty';
      p.textContent = '등록된 기기가 없음';
      devSec.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'device-list';
      for (const d of list) {
        const li = document.createElement('li');
        const labelText = d.label || d.id || '기기';
        const rawStatus = d.status || 'unknown';
        const formattedStatus = formatStateValue('device', rawStatus);
        li.textContent = `기기: ${labelText} (상태: ${formattedStatus} / 원본: ${rawStatus})`;
        ul.appendChild(li);
      }
      devSec.appendChild(ul);
    }
  }
  root.appendChild(devSec);

  // 2. 세션 상태 (sessions)
  const sesSec = document.createElement('section');
  sesSec.className = 'status-section status-sessions';
  const sesTitle = document.createElement('h3');
  sesTitle.textContent = '세션 상태 (sessions)';
  sesSec.appendChild(sesTitle);

  // 세션 관측 범위 고지
  const sesScopeP = document.createElement('p');
  sesScopeP.className = 'session-scope-notice';
  sesScopeP.textContent = '세션 조회는 현재 검증된 연결 한 개를 대상으로 하며 과거 세션 전체 목록이 아닙니다.';
  sesSec.appendChild(sesScopeP);

  const sesStatus = sessions?.status;
  const sesMode = sessions?.mode;
  const sesData = sessions?.data;
  const sesErr = sessions?.error;

  if (sesStatus === 'loading' || sesMode === 'loading') {
    const p = document.createElement('p');
    p.className = 'status-loading';
    p.textContent = '세션 정보를 불러오는 중입니다...';
    sesSec.appendChild(p);
  } else if (sesStatus === 'error') {
    const p = document.createElement('p');
    p.className = 'status-error';
    const errMsg = sesErr && typeof sesErr === 'object' && sesErr.message ? sesErr.message : String(sesErr || '');
    const isTimeout = /timeout|시간\s*초과/i.test(errMsg) || /timeout/i.test(String(sesErr?.code || ''));
    p.textContent = `세션 정보를 불러오지 못했습니다: ${isTimeout ? '요청 시간이 초과되었습니다. ' : ''}${errMsg}`.trim();
    sesSec.appendChild(p);

    const retryP = document.createElement('p');
    retryP.className = 'status-retry-guide';
    retryP.textContent = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.';
    sesSec.appendChild(retryP);
  } else if (sesStatus === 'ok') {
    const list = Array.isArray(sesData) ? sesData : (sesData && typeof sesData === 'object' && Object.keys(sesData).length > 0 ? [sesData] : []);
    if (list.length === 0) {
      const p = document.createElement('p');
      p.className = 'status-empty';
      p.textContent = '현재 연결 없음';
      sesSec.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'session-list';
      for (const s of list) {
        const li = document.createElement('li');
        const idText = s.id || '현재 세션';
        const rawStatus = s.status || 'unknown';
        const formattedStatus = formatStateValue('session', rawStatus);
        li.textContent = `세션 ID: ${idText} (상태: ${formattedStatus} / 원본: ${rawStatus})`;
        ul.appendChild(li);
      }
      sesSec.appendChild(ul);
    }
  }
  root.appendChild(sesSec);

  // 3. 알림 (notifications)
  const notifSec = document.createElement('section');
  notifSec.className = 'status-section status-notifications';
  const notifTitle = document.createElement('h3');
  notifTitle.textContent = '알림 목록 (notifications)';
  notifSec.appendChild(notifTitle);

  const notifList = Array.isArray(notifications) ? notifications : [];
  if (notifList.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.className = 'status-empty notifications-empty';
    emptyP.textContent = '주의할 알림이 없습니다';
    notifSec.appendChild(emptyP);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'notification-list';
    for (const n of notifList) {
      const li = document.createElement('li');
      li.className = 'notification-item';
      const resText = n.resource || '자료 미지정';
      const codeText = n.code || '알림 코드 미지정';
      const msgText = n.message || '(메시지 없음)';
      li.textContent = `[${resText}] (${codeText}) ${msgText}`;
      ul.appendChild(li);
    }
    notifSec.appendChild(ul);
  }
  root.appendChild(notifSec);

  // 4. 진단 상태 (diagnostics)
  const diagSec = document.createElement('section');
  diagSec.className = 'status-section status-diagnostics';
  const diagTitle = document.createElement('h3');
  diagTitle.textContent = '진단 정보 (diagnostics)';
  diagSec.appendChild(diagTitle);

  const diagStatus = diagnostics?.status;
  const diagData = diagnostics?.data;
  const diagErr = diagnostics?.error;

  if (diagStatus === 'loading') {
    const p = document.createElement('p');
    p.className = 'status-loading';
    p.textContent = '진단 정보를 불러오는 중입니다...';
    diagSec.appendChild(p);
  } else if (diagStatus === 'error') {
    const p = document.createElement('p');
    p.className = 'status-error';
    const errMsg = diagErr && typeof diagErr === 'object' && diagErr.message ? diagErr.message : String(diagErr || '');
    p.textContent = `진단 정보를 불러오지 못했습니다: ${errMsg}`.trim();
    diagSec.appendChild(p);

    const retryP = document.createElement('p');
    retryP.className = 'status-retry-guide';
    retryP.textContent = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.';
    diagSec.appendChild(retryP);
  } else if (diagStatus === 'ok') {
    if (!diagData || typeof diagData !== 'object' || Object.keys(diagData).length === 0) {
      const p = document.createElement('p');
      p.className = 'status-empty';
      p.textContent = '진단 정보가 없습니다.';
      diagSec.appendChild(p);
    } else {
      // 허용된 6개 안전 필드만 화이트리스트 추출 (비밀번호·토큰·API 키 배제)
      const safeDiagnostics = {
        requestId: diagData.requestId || '(미제공)',
        component: diagData.component || '(미제공)',
        version: diagData.version || '(미제공)',
        checkedAt: diagData.checkedAt || '(미제공)',
        engine: {
          mode: diagData.engine?.mode || '(미제공)',
          code: diagData.engine?.code || '(미제공)'
        }
      };

      const ul = document.createElement('ul');
      ul.className = 'diagnostics-list';

      const liReq = document.createElement('li');
      liReq.textContent = `요청 ID (requestId): ${safeDiagnostics.requestId}`;
      ul.appendChild(liReq);

      const liComp = document.createElement('li');
      liComp.textContent = `구성요소 (component): ${safeDiagnostics.component}`;
      ul.appendChild(liComp);

      const liVer = document.createElement('li');
      liVer.textContent = `버전 (version): ${safeDiagnostics.version}`;
      ul.appendChild(liVer);

      const liChecked = document.createElement('li');
      liChecked.textContent = `점검 시각 (checkedAt): ${safeDiagnostics.checkedAt}`;
      ul.appendChild(liChecked);

      const liMode = document.createElement('li');
      liMode.textContent = `엔진 모드 (engine.mode): ${safeDiagnostics.engine.mode}`;
      ul.appendChild(liMode);

      const liCode = document.createElement('li');
      liCode.textContent = `엔진 코드 (engine.code): ${safeDiagnostics.engine.code}`;
      ul.appendChild(liCode);

      diagSec.appendChild(ul);

      // 도움정보 복사 용도 안내 문구
      const copyGuideP = document.createElement('p');
      copyGuideP.className = 'copy-guide-text';
      copyGuideP.textContent = '이 정보는 문제 발생 시 관리자 도움 요청에 쓰도록 복사하는 것입니다.';
      diagSec.appendChild(copyGuideP);

      // 정확한 이름 「도움정보 복사」 버튼 생성
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-copy-diagnostics';
      copyBtn.textContent = '도움정보 복사';
      copyBtn.setAttribute('aria-label', '도움정보 복사');

      const copyResultSpan = document.createElement('span');
      copyResultSpan.className = 'copy-result-message';
      copyResultSpan.style.marginLeft = '8px';

      // 사용자가 버튼을 누를 때만 클립보드 복사 실행
      copyBtn.addEventListener('click', async () => {
        const textToCopy = JSON.stringify(safeDiagnostics, null, 2);
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(textToCopy);
          } else if (typeof document !== 'undefined') {
            // fallback 복사 방식
            const ta = document.createElement('textarea');
            ta.value = textToCopy;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          copyResultSpan.textContent = '도움정보가 클립보드에 복사되었습니다.';
        } catch {
          copyResultSpan.textContent = '클립보드 복사에 실패했습니다.';
        }
      });

      diagSec.appendChild(copyBtn);
      diagSec.appendChild(copyResultSpan);
    }
  }
  root.appendChild(diagSec);

  if (container) {
    container.appendChild(root);
  }

  return root;
}

/**
 * 17단계: AI 오류 원인 분석 및 안전한 한국어 가이드 반환 헬퍼
 * 원문 error.code와 error.message를 그대로 노출하지 않고 안전성이 검증된 표준 코드와 정제 메시지만 반환합니다.
 * @param {Object|string} error
 * @returns {{ code: string, message: string, category: string, guide: string }}
 */
export function classifyAiError(error) {
  const rawCode = typeof error === 'object' && error?.code ? String(error.code) : '';
  const rawMsg = typeof error === 'object' && error?.message ? String(error.message) : (typeof error === 'string' ? error : '');
  const combined = `${rawCode} ${rawMsg}`.toUpperCase();

  // 1. 취소 (CANCELLED, ABORTED)
  if (/CANCEL|ABORT/i.test(combined)) {
    return {
      code: 'CANCELLED',
      message: '요청이 취소되었습니다.',
      category: '취소',
      guide: '취소됨. 이전 결과는 현재 결과가 아님'
    };
  }

  // 2. 권한 준비 중 · 확인 불가 (AUTH_PENDING, NOT_READY, PENDING_PERMISSION, UNKNOWN 등)
  if (/PENDING|NOT_READY|PREPARING|UNKNOWN/i.test(combined)) {
    return {
      code: 'AUTH_PENDING',
      message: '운영 측 계정 연결 및 앱 권한 확인이 필요합니다.',
      category: '권한 준비 중 · 확인 불가',
      guide: '운영 측 계정 연결 및 앱 권한 확인 요청 (학생 잘못이 아님)'
    };
  }

  // 3. 인증 실패 · 접근 제한 (UNAUTHENTICATED, UNAUTHORIZED, FORBIDDEN, ACCESS_DENIED, AUTH_FAILED 등)
  if (/UNAUTH|FORBIDDEN|DENIED|ACCESS_RESTRICTED|AUTH_FAIL/i.test(combined)) {
    return {
      code: 'UNAUTHORIZED',
      message: '인증에 실패했거나 접근이 제한되었습니다.',
      category: '인증 실패 · 접근 제한',
      guide: '계정 연결 다시 확인, 담당자 확인'
    };
  }

  // 4. 요청 제한 · 시간 초과 · 네트워크 (RATE_LIMIT, TOO_MANY_REQUESTS, TIMEOUT, DEADLINE_EXCEEDED, NETWORK_ERROR 등)
  if (/RATE_LIMIT|TOO_MANY|429|THROTTLE|TIMEOUT|DEADLINE|NETWORK/i.test(combined)) {
    const isRateLimit = /RATE|TOO_MANY|429|THROTTLE/i.test(combined);
    return {
      code: isRateLimit ? 'RATE_LIMIT' : 'TIMEOUT',
      message: isRateLimit ? '요청 한도 제한에 도달했습니다.' : '요청 시간이 초과되었거나 네트워크 연결에 실패했습니다.',
      category: '요청 제한 · 시간 초과 · 네트워크',
      guide: '잠시 뒤 직접 다시 점검'
    };
  }

  // 5. 반 사용량 · 이용 한도 (QUOTA, USAGE_LIMIT, LIMIT_EXCEEDED 등)
  if (/QUOTA|USAGE_LIMIT|EXCEEDED/i.test(combined)) {
    return {
      code: 'QUOTA_EXCEEDED',
      message: '반 이용 한도를 초과했습니다.',
      category: '반 사용량 · 이용 한도',
      guide: '담당자 확인'
    };
  }

  // 6. 이용 시간 아님 (OUT_OF_SERVICE_HOURS, INVALID_TIME, HOURS_RESTRICTED)
  if (/HOUR|SCHEDULE|TIME_RESTRICT|OUT_OF_SERVICE/i.test(combined)) {
    return {
      code: 'OUT_OF_SERVICE_HOURS',
      message: '현재는 서비스 이용 시간이 아닙니다.',
      category: '이용 시간 아님',
      guide: '이용 시간 확인'
    };
  }

  // 7. 쓸 수 있는 모델 없음 (NO_MODELS_AVAILABLE, MODEL_NOT_FOUND, NO_MODEL)
  if (/NO_MODEL|MODEL_NOT_FOUND|MODEL_UNAVAILABLE/i.test(combined)) {
    return {
      code: 'NO_MODELS_AVAILABLE',
      message: '사용 가능한 AI 모델이 없습니다.',
      category: '쓸 수 있는 모델 없음',
      guide: '담당자에게 모델 허용 설정 확인 요청'
    };
  }

  // 기본 안전 분류
  return {
    code: 'UNKNOWN_ERROR',
    message: 'AI 연결을 점검할 수 없습니다.',
    category: '기타 오류',
    guide: '담당자 확인 필요'
  };
}

/**
 * 17단계: AI 연결 상태 렌더링 함수
 * @param {Object} params
 * @param {'idle'|'loading'|'ok'|'error'} [params.status]
 * @param {string} [params.mode]
 * @param {Object} [params.data] { transportChecked: boolean, audienceAuthorization: 'test'|'verified', modelCount: number, help?: string }
 * @param {Object|string} [params.error] { code: string, message: string }
 * @param {string} [params.checkedAt]
 * @param {boolean} [params.explanationAccepted]
 * @param {HTMLElement} [targetContainer]
 * @returns {HTMLElement}
 */
export function renderAiConnection({ status = 'idle', mode, data, error, checkedAt, explanationAccepted } = {}, targetContainer) {
  const container = targetContainer ||
    document.getElementById('ai-connection-container') ||
    document.getElementById('student-ai-connection') ||
    document.querySelector('[data-student-ai-connection]');

  // 이전 컨테이너 내용 비우기 (재점검 성공이나 계정 변경 뒤 이전 결과 잔존 방지)
  if (container) {
    container.textContent = '';
  }

  const root = document.createElement('div');
  root.className = 'student-ai-connection-wrapper';
  root.setAttribute('data-student-ai-connection', '');

  const heading = document.createElement('h3');
  heading.className = 'ai-connection-title';
  heading.textContent = '수업용 AI 연결 상태';
  root.appendChild(heading);

  // 1. idle 상태 (점검 전 또는 계정 재연결 후 초기화)
  if (status === 'idle' || mode === 'idle') {
    const idleWrap = document.createElement('div');
    idleWrap.className = 'ai-status-idle';

    const pStatus = document.createElement('p');
    pStatus.className = 'status-text';
    pStatus.textContent = 'AI 연결 점검 전';
    idleWrap.appendChild(pStatus);

    const pGuide = document.createElement('p');
    pGuide.className = 'guide-text';
    pGuide.textContent = '연결을 확인하려면 「현재 API 연결 점검」 버튼을 직접 누르세요.';
    idleWrap.appendChild(pGuide);

    root.appendChild(idleWrap);
    if (container) container.appendChild(root);
    return root;
  }

  // 2. loading 상태 (점검 진행 중)
  if (status === 'loading' || mode === 'loading') {
    const loadingWrap = document.createElement('div');
    loadingWrap.className = 'ai-status-loading';

    const pStatus = document.createElement('p');
    pStatus.className = 'status-text';
    pStatus.textContent = 'AI 연결 점검 중...';
    loadingWrap.appendChild(pStatus);

    root.appendChild(loadingWrap);
    if (container) container.appendChild(root);
    return root;
  }

  // 3. ok 상태 (연결 점검 성공)
  if (status === 'ok') {
    const okWrap = document.createElement('div');
    okWrap.className = 'ai-status-ok';

    // 권한 유형 텍스트 결정
    const authType = data?.audienceAuthorization;
    let authLabel = '확인 불가';
    if (authType === 'test') {
      authLabel = '시험 연결 점검(test)';
    } else if (authType === 'verified') {
      authLabel = '앱 권한 확인 후 점검(verified)';
    } else if (authType) {
      authLabel = `${authType}`;
    }

    const pAuth = document.createElement('p');
    pAuth.className = 'ai-auth-type';
    pAuth.textContent = `연결 점검 결과: ${authLabel}`;
    okWrap.appendChild(pAuth);

    const modelCount = typeof data?.modelCount === 'number' ? data.modelCount : 0;
    const pModels = document.createElement('p');
    pModels.className = 'ai-model-count';
    pModels.textContent = `사용 가능 모델 수: ${modelCount}개`;
    okWrap.appendChild(pModels);

    const pCheckedAt = document.createElement('p');
    pCheckedAt.className = 'ai-checked-at';
    pCheckedAt.textContent = `점검 시각: ${checkedAt || '(미제공)'}`;
    okWrap.appendChild(pCheckedAt);

    // 사건 설명 미실행 고지 (연결 점검과 사건 설명의 명확한 분리)
    const pExplanationNotice = document.createElement('p');
    pExplanationNotice.className = 'ai-explanation-notice';
    pExplanationNotice.textContent = '사건 설명은 아직 실행하지 않았습니다.';
    okWrap.appendChild(pExplanationNotice);

    const pExplanationDetail = document.createElement('p');
    pExplanationDetail.className = 'ai-explanation-detail';
    pExplanationDetail.textContent = '모델 목록 응답은 연결 정상 여부만 나타내며, 보안 사건 설명은 보안 기록 목록에서 별도로 요청해야 합니다.';
    okWrap.appendChild(pExplanationDetail);

    // 수동 재점검 안내
    const pManual = document.createElement('p');
    pManual.className = 'status-retry-guide';
    pManual.textContent = '다시 점검은 사용자가 버튼을 직접 누르는 것입니다.';
    okWrap.appendChild(pManual);

    root.appendChild(okWrap);
    if (container) container.appendChild(root);
    return root;
  }

  // 4. error 상태 (오류 발생)
  if (status === 'error') {
    const errWrap = document.createElement('div');
    errWrap.className = 'ai-status-error';

    const classified = classifyAiError(error);

    const pCode = document.createElement('p');
    pCode.className = 'error-code';
    pCode.textContent = `오류 코드: ${classified.code}`;
    errWrap.appendChild(pCode);

    const pMsg = document.createElement('p');
    pMsg.className = 'error-message';
    pMsg.textContent = `오류 내용: ${classified.message}`;
    errWrap.appendChild(pMsg);

    const pGuide = document.createElement('p');
    pGuide.className = 'error-guide';
    pGuide.textContent = `조치 안내: ${classified.guide}`;
    errWrap.appendChild(pGuide);

    // 수동 조치 안내
    const pManual = document.createElement('p');
    pManual.className = 'status-retry-guide';
    pManual.textContent = '다시 점검은 사용자가 버튼을 직접 누르는 것입니다.';
    errWrap.appendChild(pManual);

    root.appendChild(errWrap);
    if (container) container.appendChild(root);
    return root;
  }

  if (container) container.appendChild(root);
  return root;
}

/**
 * 17단계: AI 사건 설명 기본 렌더링 함수 (18단계 기초)
 * @param {Object} params
 * @param {Object} [params.event] { id: string }
 * @param {Object} [params.explanation] { status: string, data?: { summary: string }, error?: { code: string, message: string } }
 * @param {string} [params.checkedAt]
 * @param {HTMLElement} [targetContainer]
 * @returns {HTMLElement}
 */
export function renderExplanation({ event, explanation, checkedAt } = {}, targetContainer) {
  const container = targetContainer ||
    document.getElementById('explanation-container') ||
    document.getElementById('student-explanation') ||
    document.querySelector('[data-student-explanation]');

  if (container) {
    container.textContent = '';
  }

  const root = document.createElement('div');
  root.className = 'student-explanation-wrapper';

  const title = document.createElement('h4');
  title.className = 'explanation-title';
  title.textContent = '보안 사건 설명';
  root.appendChild(title);

  const status = explanation?.status;
  const isError = status === 'error' || Boolean(explanation?.error);

  // 1. 오류 상태 처리: event가 null이어도 안전한 오류 코드·메시지 표시
  if (isError) {
    const rawError = explanation?.error || { code: 'EXPLANATION_FAILED', message: '사건 설명을 불러오지 못했습니다.' };
    const classified = classifyAiError(rawError);
    const errCode = classified.code || 'EXPLANATION_FAILED';
    const errMsg = classified.message || '사건 설명을 불러오지 못했습니다.';

    const pFail = document.createElement('p');
    pFail.className = 'explanation-fail-notice';
    pFail.textContent = 'AI 설명 실패: 사건 설명을 불러올 수 없습니다.';
    root.appendChild(pFail);

    const pCode = document.createElement('p');
    pCode.className = 'explanation-error-code';
    pCode.textContent = `오류 코드: ${errCode}`;
    root.appendChild(pCode);

    const pMsg = document.createElement('p');
    pMsg.className = 'explanation-error-message';
    pMsg.textContent = `오류 내용: ${errMsg}`;
    root.appendChild(pMsg);

    const pKeep = document.createElement('p');
    pKeep.className = 'explanation-keep-record';
    pKeep.textContent = '기록은 그대로 유지됩니다.';
    root.appendChild(pKeep);

    if (container) container.appendChild(root);
    return root;
  }

  // 2. 오류 없이 event가 null인 경우: 보안 기록 선택 안내
  if (!event) {
    const pSelect = document.createElement('p');
    pSelect.className = 'explanation-select-event';
    pSelect.textContent = '보안 기록에서 기록을 먼저 고르세요.';
    root.appendChild(pSelect);

    if (container) container.appendChild(root);
    return root;
  }

  // 3. 요청 중 (loading) 상태 처리
  if (status === 'loading' || explanation?.mode === 'loading') {
    const pLoading = document.createElement('p');
    pLoading.className = 'explanation-loading';
    pLoading.textContent = '설명 요청 중...';
    root.appendChild(pLoading);

    if (container) container.appendChild(root);
    return root;
  }

  // 4. 설명 데이터 검증 및 실행 완료 위반(executed: true) 차단
  if (explanation?.data?.executed === true) {
    const pFail = document.createElement('p');
    pFail.className = 'explanation-fail-notice';
    pFail.textContent = 'AI 설명 실패: AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다.';
    root.appendChild(pFail);

    const pCode = document.createElement('p');
    pCode.className = 'explanation-error-code';
    pCode.textContent = '오류 코드: EXECUTED_PROPOSAL_REJECTED';
    root.appendChild(pCode);

    const pKeep = document.createElement('p');
    pKeep.className = 'explanation-keep-record';
    pKeep.textContent = '기록은 그대로 유지됩니다.';
    root.appendChild(pKeep);

    if (container) container.appendChild(root);
    return root;
  }

  // 5. 근거 유효성 및 일치성 검증 (evidence binding & sufficiency check)
  const eventEvidences = Array.isArray(event?.evidence) ? event.evidence : [];
  const explanationEvidenceIds = Array.isArray(explanation?.data?.evidenceIds) ? explanation.data.evidenceIds : null;

  // 1) 기록에 근거가 없거나(event.evidence 비어있음), AI 설명에 근거 인용이 없거나 비어있는 경우 (근거 부족)
  if (eventEvidences.length === 0 || !explanationEvidenceIds || explanationEvidenceIds.length === 0) {
    const pFail = document.createElement('p');
    pFail.className = 'explanation-fail-notice';
    pFail.textContent = 'AI 설명 실패: 근거가 부족하여 설명을 채택할 수 없습니다.';
    root.appendChild(pFail);

    const pCode = document.createElement('p');
    pCode.className = 'explanation-error-code';
    pCode.textContent = '오류 코드: INSUFFICIENT_EVIDENCE';
    root.appendChild(pCode);

    const pMsg = document.createElement('p');
    pMsg.className = 'explanation-error-message';
    pMsg.textContent = '기록의 근거가 비어 있거나 AI 설명에 인용된 근거 ID가 없어 실패로 처리합니다.';
    root.appendChild(pMsg);

    const pKeep = document.createElement('p');
    pKeep.className = 'explanation-keep-record';
    pKeep.textContent = '기록은 그대로 유지됩니다.';
    root.appendChild(pKeep);

    if (container) container.appendChild(root);
    return root;
  }

  // 2) AI 설명의 evidenceIds 중 기록에 없는 근거 ID가 포함된 경우 (근거 불일치)
  const missingEvidenceIds = explanationEvidenceIds.filter(id => !eventEvidences.some(e => e.id === id));
  if (missingEvidenceIds.length > 0) {
    const pFail = document.createElement('p');
    pFail.className = 'explanation-fail-notice';
    pFail.textContent = 'AI 설명 실패: 근거가 맞지 않아 설명을 쓸 수 없습니다.';
    root.appendChild(pFail);

    const pCode = document.createElement('p');
    pCode.className = 'explanation-error-code';
    pCode.textContent = '오류 코드: INVALID_EVIDENCE';
    root.appendChild(pCode);

    const pMsg = document.createElement('p');
    pMsg.className = 'explanation-error-message';
    pMsg.textContent = `불일치 근거 ID: ${missingEvidenceIds.join(', ')}`;
    root.appendChild(pMsg);

    const pKeep = document.createElement('p');
    pKeep.className = 'explanation-keep-record';
    pKeep.textContent = '기록은 그대로 유지됩니다.';
    root.appendChild(pKeep);

    if (container) container.appendChild(root);
    return root;
  }

  const eventId = event?.id || '(미제공)';

  if (explanation?.status === 'ok') {
    // 6. 성공한 설명에만 data-student-explanation-event 지정
    root.setAttribute('data-student-explanation-event', event?.id || '');

    // 1) 사건 ID 및 참고용 AI 요약
    const pAiTitle = document.createElement('h5');
    pAiTitle.className = 'explanation-ai-title';
    pAiTitle.textContent = 'AI 설명(참고용)';
    root.appendChild(pAiTitle);

    const pEvent = document.createElement('p');
    pEvent.className = 'explanation-event-id';
    pEvent.textContent = `사건 ID: ${eventId}`;
    root.appendChild(pEvent);

    const summaryText = explanation?.data?.summary || '(설명 내용이 없습니다.)';
    const pSummary = document.createElement('p');
    pSummary.className = 'explanation-summary';
    pSummary.textContent = `설명 요약: ${summaryText}`;
    root.appendChild(pSummary);

    if (checkedAt) {
      const pTime = document.createElement('p');
      pTime.className = 'explanation-time';
      pTime.textContent = `설명 생성 시각: ${checkedAt}`;
      root.appendChild(pTime);
    }

    // 2) 인용된 근거 목록 ("근거 ID — 근거 글")
    const evidenceSection = document.createElement('div');
    evidenceSection.className = 'explanation-evidence-section';
    const pEviTitle = document.createElement('p');
    pEviTitle.className = 'explanation-evidence-title';
    pEviTitle.textContent = '인용된 근거:';
    evidenceSection.appendChild(pEviTitle);

    const matchedEvidences = (explanationEvidenceIds !== null && explanationEvidenceIds.length > 0)
      ? eventEvidences.filter(e => explanationEvidenceIds.includes(e.id))
      : eventEvidences;

    if (matchedEvidences.length > 0) {
      const ulEvidence = document.createElement('ul');
      ulEvidence.className = 'explanation-evidence-list';
      for (const evi of matchedEvidences) {
        const li = document.createElement('li');
        li.className = 'explanation-evidence-item';
        li.textContent = `${evi.id} — ${evi.text}`;
        ulEvidence.appendChild(li);
      }
      evidenceSection.appendChild(ulEvidence);
    } else {
      const pNoEvi = document.createElement('p');
      pNoEvi.className = 'explanation-evidence-none';
      pNoEvi.textContent = '인용된 근거가 없습니다.';
      evidenceSection.appendChild(pNoEvi);
    }
    root.appendChild(evidenceSection);

    // 3) 적용된 규칙 목록 ("규칙 ID — 규칙 글")
    const rulesSection = document.createElement('div');
    rulesSection.className = 'explanation-rules-section';
    const pRulesTitle = document.createElement('p');
    pRulesTitle.className = 'explanation-rules-title';
    pRulesTitle.textContent = '적용된 규칙:';
    rulesSection.appendChild(pRulesTitle);

    const eventRules = Array.isArray(event?.rules) ? event.rules : [];
    if (eventRules.length > 0) {
      const ulRules = document.createElement('ul');
      ulRules.className = 'explanation-rules-list';
      for (const rule of eventRules) {
        const li = document.createElement('li');
        li.className = 'explanation-rule-item';
        li.textContent = `${rule.id} — ${rule.text}`;
        ulRules.appendChild(li);
      }
      rulesSection.appendChild(ulRules);
    } else {
      const pNoRules = document.createElement('p');
      pNoRules.className = 'explanation-rules-none';
      pNoRules.textContent = '적용된 규칙이 없습니다.';
      rulesSection.appendChild(pNoRules);
    }
    root.appendChild(rulesSection);

    // 4) 상태 정보: access·session·device 중 unknown인 값을 각각 확인 불가로 표시
    const stateSection = document.createElement('div');
    stateSection.className = 'explanation-state-section';
    const pStateTitle = document.createElement('p');
    pStateTitle.className = 'explanation-state-title';
    pStateTitle.textContent = '확인 불가 상태:';
    stateSection.appendChild(pStateTitle);

    const rawState = event?.state || {};
    const unknownItems = [];
    if (rawState.access === 'unknown') unknownItems.push('접속: 확인 불가(unknown)');
    if (rawState.session === 'unknown') unknownItems.push('세션: 확인 불가(unknown)');
    if (rawState.device === 'unknown') unknownItems.push('기기: 확인 불가(unknown)');

    if (unknownItems.length > 0) {
      const ulUnknown = document.createElement('ul');
      ulUnknown.className = 'explanation-unknown-list';
      for (const item of unknownItems) {
        const li = document.createElement('li');
        li.className = 'explanation-unknown-item';
        li.textContent = item;
        ulUnknown.appendChild(li);
      }
      stateSection.appendChild(ulUnknown);
    } else {
      const pNoUnknown = document.createElement('p');
      pNoUnknown.className = 'explanation-unknown-none';
      pNoUnknown.textContent = '없음';
      stateSection.appendChild(pNoUnknown);
    }
    root.appendChild(stateSection);

    // 5) 조치 제안 (proposals)
    const proposalSection = document.createElement('div');
    proposalSection.className = 'explanation-proposal-section';
    const pProposalTitle = document.createElement('p');
    pProposalTitle.className = 'explanation-proposal-title';
    pProposalTitle.textContent = '조치 제안:';
    proposalSection.appendChild(pProposalTitle);

    const proposals = Array.isArray(explanation?.data?.proposals) ? explanation.data.proposals : [];
    if (proposals.length === 0) {
      const supportedActions = Array.isArray(event?.supportedActions) ? event.supportedActions : [];
      const pNoProposal = document.createElement('p');
      pNoProposal.className = 'explanation-proposal-none';
      if (supportedActions.length === 0) {
        pNoProposal.textContent = '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상)';
      } else {
        pNoProposal.textContent = 'AI가 제안한 조치가 없습니다.';
      }
      proposalSection.appendChild(pNoProposal);
    } else {
      const ulProposals = document.createElement('ul');
      ulProposals.className = 'explanation-proposal-list';
      for (const prop of proposals) {
        const li = document.createElement('li');
        li.className = 'explanation-proposal-item';
        const actionText = prop.action || '미지정 조치';
        const reasonText = prop.reason || '사유 미기재';
        li.textContent = `제안 조치: ${actionText} (이유: ${reasonText}) - 사람 확인이 필요하며 실행되지 않았습니다`;
        ulProposals.appendChild(li);
      }
      proposalSection.appendChild(ulProposals);
    }
    root.appendChild(proposalSection);
  }

  if (container) {
    container.appendChild(root);
  }

  return root;
}
