import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentView, renderEvents, formatStateValue } from '../student/extension.mjs';

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

// 전역 document mock 설정
globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => null,
  querySelector: (sel) => null,
  body: new MockElement('body'),
};

const mockData = [
  {
    id: 'evt-older',
    kind: 'access',
    at: '2026-10-21T09:00:00Z',
    appId: 'notes-vault',
    summary: '정상 로그인 시도 <b>위조 시도</b>',
    evidence: [{ id: 'evi-1', text: '인증 완료 토큰 수신' }],
    rules: [{ id: 'rule-auth', text: '기본 신원 확인' }],
    state: { access: 'allowed', session: 'active', device: 'registered' },
    supportedActions: []
  },
  {
    id: 'evt-newer',
    kind: 'xdr',
    at: '2026-10-21T10:00:00Z',
    appId: null,
    summary: '비정상 접속 탐지 경보',
    evidence: [{ id: 'evi-xdr', text: '단시간 비정상 대량 요청' }],
    rules: [{ id: 'rule-xdr', text: 'XDR 버스트 차단' }],
    state: { access: 'denied', session: 'unknown', device: 'unknown' },
    supportedActions: []
  }
];

test('1. createStudentView 시작 틀 및 DOM 요소 반환 확인', () => {
  const view = createStudentView();
  assert.equal(typeof view.renderEvents, 'function', 'createStudentView는 renderEvents를 반환해야 함');

  const container = new MockElement('div');
  const returnedEl = view.renderEvents({ status: 'ok', data: mockData }, container);
  assert.ok(returnedEl instanceof MockElement, 'renderEvents는 독립 DOM 요소를 반환해야 함');
});

test('2. 빈 배열 처리: status ok 빈 배열일 때만 "표시할 기록이 없습니다" 출력 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: [] }, container);
  assert.equal(container.textContent, '표시할 기록이 없습니다');
});

test('3. 로딩(loading) 분기 처리 확인 (빈 목록으로 오인 방지)', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'loading' }, container);
  assert.match(container.textContent, /기록을 불러오는 중입니다/);
  assert.doesNotMatch(container.textContent, /표시할 기록이 없습니다/);
});

test('4. 계약 불일치(CONTRACT_MISMATCH) 처리: error.code 기반 실제 계약 형식 확인', () => {
  const container = new MockElement('div');
  // 실제 계약 형태: error 객체의 code 속성에 CONTRACT_MISMATCH 전달
  renderEvents({ status: 'error', error: { code: 'CONTRACT_MISMATCH', message: '스키마 불일치' } }, container);
  assert.match(container.textContent, /확인 불가\(CONTRACT_MISMATCH\)/);
  assert.doesNotMatch(container.textContent, /기록을 불러오지 못했습니다/);
});

test('5. 일반 오류(error) 처리: 기록을 불러오지 못했습니다 문구 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'error', error: { message: '네트워크 연결 시간 초과' } }, container);
  assert.match(container.textContent, /^기록을 불러오지 못했습니다: 네트워크 연결 시간 초과/);
});

test('6. 최신순 정렬 및 원본 배열 불변성 확인', () => {
  const container = new MockElement('div');
  const copyOfMock = JSON.parse(JSON.stringify(mockData));
  renderEvents({ status: 'ok', data: copyOfMock }, container);

  const rows = container.querySelectorAll('[data-student-event-id]');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].getAttribute('data-student-event-id'), 'evt-newer');
  assert.equal(rows[1].getAttribute('data-student-event-id'), 'evt-older');
  assert.equal(copyOfMock[0].id, 'evt-older');
});

test('7. 세션 및 기기 상태값 한국어 설명 및 원래 코드 보존 확인', () => {
  // access
  assert.equal(formatStateValue('access', 'allowed'), '허용(allowed)');
  assert.equal(formatStateValue('access', 'denied'), '거부(denied)');
  assert.equal(formatStateValue('access', 'unknown'), '확인 불가(unknown)');

  // session (13단계 계약)
  assert.equal(formatStateValue('session', 'active'), '유효(active)');
  assert.equal(formatStateValue('session', 'expired'), '만료(expired)');
  assert.equal(formatStateValue('session', 'revoked'), '회수(revoked)');
  assert.equal(formatStateValue('session', 'step_up_required'), '추가 인증 필요(step_up_required)');
  assert.equal(formatStateValue('session', 'unknown'), '확인 불가(unknown)');

  // device (13단계 계약)
  assert.equal(formatStateValue('device', 'registered'), '등록됨(registered)');
  assert.equal(formatStateValue('device', 'unregistered'), '미등록(unregistered)');
  assert.equal(formatStateValue('device', 'blocked'), '차단됨(blocked)');
  assert.equal(formatStateValue('device', 'unknown'), '확인 불가(unknown)');
});

test('8. 상세 버튼 및 상태 정보(세 상태 분리 및 unknown 표기) 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: mockData }, container);

  const detailBtn = container.querySelector('[aria-label="evt-newer 상세"]');
  assert.ok(detailBtn, '<event.id> 상세 버튼 존재');

  detailBtn.dispatchEvent({ type: 'click' });

  const detailSec = container.querySelector('[data-student-event-detail="evt-newer"]');
  assert.ok(detailSec, 'data-student-event-detail 요소 생성');

  const text = detailSec.textContent;
  assert.match(text, /확인 불가\(unknown\)/);
  assert.match(text, /rule-xdr/);
  assert.match(text, /evi-xdr/);
});

test('9. supportedActions 빈 배열 시 조치 버튼 미생성 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: mockData }, container);

  const detailBtn = container.querySelector('[aria-label="evt-newer 상세"]');
  detailBtn.dispatchEvent({ type: 'click' });

  const detailSec = container.querySelector('[data-student-event-detail="evt-newer"]');
  const buttonsInDetail = detailSec.querySelectorAll('button');
  assert.equal(buttonsInDetail.length, 0, '상세 영역 내 조치 버튼 미존재 확인');
});

test('10. 다시 불러오기(refresh) 시 이전 상세 및 목록 초기화 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: mockData }, container);

  const detailBtn = container.querySelector('[aria-label="evt-newer 상세"]');
  detailBtn.dispatchEvent({ type: 'click' });
  assert.ok(container.querySelector('[data-student-event-detail="evt-newer"]'));

  // 2회차 재호출
  renderEvents({ status: 'ok', data: mockData }, container);
  assert.equal(container.querySelector('[data-student-event-detail="evt-newer"]'), null);
});
