const VERIFY_TOKEN = "titan_crm_2026";

function simulateFacebookVerify(tokenFromFB) {
    console.log("-----------------------------------------");
    console.log("🔍 Verify Token चेक गर्दैछ...");
    
    if (tokenFromFB === VERIFY_TOKEN) {
        console.log("✅ सफलता! Verify Token मिल्यो।");
        console.log("💡 फेसबुकमा यही 'titan_crm_2026' हाल्नुहोला।");
    } else {
        console.log("❌ गडबड! टोकन मिलेन।");
    }
    console.log("-----------------------------------------");
}

// फेसबुकले पठाउने टोकन चेक गरेको नाटक (Simulation)
simulateFacebookVerify("titan_crm_2026");