import flask
from flask_cors import CORS
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import json
import time
import requests
import os
import random

# १. AI & SERVER CONFIG
RAW_KEY = "AIzaSyAsLmTXn6j_1SBirtXDRl9oclQh80064RY"
genai.configure(api_key=RAW_KEY.strip())
ai_model = genai.GenerativeModel('gemini-1.5-flash')

app = flask.Flask(__name__)
CORS(app)

# २. फोटो डाउनलोड गर्ने फङ्सन
def download_docs(urls):
    paths = []
    if not os.path.exists('temp_docs'): os.makedirs('temp_docs')
    for i, url in enumerate(urls):
        try:
            p = f"temp_docs/doc_{i}.jpg"
            r = requests.get(url, timeout=10)
            if r.status_code == 200:
                with open(p, 'wb') as f: f.write(r.content)
                paths.append(os.path.abspath(p))
        except: continue
    return paths

# ३. AI BRAIN: फोटो अपलोड चिन्न सक्ने बनाइएको
def get_filling_instructions(html_structure, customer_data, service_type, master_rules):
    prompt = f"""
    तपाईँ Expert RPA AI हो। संरचना: {html_structure} डेटा: {customer_data} नियम: {master_rules}
    काम: कुन ID मा के भर्ने पत्ता लगाउनुहोस्। यदि कुनै बाकस फाइल/फोटो अपलोड गर्ने (input type='file') हो भने JSON मा "is_file": true राख्नुहोस्।
    जवाफ JSON ढाँचामा: {{"mapping": [{{"selector_type": "id/name", "selector_value": "...", "value_to_type": "...", "is_file": true/false}}]}}
    """
    try:
        response = ai_model.generate_content(prompt)
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_json)
    except: return None

# ४. SMART RPA ENGINE
def start_browser_and_fill(customer, service_type, rules):
    print(f"🚀 Starting automation for {service_type}...")
    
    # IP/Browser Tracking जोगाउन User-Agent Randomize गर्ने
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    ]
    
    options = webdriver.ChromeOptions()
    options.add_argument(f"user-agent={random.choice(user_agents)}")
    options.add_argument("--disable-blink-features=AutomationControlled") # रोबोट हो भन्ने लुकाउन
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.maximize_window()

    try:
        urls = {
            "PCC": "https://opcr.nepalpolice.gov.np/",
            "NID": "https://enrollment.donidcr.gov.np/",
            "LICENSE": "https://applydl.dotm.gov.np/",
            "PASSPORT": "https://emrtds.nepalpassport.gov.np/",
            "PAN": "https://ird.gov.np/"
        }
        driver.get(urls.get(service_type, "https://google.com"))
        
        # अलिबेर पर्खिने (Real Human Delay)
        time.sleep(random.uniform(5, 8)) 

        inputs = driver.find_elements(By.TAG_NAME, "input")
        html_sample = [{"id": i.get_attribute("id"), "name": i.get_attribute("name"), "type": i.get_attribute("type")} for i in inputs[:25]]

        instructions = get_filling_instructions(str(html_sample), str(customer), service_type, rules)

        if instructions and "mapping" in instructions:
            doc_paths = download_docs(customer.get('documents', []))
            p_idx = 0
            for task in instructions["mapping"]:
                try:
                    # फर्म भर्दा मान्छेले जस्तै सानो ग्याप राख्ने
                    time.sleep(random.uniform(0.5, 1.5))
                    
                    val = task["selector_value"]
                    element = driver.find_element(By.ID, val) if task["selector_type"] == "id" else driver.find_element(By.NAME, val)
                    
                    if element:
                        if task.get("is_file") and p_idx < len(doc_paths):
                            element.send_keys(doc_paths[p_idx]) # फोटो अपलोड
                            p_idx += 1
                        else:
                            element.send_keys(task["value_to_type"]) # टाइप गर्ने
                except: continue

        print("🎯 Done!")
        time.sleep(60)
    except Exception as e: print(f"❌ Error: {e}")

# ५. API ENDPOINT
@app.route('/start-automation', methods=['POST'])
def handle_rpa_request():
    data = flask.request.json
    start_browser_and_fill(data['customer_data'], data['service_type'], data['ai_instructions'])
    return {"status": "success"}

if __name__ == "__main__":
    app.run(port=5000)