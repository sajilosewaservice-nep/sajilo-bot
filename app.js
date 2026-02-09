/**
 * TITAN ENTERPRISE CRM v4.0.0 - WHATSAPP ENGINE
 * --------------------------------------------------
 * Optimized Professional Version (Stable & Verified)
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

// इन्जिन स्टाटस ट्र्याकिङ
let engineStatus = { 
    state: "booting", 
    processedCount: 0, 
    startTime: new Date().toLocaleString(),
    lastSync: "Never" 
};

// २. ह्वाट्सएप क्लाइन्ट सेटअप (Puppeteer Optimized)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
    }
});

// ३. एड्भान्स्ड स्टोरेज लजिक (मिडिया ह्यान्डलर)
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

// ४. इभेन्ट लाइफसाइकल
client.on('qr', (qr) => {
    engineStatus.state = "awaiting_login";
    console.log('\n📱 TITAN CRM v4.0.0 - SCAN QR CODE:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    engineStatus.state = "running";
    console.log('\n✅ TITAN ENGINE v4.0.0: ONLINE & READY');
    logger.info('WhatsApp connection established successfully.');
});

// ५. मुख्य म्यासेज प्रोसेसिङ लजिक
client.on('message', async (msg) => {
    if (msg.from.includes('@g.us') || msg.isStatus) return;

    try {
        const contact = await msg.getContact();
        const phone = contact.number;
        engineStatus.processedCount++;
        engineStatus.lastSync = new Date().toLocaleTimeString();

        logger.info(`📩 Incoming: ${contact.pushname || phone}`);

        // क) मिडिया छ भने अपलोड गर्ने
        let fileLink = msg.hasMedia ? await handleMediaUpload(msg, phone) : null;

        // ख) पुरानो डाटा र हिस्ट्री तान्ने
        const { data: user } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', phone)
            .maybeSingle();

        // ग) डकुमेन्ट लिस्ट अपडेट
        let updatedDocs = Array.isArray(user?.documents) ? user.documents : [];
        if (fileLink) {
            updatedDocs.push({
                url: fileLink,
                type: 'image',
                time: new Date().toLocaleString()
            });
        }

        // घ) च्याट हिस्ट्री बनाउने (Line by Line)
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = `[${timeNow}] User: ${msg.body || "📷 Media File"}`;
        const fullChatHistory = user?.chat_summary ? `${user.chat_summary}\n${newMessage}` : newMessage;

        // ङ) सुपाबेसमा डाटा पठाउने
        const { error } = await supabase.from('customers').upsert({
            phone_number: phone,
            customer_name: contact.pushname || phone,
            platform: 'whatsapp',
            chat_summary: fullChatHistory.slice(-5000), 
            status: user?.status || 'inquiry',
            documents: updatedDocs, 
            updated_at: new Date().toISOString()
        }, { onConflict: 'phone_number' });

        if (error) throw error;
        logger.info(`✅ Synced to Dashboard: ${contact.pushname}`);

    } catch (err) {
        logger.error(`❌ Sync Failed: ${err.message}`);
    }
});

// ६. API र सर्भर स्टार्टअप
app.get('/status', (req, res) => res.json(engineStatus));

server.listen(PORT, () => {
    logger.info(`🛰️ Titan Server running on Port ${PORT}`);
    client.initialize();
});