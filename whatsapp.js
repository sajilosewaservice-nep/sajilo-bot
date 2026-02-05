/**
 * TITAN WHATSAPP ENGINE v4.2.0 (SYNC & STORAGE READY)
 * --------------------------------------------------
 * यो कोडले ह्वाट्सएप म्यासेज र मिडियालाई सिधै सुपवेस (Supabase) मा सिंक गर्छ।
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

let engineStatus = { state: "booting", processedCount: 0 };

// २. एड्भान्स्ड स्टोरेज लजिक (फाइल अपलोड गर्न)
async function handleMediaUpload(msg, phone) {
    try {
        const media = await msg.downloadMedia();
        if (!media) return null;

        const fileExt = media.mimetype.split('/')[1] || 'jpg';
        const fileName = `docs/${phone}/${Date.now()}.${fileExt}`;
        const fileBuffer = Buffer.from(media.data, 'base64');

        const { data, error } = await supabase.storage
            .from('customer_documents') 
            .upload(fileName, fileBuffer, { contentType: media.mimetype, upsert: true });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('customer_documents').getPublicUrl(fileName);
        return publicUrl;
    } catch (err) {
        logger.error(`🚨 Storage Error: ${err.message}`);
        return null;
    }
}

// ३. ह्वाट्सएप क्लाइन्ट सेटअप (v4 Core)
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'sajilo-bot' }), // तपाईँको पुरानै clientId
    puppeteer: { 
        headless: false, // सुरुमा हेर्नको लागि false, पछि true बनाउन सक्नुहुन्छ
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--disable-gpu'
        ]
    }
});

// ४. इभेन्ट लाइफसाइकल
client.on('qr', (qr) => {
    engineStatus.state = "awaiting_login";
    console.clear();
    console.log('📱 SCAN THIS QR CODE (TITAN v4.2):');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    engineStatus.state = "running";
    logger.info('🚀 TITAN ENGINE v4.2: Online & Syncing...');
});

// ५. मुख्य म्यासेज ह्यान्डलर (Updated for New SQL Schema)
client.on('message', async (msg) => {
    if (msg.from.includes('@g.us') || msg.isStatus) return;

    try {
        const contact = await msg.getContact();
        const phone = contact.number;
        engineStatus.processedCount++;

        logger.info(`📩 Msg from ${contact.pushname || phone}`);

        // क) मिडिया ह्यान्डल गर्ने
        let fileLink = null;
        if (msg.hasMedia) {
            fileLink = await handleMediaUpload(msg, phone);
        }

        // ख) पुरानो डाटा तान्ने (History जोगाउन)
        const { data: user } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', phone)
            .single();

        // ग) नयाँ च्याट इन्ट्री तयार पार्ने
        const timeNow = new Date().toLocaleTimeString();
        const chatEntry = `[${timeNow}] User: ${msg.body || "Sent a file"}${fileLink ? ` (File: ${fileLink})` : ""}`;
        
        // घ) पेलोड: तपाईँको नयाँ SQL Table सँग मिल्ने गरी
        const payload = {
            phone_number: phone,
            customer_name: contact.pushname || phone,
            platform: 'whatsapp',           // अनिवार्य: तपाईँको SQL Policy ले यो खोज्छ
            last_updated_by: 'TITAN_BOT',   // तपाईँको SQL मा भएको कोलम
            chat_summary: `${user?.chat_summary || ""}\n${chatEntry}`.slice(-2500),
            status: user?.status || 'in_progress', // SQL को डिफल्टसँग मिल्ने गरी
            service: user?.service || 'Other',
            updated_at: new Date().toISOString()
        };

        // मिडिया छ भने एरेको रूपमा पठाउने (SQL मा TEXT[] भएकोले)
        if (fileLink) {
            payload.documents = [fileLink]; 
        }

        // ङ) UPSERT गर्ने
        const { error } = await supabase
            .from('customers')
            .upsert(payload, { onConflict: 'phone_number' });

        if (error) {
            logger.error(`❌ DB Sync Fail: ${error.message}`);
        } else {
            logger.info(`✅ Synced to Dashboard: ${contact.pushname}`);
        }

    } catch (err) {
        logger.error(`❌ Processing Error: ${err.message}`);
    }
});