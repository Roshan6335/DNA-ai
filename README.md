# DNA.AI — Apna Personal Voice Assistant (Multi-User)

## Naya kya hai is version mein

**Har face ki apni alag identity hai ab.** Pehle sab logo ka data ek hi jagah mix ho ja raha tha — ab jab bhi koi naya face scan hota hai, system use pehchanta hai (ya first time ho to naya profile bana deta hai), aur uska chat history + facts sirf usi tak limited rehte hain. Koi bhi kisi aur ka data nahi dekh sakta.

⚠️ **Zaroori: Purana data migrate nahi ho sakta** (wo already mixed tha, sort karna possible nahi). Isliye niche di gayi SQL purana data poori tarah delete karke fresh, sahi structure banayegi. Iske baad **sabko (tumhe bhi) apna face dobara register karna hoga** — bas ek baar, uske baad automatic pehchan lega hamesha.

---

## Step 1: Supabase mein purana data clean karke naya structure banao

SQL Editor mein ye poora block run karo (ye purani tables delete karke sahi multi-user structure banayega):

```sql
drop table if exists messages;
drop table if exists facts;
drop table if exists security_log;
drop table if exists profile;

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
```

Agar Storage bucket `security-logs` pehle se nahi bani, to Storage tab → New bucket → naam `security-logs` → Public: OFF.

---

## Ye kaise kaam karta hai ab

1. Koi bhi face scan karta hai → backend uski descriptor ko **saari saved profiles se compare** karta hai
2. Match mil gaya → usi purani identity se history/facts load honge
3. Match nahi mila (naya chehra) → automatically ek nayi profile ban jati hai, wahi se uska apna alag history shuru hoga
4. Har message/fact database mein `user_id` ke saath tagged hota hai — isliye query karte waqt sirf apna data hi milta hai, kisi aur ka nahi

Ye poora kaam backend (`/api/memory.js`) mein hota hai — koi bhi user dusre ka face-data ya messages browser se directly nahi dekh sakta.

---

## Environment Variables (same as pehle, koi naya nahi chahiye)

| Key | Kaha se milegi |
|---|---|
| `GROQ_API_KEY` | Groq console |
| `SUPABASE_URL` | Supabase → Settings → Data API → "Project URL" |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → "Legacy anon, service_role API keys" tab |
| `ADMIN_PASSCODE` | apna socha hua passcode |

Vercel pe env vars set karne ke baad **Redeploy** karna mat bhoolna.

---

## Deploy

1. Poora folder GitHub pe push karo, Vercel se import karo
2. Framework preset: **Other**
3. Env vars add karo (upar wali table)
4. Deploy → `your-project.vercel.app`

---

## Security log admin page

`your-project.vercel.app/admin.html` → passcode daalo → har attempt ka photo, time, "Matched"/"New face" status, aur user ID ka short version dikhega. Alag-alag user IDs se pata chal jayega kaun-kaun try kar chuka hai.

**Transparency note**: Face-auth screen ke neeche likha hai ki attempt log ho sakta hai — jo bhi site use karega use ye disclosed dikhega.

---

## Features — final status

| Feature | Status |
|---|---|
| Welcome/auth/assistant screens (Three.js animations) | ✅ |
| Face scan — fast, no mirror flip, no skip button | ✅ |
| **Multi-user**: har face ki apni alag identity | ✅ naya |
| **Multi-user**: har user ka chat history/facts sirf usi ke liye | ✅ naya |
| Voice input (mic) — Android Chrome | ✅ |
| Voice output | ✅ |
| Memory (facts, chat history) — reliably saves | ✅ |
| Security snapshot + admin log page (with user ID) | ✅ |
| Custom identity ("Made by Roshan") | tum khud `js/brain.js` mein add kar sakte ho |

**Voice input note**: Chrome/Edge pe best kaam karta hai. iOS Safari support nahi karta.

---

## Kya nahi karega

Browser website hai, desktop app nahi — apps open, files control, ya system settings change nahi kar sakta.

---

## Customize

- **AI personality / identity**: `js/brain.js` → `buildSystemPrompt()`
- **Face-match sensitivity**: `api/memory.js` → `MATCH_THRESHOLD` (chhota number = strict, kam log match honge; bada number = loose, galti se dusra bhi match ho sakta hai)
- **Hindi voice input**: `js/voice.js` → `r.lang = 'hi-IN'`
- **Colors**: `css/style.css` top ke `:root` variables
- **Kitni jaldi verify ho**: `js/face.js` → `REQUIRED_STABLE_FRAMES`
