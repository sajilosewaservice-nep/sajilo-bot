// api/analytics.js
import { getAdminClient } from './supabase.js';

export default async function handler(req, res) {
  const supabase = getAdminClient();
  try {
    const statuses = ['inquiry','pending','working','success','problem'];
    const out = {};
    for (const s of statuses) {
      const { count, error } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', s);
      if (error) throw error;
      out[s] = count || 0;
    }
    const { data: payments, error: pErr } = await supabase.from('leads').select('payment');
    if (pErr) throw pErr;
    const income = (payments || []).reduce((sum, r) => sum + (Number(r.payment) || 0), 0);
    return res.status(200).json({ ...out, income });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
