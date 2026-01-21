const ngrok = require('ngrok');

(async function() {
  try {
    const url = await ngrok.connect(3000); // तपाईँको कोड ५००० पोर्टमा छ
    console.log('-----------------------------------------');
    console.log('🚀 Your Facebook Webhook URL is:');
    console.log(`${url}/webhook`);
    console.log('-----------------------------------------');
    console.log('Copy this URL and paste it into Facebook Developer Portal.');
  } catch (err) {
    console.error('Error while connecting ngrok:', err);
  }
})();