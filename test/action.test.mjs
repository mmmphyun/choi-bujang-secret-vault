import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudentView, renderAction, renderEvents, renderStatus, renderAiConnection, renderExplanation } from '../student/extension.mjs';

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

  querySelectorAll(selector) {
    const results = [];
    function search(node) {
      for (const child of node.children) {
        if (selector.startsWith('.') && child.className && child.className.includes(selector.slice(1))) {
          results.push(child);
        } else if (child.tagName === selector.toUpperCase()) {
          results.push(child);
        }
        search(child);
      }
    }
    search(this);
    return results;
  }
}

// global document mock
if (typeof globalThis.document === 'undefined' || !globalThis.document.querySelector) {
  globalThis.document = {
    createElement(tag) {
      return new MockElement(tag);
    },
    getElementById(id) {
      return null;
    },
    querySelector(selector) {
      return null;
    }
  };
}

test('1. student-source-changed: student/extension.mjs 파일 및 renderAction export 확인', () => {
  const code = fs.readFileSync('student/extension.mjs', 'utf-8');
  assert.ok(code.includes('export function renderAction'), 'renderAction 함수가 export 되어야 함');
  assert.ok(typeof renderAction === 'function', 'renderAction이 함수로 불러와져야 함');

  const view = createStudentView();
  assert.ok(typeof view.renderAction === 'function', 'createStudentView()에 renderAction이 포함되어야 함');
});

test('2. proposal_execution_separation: loading, prepared, executing, pending 상태 분리 및 ACK!=효과 검증', () => {
  // loading
  const loadEl = renderAction({ status: 'loading' });
  const loadText = loadEl.textContent;
  assert.ok(loadText.includes('조치 준비 또는 결과 조회 중'), 'loading 시 준비 또는 결과 조회 중 표시 필요');
  assert.ok(!loadText.includes('효과 확인'), 'loading을 성공이나 효과로 표시해서는 안 됨');

  // prepared
  const prepEl = renderAction({ status: 'prepared', confirmationExpiresAt: '2026-10-27T18:00:00Z' });
  const prepText = prepEl.textContent;
  assert.ok(prepText.includes('준비됨·미실행'), 'prepared 시 준비됨·미실행 문구 표시 필요');
  assert.ok(prepText.includes('2026-10-27T18:00:00Z'), 'confirmationExpiresAt이 표시되어야 함');
  assert.ok(!prepText.includes('효과 확인'), 'prepared를 성공이나 효과로 표시해서는 안 됨');

  // executing
  const execEl = renderAction({ status: 'executing' });
  const execText = execEl.textContent;
  assert.ok(execText.includes('서버에 전달 중'), 'executing 시 서버에 전달 중 표시 필요');
  assert.ok(execText.includes('완료 아님'), 'executing 시 완료 아님 고지 필요');

  // pending (ACK != 실행 성공)
  const pendEl = renderAction({ status: 'pending' });
  const pendText = pendEl.textContent;
  assert.ok(pendText.includes('서버 접수·처리 중'), 'pending 시 서버 접수·처리 중 표시 필요');
  assert.ok(pendText.includes('ACK') && pendText.includes('효과가 아닙니다'), 'ACK는 효과가 아님을 명시해야 함');
  assert.ok(pendText.includes('완료 아님'), 'pending 시 완료 아님 고지 필요');
});

test('3. human_confirmation: prepared 상태에서 사람 확인 안내 및 학생 코드 내 버튼/티켓 미생성 확인', () => {
  const container = new MockElement('div');
  const el = renderAction({
    status: 'prepared',
    confirmationExpiresAt: '2026-10-28T12:00:00Z'
  }, container);

  const text = el.textContent;
  assert.ok(text.includes('확인 기한: 2026-10-28T12:00:00Z'), '확인 기한 안내 필요');
  assert.ok(text.includes('사람 확인') || text.includes('확인한 후 집행'), '사람 확인 단계 고지 필요');

  // 학생 코드 내 버튼이나 폼 생성 금지
  const buttons = el.querySelectorAll('button');
  assert.strictEqual(buttons.length, 0, '학생 코드 내부에 조치 버튼을 직접 추가하지 않아야 함');
});

test('4. current_intent_binding: 식별자(event.id, 근거 ID, actionId, target, receipt) 표시 및 data-* 속성 부여', () => {
  // Case A: event.evidence가 배열인 경우 (공식 프로젝트 규격)
  const dummyEventArray = {
    id: 'evt-sec-999',
    evidence: [{ id: 'evi-888', text: '비정상 접속 탐지' }]
  };
  const dummyTarget = {
    id: 'node-srv-01',
    generation: 3
  };
  const dummyReceipt = {
    requestId: 'req-uuid-1234',
    receiptId: 'rcpt-5678',
    version: 2
  };

  const el = renderAction({
    status: 'pending',
    event: dummyEventArray,
    actionId: 'isolate-network',
    target: dummyTarget,
    receipt: dummyReceipt
  });

  // data-* 속성 부여 확인
  assert.strictEqual(el.getAttribute('data-student-action-event'), 'evt-sec-999');
  assert.strictEqual(el.getAttribute('data-student-action-request'), 'req-uuid-1234');

  // 텍스트 바인딩 확인
  const text = el.textContent;
  assert.ok(text.includes('evt-sec-999'), '사건 ID가 표시되어야 함');
  assert.ok(text.includes('evi-888'), '배열 evidence[0].id 근거 ID가 표시되어야 함');
  assert.ok(text.includes('isolate-network'), '조치 ID가 표시되어야 함');
  assert.ok(text.includes('node-srv-01') && text.includes('3'), '대상 ID 및 generation이 표시되어야 함');
  assert.ok(text.includes('req-uuid-1234'), '요청 ID가 표시되어야 함');
  assert.ok(text.includes('rcpt-5678'), '영수증 ID가 표시되어야 함');
  assert.ok(text.includes('2'), '버전이 표시되어야 함');

  // Case B: event.evidence가 단일 객체인 경우도 호환성 지원
  const dummyEventObj = {
    id: 'evt-sec-777',
    evidence: { id: 'evi-777' }
  };
  const elObj = renderAction({
    status: 'pending',
    event: dummyEventObj
  });
  assert.ok(elObj.textContent.includes('evi-777'), '단일 객체 evidence.id도 표시되어야 함');
});

test('5. observed_server_result: succeeded 상태에서 effectApplied===true 조건 엄격 검증', () => {
  // Case A: effectApplied === true -> 효과 확인
  const successEl = renderAction({
    status: 'succeeded',
    receipt: { receiptId: 'rcpt-pass-001' },
    observation: {
      observedAt: '2026-10-27T17:30:00Z',
      effectApplied: true
    }
  });
  const successText = successEl.textContent;
  assert.ok(successText.includes('효과 확인(succeeded)'), 'effectApplied: true 시 효과 확인 표시');
  assert.ok(successText.includes('2026-10-27T17:30:00Z'), '관측 시각 표시');
  assert.ok(successText.includes('effectApplied: true'), 'effectApplied: true 명시');
  assert.ok(successText.includes('rcpt-pass-001'), 'receiptId 표시');

  // Case B: effectApplied === false -> 결과 불명 처리
  const falseEl = renderAction({
    status: 'succeeded',
    receipt: { receiptId: 'rcpt-fail-002' },
    observation: {
      observedAt: '2026-10-27T17:30:00Z',
      effectApplied: false
    }
  });
  const falseText = falseEl.textContent;
  assert.ok(!falseText.includes('효과 확인(succeeded)'), 'effectApplied false 시 성공으로 표시 금지');
  assert.ok(falseText.includes('결과 불명(unknown)'), 'effectApplied false 시 결과 불명 처리 필요');
  assert.ok(falseText.includes('재조회'), '결과 재조회 안내 필요');

  // Case C: observation 누락 -> 결과 불명 처리
  const noObsEl = renderAction({
    status: 'succeeded',
    receipt: { receiptId: 'rcpt-no-obs' }
  });
  const noObsText = noObsEl.textContent;
  assert.ok(!noObsText.includes('효과 확인(succeeded)'), 'observation 없을 때 효과 확인 표시 금지');
  assert.ok(noObsText.includes('결과 불명(unknown)'), '결과 불명 처리 필요');

  // Case D: observation.observedAt 누락 -> 결과 불명 처리
  const noObservedAtEl = renderAction({
    status: 'succeeded',
    receipt: { receiptId: 'rcpt-pass-001' },
    observation: {
      effectApplied: true
    }
  });
  assert.ok(!noObservedAtEl.textContent.includes('효과 확인(succeeded)'), 'observedAt 누락 시 효과 확인 표시 금지');
  assert.ok(noObservedAtEl.textContent.includes('결과 불명(unknown)'), 'observedAt 누락 시 결과 불명 처리 필요');

  // Case E: receipt.receiptId 누락 -> 결과 불명 처리
  const noReceiptIdEl = renderAction({
    status: 'succeeded',
    receipt: {},
    observation: {
      observedAt: '2026-10-27T17:30:00Z',
      effectApplied: true
    }
  });
  assert.ok(!noReceiptIdEl.textContent.includes('효과 확인(succeeded)'), 'receiptId 누락 시 효과 확인 표시 금지');
  assert.ok(noReceiptIdEl.textContent.includes('결과 불명(unknown)'), 'receiptId 누락 시 결과 불명 처리 필요');
});

test('6. unknown_not_success: unknown 상태 시 성공/효과없음 단정 금지 및 재조회 안내 검증', () => {
  const el = renderAction({ status: 'unknown' });
  const text = el.textContent;
  assert.ok(text.includes('결과 불명(unknown)'), '결과 불명 상태 문구 필요');
  assert.ok(text.includes('효과 없음으로도 성공으로도 판단하지 말고'), '효과 없음/성공 단정 금지 고지 필요');
  assert.ok(text.includes('결과만 재조회') || text.includes('재조회하십시오'), '결과 재조회 안내 필요');
});

test('7. duplicate_prevention: 요청 ID 및 버전 구분을 통한 중복 혼선 방지', () => {
  const req1 = renderAction({
    status: 'pending',
    receipt: { requestId: 'req-alpha', version: 1 }
  });
  const req2 = renderAction({
    status: 'pending',
    receipt: { requestId: 'req-beta', version: 2 }
  });

  assert.strictEqual(req1.getAttribute('data-student-action-request'), 'req-alpha');
  assert.strictEqual(req2.getAttribute('data-student-action-request'), 'req-beta');
  assert.ok(req1.textContent.includes('req-alpha') && req1.textContent.includes('1'));
  assert.ok(req2.textContent.includes('req-beta') && req2.textContent.includes('2'));
});

test('8. action_refresh: 새 입력 전달 시 이전 상태 및 내용 완전 초기화 확인', () => {
  const container = new MockElement('div');

  // 1차 렌더링: event A, status prepared
  renderAction({
    status: 'prepared',
    event: { id: 'evt-first' },
    actionId: 'block-ip'
  }, container);

  assert.strictEqual(container.children.length, 1);
  assert.strictEqual(container.children[0].getAttribute('data-student-action-event'), 'evt-first');
  assert.ok(container.textContent.includes('evt-first'));
  assert.ok(container.textContent.includes('block-ip'));

  // 2차 렌더링: event B, status loading
  renderAction({
    status: 'loading',
    event: { id: 'evt-second' }
  }, container);

  assert.strictEqual(container.children.length, 1);
  assert.strictEqual(container.children[0].getAttribute('data-student-action-event'), 'evt-second');
  assert.ok(container.textContent.includes('evt-second'));
  assert.ok(!container.textContent.includes('evt-first'), '이전 이벤트 ID가 남아있어서는 안 됨');
  assert.ok(!container.textContent.includes('block-ip'), '이전 조치 내용이 남아있어서는 안 됨');
});

test('9. expired, denied, failed, error 상태 처리 검증', () => {
  // expired
  const expEl = renderAction({ status: 'expired' });
  assert.ok(expEl.textContent.includes('확인 기한 지남(expired)'));
  assert.ok(expEl.textContent.includes('다시 준비'));

  // denied
  const denEl = renderAction({ status: 'denied', message: '권한 부족' });
  assert.ok(denEl.textContent.includes('거절(denied)'));
  assert.ok(denEl.textContent.includes('권한 부족'));

  // failed
  const failEl = renderAction({ status: 'failed', message: '통신 시간 초과' });
  assert.ok(failEl.textContent.includes('실패(failed)'));
  assert.ok(failEl.textContent.includes('통신 시간 초과'));

  // error
  const errEl = renderAction({
    status: 'error',
    error: { code: 'NETWORK_ERR', message: '연결 실패' }
  });
  assert.ok(errEl.textContent.includes('요청 처리 안 됨(error)'));
  assert.ok(errEl.textContent.includes('NETWORK_ERR'));
  assert.ok(errEl.textContent.includes('연결 실패'));
});

test('10. non_regression: 이전 단계 함수 회귀 검증', () => {
  const view = createStudentView();
  assert.ok(typeof view.renderEvents === 'function');
  assert.ok(typeof view.renderStatus === 'function');
  assert.ok(typeof view.renderAiConnection === 'function');
  assert.ok(typeof view.renderExplanation === 'function');
  assert.ok(typeof view.renderAction === 'function');

  // renderExplanation 호출 테스트
  const explEl = view.renderExplanation({
    event: { id: 'evt-test', evidence: [{ id: 'evi-test', text: '정상 근거' }], rules: [] },
    explanation: { status: 'ok', data: { summary: '테스트 요약', evidenceIds: ['evi-test'], proposals: [] } }
  });
  assert.strictEqual(explEl.getAttribute('data-student-explanation-event'), 'evt-test');
});
