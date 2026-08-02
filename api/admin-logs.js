// /api/admin-logs.js
// Passcode-gated endpoint. Fetches recent face-auth attempt snapshots
// (from Supabase Storage, private bucket) and returns them as base64
// data URIs so admin.html can display them — no public URLs are ever
// created, everything stays behind this server-side passcode check.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;

module.exports = async (req, res) => {
  const passcode = req.query.passcode;

  if (!ADMIN_PASSCODE) {
    res.status(500).json({ error: 'ADMIN_PASSCODE not set in Vercel Environment Variables.' });
    return;
  }
  if (!passcode || passcode !== ADMIN_PASSCODE) {
    res.status(401).json({ error: 'Invalid passcode' });
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'Supabase env vars not configured.' });
    return;
  }

  try {
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/security_log?select=id,image_path,matched,user_id,created_at&order=created_at.desc&limit=50`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!listRes.ok) throw new Error(await listRes.text());
    const rows = await listRes.json();

    const withImages = await Promise.all(
      rows.map(async (r) => {
        try {
          const imgRes = await fetch(`${SUPABASE_URL}/storage/v1/object/security-logs/${r.image_path}`, {
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          });
          if (!imgRes.ok) return { ...r, image: null };
          const buf = Buffer.from(await imgRes.arrayBuffer());
          return { ...r, image: `data:image/jpeg;base64,${buf.toString('base64')}` };
        } catch {
          return { ...r, image: null };
        }
      })
    );

    res.status(200).json({ logs: withImages });
  } catch (err) {
    console.error('admin-logs.js error:', err);
    res.status(500).json({ error: String(err) });
  }
};
