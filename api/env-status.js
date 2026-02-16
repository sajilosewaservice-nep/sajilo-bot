export default function handler(req, res) {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || "";
  const rpa = process.env.RPA_SERVER_URL || "";
  
  const mask = (v) => (v ? `${v.slice(0,6)}… (len:${v.length})` : "");
  const ok = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url);
  
  res.status(200).json({
    supabaseUrl_present: !!url,
    supabaseUrl_masked: mask(url),
    supabaseUrl_format_ok: ok,
    supabaseAnon_present: !!key,
    supabaseAnon_masked: mask(key),
    rpa_present: !!rpa,
    rpa_masked: mask(rpa)
  });
}
