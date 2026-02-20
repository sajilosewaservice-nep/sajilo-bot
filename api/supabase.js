/**
 * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 - CENTRAL DATABASE BRIDGE
 * =============================================================================
 * Location: /api/supabase.js
 * Purpose: Secure Administrative access for Messenger & WhatsApp Webhooks.
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// Connection Cache (Saves server resources)
let supabaseAdmin = null;

/**
 * [MASTER ENGINE]
 * Get an administrative Supabase client using Service Role Key.
 * Important: Only use this in the /api folder (Backend).
 */
export function getAdminClient() {
    // 1. Resolve Environment Variables
    const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SB_ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    // 2. Security Check
    if (!SB_URL || !SB_ADMIN_KEY) {
        console.error("❌ [TITAN ENGINE ERROR]: Database Credentials Missing in .env");
        throw new Error('Supabase URL or Service Role Key is not defined.');
    }

    // 3. Singleton Initialization (Initialize once, use everywhere)
    if (!supabaseAdmin) {
        supabaseAdmin = createClient(SB_URL, SB_ADMIN_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log("🚀 TITAN DB BRIDGE: Secure Admin Connection Established.");
    }

    return supabaseAdmin;
}

/**
 * [HELPER]: Global Error Logger
 * Bholi system ma error aayo bhane 'system_logs' table ma lekhna kaam lagcha.
 */
export async function logToDatabase(errorType, errorMessage) {
    try {
        const client = getAdminClient();
        await client.from('system_logs').insert([{
            type: errorType,
            message: errorMessage,
            timestamp: new Date().toISOString()
        }]);
    } catch (e) {
        console.error("Failed to log error to DB:", e);
    }
}