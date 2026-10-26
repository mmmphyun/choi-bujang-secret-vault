import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentView, renderAiConnection, renderExplanation, classifyAiError } from '../student/extension.mjs';

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
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, listener) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
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

// 글로벌 document 모킹
globalThis.document = {
  createElement(tag) {
    return new MockElement(tag);
  },
  getElementById() {
    return null;
  },
  querySelector() {
    return null;
  }
};

test('1. createStudentView 인터페이스 확인: renderAiConnection, renderExplanation 포함', () => {
  const view = createStudentView();
  assert.equal(typeof view.renderAiConnection, 'function');
  assert.equal(typeof view.renderExplanation, 'function');
});

test('2. renderAiConnection: idle 상태 처리 및 이전 상태 초기화 확인 (ai_generation_reset)', () => {
  const container = new MockElement('div');
  container.textContent = '이전 오류 메시지 잔존';

  const root = renderAiConnection({ status: 'idle' }, container);
  assert.equal(root.getAttribute('data-student-ai-connection'), '');
  assert.ok(root.textContent.includes('AI 연결 점검 전'));
  assert.ok(!root.textContent.includes('이전 오류 메시지 잔존'), '이전 잔존 내용이 제거되어야 함');
});

test('3. renderAiConnection: loading 상태 렌더링 확인', () => {
  const container = new MockElement('div');
  const root = renderAiConnection({ status: 'loading' }, container);
  assert.ok(root.textContent.includes('AI 연결 점검 중...'));
});

test('4. renderAiConnection: ok 상태 (test vs verified) 및 사건 설명 미실행 고지 확인 (ai_transport_checked, ai_model_called)', () => {
  const container = new MockElement('div');
  
  // 1) test 권한
  const rootTest = renderAiConnection({
    status: 'ok',
    data: {
      transportChecked: true,
      audienceAuthorization: 'test',
      modelCount: 3
    },
    checkedAt: '2026-10-26T10:00:00Z',
    explanationAccepted: false
  }, container);

  assert.ok(rootTest.textContent.includes('시험 연결 점검(test)'));
  assert.ok(rootTest.textContent.includes('사용 가능 모델 수: 3개'));
  assert.ok(rootTest.textContent.includes('점검 시각: 2026-10-26T10:00:00Z'));
  assert.ok(rootTest.textContent.includes('사건 설명은 아직 실행하지 않았습니다.'), '사건 설명 미실행 고지가 포함되어야 함');
  assert.ok(rootTest.textContent.includes('다시 점검은 사용자가 버튼을 직접 누르는 것입니다.'), '수동 점검 안내 문구 포함');

  // 2) verified 권한
  const rootVerified = renderAiConnection({
    status: 'ok',
    data: {
      transportChecked: true,
      audienceAuthorization: 'verified',
      modelCount: 5
    },
    checkedAt: '2026-10-26T10:05:00Z',
    explanationAccepted: false
  }, container);

  assert.ok(rootVerified.textContent.includes('앱 권한 확인 후 점검(verified)'));
  assert.ok(rootVerified.textContent.includes('사용 가능 모델 수: 5개'));
  assert.ok(rootVerified.textContent.includes('사건 설명은 아직 실행하지 않았습니다.'));
});

test('5. renderAiConnection: error 상태 분류 및 안전한 안내 확인 (ai_auth_error, ai_limits, ai_timeout_cancel)', () => {
  const container = new MockElement('div');

  // 1) 권한 준비 중
  const r1 = renderAiConnection({
    status: 'error',
    error: { code: 'AUTH_PENDING', message: '권한 준비 중입니다.' }
  }, container);
  assert.ok(r1.textContent.includes('AUTH_PENDING'));
  assert.ok(r1.textContent.includes('운영 측 계정 연결 및 앱 권한 확인 요청'));

  // 2) 인증 실패 / 접근 제한
  const r2 = renderAiConnection({
    status: 'error',
    error: { code: 'UNAUTHORIZED', message: '접근이 거부되었습니다.' }
  }, container);
  assert.ok(r2.textContent.includes('계정 연결 다시 확인, 담당자 확인'));

  // 3) 이용 한도
  const r3 = renderAiConnection({
    status: 'error',
    error: { code: 'QUOTA_EXCEEDED', message: '사용량 한도를 초과했습니다.' }
  }, container);
  assert.ok(r3.textContent.includes('담당자 확인'));

  // 4) 시간 초과
  const r4 = renderAiConnection({
    status: 'error',
    error: { code: 'TIMEOUT', message: '요청 시간이 초과되었습니다.' }
  }, container);
  assert.ok(r4.textContent.includes('잠시 뒤 직접 다시 점검'));

  // 5) 취소
  const r5 = renderAiConnection({
    status: 'error',
    error: { code: 'CANCELLED', message: '사용자에 의해 취소되었습니다.' }
  }, container);
  assert.ok(r5.textContent.includes('취소됨. 이전 결과는 현재 결과가 아님'));

  // 6) 모델 없음
  const r6 = renderAiConnection({
    status: 'error',
    error: { code: 'NO_MODELS_AVAILABLE', message: '이용 가능한 AI 모델이 없습니다.' }
  }, container);
  assert.ok(r6.textContent.includes('담당자에게 모델 허용 설정 확인 요청'));
});

test('6. renderAiConnection: 재점검 성공 시 이전 오류 제거 확인 (ai_generation_reset)', () => {
  const container = new MockElement('div');

  // 오류 렌더링
  renderAiConnection({
    status: 'error',
    error: { code: 'AUTH_PENDING', message: '오류 발생' }
  }, container);
  assert.ok(container.textContent.includes('AUTH_PENDING'));

  // 성공으로 재점검
  renderAiConnection({
    status: 'ok',
    data: { audienceAuthorization: 'verified', modelCount: 2 },
    checkedAt: '2026-10-26T10:10:00Z'
  }, container);

  assert.ok(!container.textContent.includes('AUTH_PENDING'), '이전 오류 코드가 완전히 제거되어야 함');
  assert.ok(container.textContent.includes('앱 권한 확인 후 점검(verified)'));
});

test('7. renderExplanation: ok 상태 시 data-student-explanation-event 속성 부여 및 요약 표시 확인', () => {
  const container = new MockElement('div');
  const root = renderExplanation({
    event: { id: 'evt-2026-10-001' },
    explanation: {
      status: 'ok',
      data: { summary: '비정상적인 접근 패턴이 감지되어 차단되었습니다.' }
    },
    checkedAt: '2026-10-26T10:15:00Z'
  }, container);

  assert.equal(root.getAttribute('data-student-explanation-event'), 'evt-2026-10-001');
  assert.ok(root.textContent.includes('사건 ID: evt-2026-10-001'));
  assert.ok(root.textContent.includes('비정상적인 접근 패턴이 감지되어 차단되었습니다.'));
});

test('8. renderExplanation: 실패 시 data-student-explanation-event 속성 미부여 및 기록 보존 문구 확인', () => {
  const container = new MockElement('div');
  const root = renderExplanation({
    event: { id: 'evt-2026-10-002' },
    explanation: {
      status: 'error',
      error: { code: 'AI_TIMEOUT', message: 'AI 응답 시간 초과' }
    }
  }, container);

  assert.equal(root.getAttribute('data-student-explanation-event'), null, '실패 시 data 속성이 부여되지 않아야 함');
  assert.ok(root.textContent.includes('AI_TIMEOUT'));
  assert.ok(root.textContent.includes('기록은 그대로 유지됩니다.'));
});
