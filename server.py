import flask
from flask_cors import CORS
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import json
import time

# १. AI & SERVER CONFIG
genai.configure(api_key="तपाईँको_GEMINI_API_KEY_यहाँ")
ai_model = genai.GenerativeModel('gemini-pro')

app = flask.Flask(__name__)
CORS(app)

# २. AI BRAIN: डेटालाई शुद्ध नेपाली/अंग्रेजी र फारम ढाँचामा ढाल्ने
def process_data_with_ai(customer_data, service_type, instructions):
    prompt = f"""
    तपाईँ एउटा Expert RPA Assistant हो। 
    डेटा: {customer_data}
    सेवा: {service_type}
    नियम: {instructions}
    
    कृपया यो डेटाबाट नाम, ठेगाना, जन्ममिति र नागरिकता नम्बर निकालेर शुद्ध JSON मात्र दिनुहोस्।
    JSON बाहेक अरु केही नलेख्नुहोस्।
    """
    try:
        response = ai_model.generate_content(prompt)
        # AI को रेस्पोन्सबाट JSON मात्र निकाल्ने
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_json)
    except:
        return customer_data # यदि AI फेल भयो भने पुरानै डेटा प्रयोग गर्ने

# ३. RPA ENGINE: ब्राउजर नियन्त्रण
def start_browser_and_fill(final_data, service_type):
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service)
    driver.maximize_window()

    try:
        if service_type == "PCC":
            driver.get("https://opcr.nepalpolice.gov.np/")
            time.sleep(4)
            # यहाँ हामी 'driver.find_element' प्रयोग गरेर नाम ठेगाना भर्छौँ
            print(f"✅ Filling PCC for: {final_data.get('customer_name')}")
            
        elif service_type == "NID":
            driver.get("https://enrollment.donidcr.gov.np/")
            print(f"✅ Filling NID for: {final_data.get('customer_name')}")

        time.sleep(20) # तपाईँलाई हेर्नको लागि समय
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    # driver.quit() # काम सकिएपछि बन्द गर्न यो अन गर्न सकिन्छ

# ४. API ENDPOINT
@app.route('/start-automation', methods=['POST'])
def handle_rpa_request():
    request_data = flask.request.json
    customer = request_data.get('customer_data')
    service = request_data.get('service_type')
    rules = request_data.get('ai_instructions')

    print(f"🚀 Processing: {customer.get('customer_name')}")

    # AI मार्फत डेटा 'Clean' गर्ने
    final_data = process_data_with_ai(customer, service, rules)
    
    # रोबोट चलाउने
    start_browser_and_fill(final_data, service)

    return {"status": "success", "message": "Robot is working!"}

if __name__ == "__main__":
    app.run(port=5000)