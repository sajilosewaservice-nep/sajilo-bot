import os
import time
import json
import logging
import threading
import flask
from flask_cors import CORS
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
import google.generativeai as genai
from supabase import create_client, Client

# १. इन्भ्यारोमेन्ट लोड
load_dotenv()

# २. लगिङ सेटअप
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TitanRPA")

# ३. कन्फिगरेसन
class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
    
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

# ४. डाटाबेस फङ्सनहरू (TitanBot भन्दा माथि हुनैपर्छ)
def update_db_note(c_id, message, status="working"):
    try:
        import re
        # १. तपाईँको पुरानै सफा गर्ने सिस्टम (यसलाई केही गरेको छैन)
        clean_msg = re.sub('<[^<]+?>', '', str(message)) 
        clean_msg = clean_msg.replace('{', '').replace('}', '')[:200]
        
        timestamp = time.strftime('%H:%M:%S')
        new_entry = f"📍 [{timestamp}] {clean_msg}" # नयाँ नोट तयार भयो

        # २. यहाँ छ मुख्य सुधार: 
        supabase.table('customers').update({
            "operator_instruction": new_entry, 
            "status": status
        }).eq('id', c_id).execute()
        
    except Exception as e:
        logger.error(f"RPA DB Error: {e}")

def get_latest_note(c_id):
    try:
        res = supabase.table('customers').select('operator_instruction').eq('id', c_id).single().execute()
        val = res.data.get('operator_instruction', '') if res.data else ""
        # कमान्ड चेक गर्दा सफा टेक्स्ट मात्र पठाउने
        return val.upper()
    except:
        return ""
    
# ५. टाइटन रोबोट इन्जिन
class TitanBot:
    def __init__(self, customer, service_type, rules):
        self.customer = customer
        self.c_id = customer.get('id')
        self.service_type = service_type.upper()
        self.rules = rules
        self.first_run = True

    def extract_dom(self, page):
        """पेजका एलिमेन्टहरू निकाल्ने प्रो लजिक"""
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
        # ब्राउजर सुरु गर्ने (with बिना ताकि क्र्यास नहोस्)
        self.p_instance = sync_playwright().start()
        
        try:
            self.browser = self.p_instance.chromium.launch(
                headless=False, 
                args=["--disable-blink-features=AutomationControlled"],
                slow_mo=500
            )
            self.context = self.browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36"
            )
            self.page = self.context.new_page()

            url = Config.SERVICE_URLS.get(self.service_type, "https://google.com")
            update_db_note(self.c_id, f"🌐 {self.service_type} लोड हुँदैछ...")
            self.page.goto(url, wait_until="networkidle", timeout=60000)
            
            update_db_note(self.c_id, f"🚀 टाइटन इन्जिन सुचारु भयो।")

            while True:
                # नयाँ कमान्डको लागि डाटाबेस चेक गर्ने
                current_note = get_latest_note(self.c_id).upper()

                # बन्द गर्ने कमान्ड
                if "EXIT" in current_note:
                    update_db_note(self.c_id, "👋 बन्द गरियो। अब ब्राउजर बन्द हुँदैछ।", "success")
                    break

                # कार्य सुचारु गर्ने कन्डिसन
                if self.first_run or ("OK" in current_note and "DONE_STEP" not in current_note):
                    self.first_run = False
                    update_db_note(self.c_id, "🧠 Gemini ले पेज अध्ययन गर्दैछ...")
                    
                    dom_data = self.extract_dom(self.page)
                    
                    prompt = f"""
                    TASK: Fill {self.service_type} form.
                    CUSTOMER: {json.dumps(self.customer)}
                    ELEMENTS: {json.dumps(dom_data)}
                    RULES: {self.rules}
                    OUTPUT: Valid JSON only {{"mapping": []}}
                    """
                    
                    model = genai.GenerativeModel("gemini-1.5-flash-latest")
                    ai_res = model.generate_content(prompt)
                    
                    try:
                        clean_json = ai_res.text.strip().replace("```json", "").replace("```", "")
                        plan = json.loads(clean_json)

                        for task in plan.get("mapping", []):
                            # सुरक्षाको लागि बीचमा PAUSE चेक
                            if "PAUSE" in get_latest_note(self.c_id).upper():
                                update_db_note(self.c_id, "⏸️ रोकियो। अघि बढ्न 'OK' लेख्नुहोस्।")
                                while "OK" not in get_latest_note(self.c_id).upper(): time.sleep(3)

                            try:
                                sel = f"#{task['selector_value']}" if task['selector_type'] == 'id' else f"[name='{task['selector_value']}']"
                                self.page.wait_for_selector(sel, timeout=10000)
                                if task['action'] == "click":
                                    self.page.click(sel)
                                else:
                                    self.page.fill(sel, str(task['value']))
                            except: continue

                        update_db_note(self.c_id, "✅ फर्म भरियो। अघि बढ्न 'OK' लेख्नुहोस्।")
                        # 'OK' लाई 'DONE_STEP' मा बदल्ने ताकि लुप नदोहोरियोस्
                        processed = current_note.replace("OK", "DONE_STEP") if "OK" in current_note else current_note + "\nDONE_STEP"
                        supabase.table('customers').update({"operator_instruction": processed}).eq('id', self.c_id).execute()

                    except Exception as e:
                        update_db_note(self.c_id, f"⚠️ एआई गल्ती: {str(e)[:50]}")

                # OTP हाल्ने कमान्ड
                elif "OTP:" in current_note:
                    otp = current_note.split("OTP:")[1].split("\n")[0].strip()
                    self.page.keyboard.type(otp, delay=150)
                    update_db_note(self.c_id, f"🔐 OTP ({otp}) हालियो।")
                    # OTP प्रयोग भएपछि हटाउने
                    new_note = current_note.replace(f"OTP:{otp}", "OTP_DONE")
                    supabase.table('customers').update({"operator_instruction": new_note}).eq('id', self.c_id).execute()

                time.sleep(4)

            self.browser.close()
            self.p_instance.stop()

        except Exception as e:
            update_db_note(self.c_id, f"❌ गम्भीर एरर: {str(e)[:100]}", "problem")

# ६. Flask API
@app.route('/start-automation', methods=['POST'])
def run_bot():
    try:
        data = flask.request.json
        bot = TitanBot(data['customer_data'], data['service_type'], data['ai_instructions'])
        threading.Thread(target=bot.execute, daemon=True).start()
        return {"status": "success", "message": "Titan Started"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

if __name__ == "__main__":
    # ५००० पोर्टमा सर्भर सुरु
    app.run(port=5000, threaded=True)