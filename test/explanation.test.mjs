import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudentView, renderExplanation, renderEvents } from '../student/extension.mjs';

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
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).join(' ');
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

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
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
      if (selector.startsWith('.')) {
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

// 글로벌 document 가상 주입
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement(tagName) {
      return new MockElement(tagName);
    },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    }
  };
}

const sampleEvent = {
  id: 'evt-20261022-001',
  kind: 'access',
  at: '2026-10-22T08:00:00Z',
  appId: 'notes-vault',
  summary: '비정상 접속 차단',
  evidence: [
    { id: 'evi-auth-fail', text: '5회 연속 인증 실패' },
    { id: 'evi-ip-reputation', text: '의심 IP 대역 접속' }
  ],
  rules: [
    { id: 'rule-burst-limit', text: '임계치 초과 차단' },
    { id: 'rule-geo-ip', text: '위험 지역 차단' }
  ],
  state: {
    access: 'denied',
    session: 'unknown',
    device: 'unknown'
  },
  supportedActions: []
};

test('1. student-source-changed: student/extension.mjs 파일 및 renderExplanation 함수 확인', () => {
  const src = fs.readFileSync('student/extension.mjs', 'utf-8');
  assert.ok(src.includes('export function renderExplanation'), 'renderExplanation이 export되어야 함');
  const view = createStudentView();
  assert.equal(typeof view.renderExplanation, 'function');
});

test('2. evidence_binding: 유효한 근거 ID 일치 시 근거 문장, 규칙 문장 표시 및 data 속성 설정', () => {
  const container = new MockElement('div');
  const root = renderExplanation({
    event: sampleEvent,
    explanation: {
      status: 'ok',
      data: {
        summary: '인증 실패 및 의심 IP에 의한 차단 건입니다.',
        evidenceIds: ['evi-auth-fail', 'evi-ip-reputation'],
        proposals: []
      }
    },
    checkedAt: '2026-10-26T12:00:00Z'
  }, container);

  assert.equal(root.getAttribute('data-student-explanation-event'), 'evt-20261022-001');
  assert.ok(root.textContent.includes('AI 설명(참고용)'));
  assert.ok(root.textContent.includes('사건 ID: evt-20261022-001'));
  assert.ok(root.textContent.includes('인증 실패 및 의심 IP에 의한 차단 건입니다.'));
  assert.ok(root.textContent.includes('evi-auth-fail — 5회 연속 인증 실패'));
  assert.ok(root.textContent.includes('evi-ip-reputation — 의심 IP 대역 접속'));
  assert.ok(root.textContent.includes('rule-burst-limit — 임계치 초과 차단'));
  assert.ok(root.textContent.includes('rule-geo-ip — 위험 지역 차단'));
});

test('3. unknown_evidence: 존재하지 않는 근거 ID 포함 시 거부 및 data 속성 미부여', () => {
  const container = new MockElement('div');
  const root = renderExplanation({
    event: sampleEvent,
    explanation: {
      status: 'ok',
      data: {
        summary: '가상의 근거를 참조한 설명',
        evidenceIds: ['evi-auth-fail', 'evi-fake-unreal'],
        proposals: []
      }
    }
  }, container);

  assert.equal(root.getAttribute('data-student-explanation-event'), null, '근거 불일치 시 속성이 없어야 함');
  assert.ok(root.textContent.includes('INVALID_EVIDENCE') || root.textContent.includes('근거가 맞지 않아'));
  assert.ok(root.textContent.includes('기록은 그대로 유지됩니다.'));
});

test('4. insufficient_evidence: event가 null이어도 error 발생 시 안전한 오류 코드/메시지 노출', () => {
  const container = new MockElement('div');
  const root = renderExplanation({
    event: null,
    explanation: {
      status: 'error',
      error: { code: 'RATE_LIMIT', message: '요청 한도 초과' }
    }
  }, container);

  assert.equal(root.getAttribute('data-student-explanation-event'), null);
  assert.ok(root.textContent.includes('RATE_LIMIT'));
  assert.ok(root.textContent.includes('기록은 그대로 유지됩니다.'));
});

test('5. wrong_event_rejected: 오류 없이 event만 null인 경우 기록 선택 안내 표시 및 data 속성 미부여', () => {
  const container = new MockElement('div');
  const root = renderExplanation({
    event: null,
    explanation: { status: 'ok', data: { summary: '사건 없는 설명' } }
  }, container);

  assert.equal(root.getAttribute('data-student-explanation-event'), null);
  assert.ok(root.textContent.includes('보안 기록에서 기록을 먼저 고르세요'));
});

test('6. proposal_not_executed: proposals 미실행 상태 및 executed: true 거부 확인', () => {
  const container = new MockElement('div');

  // 1) 정상 제안: 미실행 및 사람 확인 필요 고지
  const rootWithProposal = renderExplanation({
    event: sampleEvent,
    explanation: {
      status: 'ok',
      data: {
        summary: '접속 차단 조치 제안',
        evidenceIds: ['evi-auth-fail'],
        proposals: [
          { action: 'block_ip', evidenceIds: ['evi-auth-fail'], reason: '비정상 접속 폭주 방어' }
        ],
        requiresHumanConfirmation: true,
        executed: false
      }
    }
  }, container);

  assert.ok(rootWithProposal.textContent.includes('사람 확인이 필요하며 실행되지 않았습니다'));
  assert.ok(rootWithProposal.textContent.includes('block_ip'));
  // 실행 버튼이 존재하지 않는지 확인
  const btn = rootWithProposal.querySelector('button');
  assert.equal(btn, null, '실행 버튼은 생성되지 않아야 함');

  // 2) 위반: executed: true인 경우 즉시 거부 및 속성 미부여
  const rootExecuted = renderExplanation({
    event: sampleEvent,
    explanation: {
      status: 'ok',
      data: {
        summary: '이미 실행된 조치',
        evidenceIds: ['evi-auth-fail'],
        proposals: [{ action: 'block_ip', reason: '실행됨' }],
        executed: true
      }
    }
  }, container);

  assert.equal(rootExecuted.getAttribute('data-student-explanation-event'), null);
  assert.ok(rootExecuted.textContent.includes('AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다'));
});

test('7. unknown_state: unknown 값을 확인 불가로 표시하며 정상/안전으로 왜곡하지 않음', () => {
  const container = new MockElement('div');
  const root = renderExplanation({
    event: sampleEvent,
    explanation: {
      status: 'ok',
      data: {
        summary: '상태 검증 테스트',
        evidenceIds: ['evi-auth-fail'],
        proposals: []
      }
    }
  }, container);

  assert.ok(root.textContent.includes('세션: 확인 불가(unknown)'));
  assert.ok(root.textContent.includes('기기: 확인 불가(unknown)'));
  assert.ok(!root.textContent.includes('세션: 정상'));
  assert.ok(!root.textContent.includes('기기: 안전'));

  // 지원 조치가 없을 때 제안이 없는 이유 설명
  assert.ok(root.textContent.includes('연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상)'));
});

test('8. explanation_refresh: 다른 이벤트 선택 또는 실패 시 이전 설명 및 속성 초기화', () => {
  const container = new MockElement('div');

  // 1차 성공
  renderExplanation({
    event: sampleEvent,
    explanation: {
      status: 'ok',
      data: { summary: '첫번째 성공 설명', evidenceIds: ['evi-auth-fail'], proposals: [] }
    }
  }, container);
  assert.ok(container.textContent.includes('첫번째 성공 설명'));

  // 2차 실패 렌더링으로 갱신
  renderExplanation({
    event: sampleEvent,
    explanation: {
      status: 'error',
      error: { code: 'AI_TIMEOUT', message: '응답 시간 초과' }
    }
  }, container);

  assert.ok(!container.textContent.includes('첫번째 성공 설명'), '이전 설명 텍스트가 제거되어야 함');
  assert.ok(container.textContent.includes('TIMEOUT'));
  const childWrapper = container.children[0];
  assert.equal(childWrapper.getAttribute('data-student-explanation-event'), null, '실패 시 속성이 남아있지 않아야 함');
});

test('9. non_ai_regression: AI 설명 수정 후에도 renderEvents는 기존 계약대로 정상 동작함', () => {
  const container = new MockElement('div');
  const eventsRoot = renderEvents({
    status: 'ok',
    data: [sampleEvent]
  }, container);

  assert.ok(eventsRoot.textContent.includes('evt-20261022-001'));
  assert.ok(eventsRoot.textContent.includes('비정상 접속 차단'));
});
