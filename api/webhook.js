const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.json());

// १. तपाईँको सुपाबेस कन्फिगरेसन (तपाईँको app.js बाट सापट लिइएको)
const SUPABASE_URL = "https://ratgpvubjrcoipardzdp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAGE_ACCESS_TOKEN = "EAAcaSLIPpeYBQtd8KAJjlnZCmcMWXRCCWSWNeWye0ucjX2KBp5sNp4tO1HD19d4ZBx06BFEsxZCgDcBm7VxlGBwFxU7rZCDnadrXYU3z0yfWHZBByyqOZCoZCIlTARxRbD1AbuXsN2v1UbCWGS72TbfUaDGcVTTL2qW3R8p2eEqv6nqPWjj6qFw3IWvR27ualAO1FEmUtHvUAZDZD";

// २. फेसबुक भेरिफिकेसन (Webhook Setup को लागि)
app.get('/api/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === "titan_crm_2026") {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// ३. फेसबुकबाट नयाँ म्यासेज आउँदा सुपाबेसमा सेभ गर्ने इन्जिन
app.post('/api/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            const webhook_event = entry.messaging[0];
            const psid = webhook_event.sender.id; // पठाउनेको ID

            if (webhook_event.message) {
                const messageText = webhook_event.message.text || "Sent an attachment";
                
                // फेसबुकबाट फोटो वा फाइल आएको छ भने त्यसको URL लिने
                let attachments = [];
                if (webhook_event.message.attachments) {
                    attachments = webhook_event.message.attachments.map(a => a.payload.url);
                }

                if (webhook_event.message) {
                // १. फेसबुकबाट वास्तविक नाम तान्ने नयाँ कोड (यो थप्नुहोस्)
                let customerName = "Messenger User"; 
                try {
                    const userRes = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name&access_token=${PAGE_ACCESS_TOKEN}`);
                    const userData = await userRes.json();
                    if(userData.first_name) {
                        customerName = `${userData.first_name} ${userData.last_name || ''}`;
                    }
                } catch (err) {
                    console.error("Name fetch error:", err);
                }

                const messageText = webhook_event.message.text || "Sent an attachment";
                
                // ... बाँकी अट्याचमेन्टको कोड ...

                // २. अब यहाँ लाइन ५१ मा "Messenger User" को सट्टा customerName राख्नुहोस्
                const { error } = await supabase
                    .from('customers')
                    .upsert({
                        messenger_id: psid,
                        customer_name: customerName, // <-- यहाँ फेरियो
                        phone_number: psid,
                        chat_summary: messageText,
                        platform: 'messenger',
                        documents: attachments,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'messenger_id' });
                if (error) console.error("Supabase Error:", error);
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// ४. तपाईँको ड्यासबोर्डबाट जवाफ पठाउनको लागि (Direct Reply)
app.post('/api/direct-reply', async (req, res) => {
    const { psid, messageText } = req.body;

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: psid },
                message: { text: messageText }
            })
        });

        const result = await response.json();

        if (response.ok) {
            res.status(200).json({ success: true, result });
        } else {
            res.status(500).json({ success: false, error: result });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

module.exports = app;