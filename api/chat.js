// /api/chat.js
// Vercel Serverless Function (Node runtime).
// Reads GROQ_API_KEY from Vercel Environment Variables — never exposed to the browser.
// Frontend sends { messages, image } and gets back { reply }.

const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel Environment Variables.' });
    return;
  }

  try {
    const { messages, image } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    let finalMessages = messages;
    let model = TEXT_MODEL;

    // If an image (base64 data URI) was attached, switch to the vision model
    // and reshape the last user message into the multimodal content format.
    if (image) {
      model = VISION_MODEL;
      const last = finalMessages[finalMessages.length - 1];
      finalMessages = [
        ...finalMessages.slice(0, -1),
        {
          role: 'user',
          content: [
            { type: 'text', text: last.content || 'Describe this image.' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ];
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      res.status(502).json({ error: 'Groq API error', detail: errText });
      return;
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "I didn't get a clear response.";
    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
};
