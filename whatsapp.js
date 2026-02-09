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

// ३. ह्वाट्सएप क्लाइन्ट सेटअप (v4 Core - Optimized for Windows)
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'sajilo-bot' }),
    puppeteer: { 
        headless: true, // विन्डो नखोली ब्याकग्राउन्डमा चलाउनको लागि true बनाइएको
        handleSIGINT: false, // विन्डोजमा प्रोसेस अड्किन नदिन यो थपिएको
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', 
            '--disable-gpu',
            '--disable-extensions',
            '--no-first-run',
            '--no-zygote'
        ]
    }
});

// ४. इभेन्ट लाइफसाइकल (सच्याइएको र प्रष्ट पारिएको)
client.on('qr', (qr) => {
    engineStatus.state = "awaiting_login";
    // console.clear(); // यसलाई हटाउँदा राम्रो, ताकि अरु म्यासेज देखियोस्
    console.log('\n--------------------------------------------');
    console.log('📱 SCAN THIS QR CODE (TITAN v4.2):');
    console.log('--------------------------------------------\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    engineStatus.state = "running";
    console.log('\n********************************************');
    console.log('✅ WHATSAPP IS READY & LISTENING!');
    console.log('🚀 TITAN ENGINE v4.2: Online & Syncing...');
    console.log('********************************************\n');
    logger.info('System is now fully operational.');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication Failure:', msg);
    engineStatus.state = "auth_failed";
});

client.on('disconnected', (reason) => {
    console.log('🛑 WhatsApp was logged out:', reason);
    engineStatus.state = "disconnected";
});
// ५. मुख्य म्यासेज ह्यान्डलर (ADVANCED VERSION - HISTORY & PREVIEW READY)
client.on('message', async (msg) => {
    if (msg.from.includes('@g.us') || msg.isStatus) return;

    try {
        const contact = await msg.getContact();
        const phone = contact.number;
        engineStatus.processedCount++;

        logger.info(`📩 Advanced Sync for: ${contact.pushname || phone}`);

        // क) मिडिया अपलोड गर्ने (Advanced Storage)
        let fileLink = null;
        if (msg.hasMedia) {
            fileLink = await handleMediaUpload(msg, phone);
        }

        // ख) पुरानो डाटा तान्ने (History जोगाउन यो अनिवार्य छ)
        const { data: user } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', phone)
            .maybeSingle();

        // ग) डकुमेन्ट लजिक (JSONB - ठूलो विन्डोको लागि)
        const oldDocs = Array.isArray(user?.documents) ? user.documents : [];
        let updatedDocs = [...oldDocs];
        if (fileLink) {
            updatedDocs.push({
                url: fileLink,
                type: 'image',
                name: `WA_Media_${Date.now()}`,
                time: new Date().toLocaleString()
            });
        }

        // घ) Advanced Chat History (Messenger जस्तै लाइन-बाइ-लाइन)
        const timeNow = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
        const newMessage = `[${timeNow}] User: ${msg.body || "📷 Sent a file"}`;
        
        // पुरानो समरीमा नयाँ म्यासेज थप्ने (Advanced Append)
        const fullChatHistory = user?.chat_summary 
            ? `${user.chat_summary}\n${newMessage}` 
            : newMessage;

        // ङ) पेलोड तयार पार्ने
        const payload = {
            phone_number: phone,
            customer_name: contact.pushname || phone,
            platform: 'whatsapp',
            last_updated_by: 'TITAN_ADVANCED',
            chat_summary: fullChatHistory.slice(-5000), // ५००० अक्षर सम्मको लामो इतिहास राख्ने
            status: user?.status || 'in_progress',
            service: user?.service || 'Other',
            documents: updatedDocs, 
            updated_at: new Date().toISOString()
        };

        // च) सुपाबेसमा पठाउने
        const { error } = await supabase
            .from('customers')
            .upsert(payload, { onConflict: 'phone_number' });

        if (error) {
            logger.error(`❌ Sync Error: ${error.message}`);
        } else {
            logger.info(`✅ History Updated for: ${contact.pushname}`);
        }

    } catch (err) {
        logger.error(`❌ Error: ${err.message}`);
    }
});

// ६. सर्भर र क्लाइन्ट स्टार्टअप (Improved for Debugging)
const startEngine = async () => {
    try {
        logger.info('🛰️ Starting Titan API and WhatsApp Engine...');
        
        // पहिले सर्भर चलाउने
        server.listen(PORT, () => {
            logger.info(`✅ Server is live on Port ${PORT}`);
        });

        // त्यसपछि ह्वाट्सएप सुरु गर्ने
        logger.info('⏳ Initializing WhatsApp Client...');
        await client.initialize();
        
    } catch (err) {
        logger.error(`❌ CRITICAL STARTUP ERROR: ${err.message}`);
        process.exit(1); // एरर आएमा बन्द गर्ने ताकि nodemon ले थाहा पाओस्
    }
};

startEngine();

// ७. सुरक्षित एक्जिट
process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down...');
    await client.destroy();
    process.exit(0);
});