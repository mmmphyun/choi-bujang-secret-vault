import { randomUUID } from 'node:crypto';
import { authenticate, supabaseRequest } from '../_auth.js';

export default async function handler(req, res) {
  const authUser = await authenticate(req, res);
  if (!authUser) return;

  if (req.method === 'GET') {
    try {
      const endpoint = `/rest/v1/notes?owner_id=eq.${encodeURIComponent(authUser.userId)}&select=id,title,content,created_at&order=created_at.desc`;
      const response = await supabaseRequest(endpoint);
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Database request failed' });
      }

      const rows = await response.json();
      const notes = rows.map(r => ({
        id: r.id,
        title: r.title,
        body: r.content
      }));

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(notes);
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST') {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    payload = payload || {};

    const { id: reqId, title, body: reqBody, content } = payload;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const noteId = (typeof reqId === 'string' && reqId.trim()) ? reqId.trim() : randomUUID();
    const noteTitle = title.trim();
    const noteBody = (typeof reqBody === 'string') ? reqBody : (typeof content === 'string' ? content : '');

    try {
      const response = await supabaseRequest('/rest/v1/notes', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          id: noteId,
          title: noteTitle,
          content: noteBody,
          owner_id: authUser.userId
        })
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to insert note' });
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(201).json({
        id: noteId,
        title: noteTitle,
        body: noteBody
      });
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
