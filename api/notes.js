export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const endpoint = new URL('/rest/v1/notes?select=title,content', supabaseUrl);
    const response = await fetch(endpoint, {
      headers: {
        'apikey': secretKey,
        'Authorization': `Bearer ${secretKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Database request failed' });
    }

    const rows = await response.json();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ notes: rows });
  } catch {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
