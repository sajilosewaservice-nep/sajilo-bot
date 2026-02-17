// Serverless WhatsApp send via Meta Cloud API (Vercel-compatible)
export default async function handler(req, res) {
  // Support both new and legacy env names
  const token = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID; // e.g., 123456789012345

  if (!token || !phoneId) {
    return res.status(500).json({ error: 'Missing WhatsApp Cloud API token or phone ID' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, text } = req.body || {};
  if (!to || !text) {
    return res.status(400).json({ error: 'Body must include "to" and "text"' });
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const out = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json(out);
    }
    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}