import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    // १. फेसबुक भेरिफिकेसन (यसले फेसबुकसँग बोट जोड्छ)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === 'titan_crm_2026') {
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Verification Failed');
    }

    // २. म्यासेज र फाइल प्रोसेसिङ (WhatsApp जस्तै पूर्ण सिस्टम)
    if (req.method === 'POST') {
        const body = req.body;

        if (body.object === 'page') {
            try {
                for (const entry of body.entry) {
                    if (!entry.messaging) continue;

                    for (const webhook_event of entry.messaging) {
                        if (webhook_event.message) {
                            const senderId = webhook_event.sender.id;
                            const messageText = webhook_event.message.text || "";
                            const attachments = webhook_event.message.attachments;

                            // सुपाबेसमा पुरानो रेकर्ड र डकुमेन्ट खोज्ने
                            const { data: existingUser } = await supabase
                                .from('customers')
                                .select('documents')
                                .eq('messenger_id', senderId)
                                .maybeSingle();

                            let currentDocs = existingUser?.documents || [];

                            // ३. फाइल (PDF, Photo, Video) ह्यान्डल गर्ने भाग
                            if (attachments && attachments.length > 0) {
                                for (const attachment of attachments) {
                                    if (attachment.payload && attachment.payload.url) {
                                        const fileUrl = attachment.payload.url;
                                        
                                        try {
                                            // फाइल डाउनलोड गर्ने
                                            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                                            
                                            // फाइलको नाम र प्रकार मिलाउने
                                            const contentType = response.headers['content-type'];
                                            const fileExt = contentType.includes('pdf') ? 'pdf' : 
                                                           contentType.includes('image') ? 'jpg' : 'file';
                                            const fileName = `messenger/${senderId}/msg_${Date.now()}.${fileExt}`;

                                            // सुपाबेस स्टोरेजमा अपलोड गर्ने
                                            const { error: uploadError } = await supabase.storage
                                                .from('documents')
                                                .upload(fileName, response.data, { contentType, upsert: true });

                                            if (!uploadError) {
                                                const { data: { publicUrl } } = supabase.storage
                                                    .from('documents')
                                                    .getPublicUrl(fileName);
                                                currentDocs.push(publicUrl);
                                            }
                                        } catch (err) {
                                            console.error('Media Download Error:', err.message);
                                        }
                                    }
                                }
                            }

                            // ४. डाटाबेस अपडेट (Upsert)
                            await supabase.from('customers').upsert({
                                messenger_id: senderId,
                                customer_name: 'Messenger User',
                                platform: 'messenger',
                                chat_summary: messageText || (attachments ? "📷 Media Received" : "New interaction"),
                                documents: currentDocs,
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'messenger_id' });
                        }
                    }
                }
                return res.status(200).send('EVENT_RECEIVED');
            } catch (err) {
                console.error('Global Error:', err.message);
                return res.status(200).send('EVENT_RECEIVED'); // फेसबुकलाई एरर नदेखाउने
            }
        }
    }
    res.status(405).send('Method Not Allowed');
}