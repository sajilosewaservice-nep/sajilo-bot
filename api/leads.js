// api/leads.js
import { getAdminClient } from './supabase.js';

export default async function handler(req, res) {
  const supabase = getAdminClient();

  if (req.method === 'GET') {
    try {
      const { status, platform, q, page = 1, pageSize = 25 } = req.query;
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      if (platform) query = query.eq('platform', platform);
      if (q) query = query.ilike('customer_name', `%${q}%`);

      const { data, error } = await query.range((page - 1) * pageSize, (page - 1) * pageSize + (pageSize - 1));
      if (error) throw error;
      return res.status(200).json({ data });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { data, error } = await supabase.from('leads').insert([body]).select('*').limit(1);
      if (error) throw error;
      return res.status(201).json({ data: data?.[0] });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, status, note } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const updates = {};
      if (status) updates.status = status;
      if (note !== undefined) updates.note = note;

      const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select('*').limit(1);
      if (error) throw error;
      return res.status(200).json({ data: data?.[0] });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
