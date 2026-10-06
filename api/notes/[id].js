import { authenticate, supabaseRequest } from '../_auth.js';

export default async function handler(req, res) {
  const authUser = await authenticate(req, res);
  if (!authUser) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Note id is required' });
  }

  const encodedId = encodeURIComponent(id);

  if (req.method === 'GET') {
    try {
      const response = await supabaseRequest(`/rest/v1/notes?id=eq.${encodedId}&select=id,title,content`);
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Database request failed' });
      }

      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: 'Note not found' });
      }

      const note = rows[0];
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        id: note.id,
        title: note.title,
        body: note.content
      });
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'PUT') {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    payload = payload || {};

    const { title, body: reqBody, content } = payload;
    const updateData = {};
    if (typeof title === 'string') updateData.title = title.trim();
    if (typeof reqBody === 'string') updateData.content = reqBody;
    else if (typeof content === 'string') updateData.content = content;

    try {
      const response = await supabaseRequest(`/rest/v1/notes?id=eq.${encodedId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to update note' });
      }

      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: 'Note not found' });
      }

      const updated = rows[0];
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        id: updated.id,
        title: updated.title,
        body: updated.content
      });
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // 삭제 전 존재 여부 확인
      const checkRes = await supabaseRequest(`/rest/v1/notes?id=eq.${encodedId}&select=id`);
      if (!checkRes.ok) {
        return res.status(checkRes.status).json({ error: 'Database request failed' });
      }
      const existing = await checkRes.json();
      if (!Array.isArray(existing) || existing.length === 0) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: 'Note not found' });
      }

      const delRes = await supabaseRequest(`/rest/v1/notes?id=eq.${encodedId}`, {
        method: 'DELETE'
      });

      if (!delRes.ok) {
        return res.status(delRes.status).json({ error: 'Failed to delete note' });
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ message: 'Note deleted', id });
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
