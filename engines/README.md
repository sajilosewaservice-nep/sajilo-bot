# TITAN WhatsApp Device Engine (Baileys)

A standalone WhatsApp engine using Baileys. Runs off-Vercel on a persistent host (Windows/Linux/Mac). Syncs messages to Supabase for the dashboard.

## Prerequisites
- Node.js 18+
- Supabase project with tables and RLS configured
- The dashboard deployed (optional, for UI)

## Setup
1. Install dependencies:

```bash
cd engines
npm install
```

2. Configure environment:
- Copy `.env.example` to `.env` and fill values:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - Optional: `WHATSAPP_ENGINE_PORT`

3. Run the engine:

```bash
npm start
```

4. Pair device:
- A QR code appears in the console. Scan with WhatsApp to link.
- The engine will start syncing incoming messages to Supabase.

## Notes
- This engine uses the Supabase anon key. Ensure your RLS policies allow necessary operations (insert/update/select) for the relevant tables.
- For serverless sending (Meta Cloud API), configure `META_WHATSAPP_TOKEN` and `META_WHATSAPP_PHONE_ID` and use `/api/whatsapp` in Vercel.
