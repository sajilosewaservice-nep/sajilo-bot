/**
 * TITAN ENTERPRISE CRM v4.0.0 - ULTIMATE WHATSAPP ENGINE
 * --------------------------------------------------
 * ENGINE: BAILEYS (NO PUPPETEER) | PORT: 5000 
 * FEATURES: LIVE SYNC, RPA BRIDGE, ANALYTICS READY
 */
const qrcode = require('qrcode-terminal');

require('dotenv').config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');
const pino = require('pino');

// १. कन्फिगरेसन र इन्फ्रास्ट्रक्चर
const logger = pino({ level: 'silent' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000; // ड्यासबोर्डको शक्ति यही पोर्टमा छ

// इन्जिनको स्वास्थ्य अवस्था (Health Status)
let engineStats = {
    state: "starting",
    uptime: new Date().toLocaleString(),
    messagesProcessed: 0,
    lastActivity: "None"
};

// २. मुख्य ह्वाट्सएप इन्जिन (Baileys)
async function startTitanEngine() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('titan_auth_session');

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: logger,
        browser: ["Titan CRM", "MacOS", "4.0.0"],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // ३. कनेक्सन लाइफसाइकल
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
    console.log('📱 SCAN QR CODE FOR TITAN ENGINE:');
    qrcode.generate(qr, { small: true }); // यसले अब QR कोड देखाउँछ
}
        
        if (connection === 'close') {
            engineStats.state = "reconnecting";
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startTitanEngine();
        } else if (connection === 'open') {
            engineStats.state = "running";
            console.log('\n==========================================');
            console.log('✅ TITAN ENGINE v4.0.0: ONLINE & POWERFUL');
            console.log(`🛰️ LISTENING ON PORT: ${PORT}`);
            console.log('==========================================\n');
        }
    });

    // ४. म्यासेज रिसिभिङ र सुपाबेस सिङ्क्रोनाइजेसन
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const phone = msg.key.remoteJid.split('@')[0];
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "📷 Attachment Received";
        
        engineStats.messagesProcessed++;
        engineStats.lastActivity = new Date().toLocaleTimeString();

        // ड्यासबोर्डको लागि डाटा सिंक
        // यो block मा id थप्नुहोस्
const { error } = await supabase.from('customers').upsert({
    id: phone, // <--- यो एउटा लाइन थप्नुहोस्
    phone_number: phone,
    customer_name: msg.pushName || phone,
    platform: 'whatsapp',
    chat_summary: text,
    updated_at: new Date().toISOString()
}, { onConflict: 'phone_number' });

        if (!error) console.log(`📩 Synced: ${phone} | Stats: ${engineStats.messagesProcessed}`);
    });

    // ५. ड्यासबोर्डको लागि API (RPA & Messaging Bridge)
    
    // ड्यासबोर्डबाट म्यासेज पठाउन (CHAT Button)
    app.post('/send-message', async (req, res) => {
        const { phone, message } = req.body;
        try {
            const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: message });
            res.json({ success: true, status: "Sent" });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ड्यासबोर्डको 'AUTO' बटनको लागि (RPA Bridge)
    app.post('/start-automation', (req, res) => {
        const { service_type, customer_data, ai_instructions } = req.body;
        console.log(`🤖 RPA Command: Start ${service_type} for ${customer_data.phone_number}`);
        
        // यहाँ तपाईँको AI Rules (ai_instructions) को आधारमा काम हुन्छ
        res.json({ success: true, message: "Automation Triggered" });
    });

    // इन्जिनको स्टाटस हेर्न
    app.get('/engine-status', (req, res) => res.json(engineStats));
}

// ६. सर्भर लन्च
app.listen(PORT, () => {
    startTitanEngine().catch(err => console.error("❌ Fatal Error:", err));
});