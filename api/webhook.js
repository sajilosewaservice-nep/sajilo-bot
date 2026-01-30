/**
 * TITAN MESSENGER ENGINE v4.0.0 (SYNC READY)
 * -----------------------------------------
 * यो कोडले फेसबुक म्यासेन्जरका म्यासेजहरूलाई सिधै सुपवेसमा सिंक गर्छ।
 */

const fetch = require('node-fetch');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// १. कन्फिगरेसन (Config)
const CONFIG = {
    SUPABASE_URL: "https://ratgpvubjrcoipardzdp.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",
    PAGE_ACCESS_TOKEN: "EAAcaSLIPpeYBQtd8KAJjlnZCmcMWXRCCWSWNeWye0ucjX2KBp5sNp4tO1HD19d4ZBx06BFEsxZCgDcBm7VxlGBwFxU7rZCDnadrXYU3z0yfWHZBByyqOZCoZCIlTARxRbD1AbuXsN2v1UbCWGS72TbfUaDGcVTTL2qW3R8p2eEqv6nqPWjj6qFw3IWvR27ualAO1FEmUtHvUAZDZD",
    VERIFY_TOKEN: "titan_crm_2026"
};

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// २. फेसबुक प्रोफाइल तान्ने फङ्सन
async function getFacebookUserProfile(psid) {
    try {
        const response = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${CONFIG.PAGE_ACCESS_TOKEN}`);
        const data = await response.json();
        return {
            name: data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : "Messenger User",
            profilePic: data.profile_pic || null
        };
    } catch (error) {
        console.error("❌ Profile Fetch Error:", error);
        return { name: "Messenger User", profilePic: null };
    }
}

// ३. फेसबुक भेरिफिकेसन (GET Method)
app.get('/api/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
        console.log("✅ Messenger Webhook Verified!");
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// ४. मुख्य इन्जिन: म्यासेज रिसिभ र CRM सिंक (POST Method)
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

            // क) पुराना विवरण र फेसबुक प्रोफाइल तान्ने
            const [userProfile, { data: existingCustomer }] = await Promise.all([
                getFacebookUserProfile(psid),
                supabase.from('customers').select('*').eq('phone_number', psid).maybeSingle()
            ]);

            // ख) डकुमेन्टहरू मर्ज गर्ने
            let oldDocs = existingCustomer?.documents || [];
            const updatedDocs = [...new Set([...oldDocs, ...attachments])].filter(Boolean);

            const finalMessage = messageText || (attachments.length > 0 ? "📷 Sent an attachment" : "New Message");

            // ग) TITAN v4.0.0 Logic: नयाँलाई 'inquiry' मा राख्ने, पुरानाको 'status' जोगाउने
            const customerData = {
                phone_number: psid, // Messenger ID लाई नै Phone Number को रूपमा प्रयोग गरिएको
                customer_name: userProfile.name,
                chat_summary: finalMessage,
                platform: 'messenger',
                status: existingCustomer ? existingCustomer.status : 'inquiry', // v4.0.0 Logic
                service: existingCustomer ? existingCustomer.service : 'Other',
                documents: updatedDocs,
                last_updated_by: 'MESSENGER_BOT',
                updated_at: new Date().toISOString()
            };

            try {
                await Promise.all([
                    // Customers टेबल सिंक
                    supabase.from('customers').upsert(customerData, { onConflict: 'phone_number' }),
                    
                    // History को लागि Messages टेबलमा इन्सर्ट
                    supabase.from('messages').insert([{
                        customer_id: psid,
                        content: finalMessage,
                        is_from_customer: true,
                        metadata: { urls: attachments, profile_pic: userProfile.profilePic }
                    }])
                ]);
                console.log(`✅ CRM Synced: ${userProfile.name} [${customerData.status}]`);
            } catch (err) {
                console.error("❌ Sync Error:", err.message);
            }
        }
    }
    res.status(200).send('EVENT_RECEIVED');
});

// ५. ड्यासबोर्डबाट रिप्लाई पठाउने API
app.post('/api/direct-reply', async (req, res) => {
    const { psid, messageText } = req.body;
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${CONFIG.PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: psid },
                message: { text: messageText }
            })
        });

        if (response.ok) {
            await supabase.from('messages').insert([{
                customer_id: psid,
                content: messageText,
                is_from_customer: false
            }]);
            res.status(200).json({ success: true });
        } else {
            const err = await response.json();
            res.status(500).json({ success: false, error: err });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Messenger Webhook Engine running on port ${PORT}`));