# TITAN CRM v5 (Fresh Build)

A fresh architecture for Nepal eGov forms (PAN/NID/Passport/License/PCC), Messenger + WhatsApp integrations, RPA (Playwright), analytics, and a unified dashboard.

## Architecture
- Dashboard (Next.js) — planned under `apps/dashboard-next` (to be scaffolded)
- Serverless APIs (Vercel):
  - `api_v5/config.js` — exposes Supabase keys and optional RPA URL
  - `api_v5/messenger.js` — webhook verify + events (Facebook Messenger)
  - `api_v5/whatsapp.js` — send via Meta WhatsApp Cloud API
- RPA Service (FastAPI + Playwright): `rpa/` (deploy on Render/VM)
- Supabase: Auth, tables for leads/messages/operators/status logs

## Env Variables (Vercel Project)
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — public anon key
- `SUPABASE_SERVICE_ROLE` — service key for server-side APIs (preferred)
- `RPA_SERVER_URL` — where the FastAPI service runs (optional during pilot)
- `FB_VERIFY_TOKEN` — for Messenger webhook verify
- `META_WHATSAPP_TOKEN` — Bearer token for WhatsApp Cloud API
- `META_WHATSAPP_PHONE_ID` — your phone number ID

## RPA Service (local dev)
```bash
# In rpa/
python -m venv .venv
. .venv/Scripts/activate  # Windows
pip install -r requirements.txt
python -m playwright install chromium
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Supabase Schema
Apply the schema file to your Supabase project:
```sql
-- Run in Supabase SQL editor
-- File: supabase/schema.sql
```

## API Endpoints
- `GET /api/analytics` — status counts + total income
- `GET /api/leads` — list leads (`status`, `platform`, `q`, `page`, `pageSize`)
- `POST /api/leads` — create lead (JSON body)
- `PATCH /api/leads` — update lead (`id`, optional `status`, `note`)
- `POST /api/whatsapp` — send message via Cloud API (`to`, `text`)
- `POST /api/messenger` — webhook events intake

## Notes
- Vercel serverless is not suitable for running browsers; use the separate FastAPI service for Playwright.
- Start with semi-automation: prefill forms + operator review; iterate to full automation.
- WhatsApp integration uses Cloud API (stable); device-based libraries need a persistent host.
