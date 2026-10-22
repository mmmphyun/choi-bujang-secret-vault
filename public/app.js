/**
 * public/app.js
 * 제공 앱과 학생 확장 모듈(student/extension.mjs)의 연결 및 새로고침 관리
 */

import { createStudentView, renderEvents } from '/student/extension.mjs';

// 학생 뷰 인스턴스 초기화
export const studentView = typeof createStudentView === 'function' ? createStudentView() : { renderEvents };

/**
 * 접속 기록 및 XDR 사건 데이터 불러오기 및 학생 화면 갱신
 * @param {HTMLElement} [container] 
 */
export async function refreshEvents(container) {
  const target = container || document.getElementById('events-container');
  if (!target) return;

  // 1. 로딩 상태 렌더링
  const renderFn = studentView.renderEvents || renderEvents;
  renderFn({ status: 'loading' }, target);

  try {
    const res = await fetch('/api/ops/summary', { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      renderFn({ status: 'error', error: err }, target);
      return;
    }

    // 모의 또는 조회된 최근 40건 데이터 수신 처리
    const resData = await res.json().catch(() => ({}));
    const events = Array.isArray(resData.events) ? resData.events : [];
    
    // 정상 렌더링 호출 (빈 배열 또는 이벤트 목록)
    renderFn({ status: 'ok', data: events }, target);
  } catch (err) {
    renderFn({
      status: 'error',
      error: { message: err?.message || '네트워크 연결 오류' }
    }, target);
  }
}

// 브라우저 DOM 준비 시 자동 바인딩
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('btn-refresh-events');
    const container = document.getElementById('events-container');

    if (refreshBtn && container) {
      refreshBtn.addEventListener('click', () => refreshEvents(container));
    }

    // 초기 자동 조회
    if (container) {
      refreshEvents(container);
    }
  });
}
