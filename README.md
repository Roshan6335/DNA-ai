# DNA.AI — Apna Personal Voice Assistant

## Is version mein kya fix hua

| Problem jo tumne bataya | Fix |
|---|---|
| Voice command kaam nahi kar raha | Mic ka do-jagah-se access hone wala conflict hata diya — ab sirf ek hi mic stream use hoti hai |
| Face recognition slow/ganda | Har frame pe heavy computation ho rahi thi — ab sirf ek baar hoti hai jab face stable ho. Camera bhi ab mirror nahi dikhta |
| Animations kamzor thi | Three.js se real 3D particle orb aur wireframe head — ab video jaisi polished |
| Phone compatibility | Front camera lock, chhoti resolution (fast detection), bade touch targets |
| Image upload | Poori tarah hata diya gaya |
| Supabase mein kuch save nahi ho raha | **Root cause mil gaya**: browser seedha Supabase ko anon key se call kar raha tha, jiske liye security policies (RLS) chahiye hoti hain jo set nahi thi. Ab sab kuch backend (`/api/memory`) ke through jata hai using a "service role" key jo in policies ko bypass kar deti hai — guaranteed save hoga |
| Naya: Security snapshot | Har face-verify attempt par ek single photo (video nahi) log hoti hai, ek password-protected admin page pe dekh sakte ho |

---

## Step 1: Groq API key

1. https://console.groq.com → sign up (no card needed)
2. "API Keys" → "Create API Key" → copy karo (`gsk_...`)

## Step 2: Supabase setup

1. https://supabase.com → free project banao
2. **SQL Editor** me ye poora block run karo:

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

create table security_log (
  id bigint generated always as identity primary key,
  image_path text not null,
  matched boolean not null,
  created_at timestamp default now()
);
```

3. **Storage** tab → "New bucket" → naam `security-logs` → **Public: OFF** (private rakhna, zaroori hai)
4. **Project Settings → API** → do cheezein chahiye:
   - **Project URL**
   - **service_role key** (⚠️ ye `anon` key nahi hai — "service_role" wali alag key hai, thoda scroll karke milegi. Ye bahut powerful key hai, kabhi bhi browser/frontend code mein nahi jaani chahiye — isiliye ye sirf Vercel ke server-side environment variable mein jayegi, jo hum next step mein karenge)

## Step 3: Admin passcode socho

Koi bhi strong password jaisi cheez — isse tum apne security log dekh paoge. Kahi likh lo.

## Step 4: Vercel Environment Variables set karna

1. Folder GitHub pe push karo, Vercel se import karo
2. Vercel Dashboard → project → **Settings → Environment Variables** → ye 4 add karo:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | tumhari Groq key (`gsk_...`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** key (anon nahi!) |
| `ADMIN_PASSCODE` | Step 3 wala passcode |

3. Save karo, phir **Deployments → Redeploy** karo (env vars sirf naye deployment pe apply hote hain)

Koi bhi key kabhi browser mein nahi jaati — sab kuch serverless functions ke andar rehta hai.

---

## Deploy

1. GitHub repo bana ke poora folder push karo
2. https://vercel.com → "Add New Project" → repo select karo
3. Framework preset: **Other**
4. Env vars add karo (Step 4)
5. Deploy → 2 min me live: `your-project.vercel.app`

Camera/mic ke liye HTTPS chahiye hota hai — Vercel automatically deta hai, isliye production mein dikkat nahi hogi. Local test karna ho to `vercel dev` use karo (README ke end mein detail hai).

---

## Security log kaise dekhein

`your-project.vercel.app/admin.html` kholo, passcode daalo (jo tumne Step 3 mein socha tha). Har face-verify attempt ka ek photo, time, aur match hua ya nahi — wahi dikhega.

**Transparency note**: Site pe face-auth screen ke neeche chhota sa text likha hai — *"For your security, this attempt may be logged as a single photo"* — taaki koi bhi jo tumhari site use kare, use pata ho ki ye ho raha hai. Ye continuous recording nahi hai, sirf ek photo per attempt.

**Zaroori security samajh**: Ye poora system tumhare khud ke liye bana hai (personal use). Agar tum ye link kisi aur ko bhi doge use karne ke liye, unka face bhi isi tarah ek photo ke roop mein log hoga — unhe pata hona chahiye. Ye multi-user public product ke liye nahi hai, sirf apne use ke liye.

---

## Features — final status

| Feature | Status |
|---|---|
| Welcome screen (Three.js wireframe head) | ✅ |
| Face scan — real camera, live mesh, no mirror flip | ✅ |
| Face verify — fast (~1-2 sec after face is steady), no skip button | ✅ |
| Text chat | ✅ |
| Voice input (mic) | ✅ Android Chrome — fixed the dual-mic conflict |
| Voice output | ✅ all browsers |
| Memory (facts, chat history) | ✅ now reliably saves — root cause fixed |
| Security snapshot + admin log page | ✅ new |
| Image upload | ❌ removed as requested |

**Voice input note**: Web Speech API (jo mic input chalata hai) sirf Chrome/Edge pe achhe se kaam karta hai — Android pe Chrome use karna. iOS Safari isse support hi nahi karta (agar kabhi iPhone pe bhi chalana ho to alag approach chahiye hogi — bata dena).

---

## Kya nahi karega

Browser website hai, desktop app nahi:
- Laptop/phone ke apps open/close nahi karega
- Files control nahi karega
- System settings change nahi karega

---

## Customize

- **Hindi voice input**: `js/voice.js` → `r.lang = 'en-IN'` → `'hi-IN'`
- **AI personality**: `js/brain.js` → `buildSystemPrompt()`
- **Colors**: `css/style.css` top ke `:root` variables
- **Face-match sensitivity**: `js/app.js` → `distance > 0.5` (chhota number = strict match)
- **Kitni jaldi verify ho**: `js/face.js` → `REQUIRED_STABLE_FRAMES` (abhi 6 hai, kam karoge to aur jaldi but thoda kam reliable)

---

## Local testing (advanced, optional)

`/api` functions ke liye Node backend chahiye, isliye plain static server se nahi chalega:

```bash
npm install -g vercel
cd dna-ai
vercel dev
```

Root mein `.env` file banao (ye `.gitignore` mein already excluded hai, GitHub pe nahi jayegi):
```
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
ADMIN_PASSCODE=your-passcode
```
