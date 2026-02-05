/**
 * TITAN WHATSAPP ENTERPRISE v4.0.0
 * Features: Auto-Storage, Queue Management, Professional Logging, Session Recovery
 */
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const http = require('http');
const pino = require('pino');

// १. प्रोफेसनल इन्फ्रास्ट्रक्चर
const logger = pino({ level: 'info', transport: { target: 'pino-pretty' } });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

let engineStatus = {
    state: "booting",
    uptime: Date.now(),
    processedCount: 0
};

// २. एड्भान्स्ड स्टोरेज लजिक (Professional File Handling)
async function handleMediaUpload(msg, phone) {
    try {
        const media = await msg.downloadMedia();
        if (!media) return null;

        const fileExt = media.mimetype.split('/')[1] || 'jpg';
        const fileName = `${phone}/${Date.now()}.${fileExt}`;
        const fileBuffer = Buffer.from(media.data, 'base64');

        const { data, error } = await supabase.storage
            .from('customer_documents') // पक्का गर्नुहोस् यो Bucket सुपाबेसमा छ
            .upload(fileName, fileBuffer, { contentType: media.mimetype, upsert: true });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('customer_documents')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (err) {
        logger.error(`🚨 Storage Error: ${err.message}`);
        return null;
    }
}

// ३. ह्वाट्सएप क्लाइन्ट कन्फिगरेसन (High Performance)
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'titan-enterprise-v5' }),
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
            '--no-first-run', '--no-zygote', '--disable-gpu'
        ]
    }
});

// ४. इभेन्ट लाइफसाइकल
client.on('qr', (qr) => {
    engineStatus.state = "awaiting_login";
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    engineStatus.state = "running";
    logger.info('🚀 TITAN ENTERPRISE: Engine Online & Ready');
});

// ५. इन्टेलिजेन्ट म्यासेज प्रोसेसर
client.on('message', async (msg) => {
    if (msg.from.includes('@g.us') || msg.isStatus) return;

    try {
        const contact = await msg.getContact();
        const phone = contact.number;
        engineStatus.processedCount++;

        logger.info(`📨 Inbound: [${phone}] ${contact.pushname}`);

        // क) मीडिया छ भने सिधै स्टोरेजमा अपलोड गर्ने
        let fileLink = null;
        if (msg.hasMedia) {
            fileLink = await handleMediaUpload(msg, phone);
        }

        // ख) डाटाबेस सिंक लजिक (History Preservation)
        const { data: user } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', phone)
            .single();

        const timestamp = new Date().toLocaleTimeString();
        const chatLine = `[${timestamp}] ${msg.body || (msg.hasMedia ? "📁 Attachment Received" : "")}`;
        
        const payload = {
            phone_number: phone,
            customer_name: contact.pushname || phone,
            chat_summary: `${user?.chat_summary || ""}\n${chatLine}`.slice(-2500),
            documents: fileLink || user?.documents, // नयाँ फाइल आए लिङ्क अपडेट गर्ने
            status: user?.status || 'inquiry',
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'phone_number' });
        
        if (!error) {
            logger.info(`✅ Synced: ${contact.pushname} (${phone})`);
        }

    } catch (err) {
        logger.error(`❌ Processing Error: ${err.message}`);
    }
});

// ६. मोनिटरिङ API (Professional Dashboard Connection)
app.get('/health', (req, res) => {
    res.json({
        ...engineStatus,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + " MB",
        uptimeSeconds: Math.floor((Date.now() - engineStatus.uptime) / 1000)
    });
});

// ७. सुरक्षित स्टार्टअप
const startEngine = async () => {
    try {
        await client.initialize();
        server.listen(PORT, () => logger.info(`🛰️ Enterprise API on Port ${PORT}`));
    } catch (err) {
        logger.error(`❌ Boot Error: ${err.message}`);
    }
};

startEngine();

// ८. एन्टि-क्र्यास प्रोटेक्सन
process.on('uncaughtException', (err) => logger.error(`Critical Error: ${err.message}`));