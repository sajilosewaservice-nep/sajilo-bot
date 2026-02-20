/**
 * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 - MASTER MESSENGER ENGINE
 * =============================================================================
 * System: Serverless Node.js (Vercel Optimized)
 * Integration: Meta Graph API v19.0 + Supabase DB
 * Logic Length: Industrial Grade / Extended
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// 1. SYSTEM CONFIGURATION & SECURITY
const CONFIG = {
    SB_URL: process.env.VITE_SUPABASE_URL,
    SB_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, // Bypass RLS for backend
    PAGE_TOKEN: process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_TOKEN,
    VERIFY_TOKEN: process.env.FB_VERIFY_TOKEN || 'titan-crm-v4-verify',
    API_VERSION: 'v19.0',
    RETRY_ATTEMPTS: 3
};

// Initialize Supabase Client
const supabase = createClient(CONFIG.SB_URL, CONFIG.SB_SERVICE_KEY);

/**
 * MAIN HANDLER EXPORT
 */
export default async function handler(req, res) {
    const startTime = Date.now();
    
    try {
        // --- ROUTE 1: WEBHOOK VERIFICATION (GET) ---
        if (req.method === 'GET') {
            return handleVerification(req, res);
        }

        // --- ROUTE 2: EVENT PROCESSING (POST) ---
        if (req.method === 'POST') {
            // Facebook expects 200 OK immediately to prevent timeout
            res.status(200).json({ status: 'received', timestamp: startTime });
            return await handleEvents(req.body);
        }

        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (criticalError) {
        console.error("🔥 CRITICAL_SYSTEM_ERROR:", criticalError.message);
        // Silently log to database if possible
        await logInternalError('CRITICAL_HANDLER', criticalError.message);
    }
}

/**
 * MODULE: WEBHOOK VERIFICATION
 */
function handleVerification(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
        console.log('✅ WEBHOOK_VERIFIED: Connection established with Meta.');
        return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification Failed: Token Mismatch');
}

/**
 * MODULE: EVENT ORCHESTRATOR
 */
async function handleEvents(body) {
    if (body.object !== 'page') return;

    for (const entry of body.entry) {
        const messagingEvents = entry.messaging || [];
        
        for (const event of messagingEvents) {
            // Process only real messages (skip echoes and read receipts)
            if (event.message && !event.message.is_echo) {
                await processIncomingMessage(event);
            }
            
            // Handle Postbacks (Buttons/Get Started)
            if (event.postback) {
                await handlePostback(event);
            }
        }
    }
}

/**
 * MODULE: CORE MESSAGE PROCESSOR
 * Data extraction, AI detection, and DB Sync
 */
async function processIncomingMessage(event) {
    const psid = event.sender.id;
    const message = event.message;
    const mid = message.mid;
    
    console.log(`📩 NEW_MESSAGE [PSID: ${psid}] [MID: ${mid}]`);

    // 1. FETCH SENDER IDENTITY (Meta Graph API)
    const userData = await fetchUserProfile(psid);

    // 2. EXTRACT CONTENT & MULTIMEDIA
    const text = message.text || "";
    const attachments = message.attachments || [];
    const mediaUrl = extractMediaUrl(attachments);

    // 3. SERVICE DETECTION LOGIC (Titan Smart Logic)
    const serviceDetails = analyzeMessageContent(text, attachments);

    // 4. DATABASE SYNCHRONIZATION (Supabase)
    const leadPayload = {
        customer_name: `${userData.first_name || 'Messenger'} ${userData.last_name || 'User'}`.trim(),
        platform: 'messenger',
        status: 'inquiry',
        service: serviceDetails.name,
        summary: text.slice(0, 500) || (mediaUrl ? "Sent an attachment" : "Inquiry via Messenger"),
        file_url: mediaUrl,
        payment: 0,
        rpa: false,
        operator_note: `PSID: ${psid} | Detected: ${serviceDetails.confidence}% confidence`,
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('leads').insert([leadPayload]).select();

    if (error) {
        await logInternalError('DB_INSERT_FAIL', error.message);
        return;
    }

    // 5. AUTOMATED CUSTOMER RESPONSE (Optional)
    await sendAutoAcknowledgement(psid, userData.first_name, serviceDetails.name);
}

/**
 * MODULE: PROFILE FETCHER
 */
async function fetchUserProfile(psid) {
    try {
        const url = `https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${CONFIG.PAGE_TOKEN}`;
        const response = await fetch(url);
        return await response.json();
    } catch (err) {
        return { first_name: "Messenger", last_name: "User" };
    }
}

/**
 * MODULE: AI/LOGIC ANALYZER
 */
function analyzeMessageContent(text, attachments) {
    const input = text.toLowerCase();
    let result = { name: "General Inquiry", confidence: 50 };

    // Keywords mapping
    const rules = [
        { kw: ['passport', 'rahadani', 'MRP'], service: 'Passport' },
        { kw: ['pan', 'tax', 'pani'], service: 'PAN Card' },
        { kw: ['nid', 'rastriya', 'identity'], service: 'NID' },
        { kw: ['license', 'licence', 'driving'], service: 'Driving License' },
        { kw: ['pcc', 'police', 'report'], service: 'PCC' }
    ];

    for (const rule of rules) {
        if (rule.kw.some(k => input.includes(k))) {
            result = { name: rule.service, confidence: 95 };
            break;
        }
    }

    // Attachment logic
    if (attachments.length > 0) {
        result.confidence += 5; // Higher confidence if media is provided
    }

    return result;
}

/**
 * MODULE: MEDIA EXTRACTOR
 */
function extractMediaUrl(attachments) {
    if (!attachments || attachments.length === 0) return null;
    
    // We prioritize 'file' (PDF) then 'image'
    const pdf = attachments.find(a => a.type === 'file');
    if (pdf) return pdf.payload.url;

    const img = attachments.find(a => a.type === 'image');
    if (img) return img.payload.url;

    return attachments[0].payload.url;
}

/**
 * MODULE: AUTO-RESPONDER
 */
async function sendAutoAcknowledgement(psid, name, service) {
    const text = `Namaste ${name}! 🙏 We have received your inquiry for ${service}. Our operator will check your documents and update you soon.`;
    
    await fetch(`https://graph.facebook.com/${CONFIG.API_VERSION}/me/messages?access_token=${CONFIG.PAGE_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: psid },
            message: { text: text }
        })
    });
}

/**
 * MODULE: LOGGING & ERROR RECOVERY
 */
async function logInternalError(code, detail) {
    console.error(`[${code}]: ${detail}`);
    // You can create a 'system_logs' table in Supabase to track these
}

async function handlePostback(event) {
    const psid = event.sender.id;
    const payload = event.postback.payload;
    // Implementation for "Get Started" or Menu buttons
}

/**
 * =============================================================================
 * END OF MASTER ENGINE
 * =============================================================================
 */