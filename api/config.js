// api/config.js
export default function handler(req, res) {
  // CORS र सुरक्षाका लागि Headers (ऐच्छिक तर राम्रो)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // यदि .env मा डाटा छैन भने चेतावनी दिने
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: "Configuration Missing!",
      message: "Please set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel settings."
    });
  }

  // सफा डाटा पठाउने
  res.status(200).json({
    supabaseUrl: supabaseUrl,
    supabaseAnonKey: supabaseAnonKey
  });
}