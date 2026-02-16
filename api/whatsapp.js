/**
 * TITAN ENTERPRISE CRM v4.0.0 - ULTIMATE WHATSApp ENGINE (ANON KEY VERSION)
 * ENGINE: Baileys | PORT: 5000
 * NOTE: Uses Supabase ANON KEY (client role). Make sure RLS policies allow insert/update/select.
 */

const qrcode = require('qrcode-terminal');
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

// Supabase (ANON KEY hardcoded)
const SUPABASE_URL = "https://ratgpvubjrcoipardzdp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk";

// App config
const PORT = 5000;
const AUTH_DIR = path.join(__dirname, 'titan_auth_session');
const logger = pino({ level: 'silent' });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();

// Allow requests from your dashboard domain
const allowedOrigins = [
  'https://sajilo-online-sewa.vercel.app',
  'http://localhost:3000'
];
app.use(cors({
  origin: function (origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, true); // relax CORS for now
  },
  methods: ['GET', 'POST', 'PUT'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Engine status
let engineStats = {
  state: "starting",
  uptime: new Date().toISOString(),
  messagesProcessed: 0,
  lastActivity: "None",
  connectedPhone: null,
  totalConnections: 0
};
let sock = null;

// In-memory automation state (for pause/resume buttons on dashboard)
const automationState = { paused: new Set() };

/** WhatsApp Engine */
async function startTitanEngine() {
  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: ["Titan CRM", "Windows", "4.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    // Connection lifecycle
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
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('⚠️ Reconnecting in 3 seconds...');
          setTimeout(() => startTitanEngine(), 3000);
        }
      } else if (connection === 'open') {
        engineStats.state = "running";
        engineStats.uptime = new Date().toISOString();
        engineStats.totalConnections++;
        engineStats.connectedPhone = sock.user?.id || null;
        console.log('\n==========================================');
        console.log('✅ TITAN ENGINE v4.0.0: ONLINE & POWERFUL');
        console.log(`🛰️ LISTENING ON PORT: ${PORT}`);
        console.log(`📱 Connected Phone: ${sock.user?.id || 'Loading...'}`);
        console.log('==========================================\n');
      }
    });

    sock.ev.on('user-devices.update', (devices) => {
      if (devices && devices.length > 0) {
        engineStats.connectedPhone = sock.user?.id || devices[0];
      }
    });

    // Messages ingest → Supabase
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        try {
          if (msg.key.fromMe) continue;

          const phone = msg.key.remoteJid?.split('@')[0];
          const isGroup = msg.key.remoteJid?.includes('-');
          if (isGroup) continue;

          let textContent = '';
          let documentsArray = [];

          if (msg.message?.conversation) {
            textContent = msg.message.conversation;
          } else if (msg.message?.extendedTextMessage?.text) {
            textContent = msg.message.extendedTextMessage.text;
          } else if (msg.message?.imageMessage) {
            textContent = msg.message.imageMessage.caption || '📷 Image Received';
            documentsArray.push({ type: 'image', url: '', timestamp: new Date().toISOString() });
          } else if (msg.message?.documentMessage) {
            textContent = msg.message.documentMessage.title || '📄 Document Received';
            documentsArray.push({ type: 'document', filename: msg.message.documentMessage.title || 'document', timestamp: new Date().toISOString() });
          } else if (msg.message?.audioMessage) {
            textContent = '🎵 Audio Message Received';
            documentsArray.push({ type: 'audio', timestamp: new Date().toISOString() });
          } else if (msg.message?.videoMessage) {
            textContent = msg.message.videoMessage.caption || '🎥 Video Received';
            documentsArray.push({ type: 'video', timestamp: new Date().toISOString() });
          } else {
            textContent = '📨 Message Received';
          }

          const createdIso = new Date((msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString();

          const { error } = await supabase.from('customers').upsert({
            id: `whatsapp_${phone}`,
            phone_number: phone,
            customer_name: msg.pushName || 'Unknown Customer',
            platform: 'whatsapp',
            chat_summary: textContent,
            documents: documentsArray,  // jsonb
            status: 'inquiry',
            sender_id: msg.key.id,
            created_at: createdIso,
            updated_at: new Date().toISOString()
          }, { onConflict: 'phone_number' });

          engineStats.messagesProcessed++;
          engineStats.lastActivity = new Date().toISOString();

          if (error) {
            console.error(`❌ Sync Error: ${error.message}`);
          } else {
            console.log(`✅ Synced: ${phone} | "${textContent.substring(0, 40)}..."`);
          }
        } catch (err) {
          console.error(`❌ Message Processing Error:`, err.message);
        }
      }
    });

    sock.ev.on('message-receipt.update', (updates) => {
      for (const { key, receipt } of updates) {
        if (receipt.type === 'read') {
          console.log(`👁️ Message Read: ${key.remoteJid}`);
        }
      }
    });

    /** API endpoints (Dashboard compatibility) */

    // Send text message (Dashboard CHAT button)
    app.post('/send-message', async (req, res) => {
      const { phone, message, customer_id } = req.body;
      try {
        if (!sock || engineStats.state !== 'running') {
          return res.status(503).json({ success: false, error: "Engine not connected. Please scan QR code." });
        }

        const cleanPhone = String(phone || '').replace(/\D/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });

        await supabase.from('message_logs').insert({
          customer_id,
          phone_number: cleanPhone,
          message_text: message,
          direction: 'outbound',
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        res.json({ success: true, status: "Sent", timestamp: new Date().toISOString() });
      } catch (err) {
        console.error(`❌ Send Message Error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // RPA Bridge: start (Dashboard AUTO button)
    app.post('/start-automation', async (req, res) => {
      const { service_type, customer_data, ai_instructions } = req.body;
      try {
        console.log(`🤖 RPA Command: Start ${service_type} for ${customer_data?.phone_number}`);

        await supabase.from('automation_logs').insert({
          customer_id: customer_data?.id,
          service_type,
          status: 'started',
          ai_rules_applied: ai_instructions,  // jsonb or text
          started_at: new Date().toISOString()
        });

        res.json({
          success: true,
          message: `Automation Triggered for ${service_type}`,
          service: service_type,
          customer: customer_data?.phone_number,
          timestamp: new Date().toISOString(),
          process_id: `AUTO_${Date.now()}`
        });
      } catch (err) {
        console.error(`❌ Automation Error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Pause/Resume endpoints (Dashboard expects these)
    app.post('/automation/pause/:id', async (req, res) => {
      const customerId = req.params.id;
      try {
        automationState.paused.add(customerId);
        await supabase.from('automation_logs').insert({
          customer_id: customerId,
          status: 'paused',
          service_type: 'unknown',
          started_at: new Date().toISOString()
        });
        res.json({ success: true, paused: true, customer_id: customerId });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    app.post('/automation/resume/:id', async (req, res) => {
      const customerId = req.params.id;
      try {
        automationState.paused.delete(customerId);
        await supabase.from('automation_logs').insert({
          customer_id: customerId,
          status: 'resumed',
          service_type: 'unknown',
          started_at: new Date().toISOString()
        });
        res.json({ success: true, resumed: true, customer_id: customerId });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Media send endpoints

    app.post('/send-voice-note', async (req, res) => {
      const { phone, audio_path, customer_id } = req.body;
      try {
        if (!fs.existsSync(audio_path)) {
          return res.status(400).json({ success: false, error: "Audio file not found" });
        }
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;
        const audioBuffer = fs.readFileSync(audio_path);
        await sock.sendMessage(jid, { audio: audioBuffer, ptt: true, mimetype: 'audio/mpeg' });
        res.json({ success: true, message: "Voice note sent", timestamp: new Date().toISOString() });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    app.post('/send-image', async (req, res) => {
      const { phone, image_path, caption } = req.body;
      try {
        if (!fs.existsSync(image_path)) {
          return res.status(400).json({ success: false, error: "Image file not found" });
        }
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;
        const imageBuffer = fs.readFileSync(image_path);
        await sock.sendMessage(jid, { image: imageBuffer, caption: caption || '', mimetype: 'image/jpeg' });
        res.json({ success: true, message: "Image sent", timestamp: new Date().toISOString() });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    app.post('/send-document', async (req, res) => {
      const { phone, document_path, filename } = req.body;
      try {
        if (!fs.existsSync(document_path)) {
          return res.status(400).json({ success: false, error: "Document file not found" });
        }
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;
        const docBuffer = fs.readFileSync(document_path);
        await sock.sendMessage(jid, { document: docBuffer, fileName: filename || 'document.pdf', mimetype: 'application/pdf' });
        res.json({ success: true, message: "Document sent", timestamp: new Date().toISOString() });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Health & dashboard
    app.get('/engine-status', (req, res) => {
      res.json({
        ...engineStats,
        uptime_seconds: Math.max(0, Math.floor((Date.now() - Date.parse(engineStats.uptime)) / 1000)),
        api_version: '4.0.0',
        features: ['WhatsApp Sync', 'RPA Bridge', 'AI Automation', 'Multi-Media Support']
      });
    });

    app.get('/health', (req, res) => {
      res.json({
        status: engineStats.state === 'running' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    });

    app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Customers basic APIs
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

    app.put('/customers/:id', async (req, res) => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .update({ ...req.body, updated_at: new Date().toISOString() })
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

// Server launch
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down TITAN ENGINE...');
  try { if (sock) sock.end(); } catch {}
  process.exit(0);
});

module.exports = { startTitanEngine, engineStats };