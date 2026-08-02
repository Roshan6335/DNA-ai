/* ============================================================
   memory.js
   - Thin client for /api/memory. The browser never talks to
     Supabase directly — the backend uses a service-role key.

   MULTI-USER: identifyFace() sends a scanned face descriptor to the
   backend, which compares it against every stored profile and
   returns either an existing user's id (matched) or a brand new
   one (first time seeing this face). Every other call (facts,
   messages) takes that userId so each person's data stays separate.

   SETUP: run this SQL once in your Supabase project's SQL editor
   (see README.md for the full drop + recreate script, since this
   version's table shape is different from earlier single-user ones):
   ---------------------------------------------------------------
   create table profile (
     id uuid primary key default gen_random_uuid(),
     face_descriptor float8[] not null,
     created_at timestamp default now()
   );

   create table facts (
     id bigint generated always as identity primary key,
     user_id uuid not null references profile(id) on delete cascade,
     content text not null,
     created_at timestamp default now()
   );

   create table messages (
     id bigint generated always as identity primary key,
     user_id uuid not null references profile(id) on delete cascade,
     role text not null,
     content text not null,
     created_at timestamp default now()
   );

   create table security_log (
     id bigint generated always as identity primary key,
     image_path text not null,
     matched boolean not null,
     user_id uuid references profile(id) on delete set null,
     created_at timestamp default now()
   );
   ---------------------------------------------------------------
   Also create a private Storage bucket named "security-logs".
   ============================================================ */

const MemoryModule = (() => {
  let ready = false;

  async function call(action, payload) {
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(`memory action "${action}" failed:`, data.error);
        return { ok: false };
      }
      return data;
    } catch (e) {
      console.error(`memory action "${action}" network error:`, e);
      return { ok: false };
    }
  }

  async function init() {
    const res = await call('ping');
    ready = !!res.ok;
    return ready;
  }

  function isReady() {
    return ready;
  }

  // Returns { userId, isNew } or null on failure
  async function identifyFace(descriptorArray) {
    const res = await call('identifyFace', { descriptor: descriptorArray });
    if (!res.ok) return null;
    return { userId: res.userId, isNew: res.isNew };
  }

  async function saveFact(userId, content) {
    return call('saveFact', { userId, content });
  }

  async function getAllFacts(userId) {
    const res = await call('getAllFacts', { userId });
    return res.facts || [];
  }

  async function saveMessage(userId, role, content) {
    return call('saveMessage', { userId, role, content });
  }

  async function getRecentMessages(userId, limit = 20) {
    const res = await call('getRecentMessages', { userId, limit });
    return res.messages || [];
  }

  // image = base64 data URI (single JPEG frame), matched = boolean, userId optional
  async function logAttempt(image, matched, userId = null) {
    if (!image) return { ok: false };
    return call('logAttempt', { image, matched, userId });
  }

  return {
    init,
    isReady,
    identifyFace,
    saveFact,
    getAllFacts,
    saveMessage,
    getRecentMessages,
    logAttempt,
  };
})();
