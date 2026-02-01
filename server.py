import os
import time
import json
import logging
import threading
import flask
from flask_cors import CORS
from google import genai
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client, Client

# --- १. लगिङ सेटअप ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Config:
    GEMINI_API_KEY = "AIzaSyDeMFMSo03Twh6Hxy5Mg1PhdKELURgw5V0"
    SUPABASE_URL = "https://ratgpvubjrcoipardzdp.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk"
    MODEL_ID = "models/gemini-1.5-flash"
    SERVICE_URLS = {
        "PCC": "https://opcr.nepalpolice.gov.np/",
        "NID": "https://enrollment.donidcr.gov.np/",
        "LICENSE": "https://applydl.dotm.gov.np/",
        "PASSPORT": "https://emrtds.nepalpassport.gov.np/",
        "PAN": "https://www.ird.gov.np/"
    }

client = genai.Client(api_key=Config.GEMINI_API_KEY)
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
app = flask.Flask(__name__)
CORS(app)

# --- ३. डाटाबेस फंक्सनहरू (Advanced Note Management) ---
def update_db_note(c_id, message, status="working"):
    """App.js को सानो नोट सेक्सनको लागि सुहाउने गरी सधैँ ताजा जानकारी माथि राख्ने"""
    try:
        res = supabase.table('customers').select('operator_instruction').eq('id', c_id).single().execute()
        current_val = res.data.get('operator_instruction', '') if res.data else ""
        
        # पुराना अनावश्यक इतिहास हटाउने (पछिल्लो ४०० क्यारेक्टर मात्र राख्ने)
        history = current_val[:400] 
        timestamp = time.strftime('%H:%M:%S')
        
        # App UI मा सफा देखिनको लागि नयाँ फर्म्याट
        new_entry = f"📍 [{timestamp}] {message}\n{'-'*30}\n{history}"
        
        supabase.table('customers').update({
            "operator_instruction": new_entry, 
            "status": status
        }).eq('id', c_id).execute()
        logger.info(f"DB Update: {message}")
    except Exception as e: logger.error(f"DB Error: {e}")

def get_latest_note(c_id):
    try:
        res = supabase.table('customers').select('operator_instruction').eq('id', c_id).single().execute()
        return res.data.get('operator_instruction', '') if res.data else ""
    except: return ""

def wait_for_data_in_note(c_id, keyword, timeout=300):
    """OTP वा स्पेसिफिक डाटाको लागि एआईलाई होल्ड गर्ने"""
    start_time = time.time()
    update_db_note(c_id, f"🔍 नोटमा '{keyword}' पर्खिरहेको छु...")
    while time.time() - start_time < timeout:
        note = get_latest_note(c_id).upper()
        if keyword.upper() in note:
            try:
                # 'OTP: 1234' बाट '1234' निकाल्ने
                value = note.split(keyword.upper())[1].split('\n')[0].strip(': ')
                return value
            except: pass
        time.sleep(3)
    return None

# --- ४. टाइटन रोबोट इन्जिन ---
class TitanBot:
    def __init__(self, customer, service_type, rules):
        self.customer = customer
        self.c_id = customer.get('id')
        self.service_type = service_type.upper()
        self.rules = rules
        self.driver = None
        self.first_run = True # सुरुमा सिधै चल्ने

    def setup_driver(self):
        options = webdriver.ChromeOptions()
        options.add_experimental_option("detach", True)
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        # एन्टी-बोट डिटेक्सनको लागि युजर एजेन्ट
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36")
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        self.driver.maximize_window()

    def execute(self):
        try:
            self.setup_driver()
            url = Config.SERVICE_URLS.get(self.service_type, "https://google.com")
            self.driver.get(url)
            wait = WebDriverWait(self.driver, 25)

            update_db_note(self.c_id, f"🚀 {self.service_type} ब्राउजर खुल्ला भयो।")

            while True:
                current_note = get_latest_note(self.c_id).upper()

                # १. एड्भान्स्ड कन्डिसन चेक (first_run वा 'OK' लेख्दा)
                if self.first_run or ("OK" in current_note and "DONE_STEP" not in current_note):
                    self.first_run = False 
                    
                    update_db_note(self.c_id, "🧠 Gemini ले पेज अध्ययन गर्दैछ...")
                    
                    # पेजका एलिमेन्टहरू तान्ने
                    elements = self.driver.find_elements(By.XPATH, "//input | //button | //select | //textarea")
                    dom_data = [{"tag": e.tag_name, "id": e.get_attribute("id"), "name": e.get_attribute("name"), "type": e.get_attribute("type")} for e in elements[:65]]

                    prompt = f"""
                    Role: Professional Form Filler.
                    Context: {self.service_type} registration.
                    Customer Data: {json.dumps(self.customer)}
                    HTML Elements: {json.dumps(dom_data)}
                    Rules: {self.rules}
                    Note Content: {current_note}
                    
                    Return ONLY a JSON mapping for Selenium.
                    """
                    
                    try:
                        ai_res = client.models.generate_content(model=Config.MODEL_ID, contents=prompt)
                        # सफा JSON निकाल्ने
                        clean_json = ai_res.text.strip().replace("```json", "").replace("```", "")
                        plan = json.loads(clean_json)

                        for task in plan.get("mapping", []):
                            try:
                                # PAUSE कमान्ड चेक (काम गर्दागर्दै रोक्नु परेमा)
                                if "PAUSE" in get_latest_note(self.c_id).upper():
                                    update_db_note(self.c_id, "⏸️ कार्य रोकिएको छ। सुचारु गर्न 'ok' लेख्नुहोस्।")
                                    while "OK" not in get_latest_note(self.c_id).upper(): time.sleep(3)

                                by = By.ID if task['selector_type'] == 'id' else By.NAME if task['selector_type'] == 'name' else By.XPATH
                                el = wait.until(EC.element_to_be_clickable((by, task['selector_value'])))
                                
                                if task['action'] == "click":
                                    self.driver.execute_script("arguments[0].scrollIntoView();", el)
                                    self.driver.execute_script("arguments[0].click();", el)
                                else:
                                    el.clear()
                                    el.send_keys(str(task['value']))
                            except: continue
                        
                        update_db_note(self.c_id, "✅ फारम भरियो। अर्को पेजमा जानुहोस् र 'ok' लेख्नुहोस्।")
                        
                        # नोटलाई 'DONE_STEP' मा अपडेट गर्ने ताकि लुप नदोहोरियोस्
                        processed_note = current_note.replace("OK", "DONE_STEP") if "OK" in current_note else current_note + "\nDONE_STEP"
                        supabase.table('customers').update({"operator_instruction": processed_note}).eq('id', self.c_id).execute()

                    except Exception as ai_err:
                        update_db_note(self.c_id, f"⚠️ एआई अलमलियो: {str(ai_err)[:50]}")

                elif "EXIT" in current_note:
                    update_db_note(self.c_id, "👋 सिस्टम बन्द गरियो।", "success")
                    break
                
                time.sleep(5) # डाटाबेस ओभरलोड हुन नदिन ५ सेकेन्ड ग्याप

        except Exception as e:
            update_db_note(self.c_id, f"❌ गल्ती भयो: {str(e)[:100]}", "problem")

# --- ५. Flask API ---
@app.route('/start-automation', methods=['POST'])
def run_bot():
    data = flask.request.json
    # नयाँ थ्रेडमा बोट चलाउने
    threading.Thread(target=TitanBot(data['customer_data'], data['service_type'], data.get('ai_instructions', '')).execute).start()
    return {"status": "success"}

if __name__ == "__main__":
    app.run(port=5000, threaded=True)