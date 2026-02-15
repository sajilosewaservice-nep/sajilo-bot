/**
 * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 - MESSENGER SYNC ENGINE
 * WhatsApp & Messenger Integration | Production Ready
 * =============================================================================
 */

const fetch = require('node-fetch');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

/* ═══════════════════════════════════════════════════════════════════════════
   1. SYSTEM CONFIGURATION & VALIDATION
   ═══════════════════════════════════════════════════════════════════════════ */

const CONFIG = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN || '',
    VERIFY_TOKEN: process.env.VERIFY_TOKEN || 'titan_crm_2026',
    PORT: parseInt(process.env.PORT || '3000'),
    NODE_ENV: process.env.NODE_ENV || 'development',
    FACEBOOK_API_VERSION: 'v21.0',
    FACEBOOK_GRAPH_URL: 'https://graph.facebook.com'
};

// Configuration validation
const validateConfiguration = () => {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'PAGE_ACCESS_TOKEN'];
    const missing = required.filter(key => !CONFIG[key]);

    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        console.error('📋 Required .env variables:');
        console.error('   - SUPABASE_URL');
        console.error('   - SUPABASE_ANON_KEY');
        console.error('   - PAGE_ACCESS_TOKEN');
        process.exit(1);
    }
};

validateConfiguration();

// Initialize Supabase
let supabase = null;

try {
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized');
} catch (error) {
    console.error('❌ Supabase initialization failed:', error.message);
    process.exit(1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. UTILITY & HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fetch Facebook user profile information
 */
async function getFacebookUserProfile(psid) {
    try {
        if (!psid) {
            throw new Error('Invalid PSID');
        }

        const url = `${CONFIG.FACEBOOK_GRAPH_URL}/${psid}?fields=first_name,last_name,profile_pic&access_token=${CONFIG.PAGE_ACCESS_TOKEN}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`⚠️ Facebook API Status: ${response.status}`);
            return {
                name: 'Messenger User',
                profilePic: null,
                success: false
            };
        }

        const data = await response.json();

        if (data.error) {
            console.warn('⚠️ Facebook API Error:', data.error.message);
            return {
                name: 'Messenger User',
                profilePic: null,
                success: false
            };
        }

        return {
            name: data.first_name
                ? `${data.first_name} ${data.last_name || ''}`.trim()
                : 'Messenger User',
            profilePic: data.profile_pic || null,
            success: !!data.first_name
        };
    } catch (error) {
        console.error('❌ Profile Fetch Error:', error.message);
        return {
            name: 'Messenger User',
            profilePic: null,
            success: false
        };
    }
}

/**
 * Get existing customer from database
 */
async function getExistingCustomer(messengerId) {
    try {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('messenger_id', messengerId)
            .maybeSingle();

        if (error) {
            console.warn('⚠️ Database Query Error:', error.message);
            return null;
        }

        return data;
    } catch (error) {
        console.error('❌ Database Error:', error.message);
        return null;
    }
}

/**
 * Safely parse document array
 */
function parseDocuments(rawDocs) {
    try {
        if (!rawDocs) return [];
        if (typeof rawDocs === 'string') return JSON.parse(rawDocs);
        if (Array.isArray(rawDocs)) return rawDocs;
        return [];
    } catch (e) {
        console.warn('⚠️ Document Parse Error:', e.message);
        return [];
    }
}

/**
 * Sanitize input to prevent injection attacks
 */
function sanitizeInput(text, maxLength = 1000) {
    return String(text || '')
        .trim()
        .substring(0, maxLength)
        .replace(/[<>]/g, '');
}

/**
 * Format timestamp
 */
function getCurrentTimestamp() {
    return new Date().toISOString();
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. WEBHOOK VERIFICATION ENDPOINT
   ═══════════════════════════════════════════════════════════════════════════ */

app.get('/api/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
        console.log('✅ Messenger Webhook Verified Successfully');
        return res.status(200).send(challenge);
    }

    console.warn('⚠️ Webhook Verification Failed - Invalid Token');
    res.sendStatus(403);
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. INCOMING MESSAGE HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Main webhook POST handler for incoming messages
 */
app.post('/api/webhook', async (req, res) => {
    const body = req.body;

    // Verify request object type
    if (body.object !== 'page') {
        console.warn('⚠️ Invalid object type:', body.object);
        return res.sendStatus(404);
    }

    res.status(200).send('EVENT_RECEIVED');

    try {
        for (const entry of body.entry || []) {
            if (!entry.messaging) continue;

            for (const event of entry.messaging) {
                const psid = event.sender?.id;

                if (!psid) {
                    console.warn('⚠️ Missing sender ID in event');
                    continue;
                }

                if (event.message) {
                    await handleIncomingMessage(psid, event.message);
                }
            }
        }
    } catch (error) {
        console.error('❌ Webhook Processing Error:', error.message);
    }
});

/**
 * Process incoming message and sync to CRM
 */
async function handleIncomingMessage(psid, messageData) {
    try {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        // Extract and validate message content
        const messageText = sanitizeInput(messageData.text || '');
        let attachments = [];

        if (messageData.attachments && Array.isArray(messageData.attachments)) {
            attachments = messageData.attachments
                .map(a => a.payload?.url)
                .filter(url => url && typeof url === 'string')
                .map(url => sanitizeInput(url));
        }

        // Fetch existing customer
        const existingCustomer = await getExistingCustomer(psid);

        // Fetch Facebook user profile
        const userProfile = await getFacebookUserProfile(psid);

        // Determine final customer name
        const finalName = userProfile.success
            ? userProfile.name
            : (existingCustomer?.customer_name || 'New Customer');

        // Parse existing documents
        let oldDocs = [];
        if (existingCustomer) {
            oldDocs = parseDocuments(existingCustomer.documents);
        }

        // Merge and deduplicate documents
        const updatedDocs = [...new Set([...oldDocs, ...attachments])].filter(Boolean);

        // Create final message
        const finalMessage = messageText
            || (attachments.length > 0 ? '📷 Sent an attachment' : 'New Message');

        // Prepare customer data object
        const customerData = {
            messenger_id: psid,
            customer_name: finalName,
            chat_summary: finalMessage,
            platform: 'messenger',
            status: existingCustomer?.status || 'inquiry',
            service_type: existingCustomer?.service_type || 'Other',
            documents: updatedDocs,
            last_updated_by: 'MESSENGER_BOT',
            updated_at: getCurrentTimestamp()
        };

        // Upsert customer record
        const { error: upsertError } = await supabase
            .from('customers')
            .upsert(customerData, { onConflict: 'messenger_id' });

        if (upsertError) {
            console.error('❌ Customer Upsert Error:', upsertError.message);
            return;
        }

        // Insert message to history
        const { error: insertError } = await supabase
            .from('messages')
            .insert([{
                customer_id: psid,
                platform: 'messenger',
                content: finalMessage,
                is_from_customer: true,
                created_at: getCurrentTimestamp(),
                metadata: {
                    urls: attachments,
                    profile_pic: userProfile.profilePic,
                    customer_name: finalName
                }
            }]);

        if (insertError) {
            console.error('❌ Message Insert Error:', insertError.message);
            return;
        }

        console.log(`✅ CRM Synced: ${finalName} [Messenger] [${customerData.status}]`);

    } catch (error) {
        console.error('❌ Handle Message Error:', error.message);
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. DIRECT REPLY ENDPOINT (Dashboard to Customer)
   ═══════════════════════════════════════════════════════════════════════════ */

app.post('/api/direct-reply', async (req, res) => {
    const { psid, messageText } = req.body;

    // Validate required fields
    if (!psid || !messageText) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: psid, messageText'
        });
    }

    if (!supabase) {
        return res.status(500).json({
            success: false,
            error: 'Database not initialized'
        });
    }

    try {
        const sanitizedMessage = sanitizeInput(messageText);

        // Send message via Facebook API
        const url = `${CONFIG.FACEBOOK_GRAPH_URL}/${CONFIG.FACEBOOK_API_VERSION}/me/messages?access_token=${CONFIG.PAGE_ACCESS_TOKEN}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: psid },
                message: { text: sanitizedMessage }
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('❌ Facebook API Error:', result);
            return res.status(500).json({
                success: false,
                error: result.error?.message || 'Facebook API Error'
            });
        }

        // Log sent message to database
        const { error: logError } = await supabase
            .from('messages')
            .insert([{
                customer_id: psid,
                platform: 'messenger',
                content: sanitizedMessage,
                is_from_customer: false,
                created_at: getCurrentTimestamp(),
                metadata: { message_id: result.message_id }
            }]);

        if (logError) {
            console.warn('⚠️ Message log error:', logError.message);
        }

        console.log(`✅ Reply Sent to ${psid} [Message ID: ${result.message_id}]`);

        res.status(200).json({
            success: true,
            messageId: result.message_id,
            timestamp: getCurrentTimestamp()
        });

    } catch (error) {
        console.error('❌ Reply Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   6. HEALTH CHECK & DIAGNOSTICS
   ═══════════════════════════════════════════════════════════════════════════ */

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'TITAN Messenger Engine v4.0.0',
        version: '4.0.0',
        uptime: process.uptime(),
        timestamp: getCurrentTimestamp(),
        supabase: supabase ? 'connected' : 'disconnected',
        environment: CONFIG.NODE_ENV,
        port: CONFIG.PORT
    });
});

app.get('/api/config-status', (req, res) => {
    res.status(200).json({
        supabaseUrl: CONFIG.SUPABASE_URL ? '✅' : '❌',
        supabaseAnonKey: CONFIG.SUPABASE_ANON_KEY ? '✅' : '❌',
        pageAccessToken: CONFIG.PAGE_ACCESS_TOKEN ? '✅' : '❌',
        verifyToken: CONFIG.VERIFY_TOKEN ? '✅' : '❌'
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   7. ERROR HANDLING MIDDLEWARE
   ═══════════════════════════════════════════════════════════════════════════ */

app.use((error, req, res, next) => {
    console.error('❌ Unhandled Error:', error.message);
    console.error('Stack:', error.stack);

    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: CONFIG.NODE_ENV === 'development' ? error.message : 'An error occurred',
        timestamp: getCurrentTimestamp()
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint Not Found',
        path: req.path,
        method: req.method
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   8. SERVER INITIALIZATION & GRACEFUL SHUTDOWN
   ═══════════════════════════════════════════════════════════════════════════ */

const SERVER = app.listen(CONFIG.PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         🚀 TITAN ENTERPRISE CRM v4.0.0                        ║
║         Messenger Sync Engine                                 ║
╠═══════════════════════════════════════════════════════════════╣
║ ✅ Status: Ready for Webhook Events                           ║
║ 📡 Port: ${CONFIG.PORT}                                          ║
║ 🌍 Environment: ${CONFIG.NODE_ENV}                             ║
║ 🛠️  Supabase: Connected                                       ║
║ ⏰ Started: ${getCurrentTimestamp()}                   ║
╠═══════════════════════════════════════════════════════════════╣
║ 📋 Available Endpoints:                                       ║
║   GET  /api/webhook          - Verification                   ║
║   POST /api/webhook          - Message Handler                ║
║   POST /api/direct-reply     - Send Reply                     ║
║   GET  /api/health           - Health Check                   ║
║   GET  /api/config-status    - Configuration Status           ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received, shutting down gracefully...');
    SERVER.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⚠️ SIGINT received, shutting down gracefully...');
    SERVER.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;