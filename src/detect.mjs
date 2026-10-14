export function detect(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('invalid_detection_events');
  }

  // 사용자별 GET 요청 타임스탬프(ms) 수집
  const userReads = new Map();

  for (const event of events) {
    if (!event || typeof event !== 'object') {
      continue;
    }

    const at = event.at;
    const method = event.method;
    const sub = event.identity?.sub;

    if (method === 'GET' && typeof sub === 'string' && sub && typeof at === 'string') {
      const time = new Date(at).getTime();
      if (!Number.isNaN(time)) {
        if (!userReads.has(sub)) {
          userReads.set(sub, []);
        }
        userReads.get(sub).push(time);
      }
    }
  }

  // 10분(600,000ms) 구간 내 121건 이상 조회(burst_read) 탐지
  const WINDOW_MS = 10 * 60 * 1000;
  const THRESHOLD = 120; // 120건 초과(121건 이상) 시 의심

  for (const [sub, times] of userReads.entries()) {
    times.sort((a, b) => a - b);
    for (let i = THRESHOLD; i < times.length; i++) {
      if (times[i] - times[i - THRESHOLD] <= WINDOW_MS) {
        return {
          action: 'propose_revocation',
          reasonCode: 'burst_read',
          subject: sub,
        };
      }
    }
  }

  return { action: 'observe' };
}
