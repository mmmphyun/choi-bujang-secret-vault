import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentView, renderEvents, renderStatus } from '../student/extension.mjs';

// 가상 경량 DOM 노드 구현
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this._textContent = '';
    this.eventListeners = {};
    this.className = '';
    this.id = '';
    this.disabled = false;
    this.style = {};
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).join('');
    }
    return this._textContent;
  }

  set textContent(val) {
    this.children = [];
    this._textContent = String(val);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
    }
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener(type, listener) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  dispatchEvent(event) {
    const listeners = this.eventListeners[event.type] || [];
    for (const l of listeners) {
      l(event);
    }
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector) {
    const result = [];
    const walk = (node) => {
      let matched = false;
      if (selector.startsWith('#')) {
        if (node.id === selector.slice(1)) matched = true;
      } else if (selector.startsWith('.')) {
        if (node.className && node.className.split(/\s+/).includes(selector.slice(1))) matched = true;
      } else if (selector.startsWith('[') && selector.endsWith(']')) {
        const attrExpr = selector.slice(1, -1);
        if (attrExpr.includes('=')) {
          const [k, v] = attrExpr.split('=');
          const cleanV = v.replace(/^['"]|['"]$/g, '');
          if (node.getAttribute(k) === cleanV) matched = true;
        } else {
          if (node.attributes.has(attrExpr)) matched = true;
        }
      } else if (/^[A-Z0-9]+$/i.test(selector)) {
        if (node.tagName.toLowerCase() === selector.toLowerCase()) matched = true;
      }
      if (matched) result.push(node);
      for (const child of node.children) {
        walk(child);
      }
    };
    for (const child of this.children) {
      walk(child);
    }
    return result;
  }
}

// 전역 document 및 navigator mock 설정
let clipboardWrittenText = null;
globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => null,
  querySelector: (sel) => null,
  body: new MockElement('body'),
  execCommand: () => true
};

try {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: {
      writeText: async (text) => {
        clipboardWrittenText = text;
      }
    },
    configurable: true,
    writable: true
  });
} catch {
  // navigator 속성 재정의 불가 환경 fallback
}

test('1. createStudentView 및 renderStatus 기본 인터페이스 확인', () => {
  const view = createStudentView();
  assert.equal(typeof view.renderStatus, 'function', 'createStudentView는 renderStatus를 반환해야 함');
  assert.equal(typeof renderStatus, 'function', 'renderStatus는 직접 export되어야 함');

  const container = new MockElement('div');
  const returnedEl = renderStatus({}, container);
  assert.ok(returnedEl instanceof MockElement, 'renderStatus는 독립 DOM 요소를 반환해야 함');
});

test('2. 기기(devices) 상태별 렌더링 분기 확인 (loading, error, empty, ok)', () => {
  // 1) loading
  const cLoad = new MockElement('div');
  renderStatus({ devices: { status: 'loading' } }, cLoad);
  assert.match(cLoad.textContent, /기기 정보를 불러오는 중입니다/);
  assert.doesNotMatch(cLoad.textContent, /등록된 기기가 없음/);

  // 2) error & retry 안내 & 타임아웃
  const cErr = new MockElement('div');
  renderStatus({
    devices: {
      status: 'error',
      error: { message: '네트워크 연결 timeout 발생', code: 'ETIMEDOUT' }
    }
  }, cErr);
  assert.match(cErr.textContent, /기기 목록을 불러오지 못했습니다/);
  assert.match(cErr.textContent, /요청 시간이 초과되었습니다/);
  assert.match(cErr.textContent, /다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요/);

  // 3) empty
  const cEmpty = new MockElement('div');
  renderStatus({ devices: { status: 'ok', data: [] } }, cEmpty);
  assert.match(cEmpty.textContent, /등록된 기기가 없음/);

  // 4) ok 데이터
  const cOk = new MockElement('div');
  renderStatus({
    devices: {
      status: 'ok',
      data: [{ label: '내 맥북', status: 'registered' }]
    }
  }, cOk);
  assert.match(cOk.textContent, /내 맥북/);
  assert.match(cOk.textContent, /등록됨\(registered\)/);
  assert.doesNotMatch(cOk.textContent, /등록된 기기가 없음/);
});

test('3. 세션(sessions) 상태별 렌더링 및 관측 범위 고지 확인', () => {
  // 1) 관측 범위 상시 안내 문구
  const cScope = new MockElement('div');
  renderStatus({ sessions: { status: 'loading' } }, cScope);
  assert.match(cScope.textContent, /세션 조회는 현재 검증된 연결 한 개를 대상으로 하며 과거 세션 전체 목록이 아닙니다/);

  // 2) empty
  const cEmpty = new MockElement('div');
  renderStatus({ sessions: { status: 'ok', data: [] } }, cEmpty);
  assert.match(cEmpty.textContent, /현재 연결 없음/);

  // 3) ok 데이터
  const cOk = new MockElement('div');
  renderStatus({
    sessions: {
      status: 'ok',
      data: [{ id: 'sess-current-01', status: 'active' }]
    }
  }, cOk);
  assert.match(cOk.textContent, /sess-current-01/);
  assert.match(cOk.textContent, /유효\(active\)/);
  assert.doesNotMatch(cOk.textContent, /현재 연결 없음/);

  // 4) error & retry 안내
  const cErr = new MockElement('div');
  renderStatus({
    sessions: {
      status: 'error',
      error: { message: '인증 세션 검증 실패' }
    }
  }, cErr);
  assert.match(cErr.textContent, /세션 정보를 불러오지 못했습니다: 인증 세션 검증 실패/);
  assert.match(cErr.textContent, /다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요/);
});

test('4. 알림(notifications) 렌더링 확인 (빈 목록 및 항목별 상세)', () => {
  // 1) 빈 배열
  const cEmpty = new MockElement('div');
  renderStatus({ notifications: [] }, cEmpty);
  assert.match(cEmpty.textContent, /주의할 알림이 없습니다/);

  // 2) 알림 존재
  const cList = new MockElement('div');
  renderStatus({
    notifications: [
      { resource: 'device', code: 'DEV_UNAPPROVED', message: '미승인 기기 접속 시도' },
      { resource: 'session', code: 'SES_EXPIRED', message: '보안 세션 만료 경고' }
    ]
  }, cList);
  assert.match(cList.textContent, /\[device\] \(DEV_UNAPPROVED\) 미승인 기기 접속 시도/);
  assert.match(cList.textContent, /\[session\] \(SES_EXPIRED\) 보안 세션 만료 경고/);
  assert.doesNotMatch(cList.textContent, /주의할 알림이 없습니다/);
});

test('5. 진단 정보(diagnostics) 민감정보 차단(redaction) 및 「도움정보 복사」 버튼 확인', async () => {
  clipboardWrittenText = null;
  const cDiag = new MockElement('div');
  const mockDiagData = {
    requestId: 'req-test-999',
    component: 'aleph-auth-proxy',
    version: '1.2.0',
    checkedAt: '2026-10-26T09:00:00Z',
    engine: {
      mode: 'strict',
      code: 'ENGINE_OK'
    },
    // 절대 노출되거나 복사되면 안 되는 민감 필드 (더미 값)
    apiKey: 'dummy-api-key-value',
    token: 'dummy-token-sample-string',
    serverSecret: 'dummy-server-secret-value',
    password: 'dummy-super-secret-password'
  };

  renderStatus({
    diagnostics: {
      status: 'ok',
      data: mockDiagData
    }
  }, cDiag);

  // 1) 허용 필드 노출 확인
  assert.match(cDiag.textContent, /req-test-999/);
  assert.match(cDiag.textContent, /aleph-auth-proxy/);
  assert.match(cDiag.textContent, /1\.2\.0/);
  assert.match(cDiag.textContent, /ENGINE_OK/);

  // 2) 민감 필드 차단(Redaction) 확인
  assert.doesNotMatch(cDiag.textContent, /dummy-api-key/);
  assert.doesNotMatch(cDiag.textContent, /dummy-token/);
  assert.doesNotMatch(cDiag.textContent, /dummy-server-secret/);
  assert.doesNotMatch(cDiag.textContent, /dummy-super-secret-password/);

  // 3) 「도움정보 복사」 버튼 존재 및 사용자가 누를 때만 복사 확인
  const copyBtn = cDiag.querySelector('[aria-label="도움정보 복사"]');
  assert.ok(copyBtn, '「도움정보 복사」 버튼 존재');
  assert.equal(copyBtn.textContent, '도움정보 복사');
  assert.equal(clipboardWrittenText, null, '클릭 전에는 자동 복사되지 않아야 함');

  // 버튼 클릭 시뮬레이션
  copyBtn.dispatchEvent({ type: 'click' });
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.ok(clipboardWrittenText, '클릭 후 클립보드에 문자열 복사됨');
  assert.match(clipboardWrittenText, /req-test-999/);
  assert.doesNotMatch(clipboardWrittenText, /dummy-api-key/);
  assert.doesNotMatch(clipboardWrittenText, /dummy-token/);
  assert.match(cDiag.textContent, /도움정보가 클립보드에 복사되었습니다/);
});

test('6. 미지원 조치(unsupported_action) 버튼 및 안내 문구 확인', () => {
  const container = new MockElement('div');
  const mockEvents = [
    {
      id: 'evt-action-test',
      kind: 'access',
      at: '2026-10-26T09:10:00Z',
      appId: 'notes-vault',
      summary: '조치 테스트 이벤트',
      evidence: [],
      rules: [],
      state: { access: 'denied', session: 'unknown', device: 'unknown' },
      supportedActions: ['revoke', 'quarantine']
    }
  ];

  renderEvents({ status: 'ok', data: mockEvents }, container);

  const detailBtn = container.querySelector('[aria-label="evt-action-test 상세"]');
  assert.ok(detailBtn);
  detailBtn.dispatchEvent({ type: 'click' });

  const detailSec = container.querySelector('[data-student-event-detail="evt-action-test"]');
  assert.ok(detailSec);

  // 미지원 조치 비활성 버튼 2개 생성 확인
  const revokeBtn = detailSec.querySelector('[aria-label="revoke 미지원"]');
  assert.ok(revokeBtn, 'revoke 미지원 버튼 존재');
  assert.equal(revokeBtn.disabled, true, 'revoke 미지원 버튼은 disabled 상태여야 함');
  assert.equal(revokeBtn.getAttribute('aria-disabled'), 'true');

  const quarantineBtn = detailSec.querySelector('[aria-label="quarantine 미지원"]');
  assert.ok(quarantineBtn, 'quarantine 미지원 버튼 존재');
  assert.equal(quarantineBtn.disabled, true, 'quarantine 미지원 버튼은 disabled 상태여야 함');

  assert.match(detailSec.textContent, /조치 실행 연결은 준비 중입니다/);
});

test('7. 다시 불러오기(refresh) 시 이전 실패 문구 제거 확인', () => {
  const container = new MockElement('div');

  // 1회차: error 상태 렌더링
  renderStatus({
    devices: { status: 'error', error: { message: '일시적 네트워크 장애' } }
  }, container);
  assert.match(container.textContent, /기기 목록을 불러오지 못했습니다/);

  // 2회차: 사용자가 다시 불러오기 성공(ok) 시 이전 error 내용 소멸 확인
  renderStatus({
    devices: { status: 'ok', data: [{ label: '정상 기기', status: 'registered' }] }
  }, container);
  assert.doesNotMatch(container.textContent, /기기 목록을 불러오지 못했습니다/);
  assert.match(container.textContent, /정상 기기/);
});
