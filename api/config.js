// /api/config.js
// Vercel Serverless Function.
// Exposes ONLY the public Supabase URL + anon key (safe to expose — protected by
// Supabase Row Level Security), sourced from Vercel Environment Variables so
// nothing is hardcoded in the frontend. GROQ_API_KEY is NEVER returned here.

module.exports = (req, res) => {
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
};
