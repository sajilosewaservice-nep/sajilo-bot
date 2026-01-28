require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const http = require('http' );

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const server = http.createServer(app );
const PORT = process.env.PORT || 3000;

let currentQRCode = null;
let isAuthenticated = false;

console.log('🚀 Starting WhatsApp Service...');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'sajilo-bot' }),
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-resources',
            '--single-process'
        ],
        timeout: 60000
    }
});

client.on('qr', (qr) => {
    console.log('\n📱 ========== QR CODE GENERATED ==========');
    console.log('Scan this QR code with WhatsApp');
    console.log('==========================================\n');
    currentQRCode = qr;
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
    isAuthenticated = true;
    currentQRCode = null;
});

client.on('ready', () => {
    console.log('✅ WhatsApp Client Ready!');
    isAuthenticated = true;
});

client.on('message', async (msg) => {
    if (msg.from.includes('@g.us')) return;
    try {
        const contact = await msg.getContact();
        const customerPhone = contact.number;
        const customerData = {
            customer_name: contact.pushname || customerPhone,
            phone_number: customerPhone,
            platform: 'whatsapp',
            chat_summary: msg.body || '📷 Media',
            status: 'in_progress',
            service: 'Other',
            updated_at: new Date().toISOString()
        };
        await supabase.from('customers').upsert(customerData, { onConflict: 'phone_number' });
        console.log(`✅ Synced: ${customerData.customer_name}`);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
});

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
    console.log(`\n🚀 WhatsApp Service running on http://localhost:${PORT}` );
    console.log(`📱 QR endpoint: http://localhost:${PORT}/qr` );
    console.log(`🏥 Status endpoint: http://localhost:${PORT}/status\n` );
});

console.log('⏳ Initializing WhatsApp client...');
client.initialize().catch(err => {
    console.error('❌ Initialization error:', err);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    client.destroy();
    server.close();
    process.exit(0);
});
