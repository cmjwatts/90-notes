# 90 notes

Live meeting note-taker for Ninety.io. A Recall.ai bot joins your Zoom call, Claude listens, and items flow into your Ninety workspace — matched to existing Issues, To-Dos, and Headlines instead of creating duplicates.

This README is written for a non-technical owner. It assumes nothing.

---

## What you'll need before starting

You'll create accounts at **five** services. The first four take ~3 minutes each; the last is the deploy target.

| Service | What it does | Where to sign up |
|---|---|---|
| **Recall.ai** | Sends a bot to your Zoom/Meet/Teams meeting and streams the transcript | [recall.ai](https://www.recall.ai/) |
| **Anthropic** | Provides Claude (the AI brain that decides what's an issue, to-do, etc.) | [console.anthropic.com](https://console.anthropic.com) |
| **Ninety** | Your Ninety account — we'll grab a personal API token from your settings | [ninety.io](https://ninety.io) |
| **Supabase** | Stores meeting transcripts, items, and pushes live updates to your browser | [supabase.com](https://supabase.com) |
| **Render** | Hosts the app on the internet so the meeting bot can reach it | [render.com](https://render.com) (only needed when deploying) |

You'll also want **Node.js 20+** installed on your Mac (`brew install node`).

---

## One-time setup (~20 min)

### 1. Get your API keys

Open a notes file and collect these as you go — you'll paste them all into `.env` in step 3.

- **Anthropic** → console.anthropic.com → Settings → API Keys → "Create Key." Copy the `sk-ant-…` value.
- **Recall.ai** → After signing up, dashboard → API Keys → "Create new key." Copy it. Note your region (probably `us-west-2`).
- **Ninety** → Log into Ninety → Settings → (look for API / Integrations / Developer section) → generate or copy your personal access token. *Note: if this section doesn't exist on your account, message your engineering team — Phase 0 of the plan covers this.*
- **Supabase**: see step 2.

### 2. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → "New project."
2. Name it `90-notes`. Pick a region close to you. Set a strong DB password and save it.
3. Wait ~2 min for it to provision.
4. In the project: **Settings → API** — copy these three values:
   - **Project URL** (looks like `https://abc.supabase.co`)
   - **anon public key**
   - **service_role secret** (click the eye icon to reveal — keep this private)
5. Now load the schema: **SQL Editor → New query** → paste the contents of [`server/src/db/schema.sql`](server/src/db/schema.sql) → click **Run**.

### 3. Configure local environment

In Terminal:

```bash
cd /Users/Christine/MeetingTranscription
cp .env.example .env
```

Open `.env` in any text editor (TextEdit is fine — make sure to save as plain text, not RTF). Paste each value you collected. The file has comments explaining each one.

### 4. Install dependencies

```bash
npm install
```

This will take 1-2 minutes the first time.

### 5. Run locally

```bash
npm run dev
```

This starts two processes:
- The backend server on `http://localhost:4000`
- The web app on `http://localhost:5173`

Open `http://localhost:5173` in your browser. You should see the "Start a meeting" screen.

**Important caveat for local dev:** Recall.ai needs to send webhooks to `RECALL_WEBHOOK_URL`. `localhost:4000` isn't reachable from the internet, so transcripts won't actually flow on a local-only setup. Two options:

- **Easy:** deploy to Render and test there (see deploy section below).
- **Slightly less easy:** use [ngrok](https://ngrok.com) to expose your local server to the internet, then update `RECALL_WEBHOOK_URL` in `.env` to the ngrok URL. Install ngrok with `brew install ngrok`, then run `ngrok http 4000` in another terminal.

---

## Deploying to Render (production)

1. **Create a GitHub repo** for this project and push it (skip files starting with `.` and `node_modules/`). If you've never done this, ask Claude to walk you through `git init` + `git push`.
2. **Render → New → Web Service** → connect your GitHub repo.
3. Settings:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm run start`
   - **Environment:** Node
   - **Instance type:** Starter ($7/mo — required for "always-on" so the bot's webhooks land reliably)
4. **Environment variables:** paste each line from your `.env` into Render's Environment tab. **Important:**
   - `NODE_ENV=production`
   - `PUBLIC_BASE_URL=https://YOUR-RENDER-DOMAIN.onrender.com` (Render gives you this domain after the first deploy)
   - `RECALL_WEBHOOK_URL=https://YOUR-RENDER-DOMAIN.onrender.com/api/recall-webhook`
   - `VITE_API_BASE` should be empty (frontend and backend share a domain in prod)
5. Deploy. First deploy takes ~5 min.
6. Visit your Render URL — same Start-a-meeting screen, but now publicly reachable.

---

## How to use it (the short version)

1. Open the app (Render URL or `localhost:5173`).
2. Paste a Zoom meeting URL, pick a Team + Playbook, click **Start meeting**.
3. The bot joins your Zoom call as "90 notes" (or whatever you named it). Tell attendees you're using a note-taker.
4. Have your meeting. As you talk:
   - **Explicit language** ("that's an issue", "add a to-do") → items auto-write to Ninety. You'll see them in the "Approved & added" list at the bottom.
   - **Inferred items** → appear in the focus card. Approve / Edit / Skip.
   - The "Tell the bot" input lets you steer it ("we're back on the NPS issue", "this is Mark's").
   - The **IDS Coach** (sparkle button bottom-right) helps with root causes / discussion questions when you ask.
5. When done, click **End meeting**. You'll see a recap with everything created + cost.

---

## File map (for when you're poking around)

```
MeetingTranscription/
├── server/                      # The Node + Express backend
│   ├── src/
│   │   ├── index.ts             # Entry point
│   │   ├── config.ts            # Reads .env, validates
│   │   ├── routes/              # /api/meetings, /api/items, /api/coach
│   │   ├── webhooks/recall.ts   # Receives transcript chunks from Recall.ai
│   │   ├── orchestrator/        # Per-meeting work queue + session state
│   │   ├── llm/                 # Claude prompts: hot loop, cold loop, coach
│   │   ├── integrations/        # Recall.ai, Ninety, Supabase, Anthropic clients
│   │   └── db/schema.sql        # ← run this once in Supabase
│   └── package.json
│
├── web/                         # The browser app (React + Vite)
│   ├── index.html               # Loads Poppins + Caveat fonts
│   ├── src/
│   │   ├── main.tsx             # Router setup
│   │   ├── pages/               # MeetingSetup, MeetingRoom, PlaybookEditor, Recap
│   │   ├── components/          # TopBar, FocusCard, TranscriptPane, IDS warning, etc.
│   │   ├── lib/api.ts           # Calls to the backend
│   │   ├── lib/supabase.ts      # Realtime subscriptions
│   │   └── styles/tokens.css    # Brand colors + typography (copied from design handoff)
│   └── package.json
│
├── package.json                 # Workspaces config
├── .env.example                 # Copy this to .env and fill in
└── README.md                    # ← you are here
```

---

## Troubleshooting

**"Invalid environment configuration" on server start.** You're missing a value in `.env`. Look at the printed list of errors. Each line tells you which key is bad.

**Bot never joins the Zoom call.** Check the Render logs (or terminal if local). Usually one of: (1) bad `RECALL_API_KEY`, (2) Zoom URL not a Zoom Cloud meeting URL, (3) the meeting is in a waiting room and no one has admitted the bot.

**Items not appearing in Ninety.** Phase 0 of the plan: confirm your Ninety personal access token works. Test with `curl`:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.public.ninety.io/v1/issues
```
If that returns a list, the token's good. If not, talk to your engineering team — the public API surface or auth model may differ.

**Realtime updates not flowing in the browser.** Open the browser console (Cmd+Option+I → Console tab) and look for errors. Common culprit: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing on the frontend in production. Render's "Environment" tab needs `VITE_*` keys to be present at *build* time — verify they're saved before deploys.

---

## What's NOT built yet (per the plan)

This is V1 scaffolding. Working: meeting bot dispatch, transcript streaming, Claude extraction, match-before-create logic, Card Stack UI, IDS coach, recap. **Not yet working:**

- Playbook Editor (currently a placeholder — server uses a hardcoded default Playbook)
- Auto-section-detection (you set the section manually for now)
- Ninety API verification (Phase 0 — see plan)
- Bot-kicked / waiting-room recovery UI
- Custom domain mapping

See `/Users/Christine/.claude/plans/i-want-to-go-shiny-brook.md` for the full plan and Phase 6 polish list.
