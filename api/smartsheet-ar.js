// Vercel serverless function — Smartsheet A/R proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let token, sheetId;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    token   = body?.token;
    sheetId = body?.sheetId;
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON body: ' + e.message });
  }

  if (!token || !sheetId) {
    return res.status(400).json({ error: 'Missing token or sheetId' });
  }

  const url = `https://api.smartsheet.com/2.0/sheets/${String(sheetId).trim()}`;

  try {
    const ssResp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await ssResp.text();
    if (!ssResp.ok) {
      return res.status(ssResp.status).json({
        error: `Smartsheet API error ${ssResp.status}: ${ssResp.statusText}`,
        detail: text,
      });
    }

    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    return res.status(500).json({ error: 'Proxy fetch error: ' + err.message });
  }
}
