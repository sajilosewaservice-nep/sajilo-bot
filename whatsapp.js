/**
 * TITAN WHATSAPP ENGINE v4.0.0 (SYNC READY)
 * ---------------------------------------
 * यो कोडले ह्वाट्सएप म्यासेजलाई सिधै सुपवेस (Supabase) मा सिंक गर्छ।
 */
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal'); // टर्मिनलमा QR देखाउन थपिएको
const express = require('express');
const http = require('http');

// १. सुपवेस कनेक्शन (Supabase Connection)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

let currentQRCode = null;
let isAuthenticated = false;

console.log('🚀 Starting Titan WhatsApp Service...');

// २. ह्वाट्सएप क्लाइन्ट सेटअप
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'sajilo-bot' }),
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        timeout: 60000
    }
});

// ३. क्यूआर कोड (QR Code) टर्मिनलमा देखाउने
client.on('qr', (qr) => {
    console.log('\n📱 ========== SCAN THIS QR CODE ==========');
    qrcode.generate(qr, { small: true }); // टर्मिनलमै QR आउँछ
    console.log('==========================================\n');
    currentQRCode = qr;
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
    isAuthenticated = true;
    currentQRCode = null;
});

client.on('ready', () => {
    console.log('🚀 WhatsApp Client Ready & Online!');
});

// ४. मुख्य म्यासेज ह्यान्डलर (v4.0.0 Logic)
client.on('message', async (msg) => {
    if (msg.from.includes('@g.us')) return; // ग्रुप इग्नोर गर्ने

    try {
        const contact = await msg.getContact();
        const customerPhone = contact.number;

        // क) पहिले नै यो ग्राहक छ कि छैन चेक गर्ने (उनको स्टेटस जोगाउन)
        const { data: existingUser } = await supabase
            .from('customers')
            .select('status, service')
            .eq('phone_number', customerPhone)
            .single();

        const customerData = {
            customer_name: contact.pushname || customerPhone,
            phone_number: customerPhone,
            platform: 'whatsapp',
            chat_summary: msg.body || (msg.hasMedia ? "📷 Media Received" : "New message"),
            
            // नयाँ लजिक: नयाँ मान्छे भए 'inquiry' मा राख्ने, पुरानाको 'working/success' नबिगार्ने
            status: existingUser ? existingUser.status : 'inquiry', 
            
            service: existingUser ? existingUser.service : 'Other',
            updated_at: new Date().toISOString()
        };

        // ख) डेटाबेसमा पठाउने (Upsert)
        const { error } = await supabase
            .from('customers')
            .upsert(customerData, { onConflict: 'phone_number' });

        if (!error) {
            console.log(`✅ Synced: ${customerData.customer_name} [${customerData.status}]`);
        }
    } catch (err) {
        console.error('❌ Sync Error:', err.message);
    }
});

// ५. वेब सर्भर रूटहरू (API Endpoints)
app.get('/qr', (req, res) => {
    if (!currentQRCode) {
        return res.status(400).json({ 
            success: false, 
            error: isAuthenticated ? 'Already authenticated' : 'QR code not ready yet' 
        });
    }
    res.json({ success: true, qr: currentQRCode });
});

app.get('/status', (req, res) => {
    res.json({ authenticated: isAuthenticated, hasQR: !!currentQRCode });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Service running on http://localhost:${PORT}`);
    console.log(`🏥 Status: http://localhost:${PORT}/status\n`);
});

// क्लाइन्ट सुरु गर्ने
client.initialize().catch(err => {
    console.error('❌ Initialization error:', err);
    process.exit(1);
});

// ६. सुरक्षित तरिकाले बन्द गर्ने
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await client.destroy();
    server.close();
    process.exit(0);
});