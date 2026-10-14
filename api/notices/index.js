import { authenticate } from '../_auth.js';

// 가상 반 공지 자료 (메모와 구별되는 notice- 자원 ID 사용)
const CLASS_NOTICES = [
  {
    id: 'notice-1',
    title: '강사 공지: 8단계 자료실 구역 격리 안내',
    content: '모든 자료는 구역별로 격리되며, 학생 계정으로 공지를 수정할 수 없습니다.',
    created_at: '2026-10-14T09:00:00.000Z',
    zone: 'notices'
  },
  {
    id: 'notice-2',
    title: '반 공지: 중간 점검 일정',
    content: '중간 방어전 점검은 10월 16일 24시까지 진행됩니다.',
    created_at: '2026-10-14T10:00:00.000Z',
    zone: 'notices'
  }
];

export default async function handler(req, res) {
  // 인증 검증
  const authUser = await authenticate(req, res);
  if (!authUser) return;

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(CLASS_NOTICES);
  }

  if (req.method === 'POST') {
    // 요청 본문이나 헤더의 role을 절대 신뢰하지 않음
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(403).json({ error: 'Forbidden: Instructor permission required' });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
