const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ह्वाट्सएप क्लाइन्ट सेटअप
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false, // ब्राउजर आँखा अगाडि खुल्नेछ ताकि समस्या देखियोस्
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

console.log('--- ह्वाट्सएप जडान परीक्षण सुरु हुँदैछ ---');

client.on('qr', (qr) => {
    console.log('क्युआर कोड प्राप्त भयो! कृपया स्क्यान गर्नुहोस्:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('बधाई छ! तपाईँको ह्वाट्सएप पूर्ण रूपमा READY भयो र LISTENING मोडमा छ।');
});

client.on('auth_failure', (msg) => {
    console.error('प्रमाणीकरण असफल (Auth Failure):', msg);
});

client.initialize();