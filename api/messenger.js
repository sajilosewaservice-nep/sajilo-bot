// api/messenger.js
// Facebook Messenger webhook handler (verify + events)
export default async function handler(req, res) {
	// Support both new and legacy env names
	const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || process.env.MESSENGER_VERIFY_TOKEN || 'verify-token';

	if (req.method === 'GET') {
		const mode = req.query['hub.mode'];
		const token = req.query['hub.verify_token'];
		const challenge = req.query['hub.challenge'];

		if (mode === 'subscribe' && token === VERIFY_TOKEN) {
			return res.status(200).send(challenge);
		}
		return res.status(403).send('Forbidden');
	}

	if (req.method === 'POST') {
		try {
			const body = req.body || {};
			// Persist or log events as needed
			return res.status(200).json({ ok: true });
		} catch (err) {
			return res.status(500).json({ error: String(err) });
		}
	}

	return res.status(405).json({ error: 'Method not allowed' });
}
