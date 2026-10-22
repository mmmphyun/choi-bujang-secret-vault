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

        // 15단계 범위: supportedActions가 비어있으면 조치 버튼을 일체 생성하지 않음
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
    renderEvents
  };
}
