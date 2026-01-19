require('dotenv').config(); 
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');

// पुरानो 'https://...' र 'eyJh...' भएको लाइन हटाएर यो लेख्नुहोस्
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, // यसलाई true बनाएपछि ब्राउजर खुल्दैन, टर्मिनलमा QR कोड आउँछ
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox'
        ] 
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    console.log('-----------------------------------------------------');
    console.log('Titan CRM: QR कोड स्क्यान गर्नुहोस्');
    console.log('-----------------------------------------------------');
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot Ready! Listening for messages...');
});

// ३. म्यासेज प्रोसेसिङ इन्जिन
client.on('message', async (msg) => {
    try {
        const contact = await msg.getContact();
        const customerPhone = contact.number;

        // क) डेटाबेसमा यो ग्राहक पहिल्यै छ कि छैन चेक गर्ने
        const { data: existingUser } = await supabase
            .from('customers')
            .select('status, service, documents')
            .eq('phone_number', customerPhone)
            .single();

        // ख) पठाउने डाटा तयार गर्ने
        let customerData = {
            customer_name: contact.pushname || customerPhone,
            phone_number: customerPhone,
            platform: 'whatsapp',
            chat_summary: msg.body || (msg.hasMedia ? "📷 Media Received" : ""),
            // यदि ग्राहक नयाँ हो भने मात्र 'in_progress' राख्ने, नत्र पुरानै status जोगाउने
            status: existingUser ? existingUser.status : 'in_progress',
            service: existingUser ? existingUser.service : 'Other',
            updated_at: new Date().toISOString()
        };

        // ग) मिडिया (फोटो/डकुमेन्ट) ह्यान्डल गर्ने
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const fileName = `${Date.now()}_${customerPhone}.jpg`;
                    const fileBuffer = Buffer.from(media.data, 'base64');

                    const { error: uploadError } = await supabase.storage
                        .from('documents') 
                        .upload(fileName, fileBuffer, { contentType: media.mimetype });

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('documents')
                            .getPublicUrl(fileName);
                        
                        // पुराना फोटोहरूमा नयाँ फोटो थप्ने (Array Append)
                        const currentDocs = existingUser?.documents || [];
                        customerData.documents = [...currentDocs, publicUrl];
                        
                        if(!msg.body) customerData.chat_summary = "📷 New Media Added";
                    }
                }
            } catch (mediaErr) {
                console.error('⚠️ Media Upload Error:', mediaErr.message);
            }
        }

        // घ) डेटाबेसमा Upsert गर्ने (फोन नम्बरको आधारमा)
        const { error } = await supabase
            .from('customers')
            .upsert(customerData, { onConflict: 'phone_number' });

        if (error) {
            console.error('❌ DB Save Error:', error.message);
        } else {
            console.log(`✅ Sync Success: ${customerData.customer_name}`);
        }

    } catch (err) {
        console.error('❌ System Error:', err.message);
    }
});

const express = require('express');
const axios = require('axios'); 
const app = express();
app.use(express.json());

const MESSENGER_CONFIG = {
    // यो लाइनले अब .env फाइलको बाकसबाट डाटा तान्छ
    PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN, 
    VERIFY_TOKEN: process.env.VERIFY_TOKEN || 'titan_crm_2026'
};

// १. मेसेन्जर इन्जिन (फोटोलाई Supabase मा अपलोड गर्ने नयाँ लजिक)
async function syncMessengerToSupabase(senderId, messageEvent) {
    try {
        const messageText = messageEvent.text;
        const attachments = messageEvent.attachments;

        // --- यसलाई मात्र फेर्नुहोस् ---
        const fbUrl = `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${MESSENGER_CONFIG.PAGE_ACCESS_TOKEN}`;
        
        const fbResponse = await axios.get(fbUrl).catch((err) => {
            console.log("❌ Facebook API Error:", err.response ? err.response.data : err.message); 
            return { data: {} };
        });

        // यो लाइनले तपाईँलाई टर्मिनलमा नाम आयो कि आएन देखाउँछ
        console.log("👤 Facebook Profile Data:", fbResponse.data); 

        const fullName = fbResponse.data.first_name 
            ? `${fbResponse.data.first_name} ${fbResponse.data.last_name}` 
            : 'Messenger User';
        // --- यहाँ सम्म मात्र ---

        const { data: existingUser } = await supabase
            .from('customers')
            .select('status, documents')
            .eq('messenger_id', senderId)
            .single();

        let messengerData = {
            messenger_id: senderId,
            customer_name: fullName,
            platform: 'messenger',
            chat_summary: messageText || (attachments ? "📷 Media Received" : "New Message"),
            status: existingUser ? existingUser.status : 'in_progress',
            updated_at: new Date().toISOString(),
            last_updated_by: 'TITAN_MESSENGER_CORE',
            documents: existingUser?.documents || []
        };

        // --- मिडियालाई ह्वाट्सएप जस्तै बनाउने (Preview Fix) ---
        if (attachments && attachments.length > 0) {
            for (const attachment of attachments) {
                if (attachment.payload && attachment.payload.url) {
                    const fileUrl = attachment.payload.url;
                    
                    if (attachment.type === 'image') {
                        // फोटोलाई डाउनलोड गरेर Supabase Storage मा हाल्ने
                        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                        const fileName = `msg_${Date.now()}.jpg`;
                        
                        await supabase.storage.from('documents').upload(fileName, response.data, { contentType: 'image/jpeg' });
                        
                        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
                        messengerData.documents.push(publicUrl);
                        messengerData.chat_summary = "📷 New Photo Added";
                    } else {
                        messengerData.documents.push(fileUrl);
                    }
                }
            }
        }

        const { error } = await supabase
            .from('customers')
            .upsert(messengerData, { onConflict: 'messenger_id' });

        if (!error) console.log(`🚀 Messenger Sync Success: ${fullName}`);

    } catch (err) {
        console.error('❌ Messenger Error:', err.message);
    }
}

// २. वेबहुक पोर्ट ३००० मा सुन्ने
app.post('/webhook', (req, res) => {
    const body = req.body;
    if (body.object === 'page') {
        body.entry.forEach(entry => {
            const webhook_event = entry.messaging[0];
            if (webhook_event.message) syncMessengerToSupabase(webhook_event.sender.id, webhook_event.message);
        });
        res.status(200).send('EVENT_RECEIVED');
    }
});

app.listen(3000, () => {
    console.log('🌐 Messenger Webhook Active on Port 3000');
});

client.initialize();