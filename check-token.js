const axios = require('axios');

// १. तपाईँको टोकनहरू (मैले यहाँ सबै सच्याइदिएको छु)
const PAGE_ACCESS_TOKEN = "EAAcaSLIPpeYBQdlPK5I7QUFqs1EIJQa9ZCroZATOou6V3ozjIeYiSsqIyWUk5bwXRTdogRW8Ii2595dQZC1Vb0OqWRyStGWlEutdZBDE6bFfK1FHxgsXlxmnbty8fqajodQmBwQXZC0OjZBpa8nj2Pl9K1XpA9VZAjZCBVoZAhH4p6r9c748LQSHP647vHQzxGsvNi5xiZA97jAAZDZD";
const VERIFY_TOKEN = "titan_crm_2026";

async function testFacebookToken() {
    try {
        console.log("-----------------------------------------");
        console.log("🚀 फेसबुक टोकन चेक गर्दैछ... कृपया पर्खनुहोस्।");
        console.log("-----------------------------------------");
        
        // फेसबुक ग्राफ API सँग कुरा गर्दै
        const response = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${PAGE_ACCESS_TOKEN}`);
        
        console.log("✅ सफलता! टोकनले काम गरिरहेको छ।");
        console.log("📄 पेजको नाम:", response.data.name);
        console.log("🆔 पेजको ID:", response.data.id);
        console.log("-----------------------------------------");
        console.log("💡 अब तपाईँ यो टोकनलाई आफ्नो मुख्य webhook.js मा हाल्न सक्नुहुन्छ।");
    } catch (error) {
        console.error("❌ टोकनमा समस्या देखियो!");
        if (error.response) {
            console.error("विवरण:", error.response.data.error.message);
        } else {
            console.error("Error:", error.message);
        }
        console.log("-----------------------------------------");
    }
}

testFacebookToken();