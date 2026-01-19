import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    // १. फेसबुक भेरिफिकेसन
    if (req.method === 'GET') {
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        if (token === process.env.VERIFY_TOKEN) {
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Verification Failed');
    }

    // २. म्यासेज प्रोसेसिङ (Text + Attachments)
    if (req.method === 'POST') {
        const body = req.body;
        if (body.object === 'page') {
            try {
                for (const entry of body.entry) {
                    const webhook_event = entry.messaging[0];
                    if (webhook_event && webhook_event.message) {
                        const senderId = webhook_event.sender.id;
                        const messageText = webhook_event.message.text;
                        const attachments = webhook_event.message.attachments;

                        // पुरानो डाटा तान्ने (documents array जोगाउन)
                        const { data: existingUser } = await supabase
                            .from('customers')
                            .select('documents')
                            .eq('messenger_id', senderId)
                            .single();

                        let currentDocs = existingUser?.documents || [];

                        // अट्याचमेन्ट (Photo, PDF, File) ह्यान्डल गर्ने
                        if (attachments && attachments.length > 0) {
                            for (const attachment of attachments) {
                                if (attachment.payload && attachment.payload.url) {
                                    const fileUrl = attachment.payload.url;
                                    
                                    // फाइल डाउनलोड गरेर सुपाबेसमा हाल्ने (Image/File को लागि)
                                    try {
                                        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                                        const fileExt = attachment.type === 'image' ? 'jpg' : 'pdf';
                                        const fileName = `msg_${Date.now()}_${senderId}.${fileExt}`;
                                        
                                        const { error: uploadError } = await supabase.storage
                                            .from('documents')
                                            .upload(fileName, response.data, { 
                                                contentType: response.headers['content-type'] 
                                            });

                                        if (!uploadError) {
                                            const { data: { publicUrl } } = supabase.storage
                                                .from('documents')
                                                .getPublicUrl(fileName);
                                            currentDocs.push(publicUrl);
                                        }
                                    } catch (err) {
                                        console.error('File sync error:', err.message);
                                    }
                                }
                            }
                        }

                        // सुपाबेसमा अन्तिम अपडेट गर्ने
                        await supabase.from('customers').upsert({
                            messenger_id: senderId,
                            customer_name: 'Messenger User',
                            platform: 'messenger',
                            chat_summary: messageText || (attachments ? "📷 Media Received" : "New Message"),
                            documents: currentDocs,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'messenger_id' });
                    }
                }
                return res.status(200).send('EVENT_RECEIVED');
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        }
    }
    res.status(405).send('Method Not Allowed');
}