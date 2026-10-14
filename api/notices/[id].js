import { authenticate } from '../_auth.js';

const CLASS_NOTICES = {
  'notice-1': {
    id: 'notice-1',
    title: '강사 공지: 8단계 자료실 구역 격리 안내',
    content: '모든 자료는 구역별로 격리되며, 학생 계정으로 공지를 수정할 수 없습니다.',
    created_at: '2026-10-14T09:00:00.000Z',
    zone: 'notices'
  },
  'notice-2': {
    id: 'notice-2',
    title: '반 공지: 중간 점검 일정',
    content: '중간 방어전 점검은 10월 16일 24시까지 진행됩니다.',
    created_at: '2026-10-14T10:00:00.000Z',
    zone: 'notices'
  }
};

export default async function handler(req, res) {
  const authUser = await authenticate(req, res);
  if (!authUser) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Notice id is required' });
  }

  // 자원 구역 검증: 공지 ID가 아닌 다른 구역 자원 ID(예: 메모 ID)로 접근 시 차단
  if (!id.startsWith('notice-')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(403).json({ error: 'Forbidden: Invalid notice zone resource' });
  }

  if (req.method === 'GET') {
    const notice = CLASS_NOTICES[id];
    if (!notice) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ error: 'Notice not found' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(notice);
  }

  if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    // 요청 본문이나 헤더의 role='instructor' 주장을 신뢰하지 않고 학생 계정의 공지 수정 차단
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(403).json({ error: 'Forbidden: Instructor permission required' });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
