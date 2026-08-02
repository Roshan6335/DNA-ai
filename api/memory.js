// /api/memory.js
// Vercel Serverless Function.
// ALL Supabase reads/writes go through here using the SERVICE ROLE key
// (server-side only, never sent to the browser). This bypasses Row Level
// Security entirely.
//
// MULTI-USER: every face gets its own profile row (uuid). When a face is
// scanned, we compare it against ALL stored profiles here on the backend
// and either return the matching user's id, or create a brand new profile
// if no one matches closely enough. Every fact/message is tagged with a
// user_id, so each person's memory stays completely separate — no two
// people share the same conversation history or facts anymore.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MATCH_THRESHOLD = 0.5; // lower = stricter match

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

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
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

      // Compares the scanned face against every stored profile. Returns the
      // matching user's id, or registers a brand new profile if nobody matches.
      case 'identifyFace': {
        const descriptor = payload.descriptor;
        const profiles = await restSelect('profile', 'select=id,face_descriptor');

        let bestId = null;
        let bestDist = Infinity;
        for (const p of profiles) {
          if (!p.face_descriptor) continue;
          const d = euclideanDistance(descriptor, p.face_descriptor);
          if (d < bestDist) {
            bestDist = d;
            bestId = p.id;
          }
        }

        if (bestId !== null && bestDist < MATCH_THRESHOLD) {
          res.status(200).json({ ok: true, userId: bestId, isNew: false });
          return;
        }

        const inserted = await restInsert('profile', { face_descriptor: descriptor });
        res.status(200).json({ ok: true, userId: inserted[0].id, isNew: true });
        return;
      }

      case 'saveFact': {
        await restInsert('facts', { user_id: payload.userId, content: payload.content });
        res.status(200).json({ ok: true });
        return;
      }

      case 'getAllFacts': {
        const uid = encodeURIComponent(payload.userId);
        const rows = await restSelect('facts', `select=content&user_id=eq.${uid}&order=created_at.asc`);
        res.status(200).json({ ok: true, facts: rows.map((r) => r.content) });
        return;
      }

      case 'saveMessage': {
        await restInsert('messages', { user_id: payload.userId, role: payload.role, content: payload.content });
        res.status(200).json({ ok: true });
        return;
      }

      case 'getRecentMessages': {
        const uid = encodeURIComponent(payload.userId);
        const limit = payload?.limit || 20;
        const rows = await restSelect('messages', `select=role,content&user_id=eq.${uid}&order=created_at.desc&limit=${limit}`);
        res.status(200).json({ ok: true, messages: rows.reverse() });
        return;
      }

      case 'logAttempt': {
        const filename = `${Date.now()}.jpg`;
        await uploadImage(filename, payload.image);
        await restInsert('security_log', {
          image_path: filename,
          matched: !!payload.matched,
          user_id: payload.userId || null,
        });
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
