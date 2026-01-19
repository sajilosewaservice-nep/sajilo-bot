require('dotenv').config(); 
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');

// १. Supabase कनेक्शन सेटअप
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// २. WhatsApp Client सेटअप (LocalAuth ले गर्दा बारम्बार लगइन गर्नु पर्दैन)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-extensions'
        ] 
    }
});

// ३. QR कोड जेनेरेशन
client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    console.log('-----------------------------------------------------');
    console.log('Titan CRM: ह्वाट्सएप QR कोड स्क्यान गर्नुहोस्');
    console.log('-----------------------------------------------------');
});

// ४. बोट तयार भएपछि मेसेज दिने
client.on('ready', () => {
    console.log('✅ WhatsApp Bot Ready! Listening for messages...');
});

// ५. मुख्य म्यासेज ह्यान्डलर
client.on('message', async (msg) => {
    // ग्रुप म्यासेजलाई इग्नोर गर्ने (व्यक्तिगत म्यासेज मात्र लिने)
    if (msg.from.includes('@g.us')) return;

    try {
        const contact = await msg.getContact();
        const customerPhone = contact.number;

        // क) डेटाबेसमा ग्राहक छ कि छैन चेक गर्ने
        const { data: existingUser } = await supabase
            .from('customers')
            .select('status, service, documents')
            .eq('phone_number', customerPhone)
            .single();

        let customerData = {
            customer_name: contact.pushname || customerPhone,
            phone_number: customerPhone,
            platform: 'whatsapp',
            chat_summary: msg.body || (msg.hasMedia ? "📷 Media Received" : "New message"),
            status: existingUser ? existingUser.status : 'in_progress',
            service: existingUser ? existingUser.service : 'Other',
            updated_at: new Date().toISOString()
        };

        // ख) फोटो वा डकुमेन्ट ह्यान्डल गर्ने
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    // फाइलको नाम बनाउने (समय र फोन नम्बर मिलाएर)
                    const fileExtension = media.mimetype.split('/')[1].split(';')[0];
                    const fileName = `wa_${Date.now()}_${customerPhone}.${fileExtension}`;
                    const fileBuffer = Buffer.from(media.data, 'base64');

                    // सुपाबेस स्टोरेजमा अपलोड गर्ने
                    const { error: uploadError } = await supabase.storage
                        .from('documents') 
                        .upload(fileName, fileBuffer, { 
                            contentType: media.mimetype,
                            upsert: true 
                        });

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('documents')
                            .getPublicUrl(fileName);
                        
                        // पुराना डकुमेन्टको लिस्टमा नयाँ थप्ने
                        const currentDocs = existingUser?.documents || [];
                        customerData.documents = [...currentDocs, publicUrl];
                        
                        if(!msg.body) customerData.chat_summary = "📷 New Media Received";
                    } else {
                        console.error('⚠️ Upload Error:', uploadError.message);
                    }
                }
            } catch (mediaErr) {
                console.error('⚠️ Media Processing Error:', mediaErr.message);
            }
        }

        // ग) डेटाबेस अपडेट वा नयाँ इन्ट्री (Upsert)
        const { error: dbError } = await supabase
            .from('customers')
            .upsert(customerData, { onConflict: 'phone_number' });

        if (dbError) {
            console.error('❌ DB Save Error:', dbError.message);
        } else {
            console.log(`🚀 WhatsApp Sync Success: ${customerData.customer_name}`);
        }

    } catch (err) {
        console.error('❌ Critical System Error:', err.message);
    }
});

// ६. क्लाइन्ट सुरु गर्ने
client.initialize();