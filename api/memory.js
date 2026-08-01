// /api/memory.js
// Vercel Serverless Function.
// ALL Supabase reads/writes go through here using the SERVICE ROLE key
// (server-side only, never sent to the browser). This bypasses Row Level
// Security entirely, which is what was causing "nothing saves" before —
// the browser was using the anon key with no RLS policies allowing writes.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function authHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function restInsert(table, row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function restUpsert(table, row, conflictCol) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCol}`, {
    method: 'POST',
    headers: authHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function restSelect(table, query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function uploadImage(path, base64DataUri) {
  const base64 = base64DataUri.split(',')[1] || base64DataUri;
  const buffer = Buffer.from(base64, 'base64');
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/security-logs/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!r.ok) throw new Error(await r.text());
  return path;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in Vercel Environment Variables.' });
    return;
  }

  const { action, payload } = req.body || {};

  try {
    switch (action) {
      case 'ping': {
        res.status(200).json({ ok: true });
        return;
      }

      case 'saveFact': {
        await restInsert('facts', { content: payload.content });
        res.status(200).json({ ok: true });
        return;
      }

      case 'getAllFacts': {
        const rows = await restSelect('facts', 'select=content&order=created_at.asc');
        res.status(200).json({ ok: true, facts: rows.map((r) => r.content) });
        return;
      }

      case 'saveMessage': {
        await restInsert('messages', { role: payload.role, content: payload.content });
        res.status(200).json({ ok: true });
        return;
      }

      case 'getRecentMessages': {
        const limit = payload?.limit || 20;
        const rows = await restSelect('messages', `select=role,content&order=created_at.desc&limit=${limit}`);
        res.status(200).json({ ok: true, messages: rows.reverse() });
        return;
      }

      case 'saveFaceDescriptor': {
        await restUpsert('profile', { id: 'me', face_descriptor: payload.descriptor }, 'id');
        res.status(200).json({ ok: true });
        return;
      }

      case 'getFaceDescriptor': {
        const rows = await restSelect('profile', 'select=face_descriptor&id=eq.me');
        res.status(200).json({ ok: true, descriptor: rows[0]?.face_descriptor || null });
        return;
      }

      case 'logAttempt': {
        const filename = `${Date.now()}.jpg`;
        await uploadImage(filename, payload.image);
        await restInsert('security_log', { image_path: filename, matched: !!payload.matched });
        res.status(200).json({ ok: true });
        return;
      }

      default:
        res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('memory.js error:', err);
    res.status(500).json({ error: String(err) });
  }
};
