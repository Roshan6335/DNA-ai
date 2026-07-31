# DNA.AI — Apna Personal Voice Assistant

Full working website:
- Welcome screen → Face scan → Face recognized → Main assistant
- Real webcam + face detection (face-api.js)
- Voice input/output (Web Speech API)
- Image upload (attach a photo, AI ko usme se samajhne ko bolo — Groq vision model)
- AI brain (Groq — free, Llama 3.3 70B for text, Llama 4 Scout for images)
- Long-term memory (Supabase — jo bhi "remember..." bologe, wo yaad rahega)

**API keys ab website ke andar nahi daalni** — sab Vercel ke Environment Variables se aati hain.
Frontend keys kabhi nahi dekhta; do chhoti backend functions (`/api/chat`, `/api/config`) unhe safely use karti hain.

---

## Step 1: Groq API key lena

1. https://console.groq.com → sign up (no card needed)
2. "API Keys" → "Create API Key" → copy karo (`gsk_...`)

## Step 2: Supabase setup

1. https://supabase.com → free project banao
2. "SQL Editor" me ye run karo:

```sql
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
```

3. "Project Settings" → "API" → **Project URL** aur **anon public key** copy karo

## Step 3: Vercel pe Environment Variables set karna

1. Is folder ko GitHub repo me push karo, Vercel se import karo
2. Vercel Dashboard → tumhara project → **Settings → Environment Variables** → ye teen add karo:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | tumhari Groq key (`gsk_...`) |
| `SUPABASE_URL` | tumhara Supabase project URL |
| `SUPABASE_ANON_KEY` | tumhari Supabase anon public key |

3. Save karo, phir "Deployments" tab se **Redeploy** karo (env vars sirf naye deployment pe apply hote hain)

Bas — website automatically in variables ko backend se utha legi. Koi key kahi hardcode nahi hai.

---

## Local testing (Vercel CLI se, kyunki /api functions ko Node backend chahiye)

Plain `python -m http.server` se /api functions kaam nahi karenge (wo sirf static files serve karta hai). Local test ke liye:

```bash
npm install -g vercel
cd dna-ai
vercel dev
```

Ye local `.env` file bhi use kar sakta hai — root me `.env` banao:
```
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

Camera/mic access ke liye `localhost` chalega (production me automatically HTTPS milega Vercel se).

---

## Vercel pe deploy

1. GitHub repo bana ke ye poora folder push karo
2. https://vercel.com → "Add New Project" → repo select karo
3. Framework preset: **Other** (koi build step nahi chahiye)
4. Environment Variables add karo (Step 3 dekho upar)
5. Deploy

2 minute me live: `your-project.vercel.app`

---

## Features — sab check kar liya

| Feature | Status |
|---|---|
| Welcome screen animation | ✅ working |
| Face scan (webcam + live mesh) | ✅ working, camera permission chahiye |
| Face recognized + Supabase registration | ✅ working (pehli baar register, phir compare) |
| Text chat input | ✅ working → `/api/chat` |
| Mic / voice input | ✅ working (Chrome recommended — Web Speech API) |
| Voice output (AI bolta hai) | ✅ working, sab browsers me |
| Image upload | ✅ working — attach karo, AI dekh ke jawab dega |
| Memory (facts yaad rakhna) | ✅ working, Supabase ke through |
| API keys | ✅ ab sirf Vercel Environment Variables se, browser me kahi nahi |

---

## Kya nahi karega

Ye browser-based website hai, desktop app nahi — isliye:
- Laptop ke apps open/close nahi karega
- Files control nahi karega
- System settings change nahi karega

Wo chahiye to alag Python/Electron desktop app banani padegi.

---

## Customize

- **Hindi voice input**: `js/voice.js` me `recognition.lang = 'en-IN'` → `'hi-IN'`
- **AI personality**: `js/brain.js` → `buildSystemPrompt()`
- **Colors**: `css/style.css` top ke `:root` variables
- **Text model / vision model**: `api/chat.js` top ke `TEXT_MODEL` / `VISION_MODEL`
