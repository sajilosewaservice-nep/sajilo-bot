const fetch = require('node-fetch');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// १. कन्फिगरेसन (Environment Variables मा राख्नु राम्रो हुन्छ)
const CONFIG = {
    SUPABASE_URL: "https://ratgpvubjrcoipardzdp.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",
    PAGE_ACCESS_TOKEN: "EAAcaSLIPpeYBQtCvOSrO7r3IWAbylbq3yB7mogGwmZA71nNS7RPzkdnDfe5M8D3vN993LN7nvUN0D1k2ZCmt0dXkn8HjpmbffDKOozGkEk6H3CGXahWZABw6CZAxah9ClHixXpEJBYZC0iTS4OkAQim38IjraOYVz0mziWZA1jex2jOI5NZAz89ZArGjF4fPwa4YVak7YfiF1AZDZD",
    VERIFY_TOKEN: "titan_crm_2026"
};

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// २. हेल्पर फङ्सन: फेसबुकबाट युजरको विवरण तान्न
async function getFacebookUserProfile(psid) {
    try {
        const response = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${CONFIG.PAGE_ACCESS_TOKEN}`);
        const data = await response.json();
        return {
            name: data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : "Messenger User",
            profilePic: data.profile_pic || null
        };
    } catch (error) {
        console.error("❌ FB Profile Fetch Error:", error);
        return { name: "Messenger User", profilePic: null };
    }
}

// ३. फेसबुक भेरिफिकेसन (Webhook Setup)
app.get('/api/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
        console.log("✅ Webhook Verified!");
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// ४. मुख्य इन्जिन: म्यासेज रिसिभ र डाटाबेस अपडेट
app.post('/api/webhook', async (req, res) => {
    const body = req.body;

    if (body.object !== 'page') return res.sendStatus(404);

    for (const entry of body.entry) {
        if (!entry.messaging) continue;

        const event = entry.messaging[0];
        const psid = event.sender.id;

        if (event.message) {
            const messageText = event.message.text || "";
            let attachments = [];

            if (event.message.attachments) {
                attachments = event.message.attachments.map(a => a.payload.url);
            }

            console.log(`📩 New message from ${psid}: ${messageText || '[Attachment]'}`);

            // क) फेसबुक प्रोफाइल र सुपाबेसको पुरानो डाटा एकैसाथ तान्ने (Parallel processing)
            const [userProfile, { data: existingCustomer }] = await Promise.all([
                getFacebookUserProfile(psid),
                supabase.from('customers').select('documents').eq('messenger_id', psid).maybeSingle()
            ]);

            // ख) डकुमेन्ट/फोटोहरू मर्ज गर्ने लजिक
            let oldDocs = existingCustomer?.documents || [];
            if (!Array.isArray(oldDocs)) oldDocs = [oldDocs];
            const updatedDocs = [...new Set([...oldDocs, ...attachments])].filter(Boolean);

            // ग) डाटाबेस अपडेट (Customers & Messages)
            const finalMessage = messageText || (attachments.length > 0 ? "📷 Sent an attachment" : "New Message");

            try {
                await Promise.all([
                    // Customers टेबल अपडेट
                    supabase.from('customers').upsert({
                        messenger_id: psid,
                        customer_name: userProfile.name,
                        chat_summary: finalMessage,
                        platform: 'messenger',
                        documents: updatedDocs,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'messenger_id' }),

                    // Messages (History) टेबल अपडेट
                    supabase.from('messages').insert([{
                        customer_id: psid,
                        content: finalMessage,
                        is_from_customer: true,
                        metadata: { urls: attachments, profile_pic: userProfile.profilePic }
                    }])
                ]);
                console.log(`✅ Database updated for ${userProfile.name}`);
            } catch (dbError) {
                console.error("❌ Database Update Error:", dbError);
            }
        }
    }
    res.status(200).send('EVENT_RECEIVED');
});

// ५. ड्यासबोर्डबाट सिधै रिप्लाई पठाउने API
app.post('/api/direct-reply', async (req, res) => {
    const { psid, messageText } = req.body;

    if (!psid || !messageText) {
        return res.status(400).json({ error: "Missing psid or messageText" });
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${CONFIG.PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: psid },
                message: { text: messageText }
            })
        });

        const result = await response.json();
        if (response.ok) {
            // रिप्लाई म्यासेजलाई पनि हिस्ट्रीमा सेभ गर्ने
            await supabase.from('messages').insert([{
                customer_id: psid,
                content: messageText,
                is_from_customer: false
            }]);
            
            res.status(200).json({ success: true, result });
        } else {
            res.status(500).json({ success: false, error: result });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

module.exports = app;