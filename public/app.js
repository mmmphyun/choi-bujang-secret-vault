/**
 * public/app.js
 * 제공 앱과 학생 확장 모듈(student/extension.mjs)의 연결, 새로고침 및 AI 통신 관리
 */

import { createStudentView, renderEvents, renderAiConnection, renderExplanation } from '/student/extension.mjs';

// 학생 뷰 인스턴스 초기화
export const studentView = typeof createStudentView === 'function' ? createStudentView() : {
  renderEvents,
  renderAiConnection,
  renderExplanation
};

/**
 * 접속 기록 및 XDR 사건 데이터 불러오기 및 학생 화면 갱신
 * @param {HTMLElement} [container] 
 */
export async function refreshEvents(container) {
  const target = container || document.getElementById('events-container');
  if (!target) return;

  const renderFn = studentView.renderEvents || renderEvents;
  renderFn({ status: 'loading' }, target);

  try {
    const res = await fetch('/api/events', { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      renderFn({ status: 'error', error: err }, target);
      return;
    }

    const events = await res.json();
    renderFn({ status: 'ok', data: Array.isArray(events) ? events : [] }, target);
  } catch (err) {
    renderFn({
      status: 'error',
      error: { message: err?.message || '기록을 불러오지 못했습니다.' }
    }, target);
  }
}

// 17단계: 취소 및 늦게 도착한 응답 무효화를 위한 상태 변수
let currentAiCheckController = null;
let currentAiCheckRequestId = 0;

/**
 * AI 연결 점검 요청 함수
 * 취소 뒤 늦게 도착한 응답이 현재 결과를 되살리지 않도록 요청 ID를 검증합니다.
 * @param {HTMLElement} [container]
 */
export async function checkAiConnection(container) {
  const target = container || document.getElementById('ai-connection-container');
  if (!target) return;

  // 이전 진행 중 요청이 있다면 즉시 중단
  if (currentAiCheckController) {
    currentAiCheckController.abort();
  }

  // 신규 요청 시퀀스 할당 및 AbortController 생성
  const requestId = ++currentAiCheckRequestId;
  currentAiCheckController = new AbortController();
  const signal = currentAiCheckController.signal;

  const renderFn = studentView.renderAiConnection || renderAiConnection;
  renderFn({ status: 'loading' }, target);

  try {
    const res = await fetch('/api/ai/connection', { signal, cache: 'no-store' });

    // 요청이 취소되었거나 더 새로운 요청이 시작되었으면 응답을 완전히 무시 (무효화)
    if (requestId !== currentAiCheckRequestId || signal.aborted) {
      return;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ code: 'INTERNAL_ERROR', message: 'AI 점검 실패' }));
      renderFn({
        status: 'error',
        error: errData,
        checkedAt: new Date().toISOString()
      }, target);
      return;
    }

    const data = await res.json().catch(() => ({}));

    // 응답 완료 시점에도 취소 여부 재확인
    if (requestId !== currentAiCheckRequestId || signal.aborted) {
      return;
    }

    renderFn({
      status: 'ok',
      data,
      checkedAt: new Date().toISOString(),
      explanationAccepted: false
    }, target);
  } catch (err) {
    // 취소로 인한 중단이거나 만료된 요청 응답인 경우 무시
    if (requestId !== currentAiCheckRequestId || signal.aborted || err?.name === 'AbortError') {
      return;
    }

    renderFn({
      status: 'error',
      error: { code: 'NETWORK_ERROR', message: err?.message || '네트워크 연결 오류' },
      checkedAt: new Date().toISOString()
    }, target);
  } finally {
    if (requestId === currentAiCheckRequestId) {
      currentAiCheckController = null;
    }
  }
}

/**
 * AI 연결 점검 취소 함수
 * 활성 요청을 Abort하고 요청 ID를 증가시켜 늦은 응답을 무효화합니다.
 * @param {HTMLElement} [container]
 */
export function cancelAiConnectionCheck(container) {
  const target = container || document.getElementById('ai-connection-container');
  
  // 진행 중 요청 취소
  if (currentAiCheckController) {
    currentAiCheckController.abort();
    currentAiCheckController = null;
  }

  // 시퀀스를 올려 늦게 도착하는 fetch 응답이 결과를 되살리지 못하게 함
  currentAiCheckRequestId++;

  const renderFn = studentView.renderAiConnection || renderAiConnection;
  renderFn({
    status: 'error',
    error: { code: 'CANCELLED', message: '사용자에 의해 점검이 취소되었습니다.' },
    checkedAt: new Date().toISOString()
  }, target);
}

/**
 * AI 연결 재연결 및 상태 초기화 함수
 * 재연결 시 진행 중인 점검 요청을 즉시 중단(abort)하고 응답을 무효화하여
 * 늦게 도착한 점검 결과가 남지 않도록 완전히 초기화합니다.
 * @param {HTMLElement} [container]
 */
export function resetAiConnection(container) {
  const target = container || document.getElementById('ai-connection-container');

  // 진행 중인 점검 요청 즉시 중단
  if (currentAiCheckController) {
    currentAiCheckController.abort();
    currentAiCheckController = null;
  }

  // 시퀀스 ID 증가로 지연 응답 무효화
  currentAiCheckRequestId++;

  if (target) {
    const renderFn = studentView.renderAiConnection || renderAiConnection;
    renderFn({ status: 'idle' }, target);
  }
}

/**
 * 보안 사건 AI 설명 요청 함수
 * 과제 기준의 /api/ai/explain 경로를 호출하여 사건 설명을 생성하고 renderExplanation으로 전달합니다.
 * @param {string} eventId
 * @param {HTMLElement} [container]
 */
export async function explainSecurityEvent(eventId, container) {
  const target = container || document.getElementById('explanation-container');
  if (!target) return;

  const renderFn = studentView.renderExplanation || renderExplanation;
  renderFn({
    event: { id: eventId },
    explanation: { status: 'loading' }
  }, target);

  try {
    const res = await fetch('/api/ai/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      renderFn({
        event: { id: eventId },
        explanation: { status: 'error', error: err },
        checkedAt: new Date().toISOString()
      }, target);
      return;
    }

    const data = await res.json();
    renderFn({
      event: { id: eventId },
      explanation: data,
      checkedAt: new Date().toISOString()
    }, target);
  } catch (err) {
    renderFn({
      event: { id: eventId },
      explanation: {
        status: 'error',
        error: { code: 'EXPLANATION_FAILED', message: err?.message || '사건 설명 생성 오류' }
      },
      checkedAt: new Date().toISOString()
    }, target);
  }
}

// 브라우저 DOM 준비 시 자동 바인딩
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // 15단계 기록 새로고침
    const refreshBtn = document.getElementById('btn-refresh-events');
    const eventsContainer = document.getElementById('events-container');
    if (refreshBtn && eventsContainer) {
      refreshBtn.addEventListener('click', () => refreshEvents(eventsContainer));
    }
    if (eventsContainer) {
      refreshEvents(eventsContainer);
    }

    // 17단계 AI 연결 점검 및 취소 버튼 바인딩
    const checkBtn = document.getElementById('btn-check-ai-connection');
    const cancelBtn = document.getElementById('btn-cancel-ai-check');
    const aiContainer = document.getElementById('ai-connection-container');
    const startConnectBtn = document.getElementById('btn-start-ai-connect');
    const confirmConnectBtn = document.getElementById('btn-confirm-ai-connect');
    const connectNumberSpan = document.getElementById('ai-connect-number');

    if (startConnectBtn && connectNumberSpan) {
      startConnectBtn.addEventListener('click', () => {
        resetAiConnection(aiContainer);
        connectNumberSpan.textContent = '확인 번호: AG-90118';
      });
    }

    if (confirmConnectBtn) {
      confirmConnectBtn.addEventListener('click', () => {
        resetAiConnection(aiContainer);
      });
    }

    if (checkBtn && aiContainer) {
      checkBtn.addEventListener('click', () => checkAiConnection(aiContainer));
    }

    if (cancelBtn && aiContainer) {
      cancelBtn.addEventListener('click', () => cancelAiConnectionCheck(aiContainer));
    }

    // 사건 설명 테스트 버튼 바인딩
    const explainBtn = document.getElementById('btn-test-ai-explain');
    const explanationContainer = document.getElementById('explanation-container');
    if (explainBtn && explanationContainer) {
      explainBtn.addEventListener('click', () => {
        explainSecurityEvent('evt-20261022-001', explanationContainer);
      });
    }

    // 초기 상태 렌더링 (점검 전)
    if (aiContainer) {
      const renderFn = studentView.renderAiConnection || renderAiConnection;
      renderFn({ status: 'idle' }, aiContainer);
    }
  });
}
