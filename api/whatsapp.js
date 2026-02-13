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
const path = require('path');
const fs = require('fs');

// १. कन्फिगरेसन र इन्फ्रास्ट्रक्चर
const logger = pino({ level: 'silent' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

const PORT = 5000;
const AUTH_DIR = path.join(__dirname, 'titan_auth_session');

// इन्जिनको स्वास्थ्य अवस्था (Health Status)
let engineStats = {
    state: "starting",
    uptime: new Date().toLocaleString(),
    messagesProcessed: 0,
    lastActivity: "None",
    connectedPhone: null,
    totalConnections: 0
};

let sock = null;

// २. मुख्य ह्वाट्सएप इन्जिन (Baileys)
async function startTitanEngine() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        sock = makeWASocket({
            version,
            auth: state,
            logger: logger,
            browser: ["Titan CRM", "Windows", "4.0.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true
        });

        sock.ev.on('creds.update', saveCreds);

        // ३. कनेक्सन लाइफसाइकल
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 =============================================');
                console.log('SCAN QR CODE FOR TITAN ENGINE:');
                console.log('=============================================');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                engineStats.state = "reconnecting";
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log('⚠️ Reconnecting in 3 seconds...');
                    setTimeout(() => startTitanEngine(), 3000);
                }
            } else if (connection === 'open') {
                engineStats.state = "running";
                engineStats.uptime = new Date().toLocaleString();
                engineStats.totalConnections++;
                console.log('\n==========================================');
                console.log('✅ TITAN ENGINE v4.0.0: ONLINE & POWERFUL');
                console.log(`🛰️ LISTENING ON PORT: ${PORT}`);
                console.log(`📱 Connected Phone: ${sock.user?.id || 'Loading...'}`);
                console.log('==========================================\n');
            }
        });

        // ४. यूजर अपडेट इभेन्ट
        sock.ev.on('user-devices.update', (devices) => {
            if (devices && devices.length > 0) {
                engineStats.connectedPhone = sock.user?.id || devices[0];
            }
        });

        // ५. म्यासेज रिसिभिङ र सुपाबेस सिङ्क्रोनाइजेसन
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            for (const msg of messages) {
                try {
                    // आफ्नो मेसेज स्किप गर्न
                    if (msg.key.fromMe) continue;

                    const phone = msg.key.remoteJid?.split('@')[0];
                    const isGroup = msg.key.remoteJid?.includes('-');
                    
                    if (isGroup) continue; // ग्रुप मेसेज स्किप गर्न

                    // मेसेज कन्टेन्ट निकाल्न
                    let textContent = '';
                    let documentsArray = [];

                    if (msg.message?.conversation) {
                        textContent = msg.message.conversation;
                    } else if (msg.message?.extendedTextMessage?.text) {
                        textContent = msg.message.extendedTextMessage.text;
                    } else if (msg.message?.imageMessage) {
                        textContent = msg.message.imageMessage.caption || '📷 Image Received';
                        documentsArray.push({
                            type: 'image',
                            url: `https://placeholder.com/200x200?text=Image`,
                            timestamp: new Date().toISOString()
                        });
                    } else if (msg.message?.documentMessage) {
                        textContent = msg.message.documentMessage.title || '📄 Document Received';
                        documentsArray.push({
                            type: 'document',
                            filename: msg.message.documentMessage.title || 'document',
                            timestamp: new Date().toISOString()
                        });
                    } else if (msg.message?.audioMessage) {
                        textContent = '🎵 Audio Message Received';
                        documentsArray.push({
                            type: 'audio',
                            timestamp: new Date().toISOString()
                        });
                    } else if (msg.message?.videoMessage) {
                        textContent = msg.message.videoMessage.caption || '🎥 Video Received';
                        documentsArray.push({
                            type: 'video',
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        textContent = '📨 Message Received';
                    }

                    // सुपाबेसमा इन्सर्ट वा अपडेट गर्न (JSONB FORMAT)
                    const { data, error } = await supabase.from('customers').upsert({
                        id: `whatsapp_${phone}`,
                        phone_number: phone,
                        customer_name: msg.pushName || 'Unknown Customer',
                        platform: 'whatsapp',
                        chat_summary: textContent,
                        documents: documentsArray,  // JSONB को रूपमा भेज (सित्तै array)
                        status: 'inquiry',
                        sender_id: msg.key.id,
                        created_at: new Date(msg.messageTimestamp * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    }, { 
                        onConflict: 'phone_number' 
                    });

                    engineStats.messagesProcessed++;
                    engineStats.lastActivity = new Date().toLocaleTimeString();

                    if (!error) {
                        console.log(`✅ Synced: ${phone} | Message: "${textContent.substring(0, 40)}..."`);
                    } else {
                        console.error(`❌ Sync Error: ${error.message}`);
                    }

                } catch (err) {
                    console.error(`❌ Message Processing Error:`, err.message);
                }
            }
        });

        // ६. रीड रिसिपट ह्यान्डलिङ
        sock.ev.on('message-receipt.update', async (updates) => {
            for (const { key, receipt } of updates) {
                if (receipt.type === 'read') {
                    console.log(`👁️ Message Read: ${key.remoteJid}`);
                }
            }
        });

        // ७. API एन्डपॉइन्ट्स

        // ड्यासबोर्डबाट म्यासेज पठाउन (CHAT Button)
        app.post('/send-message', async (req, res) => {
            const { phone, message, customer_id } = req.body;
            
            try {
                if (!sock || engineStats.state !== 'running') {
                    return res.status(503).json({ 
                        success: false, 
                        error: "Engine not connected. Please scan QR code." 
                    });
                }

                const cleanPhone = phone.replace(/\D/g, '');
                const jid = `${cleanPhone}@s.whatsapp.net`;

                await sock.sendMessage(jid, { text: message });

                // मेसेज लग सुपाबेसमा सेभ गर्न
                await supabase.from('message_logs').insert({
                    customer_id: customer_id,
                    phone_number: cleanPhone,
                    message_text: message,
                    direction: 'outbound',
                    status: 'sent',
                    sent_at: new Date().toISOString()
                });

                res.json({ 
                    success: true, 
                    status: "Sent",
                    timestamp: new Date().toISOString()
                });

            } catch (err) {
                console.error(`❌ Send Message Error:`, err.message);
                res.status(500).json({ 
                    success: false, 
                    error: err.message 
                });
            }
        });

        // ड्यासबोर्डको 'AUTO' बटनको लागि (RPA Bridge)
        app.post('/start-automation', async (req, res) => {
            const { service_type, customer_data, ai_instructions } = req.body;
            
            try {
                console.log(`🤖 RPA Command: Start ${service_type} for ${customer_data.phone_number}`);
                
                // AI Rules को आधारमा अटोमेशन प्रक्रिया
                const automationResponse = {
                    success: true,
                    message: `Automation Triggered for ${service_type}`,
                    service: service_type,
                    customer: customer_data.phone_number,
                    timestamp: new Date().toISOString(),
                    process_id: `AUTO_${Date.now()}`
                };

                // अटोमेशन स्टेटस लग गर्न (JSONB FORMAT)
                await supabase.from('automation_logs').insert({
                    customer_id: customer_data.id,
                    service_type: service_type,
                    status: 'started',
                    ai_rules_applied: ai_instructions,  // JSONB को रूपमा
                    started_at: new Date().toISOString()
                });

                res.json(automationResponse);

            } catch (err) {
                console.error(`❌ Automation Error:`, err.message);
                res.status(500).json({ 
                    success: false, 
                    error: err.message 
                });
            }
        });

        // भोलस्क समर्थन
        app.post('/send-voice-note', async (req, res) => {
            const { phone, audio_path, customer_id } = req.body;
            
            try {
                if (!fs.existsSync(audio_path)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: "Audio file not found" 
                    });
                }

                const cleanPhone = phone.replace(/\D/g, '');
                const jid = `${cleanPhone}@s.whatsapp.net`;
                const audioBuffer = fs.readFileSync(audio_path);

                await sock.sendMessage(jid, { 
                    audio: audioBuffer,
                    ptt: true,
                    mimetype: 'audio/mpeg'
                });

                res.json({ 
                    success: true, 
                    message: "Voice note sent",
                    timestamp: new Date().toISOString()
                });

            } catch (err) {
                res.status(500).json({ 
                    success: false, 
                    error: err.message 
                });
            }
        });

        // इमेज पठाउन
        app.post('/send-image', async (req, res) => {
            const { phone, image_path, caption, customer_id } = req.body;
            
            try {
                if (!fs.existsSync(image_path)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: "Image file not found" 
                    });
                }

                const cleanPhone = phone.replace(/\D/g, '');
                const jid = `${cleanPhone}@s.whatsapp.net`;
                const imageBuffer = fs.readFileSync(image_path);

                await sock.sendMessage(jid, { 
                    image: imageBuffer,
                    caption: caption || '',
                    mimetype: 'image/jpeg'
                });

                res.json({ 
                    success: true, 
                    message: "Image sent",
                    timestamp: new Date().toISOString()
                });

            } catch (err) {
                res.status(500).json({ 
                    success: false, 
                    error: err.message 
                });
            }
        });

        // डकुमेन्ट पठाउन
        app.post('/send-document', async (req, res) => {
            const { phone, document_path, filename, customer_id } = req.body;
            
            try {
                if (!fs.existsSync(document_path)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: "Document file not found" 
                    });
                }

                const cleanPhone = phone.replace(/\D/g, '');
                const jid = `${cleanPhone}@s.whatsapp.net`;
                const docBuffer = fs.readFileSync(document_path);

                await sock.sendMessage(jid, { 
                    document: docBuffer,
                    fileName: filename || 'document.pdf',
                    mimetype: 'application/pdf'
                });

                res.json({ 
                    success: true, 
                    message: "Document sent",
                    timestamp: new Date().toISOString()
                });

            } catch (err) {
                res.status(500).json({ 
                    success: false, 
                    error: err.message 
                });
            }
        });

        // इन्जिनको स्टाटस हेर्न
        app.get('/engine-status', (req, res) => {
            res.json({
                ...engineStats,
                uptime_seconds: Math.floor((Date.now() - new Date(engineStats.uptime)) / 1000),
                api_version: '4.0.0',
                features: ['WhatsApp Sync', 'RPA Bridge', 'AI Automation', 'Multi-Media Support']
            });
        });

        // सर्भरको स्वास्थ्य जाँच
        app.get('/health', (req, res) => {
            res.json({ 
                status: engineStats.state === 'running' ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            });
        });

        // ड्यासबोर्ड
        app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // सभी ग्राहकहरू प्राप्त करें
        app.get('/customers', async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                res.json(data);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // एकल ग्राहक प्राप्त करें
        app.get('/customers/:id', async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', req.params.id)
                    .single();

                if (error) throw error;
                res.json(data);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // ग्राहक अपडेट करें
        app.put('/customers/:id', async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .update({
                        ...req.body,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', req.params.id);

                if (error) throw error;
                res.json({ success: true, data });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

    } catch (err) {
        console.error('❌ Engine Start Error:', err);
        setTimeout(() => startTitanEngine(), 5000);
    }
}

// ८. सर्भर लन्च
app.listen(PORT, async () => {
    console.log('\n🚀 TITAN ENTERPRISE CRM v4.0.0');
    console.log(`🔧 Starting on PORT ${PORT}...`);
    console.log('⏳ Initializing WhatsApp Engine...\n');
    
    try {
        await startTitanEngine();
    } catch (err) {
        console.error("❌ Fatal Error:", err);
        process.exit(1);
    }
});

// ९. ग्रेसफुल शटडाउन
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down TITAN ENGINE...');
    if (sock) sock.end();
    process.exit(0);
});

module.exports = { startTitanEngine, engineStats };