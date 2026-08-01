/* ============================================================
   brain.js
   - Sends conversation to /api/chat (backend proxies to Groq using
     the server-side GROQ_API_KEY — never touches the browser).
   - Injects remembered facts + recent history into the prompt.
   - Detects when the user is telling it something to remember.
   ============================================================ */

const BrainModule = (() => {
  function buildSystemPrompt(facts) {
    let base = `You are DNA.AI, a warm, casual, human-like personal voice assistant.
Speak naturally and conversationally, like a helpful friend — short sentences, no corporate tone, no long lists unless asked.
Keep replies concise (2-4 sentences) since they will often be read aloud by text-to-speech.`;

    if (facts && facts.length) {
      base += `\n\nHere is what you already know about the user from past conversations:\n`;
      facts.forEach((f) => (base += `- ${f}\n`));
      base += `\nUse this naturally when relevant. Don't recite it back like a list unless asked.`;
    }
    return base;
  }

  async function ask(userText, { facts, history } = {}) {
    const messages = [
      { role: 'system', content: buildSystemPrompt(facts) },
      ...(history || []).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: userText },
    ];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('Backend /api/chat error:', errBody);
        if (errBody.error?.includes('GROQ_API_KEY')) {
          return "The Groq API key isn't set up on the server yet — add GROQ_API_KEY in Vercel's Environment Variables.";
        }
        return "Hmm, I couldn't reach my brain right now. Try again in a moment.";
      }

      const data = await res.json();
      return data.reply || "I didn't quite get a response there.";
    } catch (e) {
      console.error(e);
      return 'Something went wrong reaching the server — check your internet connection.';
    }
  }

  function extractFact(userText) {
    const lower = userText.toLowerCase();
    const triggers = ['remember that', 'remember i', 'remember my', "don't forget", 'my name is', 'i like', 'i love', 'i hate', 'my birthday'];
    if (triggers.some((t) => lower.includes(t))) {
      return userText.trim();
    }
    return null;
  }

  return { ask, extractFact };
})();
