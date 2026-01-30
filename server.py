import flask
from flask_cors import CORS
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import json
import time

# १. AI & SERVER CONFIG (Key लाई .strip() गरेर सफा गरिएको छ)
RAW_KEY = "AIzaSyAsLmTXn6j_1SBirtXDRl9oclQh80064RY"
genai.configure(api_key=RAW_KEY.strip())
ai_model = genai.GenerativeModel('gemini-pro')

app = flask.Flask(__name__)
CORS(app)

# २. AI BRAIN
def process_data_with_ai(customer_data, service_type, instructions):
    prompt = f"Extract name, address, dob, and citizenship number as JSON from: {customer_data}. Service: {service_type}."
    try:
        response = ai_model.generate_content(prompt)
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_json)
    except Exception as e:
        print(f"⚠️ AI Skip: {e}")
        return customer_data 

# ३. RPA ENGINE
def start_browser_and_fill(final_data, service_type):
    print(f"🌐 Opening Browser for {service_type}...")
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service)
        driver.maximize_window()

        if service_type == "PCC":
            driver.get("https://opcr.nepalpolice.gov.np/")
        elif service_type == "NID":
            driver.get("https://enrollment.donidcr.gov.np/")
        else:
            driver.get("https://www.google.com") # Default

        print(f"✅ Browser Ready for: {final_data.get('customer_name', 'Customer')}")
        time.sleep(30) 
    except Exception as e:
        print(f"❌ Selenium Error: {str(e)}")

# ४. API ENDPOINT
@app.route('/start-automation', methods=['POST'])
def handle_rpa_request():
    data = flask.request.json
    customer = data.get('customer_data', {})
    service = data.get('service_type', 'PCC')
    rules = data.get('ai_instructions', '')

    print(f"🚀 Processing: {customer.get('customer_name', 'Unknown')}")

    # AI ले काम गरेन भने पनि ब्राउजर खुल्छ
    try:
        final_data = process_data_with_ai(customer, service, rules)
    except:
        final_data = customer

    start_browser_and_fill(final_data, service)
    return {"status": "success"}

if __name__ == "__main__":
    app.run(port=5000, debug=False)