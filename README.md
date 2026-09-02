# CitizenVoice — Backend + Frontend Wiring Guide

Your original frontend (`index.html`, `index1.html`, `index2.html` + scripts)
was fully mocked: login always succeeded, and complaints only went to
`console.log`. This package adds a real FastAPI backend and updates the
frontend files to actually call it.

## What changed in your frontend

| File | Change |
|---|---|
| `supabase-client.js` | **New.** Shared Supabase connection config, loaded on every page. |
| `script.js` | Login/Register now call real `supabaseClient.auth.signInWithPassword()` / `signUp()` instead of faking success. |
| `script1.js` | Complaint form now sends a real `multipart/form-data` request (with your auth token) to the backend instead of `console.log`. Also now guarded so it only runs on the page with the form. |
| `script2.js` | `logout()` now actually calls `supabaseClient.auth.signOut()`. |
| `index1.html` | Fixed a bug: the photo `<input>` had `id="files"` then `id="photo"` set twice (invalid HTML) — now just `id="photo"`. Made the photo field optional to match the backend. |
| `index.html`, `index1.html`, `index2.html` | Added the Supabase JS SDK `<script>` tag + `supabase-client.js` before your existing scripts. |
| `track.html`, `track.js` | **New.** `script2.js` already linked to `track.html` but it didn't exist — this is the "Track Complaint" page, listing the logged-in citizen's own complaints and statuses. |

---

## Setup order (do these in sequence)

### 1. Supabase project
Create a project at [supabase.com](https://supabase.com). On the creation
screen: keep **Data API enabled** and **Automatically expose new tables**
checked (needed for the backend to reach your tables).

### 2. Run the schema
SQL Editor → paste all of `sql/schema.sql` → Run. This creates:
- `departments`, `complaints`, `complaint_status_history`, `profiles` tables
- A trigger that auto-creates a `profiles` row whenever someone signs up
- RLS policies so citizens can only see their own complaints
- The `match_similar_complaints` function for duplicate detection

### 3. Create the storage bucket (manual — not SQL)
Dashboard → **Storage** → **New bucket** → name it exactly `complaint-photos`
→ toggle **Public bucket: ON** → Create.

### 4. Enable Email auth (usually on by default)
Dashboard → **Authentication** → **Providers** → confirm **Email** is enabled.
For a hackathon demo, also go to **Authentication → Settings** and consider
turning **off** "Confirm email" so test accounts can log in immediately
without clicking an email link.

### 5. Get your keys
Project Settings → API. You need three values:
- **Project URL**
- **anon / publishable key** → goes in `supabase-client.js` (frontend) — safe to expose
- **service_role key** → goes in backend `.env` only — **never put this in frontend code**

### 6. Configure the backend
```bash
cd citizenvoice-backend
cp .env.example .env
# edit .env with your URL + service_role key + anon key
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/docs` to confirm it's running.

### 7. Configure the frontend
Open `citizenvoice-frontend/supabase-client.js` and fill in:
```js
const SUPABASE_URL = "https://your-project-ref.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
const API_BASE_URL = "http://localhost:8000";
```

### 8. Run the frontend
Since these are plain HTML files using `fetch`, you need them served over
`http://`, not opened directly as `file://` (browsers block some requests
from `file://`). Easiest option:
```bash
cd citizenvoice-frontend
python3 -m http.server 5500
```
Visit `http://localhost:5500/index.html`.

---

## How the pieces fit together

```
Browser (index.html)
   │
   │  1. signUp()/signInWithPassword() — DIRECT to Supabase Auth
   ▼
Supabase Auth  ──► creates row in auth.users ──► trigger creates profiles row
   │
   │  2. returns access_token to browser
   ▼
Browser stores session, redirects to index2.html → index1.html (complaint form)
   │
   │  3. fetch(API_BASE_URL + "/complaints", { headers: { Authorization: Bearer <token> }, body: FormData })
   ▼
FastAPI backend
   │
   │  4. verifies token via app/auth.py (asks Supabase "whose token is this?")
   │  5. normalizes text, classifies, scores priority, embeds, checks duplicates
   │  6. uploads photo to Supabase Storage
   │  7. inserts complaint row using service_role key (bypasses RLS — trusted backend)
   ▼
Supabase Postgres (complaints table)
```

The key security idea: **the browser never gets a privileged key.** It only
ever holds the citizen's own login token, which (thanks to RLS) can only ever
touch that citizen's own rows if it talked to Supabase directly. All the
"smart" work (classification, duplicate detection) happens in your backend
using the powerful key, which never leaves your server.

## Testing the flow end to end

1. Open `index.html` → Register a test account → check you can log in.
2. You should land on `index2.html` (dashboard).
3. Click **Book Complaint** → fill the form → submit.
4. You should see a message like `Complaint submitted! Category: Water Supply | Priority: high`.
5. Click **Track Complaint** (or navigate to `track.html`) → your complaint should appear with its category, priority, and status.
6. In Supabase Dashboard → Table Editor → `complaints`, you should see the row, including the `embedding` column populated.

## What's still simplified (fine for a hackathon, flag for judges as "next steps")

- No authority-side dashboard yet (only the citizen side is wired up) — `PATCH /complaints/{id}/status` exists in the API but has no UI yet.
- Status-update endpoint isn't role-restricted — any authenticated user could technically call it. Add an `is_authority` flag on `profiles` and check it before allowing status changes.
- No password-reset flow (Supabase Auth supports it, just not wired into these pages yet).
