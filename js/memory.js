/* ============================================================
   memory.js
   - Talks to Supabase to store/retrieve:
     1. face_descriptor (for login)
     2. conversation history
     3. long-term "facts" the user tells the assistant
   - Supabase URL/anon key are fetched from /api/config (which reads
     Vercel Environment Variables server-side) — nothing hardcoded here.

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
     role text not null,       -- 'user' or 'assistant'
     content text not null,
     created_at timestamp default now()
   );
   ---------------------------------------------------------------
   ============================================================ */

const MemoryModule = (() => {
  let supabase = null;

  async function init() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return false;
      const cfg = await res.json();
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return false;
      supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      return true;
    } catch (e) {
      console.warn('Could not load /api/config — memory features disabled:', e);
      return false;
    }
  }

  function isReady() {
    return !!supabase;
  }

  // ---- Face descriptor storage ----
  async function saveFaceDescriptor(descriptor) {
    if (!supabase) return;
    await supabase.from('profile').upsert({
      id: 'me',
      face_descriptor: Array.from(descriptor),
    });
  }

  async function getFaceDescriptor() {
    if (!supabase) return null;
    const { data, error } = await supabase.from('profile').select('face_descriptor').eq('id', 'me').single();
    if (error || !data) return null;
    return Float32Array.from(data.face_descriptor);
  }

  // ---- Facts (long-term memory) ----
  async function saveFact(content) {
    if (!supabase) return;
    await supabase.from('facts').insert({ content });
  }

  async function getAllFacts() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('facts').select('content').order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map((r) => r.content);
  }

  // ---- Conversation history ----
  async function saveMessage(role, content) {
    if (!supabase) return;
    await supabase.from('messages').insert({ role, content });
  }

  async function getRecentMessages(limit = 20) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('role, content')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.reverse();
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
  };
})();
