/* Preserved WhatsApp Baileys engine (moved out of /api for Vercel)
    Original file: api/whatsapp.js
    Note: This is a standalone Express server; deploy on a persistent host. */
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

// Supabase from env (avoid hardcoded keys)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// App config
const PORT = process.env.WHATSAPP_ENGINE_PORT || 5000;
const AUTH_DIR = path.join(__dirname, '../titan_auth_session');
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

