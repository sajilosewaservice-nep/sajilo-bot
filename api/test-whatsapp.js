const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false, // ब्राउजर खुल्छ, यसलाई बन्द नगर्नुहोस्
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        ],
    }
});

console.log('--- ह्वाट्सएप जडान परीक्षण सुरु हुँदैछ ---');

// १. लोड हुँदा कति प्रतिशत भयो हेर्न यो थप्नुहोस्
client.on('loading_screen', (percent, message) => {
    console.log('ह्वाट्सएप लोड हुँदैछ:', percent, '% -', message);
});

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

// २. डिस्कनेक्ट भयो भने थाहा पाउन यो थप्नुहोस्
client.on('disconnected', (reason) => {
    console.log('ह्वाट्सएप डिस्कनेक्ट भयो:', reason);
});

client.initialize();