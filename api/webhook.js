const fetch = require('node-fetch');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.json());

// १. सुपाबेस कन्फिगरेसन
const SUPABASE_URL = "https://ratgpvubjrcoipardzdp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAGE_ACCESS_TOKEN = "EAAcaSLIPpeYBQtCvOSrO7r3IWAbylbq3yB7mogGwmZA71nNS7RPzkdnDfe5M8D3vN993LN7nvUN0D1k2ZCmt0dXkn8HjpmbffDKOozGkEk6H3CGXahWZABw6CZAxah9ClHixXpEJBYZC0iTS4OkAQim38IjraOYVz0mziWZA1jex2jOI5NZAz89ZArGjF4fPwa4YVak7YfiF1AZDZD";

// २. फेसबुक भेरिफिकेसन
app.get('/api/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === "titan_crm_2026") {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// ३. नयाँ म्यासेज र नाम सेभ गर्ने इन्जिन
app.post('/api/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            const webhook_event = entry.messaging[0];
            const psid = webhook_event.sender.id;

            if (webhook_event.message) {
                let customerName = "Messenger User"; 
                try {
                    const userRes = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name&access_token=${PAGE_ACCESS_TOKEN}`);
                    const userData = await userRes.json();
                    if(userData.first_name) {
                        customerName = `${userData.first_name} ${userData.last_name || ''}`.trim();
                    }
                } catch (err) {
                    console.error("Name fetch error:", err);
                }

                const messageText = webhook_event.message.text || "Sent an attachment";
                
                let attachments = [];
                if (webhook_event.message.attachments) {
                    attachments = webhook_event.message.attachments.map(a => a.payload.url);
                }

                // १. पहिलेको डाटा तान्ने
const { data: currentCust } = await supabase
    .from('customers')
    .select('documents')
    .eq('messenger_id', psid)
    .maybeSingle();

// २. पुराना फाइलहरूलाई पक्का Array बनाउने (यो नै मुख्य समाधान हो)
let oldDocs = [];
if (currentCust && currentCust.documents) {
    // यदि पहिलेदेखि नै एरे छ भने लिने, नत्र एरेमा बदल्ने
    oldDocs = Array.isArray(currentCust.documents) ? currentCust.documents : [currentCust.documents];
}

// ३. नयाँ र पुराना मिसाउने (यसले १ वटा होइन, जति पनि फोटो बस्न दिन्छ)
const allDocs = [...new Set([...oldDocs, ...attachments])].filter(Boolean); 

// ४. अब अपडेट गर्ने (यसले म्यासेज रोकिन दिँदैन)
                const { error: upsertError } = await supabase
                    .from('customers')
                    .upsert({
                        messenger_id: psid,
                        customer_name: customerName,
                        phone_number: psid, 
                        chat_summary: messageText,
                        platform: 'messenger',
                        documents: allDocs || [], // यदि केही छैन भने खाली एरे पठाउने
                        updated_at: new Date().toISOString()
                    }, { 
                        onConflict: 'messenger_id'
                    });

                if (upsertError) {
                    console.error("Supabase Error:", upsertError.message);
                }
            } // if (webhook_event.message) को अन्त्य
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// ४. ड्यासबोर्डबाट रिप्लाई पठाउन
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