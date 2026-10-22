import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEvents } from '../student/extension.mjs';

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
    state: { access: 'allowed', session: 'valid', device: 'registered' },
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

test('1. 빈 배열 처리: 표시할 기록이 없습니다 출력 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: [] }, container);
  assert.equal(container.textContent, '표시할 기록이 없습니다');
});

test('2. 실패(error) 처리: 기록을 불러오지 못했습니다 문구 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'error', error: { message: '네트워크 연결 시간 초과' } }, container);
  assert.match(container.textContent, /^기록을 불러오지 못했습니다: 네트워크 연결 시간 초과/);
});

test('3. 계약 불일치(CONTRACT_MISMATCH) 처리: 확인 불가 및 목록 초기화 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'CONTRACT_MISMATCH' }, container);
  assert.match(container.textContent, /확인 불가\(CONTRACT_MISMATCH\)/);
});

test('4. 최신순 정렬 및 원본 배열 불변성 확인', () => {
  const container = new MockElement('div');
  const copyOfMock = JSON.parse(JSON.stringify(mockData));
  renderEvents({ status: 'ok', data: copyOfMock }, container);

  // 원본 첫 요소는 evt-older였으나, 렌더링된 첫 요소는 더 최신인 evt-newer여야 함
  const rows = container.querySelectorAll('[data-student-event-id]');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].getAttribute('data-student-event-id'), 'evt-newer');
  assert.equal(rows[1].getAttribute('data-student-event-id'), 'evt-older');

  // 원본 배열이 변형되지 않았는지 검증
  assert.equal(copyOfMock[0].id, 'evt-older');
});

test('5. 필터 라벨 및 컨트롤 접근성 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: mockData }, container);

  const kindSelect = container.querySelector('#student-filter-kind');
  const appSelect = container.querySelector('#student-filter-app');
  const accessSelect = container.querySelector('#student-filter-access');

  assert.ok(kindSelect, '기록 종류 필터 존재');
  assert.ok(appSelect, '업무 앱 필터 존재');
  assert.ok(accessSelect, '접속 상태 필터 존재');

  assert.equal(kindSelect.getAttribute('aria-label'), '기록 종류');
  assert.equal(appSelect.getAttribute('aria-label'), '업무 앱');
  assert.equal(accessSelect.getAttribute('aria-label'), '접속 상태');
});

test('6. 상세 버튼 및 상태 정보(unknown -> 확인 불가) 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: mockData }, container);

  // evt-newer 상세 버튼 확인
  const detailBtn = container.querySelector('[aria-label="evt-newer 상세"]');
  assert.ok(detailBtn, '<event.id> 상세 버튼 존재');

  // 상세 버튼 클릭
  detailBtn.dispatchEvent({ type: 'click' });

  // 상세 영역 생성 확인
  const detailSec = container.querySelector('[data-student-event-detail="evt-newer"]');
  assert.ok(detailSec, 'data-student-event-detail 요소 생성');

  const text = detailSec.textContent;
  assert.match(text, /확인 불가\(unknown\)/, 'unknown 값이 확인 불가(unknown)으로 표시됨');
  assert.match(text, /rule-xdr/, '규칙 id 포함');
  assert.match(text, /evi-xdr/, '근거 id 포함');
});

test('7. supportedActions 빈 배열 시 조치 버튼 미생성 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: mockData }, container);

  const detailBtn = container.querySelector('[aria-label="evt-newer 상세"]');
  detailBtn.dispatchEvent({ type: 'click' });

  const detailSec = container.querySelector('[data-student-event-detail="evt-newer"]');
  const buttonsInDetail = detailSec.querySelectorAll('button');
  assert.equal(buttonsInDetail.length, 0, '상세 영역 내 조치 버튼이 존재하지 않아야 함');
});

test('8. 다시 불러오기(refresh) 시 이전 상세 및 목록 초기화 확인', () => {
  const container = new MockElement('div');
  renderEvents({ status: 'ok', data: mockData }, container);

  // 1회차 클릭으로 상세 열기
  const detailBtn = container.querySelector('[aria-label="evt-newer 상세"]');
  detailBtn.dispatchEvent({ type: 'click' });
  assert.ok(container.querySelector('[data-student-event-detail="evt-newer"]'));

  // 2회차 호출 (refresh)
  renderEvents({ status: 'ok', data: mockData }, container);

  // 이전 상세는 닫혀 있어야 함
  assert.equal(container.querySelector('[data-student-event-detail="evt-newer"]'), null);
});
