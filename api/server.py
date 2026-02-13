"""
═════════════════════════════════════════════════════════════════════════════
TITAN ENTERPRISE CRM v4.0.0 - RPA Automation Server
Port: 5000 | Production Ready with AI & Browser Automation
═════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import time
import json
import logging
import threading
from datetime import datetime
from typing import Dict, List, Optional

import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# AI & Supabase
import google.generativeai as genai
from supabase import create_client, Client

# Browser Automation
from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext

# ═════════════════════════════════════════════════════════════════════════════
# Environment & Logging Configuration
# ═════════════════════════════════════════════════════════════════════════════

load_dotenv()

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('titan_rpa.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("TITAN-RPA")

# ═════════════════════════════════════════════════════════════════════════════
# Configuration Class
# ═════════════════════════════════════════════════════════════════════════════

class Config:
    """Application Configuration"""
    
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    
    # Server Settings
    PORT = 5000
    HOST = "0.0.0.0"
    DEBUG = False
    THREADED = True
    
    # Browser Settings
    HEADLESS = False
    SLOW_MO = 250
    TIMEOUT = 60000
    
    # Service URLs
    SERVICE_URLS = {
        "PCC": "https://opcr.nepalpolice.gov.np/",
        "NID": "https://enrollment.donidcr.gov.np/",
        "LICENSE": "https://applydl.dotm.gov.np/",
        "PASSPORT": "https://emrtds.nepalpassport.gov.np/",
        "PAN": "https://www.ird.gov.np/"
    }
    
    # Validation
    REQUIRED_KEYS = ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"]

# ═════════════════════════════════════════════════════════════════════════════
# Configuration Validation
# ═════════════════════════════════════════════════════════════════════════════

def validate_config():
    """Validate environment configuration"""
    missing = [key for key in Config.REQUIRED_KEYS if not getattr(Config, key)]
    
    if missing:
        logger.error(f"❌ Missing configuration: {', '.join(missing)}")
        logger.info("Please set these environment variables in .env file")
        return False
    
    logger.info("✅ Configuration validated successfully")
    return True

# ═════════════════════════════════════════════════════════════════════════════
# Initialize AI & Database Clients
# ═════════════════════════════════════════════════════════════════════════════

try:
    genai.configure(api_key=Config.GEMINI_API_KEY)
    supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    logger.info("✅ Gemini AI & Supabase initialized")
except Exception as e:
    logger.error(f"❌ Failed to initialize clients: {str(e)}")
    supabase = None

# ═════════════════════════════════════════════════════════════════════════════
# Flask App Setup
# ═════════════════════════════════════════════════════════════════════════════

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ═════════════════════════════════════════════════════════════════════════════
# Database Helper Functions
# ═════════════════════════════════════════════════════════════════════════════

class DatabaseHelper:
    """Handle all database operations"""
    
    @staticmethod
    def update_customer_note(customer_id: str, message: str, status: str = "working") -> bool:
        """Update customer note and status in database"""
        try:
            if not supabase:
                logger.warning("⚠️ Supabase not initialized")
                return False
            
            # Clean message (remove HTML, limit length)
            import re
            clean_msg = re.sub(r'<[^<]+?>', '', str(message))
            clean_msg = clean_msg.replace('{', '').replace('}', '')[:200]
            
            # Add timestamp
            timestamp = datetime.now().strftime('%H:%M:%S')
            new_entry = f"📍 [{timestamp}] {clean_msg}"
            
            # Update database
            supabase.table('customers').update({
                "operator_instruction": new_entry,
                "status": status,
                "last_updated": datetime.now().isoformat()
            }).eq('id', customer_id).execute()
            
            logger.info(f"✅ DB Updated [{customer_id}]: {clean_msg}")
            return True
        
        except Exception as e:
            logger.error(f"❌ Database update error: {str(e)}")
            return False
    
    @staticmethod
    def get_customer_note(customer_id: str) -> str:
        """Get latest note from customer"""
        try:
            if not supabase:
                return ""
            
            res = supabase.table('customers').select('operator_instruction').eq('id', customer_id).single().execute()
            note = res.data.get('operator_instruction', '') if res.data else ""
            return note.upper().strip()
        
        except Exception as e:
            logger.error(f"⚠️ Failed to get note: {str(e)}")
            return ""
    
    @staticmethod
    def get_customer_data(customer_id: str) -> Optional[Dict]:
        """Fetch customer data from database"""
        try:
            if not supabase:
                return None
            
            res = supabase.table('customers').select('*').eq('id', customer_id).single().execute()
            return res.data if res.data else None
        
        except Exception as e:
            logger.error(f"❌ Failed to fetch customer: {str(e)}")
            return None
    
    @staticmethod
    def log_automation(customer_id: str, service: str, status: str, details: str = ""):
        """Log automation attempt"""
        try:
            if not supabase:
                return False
            
            supabase.table('automation_logs').insert({
                "customer_id": customer_id,
                "service": service,
                "status": status,
                "details": details,
                "timestamp": datetime.now().isoformat()
            }).execute()
            
            return True
        except Exception as e:
            logger.error(f"Log error: {str(e)}")
            return False

# ═════════════════════════════════════════════════════════════════════════════
# RPA Bot Class - TITAN Automation Engine
# ═════════════════════════════════════════════════════════════════════════════

class TitanRPABot:
    """TITAN RPA Automation Bot - Handles form filling and navigation"""
    
    def __init__(self, customer_id: str, service_type: str, customer_data: Dict = None):
        self.customer_id = customer_id
        self.service_type = service_type.upper()
        self.customer_data = customer_data or {}
        
        # Browser resources
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        
        # State tracking
        self.first_run = True
        self.steps_completed = 0
        self.is_running = False
    
    def _log(self, message: str, level: str = "info"):
        """Log message with context"""
        prefix = f"[{self.service_type}:{self.customer_id[:8]}]"
        
        if level == "info":
            logger.info(f"{prefix} {message}")
        elif level == "error":
            logger.error(f"{prefix} {message}")
        elif level == "warning":
            logger.warning(f"{prefix} {message}")
    
    def _update_status(self, message: str, status: str = "working"):
        """Update customer status"""
        DatabaseHelper.update_customer_note(self.customer_id, message, status)
        self._log(message)
    
    def extract_page_dom(self) -> List[Dict]:
        """Extract DOM elements from current page"""
        try:
            dom_data = self.page.evaluate("""
                () => {
                    const elements = Array.from(document.querySelectorAll('input, select, textarea, button, a'));
                    return elements.map(el => ({
                        tag: el.tagName,
                        id: el.id || "",
                        name: el.name || "",
                        type: el.type || "",
                        placeholder: el.placeholder || "",
                        value: el.value || "",
                        text: el.innerText?.substring(0, 50) || "",
                        label: document.querySelector(`label[for="${el.id}"]`)?.innerText || "",
                        isVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
                        isRequired: el.hasAttribute('required')
                    })).filter(el => el.isVisible && (el.id || el.name || el.text))
                    .slice(0, 100);
                }
            """)
            
            self._log(f"📄 Extracted {len(dom_data)} DOM elements")
            return dom_data
        
        except Exception as e:
            self._log(f"DOM extraction error: {str(e)}", "error")
            return []
    
    def process_ai_instructions(self, dom_data: List[Dict]) -> List[Dict]:
        """Use Gemini AI to generate form-filling instructions"""
        try:
            self._update_status("🧠 Analyzing page with Gemini AI...")
            
            prompt = f"""
            Task: Analyze and fill form with user data
            Service: {self.service_type}
            User Data: {json.dumps(self.customer_data, ensure_ascii=False)}
            
            Available Form Elements:
            {json.dumps(dom_data, ensure_ascii=False)}
            
            Generate JSON array of actions to fill the form.
            Each action should have: selector_type (id/name), selector_value, action (fill/click), value
            
            Return ONLY valid JSON array, no markdown:
            [
              {{"selector_type": "id", "selector_value": "firstName", "action": "fill", "value": "Name"}},
              {{"selector_type": "id", "selector_value": "submit", "action": "click", "value": ""}}
            ]
            """
            
            model = genai.GenerativeModel("gemini-1.5-flash-latest")
            response = model.generate_content(prompt)
            
            # Parse AI response
            response_text = response.text.strip()
            response_text = response_text.replace("```json", "").replace("```", "").strip()
            
            actions = json.loads(response_text)
            self._log(f"✅ AI generated {len(actions)} actions")
            
            return actions if isinstance(actions, list) else []
        
        except json.JSONDecodeError as e:
            self._log(f"⚠️ AI response JSON error: {str(e)}", "warning")
            return []
        except Exception as e:
            self._log(f"❌ AI processing error: {str(e)}", "error")
            return []
    
    def execute_actions(self, actions: List[Dict]) -> bool:
        """Execute AI-generated actions on the page"""
        try:
            for idx, action in enumerate(actions):
                # Check for pause/stop signals
                current_note = DatabaseHelper.get_customer_note(self.customer_id)
                if "PAUSE" in current_note:
                    self._update_status(f"⏸️ Paused at step {idx}. Send 'RESUME' to continue.")
                    while "RESUME" not in DatabaseHelper.get_customer_note(self.customer_id):
                        time.sleep(2)
                
                if "STOP" in current_note or "EXIT" in current_note:
                    self._update_status("🛑 Automation stopped by user", "success")
                    return False
                
                try:
                    selector_type = action.get('selector_type', 'id')
                    selector_value = action.get('selector_value', '')
                    action_type = action.get('action', 'fill')
                    value = action.get('value', '')
                    
                    # Build selector
                    if selector_type == 'id':
                        selector = f"#{selector_value}"
                    elif selector_type == 'name':
                        selector = f"[name='{selector_value}']"
                    else:
                        selector = selector_value
                    
                    # Wait for element
                    self.page.wait_for_selector(selector, timeout=10000)
                    
                    # Execute action
                    if action_type == "click":
                        self.page.click(selector)
                        self._log(f"✓ Clicked: {selector_value}")
                    elif action_type == "fill":
                        self.page.fill(selector, str(value))
                        self._log(f"✓ Filled: {selector_value} = {value}")
                    
                    time.sleep(1)
                    self.steps_completed += 1
                
                except Exception as e:
                    self._log(f"⚠️ Step {idx} failed: {str(e)}", "warning")
                    continue
            
            return True
        
        except Exception as e:
            self._log(f"❌ Action execution error: {str(e)}", "error")
            return False
    
    def handle_otp(self):
        """Wait for and handle OTP input"""
        try:
            self._update_status("🔐 Waiting for OTP code...")
            
            max_wait = 300  # 5 minutes
            elapsed = 0
            
            while elapsed < max_wait:
                note = DatabaseHelper.get_customer_note(self.customer_id)
                
                if "OTP:" in note:
                    otp_code = note.split("OTP:")[1].split("\n")[0].strip()
                    
                    # Type OTP
                    self.page.keyboard.type(otp_code, delay=100)
                    self._update_status(f"✅ OTP entered: {otp_code}")
                    
                    return True
                
                time.sleep(3)
                elapsed += 3
            
            self._update_status("⏱️ OTP timeout - no code provided", "pending")
            return False
        
        except Exception as e:
            self._log(f"OTP error: {str(e)}", "error")
            return False
    
    def launch_browser(self) -> bool:
        """Initialize and launch browser"""
        try:
            self._update_status(f"🌐 Launching browser for {self.service_type}...")
            
            self.playwright = sync_playwright().start()
            self.browser = self.playwright.chromium.launch(
                headless=Config.HEADLESS,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage"
                ],
                slow_mo=Config.SLOW_MO
            )
            
            self.context = self.browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36"
            )
            
            self.page = self.context.new_page()
            self._log("✅ Browser launched")
            
            return True
        
        except Exception as e:
            self._log(f"❌ Browser launch failed: {str(e)}", "error")
            self._update_status(f"❌ Browser error: {str(e)}", "problem")
            return False
    
    def close_browser(self):
        """Close browser and cleanup"""
        try:
            if self.page:
                self.page.close()
            if self.context:
                self.context.close()
            if self.browser:
                self.browser.close()
            if self.playwright:
                self.playwright.stop()
            
            self._log("✅ Browser closed")
        except Exception as e:
            self._log(f"⚠️ Cleanup error: {str(e)}", "warning")
    
    def run(self):
        """Main automation execution loop"""
        try:
            self.is_running = True
            
            self._log(f"🚀 Starting automation for customer {self.customer_id}")
            DatabaseHelper.log_automation(self.customer_id, self.service_type, "started")
            
            # Launch browser
            if not self.launch_browser():
                return
            
            # Navigate to service URL
            service_url = Config.SERVICE_URLS.get(self.service_type, "https://google.com")
            self._update_status(f"📡 Navigating to {self.service_type}...")
            
            try:
                self.page.goto(service_url, wait_until="networkidle", timeout=Config.TIMEOUT)
            except Exception as e:
                self._log(f"Navigation timeout: {str(e)}", "warning")
            
            self._update_status(f"✅ Page loaded. Starting automation...")
            
            # Main automation loop
            loop_count = 0
            max_loops = 50
            
            while self.is_running and loop_count < max_loops:
                loop_count += 1
                
                # Check for stop signal
                current_note = DatabaseHelper.get_customer_note(self.customer_id)
                
                if "EXIT" in current_note or "STOP" in current_note:
                    self._update_status("👋 Automation stopped", "success")
                    break
                
                # First run: Extract DOM and generate actions
                if self.first_run:
                    self.first_run = False
                    
                    dom_data = self.extract_page_dom()
                    if not dom_data:
                        self._update_status("⚠️ No form elements found", "pending")
                        time.sleep(5)
                        continue
                    
                    actions = self.process_ai_instructions(dom_data)
                    if not actions:
                        self._update_status("⚠️ AI could not generate actions", "pending")
                        time.sleep(5)
                        continue
                    
                    # Execute actions
                    if self.execute_actions(actions):
                        self._update_status(f"✅ Form filled ({self.steps_completed} steps)", "success")
                    else:
                        self._update_status("⚠️ Some steps failed", "pending")
                
                # Check for OTP requirement
                if "OTP" in current_note:
                    self.handle_otp()
                
                time.sleep(3)
            
            self._update_status("🎉 Automation completed", "success")
            DatabaseHelper.log_automation(self.customer_id, self.service_type, "completed", f"Steps: {self.steps_completed}")
        
        except Exception as e:
            self._log(f"❌ Critical error: {str(e)}", "error")
            self._update_status(f"❌ Error: {str(e)}", "problem")
            DatabaseHelper.log_automation(self.customer_id, self.service_type, "failed", str(e))
        
        finally:
            self.is_running = False
            self.close_browser()

# ═════════════════════════════════════════════════════════════════════════════
# Flask API Endpoints
# ═════════════════════════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'TITAN RPA Engine v4.0.0',
        'timestamp': datetime.now().isoformat(),
        'features': ['AI-Powered Automation', 'Form Filling', 'OTP Handling']
    }), 200

@app.route('/api/start-automation', methods=['POST'])
def start_automation():
    """Start RPA automation for a customer"""
    try:
        data = request.get_json()
        
        # Validate request
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        customer_id = data.get('customer_id')
        service_type = data.get('service_type', 'PCC')
        
        if not customer_id:
            return jsonify({'success': False, 'message': 'customer_id required'}), 400
        
        if service_type not in Config.SERVICE_URLS:
            return jsonify({'success': False, 'message': f'Invalid service type. Use: {list(Config.SERVICE_URLS.keys())}'}), 400
        
        # Fetch customer data
        customer_data = DatabaseHelper.get_customer_data(customer_id)
        if not customer_data:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
        # Start automation in background thread
        bot = TitanRPABot(customer_id, service_type, customer_data)
        thread = threading.Thread(target=bot.run, daemon=True)
        thread.start()
        
        logger.info(f"🤖 Automation started for {customer_id} - Service: {service_type}")
        
        return jsonify({
            'success': True,
            'message': 'Automation started',
            'customer_id': customer_id,
            'service': service_type,
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Automation start error: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/automation/status/<customer_id>', methods=['GET'])
def get_automation_status(customer_id):
    """Get current automation status"""
    try:
        note = DatabaseHelper.get_customer_note(customer_id)
        customer = DatabaseHelper.get_customer_data(customer_id)
        
        return jsonify({
            'success': True,
            'customer_id': customer_id,
            'status': customer.get('status', 'unknown') if customer else 'unknown',
            'note': note,
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/automation/pause/<customer_id>', methods=['POST'])
def pause_automation(customer_id):
    """Pause running automation"""
    try:
        DatabaseHelper.update_customer_note(customer_id, "⏸️ PAUSE", "paused")
        return jsonify({'success': True, 'message': 'Automation paused'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/automation/resume/<customer_id>', methods=['POST'])
def resume_automation(customer_id):
    """Resume paused automation"""
    try:
        DatabaseHelper.update_customer_note(customer_id, "▶️ RESUME", "working")
        return jsonify({'success': True, 'message': 'Automation resumed'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/automation/stop/<customer_id>', methods=['POST'])
def stop_automation(customer_id):
    """Stop automation"""
    try:
        DatabaseHelper.update_customer_note(customer_id, "⛔ STOP", "stopped")
        return jsonify({'success': True, 'message': 'Automation stopped'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/automation/otp/<customer_id>', methods=['POST'])
def submit_otp(customer_id):
    """Submit OTP code"""
    try:
        data = request.get_json()
        otp_code = data.get('otp', '')
        
        if not otp_code:
            return jsonify({'success': False, 'message': 'OTP code required'}), 400
        
        DatabaseHelper.update_customer_note(customer_id, f"🔐 OTP:{otp_code}", "working")
        return jsonify({'success': True, 'message': 'OTP submitted'}), 200
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ═════════════════════════════════════════════════════════════════════════════
# Error Handlers
# ═════════════════════════════════════════════════════════════════════════════

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    logger.error(f"Server error: {str(error)}")
    return jsonify({'success': False, 'message': 'Internal server error'}), 500

# ═════════════════════════════════════════════════════════════════════════════
# Main Entry Point
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║     🤖 TITAN RPA AUTOMATION ENGINE v4.0.0                   ║
    ║                                                              ║
    ║  📍 Location: http://localhost:5000                        ║
    ║  🔗 API: http://localhost:5000/api                         ║
    ║  ✅ Health: http://localhost:5000/health                   ║
    ║                                                              ║
    ║  ✨ Features:                                               ║
    ║     • AI-Powered Form Automation (Gemini)                 ║
    ║     • Browser Automation (Playwright)                     ║
    ║     • OTP Handling & Pausing                              ║
    ║     • Real-time Status Updates                            ║
    ║     • Database Integration (Supabase)                     ║
    ║                                                              ║
    ║  Supported Services:                                        ║
    ║     • PCC (Police Clearance)                              ║
    ║     • NID (National Identity)                             ║
    ║     • LICENSE (Driving License)                           ║
    ║     • PASSPORT (Passport)                                 ║
    ║     • PAN (Tax ID)                                        ║
    ║                                                              ║
    ║  Press CTRL+C to stop                                      ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Validate configuration
    if not validate_config():
        logger.error("Configuration validation failed. Exiting.")
        sys.exit(1)
    
    logger.info("🚀 Starting TITAN RPA Server...")
    
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        threaded=Config.THREADED
    )