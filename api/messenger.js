// TITAN ENTERPRISE CRM v4.0.0 - Messenger Webhook (Vercel Serverless)
// Reads keys from environment variables. Compatible with Dashboard.js expectations.

import { createClient } from '@supabase/supabase-js';

const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN || '',
  VERIFY_TOKEN: process.env.VERIFY_TOKEN || 'titan_crm_2026',
  FACEBOOK_API_VERSION: 'v21.0',
  FACEBOOK_GRAPH_URL: 'https://graph.facebook.com',
};

// Initialize Supabase only if env present
const supabase = (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY)
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;

// Utils
const sanitize = (t, n = 1000) => String(t || '').trim().substring(0, n).replace(/[<>]/g, '');
const parseDocs = (raw) => {
  try {
    if (!raw) return [];
    if (typeof raw === 'string') return JSON.parse(raw);
    if (Array.isArray(raw)) return raw;
    return [];
  } catch { return []; }
};
const nowISO = () => new Date().toISOString();

async function getProfile(psid) {
  try {
    if (!psid || !CONFIG.PAGE_ACCESS_TOKEN) {
      return { name: 'Messenger User', profilePic: null, success: false };
    }
    const url = `${CONFIG.FACEBOOK_GRAPH_URL}/${psid}?fields=first_name,last_name,profile_pic&access_token=${CONFIG.PAGE_ACCESS_TOKEN}`;
    const r = await fetch(url);
    if (!r.ok) return { name: 'Messenger User', profilePic: null, success: false };
    const d = await r.json();
    if (d?.error) return { name: 'Messenger User', profilePic: null, success: false };
    return {
      name: d.first_name ? `${d.first_name} ${d.last_name || ''}`.trim() : 'Messenger User',
      profilePic: d.profile_pic || null,
      success: !!d.first_name,
    };
  } catch {
    return { name: 'Messenger User', profilePic: null, success: false };
  }
}

async function getExisting(psid) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('messenger_id', psid)
    .maybeSingle();
  if (error) return null;
  return data;
}

// Core handler to ingest and sync to CRM (Dashboard-compatible schema)
async function handleIncoming(psid, messageData) {
  if (!supabase) return;

  const text = sanitize(messageData.text || '');
  let attachments = [];
  if (Array.isArray(messageData.attachments)) {
    attachments = messageData.attachments
      .map(a => a.payload?.url)
      .filter(u => typeof u === 'string' && u)
      .map(sanitize);
  }

  const existing = await getExisting(psid);
  const profile = await getProfile(psid);

  // Dashboard expects 'id' and 'service'
  const id = `messenger_${psid}`;
  const name = profile.success ? profile.name : (existing?.customer_name || 'Messenger User');

  const oldDocs = existing ? parseDocs(existing.documents) : [];
  const docs = [...new Set([...oldDocs, ...attachments])].filter(Boolean);

  const finalMsg = text || (attachments.length ? '📷 Sent an attachment' : 'New Message');

  const customer = {
    id,                          // IMPORTANT: used by Dashboard commitUpdate()
    messenger_id: psid,          // for webhook linkage
    customer_name: name,
    chat_summary: finalMsg,
    platform: 'messenger',
    status: existing?.status || 'inquiry',
    service: existing?.service || 'Other',   // use 'service' (not service_type)
    documents: docs,
    last_updated_by: 'MESSENGER_BOT',
    updated_at: nowISO(),
    // keep created_at unchanged if exists; upsert will retain it
  };

  // Upsert by messenger_id (ensure UNIQUE on messenger_id in DB)
  const { error: upsertErr } = await supabase
    .from('customers')
    .upsert(customer, { onConflict: 'messenger_id' });
  if (upsertErr) {
    console.error('Customer Upsert Error:', upsertErr.message);
    return;
  }

  // Insert message history
  const { error: insertErr } = await supabase
    .from('messages')
    .insert([{
      customer_id: id,                // link by Dashboard-visible id
      platform: 'messenger',
      content: finalMsg,
      is_from_customer: true,
      created_at: nowISO(),
      metadata: { urls: attachments, profile_pic: profile.profilePic, customer_name: name },
    }]);
  if (insertErr) console.error('Message Insert Error:', insertErr.message);
}

// Serverless entry
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
        console.log('✅ Messenger Webhook Verified');
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (body.object !== 'page') return res.sendStatus(404);
      // ACK Facebook immediately
      res.status(200).send('EVENT_RECEIVED');

      try {
        for (const entry of body.entry || []) {
          if (!entry.messaging) continue;
          for (const evt of entry.messaging) {
            const psid = evt.sender?.id;
            if (!psid) continue;
            if (evt.message) await handleIncoming(psid, evt.message);
          }
        }
      } catch (e) {
        console.error('Webhook Processing Error:', e.message);
      }
      return;
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Unhandled Error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}