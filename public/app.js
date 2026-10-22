/**
 * public/app.js
 * 제공 앱과 학생 확장 모듈(student/extension.mjs)의 연결 및 새로고침 관리
 */

import { createStudentView, renderEvents } from '/student/extension.mjs';

// 학생 뷰 인스턴스 초기화
export const studentView = typeof createStudentView === 'function' ? createStudentView() : { renderEvents };

/**
 * 접속 기록 및 XDR 사건 데이터 불러오기 및 학생 화면 갱신
 * 제공 화면이 /api/events의 기록 자료를 학생 renderEvents에 전달합니다.
 * @param {HTMLElement} [container] 
 */
export async function refreshEvents(container) {
  const target = container || document.getElementById('events-container');
  if (!target) return;

  // 1. 로딩 상태 렌더링
  const renderFn = studentView.renderEvents || renderEvents;
  renderFn({ status: 'loading' }, target);

  try {
    const res = await fetch('/api/events', { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      renderFn({ status: 'error', error: err }, target);
      return;
    }

    // /api/events로부터 최근 본인 기록 배열 수신
    const events = await res.json();
    
    // 정상 렌더링 호출
    renderFn({ status: 'ok', data: Array.isArray(events) ? events : [] }, target);
  } catch (err) {
    renderFn({
      status: 'error',
      error: { message: err?.message || '기록을 불러오지 못했습니다.' }
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
