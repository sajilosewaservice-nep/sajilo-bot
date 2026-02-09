const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');

const supabase = createClient("https://ratgpvubjrcoipardzdp.supabase.co", "तपाईँको_ANON_KEY_यहाँ_हाल्नुहोस्");

async function startListing() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.key.fromMe && m.message) {
            const sender = m.key.remoteJid;
            const text = m.message.conversation || m.message.extendedTextMessage?.text || "Media";
            const name = m.pushName || "New Customer";

            console.log(`📥 New Message: ${name} - ${text}`);

            await supabase.from('customers').upsert([{ 
                phone_number: sender.replace('@s.whatsapp.net', ''),
                customer_name: name,
                chat_summary: text,
                platform: 'whatsapp',
                updated_at: new Date()
            }], { onConflict: 'phone_number' });
            
            console.log("✅ Listed in Supabase!");
        }
    });
}
startListing();