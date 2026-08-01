/* ============================================================
   memory.js
   - Thin client for /api/memory (the browser never talks to
     Supabase directly anymore, and never sees any Supabase key —
     the backend uses a service-role key that bypasses Row Level
     Security, which is what was silently blocking saves before).

   SETUP: run this SQL once in your Supabase project's SQL editor:
   ---------------------------------------------------------------
   create table profile (
     id text primary key default 'me',
     face_descriptor float8[],
     created_at timestamp default now()
   );

   create table facts (
     id bigint generated always as identity primary key,
     content text not null,
     created_at timestamp default now()
   );

   create table messages (
     id bigint generated always as identity primary key,
     role text not null,
     content text not null,
     created_at timestamp default now()
   );

   create table security_log (
     id bigint generated always as identity primary key,
     image_path text not null,
     matched boolean not null,
     created_at timestamp default now()
   );
   ---------------------------------------------------------------
   Also create a private Storage bucket named "security-logs"
   (Storage → New bucket → Public: OFF). See README.md.
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

  async function saveFaceDescriptor(descriptorArray) {
    return call('saveFaceDescriptor', { descriptor: descriptorArray });
  }

  async function getFaceDescriptor() {
    const res = await call('getFaceDescriptor');
    return res.descriptor || null;
  }

  async function saveFact(content) {
    return call('saveFact', { content });
  }

  async function getAllFacts() {
    const res = await call('getAllFacts');
    return res.facts || [];
  }

  async function saveMessage(role, content) {
    return call('saveMessage', { role, content });
  }

  async function getRecentMessages(limit = 20) {
    const res = await call('getRecentMessages', { limit });
    return res.messages || [];
  }

  // image = base64 data URI (single JPEG frame), matched = boolean
  async function logAttempt(image, matched) {
    if (!image) return { ok: false };
    return call('logAttempt', { image, matched });
  }

  return {
    init,
    isReady,
    saveFaceDescriptor,
    getFaceDescriptor,
    saveFact,
    getAllFacts,
    saveMessage,
    getRecentMessages,
    logAttempt,
  };
})();
