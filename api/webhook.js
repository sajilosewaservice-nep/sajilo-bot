const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const app = express();
app.use(express.json());

// १. साँचोहरू (Keys)
const SUPABASE_URL = "https://ratgpvubjrcoipardzdp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk";
const PAGE_ACCESS_TOKEN = "EAAcaSLIPpeYBQtd8KAJjlnZCmcMWXRCCWSWNeWye0ucjX2KBp5sNp4tO1HD19d4ZBx06BFEsxZCgDcBm7VxlGBwFxU7rZCDnadrXYU3z0yfWHZBByyqOZCoZCIlTARxRbD1AbuXsN2v1UbCWGS72TbfUaDGcVTTL2qW3R8p2eEqv6nqPWjj6qFw3IWvR27ualAO1FEmUtHvUAZDZD";
const VERIFY_TOKEN = "titan_crm_2026";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// २. फेसबुक भेरिफिकेसन (GET Method for Meta)
app.get('/api/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("✅ Webhook Verified Successfully!");
        return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification Failed');
});

// ३. म्यासेज र मिडिया प्रोसेसिङ (POST Method)
app.post('/api/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        try {
            for (const entry of body.entry) {
                if (!entry.messaging) continue;

                for (const webhook_event of entry.messaging) {
                    const senderId = webhook_event.sender.id;

                    if (webhook_event.message) {
                        const messageText = webhook_event.message.text || "";
                        const attachments = webhook_event.message.attachments;

                        // A. फेसबुकबाट ग्राहकको असली नाम तान्ने
                        let customerRealName = "Messenger User";
                        try {
                            const userProfile = await axios.get(`https://graph.facebook.com/${senderId}?fields=first_name,last_name,name&access_token=${PAGE_ACCESS_TOKEN}`);
                            customerRealName = userProfile.data.name || `${userProfile.data.first_name} ${userProfile.data.last_name}`;
                        } catch (err) {
                            console.error('❌ Error fetching name:', err.message);
                        }

                        // B. सुपाबेसमा पुराना डकुमेन्ट खोज्ने (Duplicate रोक्न)
                        const { data: existingUser } = await supabase
                            .from('customers')
                            .select('documents')
                            .eq('messenger_id', senderId)
                            .maybeSingle();

                        let currentDocs = existingUser?.documents || [];

                        // C. फाइलहरू (Images/PDF) डाउनलोड र अपलोड गर्ने
                        if (attachments && attachments.length > 0) {
                            for (const attachment of attachments) {
                                if (attachment.payload && attachment.payload.url) {
                                    try {
                                        const fileResponse = await axios.get(attachment.payload.url, { 
                                            params: { access_token: PAGE_ACCESS_TOKEN },
                                            responseType: 'arraybuffer' 
                                        });
                                        
// १. फाइलको प्रकार चिन्ने
const fileType = fileResponse.headers['content-type'] || ""; // नाम बदलियो
const isPDF = fileType.includes('pdf') || attachment.payload.url.toLowerCase().includes('.pdf');
const isImage = fileType.includes('image');

let fileExt = 'file';
let folder = 'others';

// लामो तरिका (तपाईँलाई सजिलो लाग्ने)
if (isPDF) {
    fileExt = 'pdf';
    folder = 'documents';
} else if (isImage) {
    fileExt = 'jpg';
    folder = 'images';
}

const fileName = `messenger/${senderId}/${folder}/msg_${Date.now()}.${fileExt}`;
                                        // Supabase Storage "documents" bucket मा अपलोड
                                        const { error: uploadError } = await supabase.storage
                                            .from('documents')
                                           .upload(fileName, fileResponse.data, { contentType: fileType, upsert: true });

                                        if (!uploadError) {
                                            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
                                            currentDocs.push(publicUrl);
                                            console.log(`📁 File Saved: ${fileName}`);
                                        } else {
                                            console.error('❌ Upload Error:', uploadError.message);
                                        }
                                    } catch (err) {
                                        console.error('❌ File Processing Error:', err.message);
                                    }
                                }
                            }
                        }

                        // D. डाटाबेस अपडेट (Upsert logic)
                        const { error: dbError } = await supabase.from('customers').upsert({
                            messenger_id: senderId,
                            customer_name: customerRealName,
                            platform: 'messenger',
                            chat_summary: messageText || (attachments ? "📷 Media Received" : "New interaction"),
                            documents: currentDocs,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'messenger_id' });

                        if (!dbError) {
                            console.log(`✅ Database Updated for: ${customerRealName}`);
                        }

                        // E. अटो-रिप्लाई पठाउने
                        await sendFacebookReply(senderId, `नमस्ते ${customerRealName}! यस अनलाइन सजिलो सर्भिस सेवामा यहाँलाई हार्दिक स्वागत छ।`);
                    }
                }
            }
            return res.status(200).send('EVENT_RECEIVED');
        } catch (err) {
            console.error("❌ Overall Error:", err.message);
            return res.status(200).send('EVENT_RECEIVED');
        }
    }
    res.status(404).send('Not Found');
});

// फेसबुकमा रिप्लाई पठाउने फङ्सन
async function sendFacebookReply(psid, text) {
    try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            recipient: { id: psid },
            message: { text: text }
        });
    } catch (err) {
        console.error('❌ Reply Error:', err.response ? err.response.data : err.message);
    }
}

// सर्भर पोर्ट ५००० मा सुन्ने (Local को लागि मात्र)
if (process.env.NODE_ENV !== 'production') {
    app.listen(5000, () => {
        console.log(`🚀 Titan Webhook is LIVE on port 5000`);
    });
}

// Vercel को लागि अनिवार्य Export
module.exports = app;