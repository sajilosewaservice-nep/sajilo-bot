// api/config.js
export default function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const rpaServerUrl = process.env.RPA_SERVER_URL || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Missing Supabase env' });
  }
  
  res.status(200).json({ 
    supabaseUrl, 
    supabaseAnonKey,
    rpaServerUrl
  });
}