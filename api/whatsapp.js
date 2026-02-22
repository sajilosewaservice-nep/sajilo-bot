/**
 * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 - MASTER WHATSAPP ENGINE
 * =============================================================================
 * System: Serverless Node.js (Vercel Optimized)
 * Integration: Meta WhatsApp Business API + Supabase
 * Logic: Auto-Service Detection & Real-time Sync
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// 1. SYSTEM CONFIGURATION
const CONFIG = {
    SB_URL: process.env.VITE_SUPABASE_URL,
    SB_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WA_TOKEN: process.env.WHATSAPP_TOKEN, // Meta Dashboard बाट आउने Permanent Token
    VERIFY_TOKEN: process.env.FB_VERIFY_TOKEN || 'titan-crm-v4-verify',
    PHONE_NUMBER_ID: process.env.WA_PHONE_NUMBER_ID, // Meta को Phone ID
    TABLE: 'leads'
};

const supabase = createClient(CONFIG.SB_URL, CONFIG.SB_SERVICE_KEY);

export default async function handler(req, res) {
    // --- ROUTE 1: WEBHOOK VERIFICATION (Facebook Verify गर्दा) ---
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
            console.log('✅ WHATSAPP_WEBHOOK: Verified Successfully');
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    // --- ROUTE 2: EVENT PROCESSING (म्यासेज आउँदा) ---
    if (req.method === 'POST') {
        // Meta लाई तुरुन्तै 200 OK दिनुपर्छ
        res.status(200).json({ status: 'received' });

        try {
            const body = req.body;
            if (!body.object || body.object !== 'whatsapp_business_account') return;

            const entry = body.entry?.[0]?.changes?.[0]?.value;
            const messages = entry?.messages;

            if (messages && messages[0]) {
                const msg = messages[0];
                const from = msg.from; // Customer's WhatsApp Number
                const userName = entry.contacts?.[0]?.profile?.name || "WhatsApp User";
                
                // Content Extraction
                let textContent = "";
                let mediaUrl = null;

                if (msg.type === 'text') {
                    textContent = msg.text.body;
                } else if (msg.type === 'image') {
                    textContent = "Sent an image";
                    mediaUrl = await getWhatsAppMedia(msg.image.id);
                } else if (msg.type === 'document') {
                    textContent = "Sent a document: " + (msg.document.filename || "");
                    mediaUrl = await getWhatsAppMedia(msg.document.id);
                }

                // 1. SERVICE DETECTION (Titan Smart Logic)
                const detected = analyzeContent(textContent);

                // 2. SAVE TO SUPABASE
                const leadPayload = {
                    customer_name: userName,
                    platform: 'whatsapp',
                    status: 'inquiry',
                    service: detected.service,
                    summary: textContent.slice(0, 500),
                    file_url: mediaUrl,
                    payment: 0,
                    operator_note: `WA_ID: ${from} | MsgID: ${msg.id}`,
                    created_at: new Date().toISOString()
                };

                const { error } = await supabase.from(CONFIG.TABLE).insert([leadPayload]);

                if (!error) {
                    // 3. AUTO ACKNOWLEDGEMENT
                    await sendWAReply(from, userName, detected.service);
                }
            }
        } catch (err) {
            console.error("🔥 WA_ENGINE_ERROR:", err.message);
        }
    }
}

/**
 * MODULE: WHATSAPP MEDIA FETCH
 * WhatsApp को म्यासेजबाट फोटो/PDF डाउनलोड गर्ने URL निकाल्छ
 */
async function getWhatsAppMedia(mediaId) {
    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${mediaId}?access_token=${CONFIG.WA_TOKEN}`);
        const data = await response.json();
        return data.url; // यो URL सुपबेसमा सेभ हुन्छ
    } catch (e) { return null; }
}

/**
 * MODULE: AI KEYWORD ANALYZER
 */
function analyzeContent(text) {
    const input = text.toLowerCase();
    const rules = [
        { kw: ['passport', 'rahadani', 'mrp'], service: 'Passport' },
        { kw: ['pan', 'tax', 'bill'], service: 'PAN Card' },
        { kw: ['license', 'licence', 'bike', 'car'], service: 'Driving License' },
        { kw: ['nid', 'national id', 'rastriya'], service: 'NID' }
    ];

    for (const rule of rules) {
        if (rule.kw.some(k => input.includes(k))) return { service: rule.service };
    }
    return { service: 'General Inquiry' };
}

/**
 * MODULE: AUTO-RESPONDER
 */
async function sendWAReply(to, name, service) {
    const url = `https://graph.facebook.com/v19.0/${CONFIG.PHONE_NUMBER_ID}/messages`;
    const body = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: `Namaste ${name}! 🙏\n\nWe have received your request for *${service}*. Our team is reviewing your details and will get back to you shortly.` }
    };

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.WA_TOKEN}` },
        body: JSON.stringify(body)
    });
}