import os
import os
from dotenv import load_dotenv
load_dotenv() # यसले तपाईँको .env फाइलबाट डाटा तान्छ
import time
import json
import logging
import threading
import flask
from flask_cors import CORS
from playwright.sync_api import sync_playwright
import google.generativeai as genai
from supabase import create_client, Client

# --- १. लगिङ सेटअप ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TitanRPA")

# --- २. कन्फिगरेसन ---
class Config:
    # .env फाइलमा भएको नामसँग मिलाइएको छ
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") # यहाँ ANON_KEY लेख्नुहोस्
    
    SERVICE_URLS = {
        "PCC": "https://opcr.nepalpolice.gov.np/",
        "NID": "https://enrollment.donidcr.gov.np/",
        "LICENSE": "https://applydl.dotm.gov.np/",
        "PASSPORT": "https://emrtds.nepalpassport.gov.np/",
        "PAN": "https://www.ird.gov.np/"
    }

# सेटअप क्लाइन्टहरू
genai.configure(api_key=Config.GEMINI_API_KEY)
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
app = flask.Flask(__name__)
CORS(app)

# --- ३. डाटाबेस फङ्सनहरू (Advanced Note Management) ---
def update_db_note(c_id, message, status="working"):
    try:
        res = supabase.table('customers').select('operator_instruction').eq('id', c_id).single().execute()
        current_val = res.data.get('operator_instruction', '') if res.data else ""
        
        if message in current_val and len(message) > 5:
            return 

        timestamp = time.strftime('%H:%M:%S')
        new_entry = f"📍 [{timestamp}] {message}\n{'-'*30}\n{current_val[:2000]}"
        
        supabase.table('customers').update({
            "operator_instruction": new_entry, 
            "status": status
        }).eq('id', c_id).execute()
    except Exception as e:
        logger.error(f"DB Update Error: {e}")

def get_latest_note(c_id):
    try:
        res = supabase.table('customers').select('operator_instruction').eq('id', c_id).single().execute()
        return res.data.get('operator_instruction', '') if res.data else ""
    except:
        return ""

# --- ४. टाइटन रोबोट इन्जिन (Playwright Engine) ---
class TitanBot:
    def __init__(self, customer, service_type, rules):
        self.customer = customer
        self.c_id = customer.get('id')
        self.service_type = service_type.upper()
        self.rules = rules
        self.first_run = True

    def extract_dom(self, page):
        """पेजका सबै फर्म एलिमेन्टहरू निकाल्ने"""
        return page.evaluate("""
            () => {
                const elements = Array.from(document.querySelectorAll('input, select, textarea, button'));
                return elements.map(el => ({
                    tag: el.tagName,
                    id: el.id,
                    name: el.name,
                    type: el.type,
                    placeholder: el.placeholder || "",
                    label: document.querySelector(`label[for="${el.id}"]`)?.innerText || "",
                    isVisible: el.offsetWidth > 0 && el.offsetHeight > 0
                })).filter(el => el.isVisible && (el.id || el.name)).slice(0, 80);
            }
        """)

    def execute(self):
        with sync_playwright() as p:
            try:
                # ब्राउजर लन्च (Stealth Mode)
                browser = p.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])
                context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
                page = context.new_page()

                url = Config.SERVICE_URLS.get(self.service_type, "https://google.com")
                page.goto(url)
                update_db_note(self.c_id, f"🚀 {self.service_type} ब्राउजर तयार छ।")

                while True:
                    current_note = get_latest_note(self.c_id).upper()

                    # १. कार्य सुचारु गर्ने कन्डिसन (First Run वा 'OK' लेख्दा)
                    if self.first_run or ("OK" in current_note and "DONE_STEP" not in current_note):
                        self.first_run = False
                        update_db_note(self.c_id, "🧠 Gemini ले पेज स्क्यान गर्दैछ...")
                        
                        dom_data = self.extract_dom(page)
                        
                        prompt = f"""
                        You are Titan RPA Engine. 
                        RULES: {self.rules}
                        TASK: Fill {self.service_type} form.
                        CUSTOMER: {json.dumps(self.customer)}
                        ELEMENTS: {json.dumps(dom_data)}
                        OUTPUT: Valid JSON only {{"mapping": [{{"selector_type": "id|name", "selector_value": "", "action": "type|click", "value": ""}}]}}
                        """
                        
                        model = genai.GenerativeModel(model_name="models/gemini-1.5-flash")
                        ai_res = model.generate_content(prompt)
                        
                        try:
                            clean_json = ai_res.text.strip().replace("```json", "").replace("```", "")
                            plan = json.loads(clean_json)

                            for task in plan.get("mapping", []):
                                # बीचमा कसैले PAUSE लेखेमा रोकिने
                                if "PAUSE" in get_latest_note(self.c_id).upper():
                                    update_db_note(self.c_id, "⏸️ कार्य रोकियो। सुचारु गर्न 'OK' लेख्नुहोस्।")
                                    while "OK" not in get_latest_note(self.c_id).upper(): time.sleep(3)

                                try:
                                    selector = f"#{task['selector_value']}" if task['selector_type'] == 'id' else f"[name='{task['selector_value']}']"
                                    if task['action'] == "click":
                                        page.click(selector, timeout=5000)
                                    else:
                                        page.fill(selector, str(task['value']), timeout=5000)
                                except: continue

                            update_db_note(self.c_id, "✅ फर्म भरियो। अघि बढ्न 'OK' वा बन्द गर्न 'EXIT' लेख्नुहोस्।")
                            
                            # DONE_STEP थपेर लुप कन्ट्रोल गर्ने
                            processed_note = current_note.replace("OK", "DONE_STEP") if "OK" in current_note else current_note + "\nDONE_STEP"
                            supabase.table('customers').update({"operator_instruction": processed_note}).eq('id', self.c_id).execute()

                        except Exception as e:
                            update_db_note(self.c_id, f"⚠️ एआई गल्ती: {str(e)[:50]}")

                    # २. OTP प्रविष्ट गर्ने लजिक
                    elif "OTP:" in current_note:
                        otp_value = current_note.split("OTP:")[1].split("\n")[0].strip()
                        page.keyboard.type(otp_value)
                        update_db_note(self.c_id, f"🔐 OTP ({otp_value}) प्रविष्ट गरियो।")
                        # OTP प्रयोग भएपछि हटाउने
                        clean_note = current_note.replace(f"OTP:{otp_value}", "OTP_DONE")
                        supabase.table('customers').update({"operator_instruction": clean_note}).eq('id', self.c_id).execute()

                    # ३. सिस्टम बन्द गर्ने
                    elif "EXIT" in current_note:
                        update_db_note(self.c_id, "👋 टाइटन बन्द हुँदैछ...", "success")
                        break

                    time.sleep(4) 

                browser.close()
            except Exception as e:
                update_db_note(self.c_id, f"❌ एरर: {str(e)[:100]}", "problem")

# --- ५. Flask API ---
@app.route('/start-automation', methods=['POST'])
def run_bot():
    data = flask.request.json
    bot = TitanBot(data['customer_data'], data['service_type'], data['ai_instructions'])
    threading.Thread(target=bot.execute, daemon=True).start()
    return {"status": "success", "message": "Titan Started"}

if __name__ == "__main__":
    app.run(port=5000, threaded=True)