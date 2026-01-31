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
RAW_KEY = "AIzaSyAsLmTXn6j_1SBirtXDRl9oclQh80064RY"
genai.configure(api_key=RAW_KEY.strip())
ai_model = genai.GenerativeModel('gemini-1.5-flash')

app = flask.Flask(__name__)
CORS(app)

# २. AI BRAIN: वेबसाइटको सबै बाकसहरू चिन्ने र डेटा मिलाउने
def get_filling_instructions(html_structure, customer_data, service_type, master_rules):
    prompt = f"""
    तपाईँ एउटा Expert RPA AI हो। 
    वेबसाइटको HTML संरचना: {html_structure}
    ग्राहकको डेटा: {customer_data}
    मास्टर नियमहरू: {master_rules}
    
    काम: माथिको HTML संरचना हेरेर ग्राहकको विवरण कुन-कुन ID वा Name भएको बाकसमा भर्नुपर्छ, पत्ता लगाउनुहोस्।
    जवाफमा मात्र यो JSON ढाँचा दिनुहोस्:
    {{
        "mapping": [
            {{"selector_type": "id/name/xpath", "selector_value": "बाकसको_नाम", "value_to_type": "भर्नुपर्ने_कुरा"}}
        ]
    }}
    """
    try:
        response = ai_model.generate_content(prompt)
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_json)
    except:
        return None

# ३. SMART RPA ENGINE: आफैँ बाकस खोजेर भर्ने
def start_browser_and_fill(customer, service_type, rules):
    print(f"🚀 AI Thinking: Starting automation for {service_type}...")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service)
    driver.maximize_window()

    try:
        # क) वेबसाइट खोल्ने
        urls = {
            "PCC": "https://opcr.nepalpolice.gov.np/",
            "NID": "https://enrollment.donidcr.gov.np/",
            "LICENSE": "https://applydl.dotm.gov.np/",
            "PASSPORT": "https://emrtds.nepalpassport.gov.np/",
            "PAN": "https://ird.gov.np/"
        }
        driver.get(urls.get(service_type, "https://google.com"))
        time.sleep(6) # पेज लोड हुन दिने

        # ख) पेजको मुख्य संरचना (Inputs) टिप्ने
        inputs = driver.find_elements(By.TAG_NAME, "input")
        html_sample = [{"id": i.get_attribute("id"), "name": i.get_attribute("name"), "placeholder": i.get_attribute("placeholder")} for i in inputs[:20]]

        # ग) AI लाई सोध्ने - "कुन बाकसमा के भरौँ?"
        instructions = get_filling_instructions(str(html_sample), str(customer), service_type, rules)

        # घ) अटो-फिल गर्ने
        if instructions and "mapping" in instructions:
            for task in instructions["mapping"]:
                try:
                    val = task["selector_value"]
                    element = None
                    if task["selector_type"] == "id": element = driver.find_element(By.ID, val)
                    elif task["selector_type"] == "name": element = driver.find_element(By.NAME, val)
                    
                    if element:
                        element.send_keys(task["value_to_type"])
                        print(f"✅ Typed: {task['value_to_type']} into {val}")
                except: continue

        print("🎯 AI Automation completed successfully!")
        time.sleep(60)
    except Exception as e:
        print(f"❌ Error: {e}")

# ४. API ENDPOINT
@app.route('/start-automation', methods=['POST'])
def handle_rpa_request():
    data = flask.request.json
    start_browser_and_fill(data['customer_data'], data['service_type'], data['ai_instructions'])
    return {"status": "success"}

if __name__ == "__main__":
    app.run(port=5000)