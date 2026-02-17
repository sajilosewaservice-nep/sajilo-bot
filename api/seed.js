// api/seed.js
// Seed sample leads when SEED_ENABLED=1 (temporary endpoint for testing)
import { getAdminClient } from './supabase.js';

export default async function handler(req, res) {
  if (process.env.SEED_ENABLED !== '1') {
    return res.status(403).json({ error: 'Seeding disabled' });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const supabase = getAdminClient();
  const samples = [
    { platform: 'whatsapp', customer_name: 'Ram Shrestha', phone: '9800000000', service: 'Passport', status: 'inquiry', payment: 0, rpa: false, docs: false },
    { platform: 'messenger', customer_name: 'Sita Gurung', phone: '9811111111', service: 'NID', status: 'pending', payment: 0, rpa: false, docs: false },
    { platform: 'whatsapp', customer_name: 'Hari Adhikari', phone: '9822222222', service: 'License', status: 'working', payment: 800, rpa: true, docs: true },
    { platform: 'messenger', customer_name: 'Maya KC', phone: '9833333333', service: 'PAN', status: 'success', payment: 1500, rpa: false, docs: false },
    { platform: 'whatsapp', customer_name: 'Bishal Rai', phone: '9844444444', service: 'PCC', status: 'problem', payment: 0, rpa: false, docs: false }
  ];
  try {
    const { data, error } = await supabase.from('leads').insert(samples).select('*');
    if (error) throw error;
    return res.status(200).json({ inserted: data.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
