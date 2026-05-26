# 90 notes — Mac menubar app

Records your meetings **locally on your Mac** and sends the transcript to your 90 notes workspace — **without a bot joining the call.** Nobody in the meeting sees an extra participant.

This is the "Rung B" desktop companion to the web app. The web Meeting Room view still shows the live transcript and items; this app is just the invisible audio capture.

---

## Before you start

You need two things from your 90 notes web setup:
1. **Your 90 notes web address** — e.g. `https://nine0-notes.onrender.com`
2. **Your access key** — the `DESKTOP_API_KEY` value you added to Render's Environment tab

You also need the server to have `DESKTOP_API_KEY` set (Render → Environment). If it's not set, the app will say "Desktop mode not enabled."

---

## Installing & running (the app is already built for you)

1. Find **`90 notes.app`** (Claude built it into `desktop/release/mac-arm64/`).
2. Drag it to your **Applications** folder.
3. **First launch:** because the app isn't signed by Apple, macOS will block it the first time. To open it:
   - **Right-click** the app → **Open** → in the dialog, click **Open** again.
   - (You only do this once. After that, it opens normally.)
4. A small **✦** icon appears in your menubar (top-right of your screen). The app has no Dock icon — it lives in the menubar.

---

## First-run setup (one time)

1. Click the **✦** menubar icon → a small panel opens.
2. It opens to **Settings** the first time. Fill in:
   - **90 notes web address** — paste your Render URL
   - **Access key** — paste your `DESKTOP_API_KEY`
   - Click **Load teams from server**, then pick your **default team**
   - Click **Save**
3. Next it shows the **Permissions** step. Click **Grant access**. macOS will pop up dialogs asking to allow:
   - **Microphone** → Allow
   - **Screen Recording** → Allow (this is how it hears the *other* people — macOS files system-audio capture under Screen Recording)
   - **Accessibility** → Allow (helps label who's speaking)
   - If you miss a dialog or click "Don't Allow," click **Open macOS Privacy settings** and toggle them on manually. You may need to quit + reopen the app after granting Screen Recording.
4. Click **I've granted them — continue**. You're set up.

---

## Using it

1. **Start your meeting first** (Zoom, Meet, Teams, or even an in-person conversation).
2. Click the **✦** menubar icon → click **Start recording**.
3. The icon changes to **● REC**. The app is now capturing audio locally.
4. Click **Open Meeting Room →** to watch the live transcript + items in your browser — exactly like the bot version.
5. When the meeting ends, click the menubar icon → **Stop recording**.

That's it. Issues, To-Dos, IDS notes flow into Ninety the same way as the bot version — the only difference is there's no "90 notes" participant in the call.

---

## Rebuilding the app (for Claude / developers)

```bash
cd desktop
npm install
npm run build      # bundles main + preload + renderer via esbuild
npm run dist       # builds the unsigned .dmg / .app into desktop/release/
```

To run in development without packaging:
```bash
npm start          # builds, then launches Electron directly
```

### Notes for maintainers
- Built on Electron + esbuild. No electron-vite — `build.mjs` bundles the three entry points.
- Settings are stored encrypted via Electron `safeStorage` (macOS Keychain) at `~/Library/Application Support/90 notes/config.enc`.
- The Recall Desktop SDK (`@recallai/desktop-sdk`) is a native module — `electron-builder.yml` unpacks it from the asar archive (`asarUnpack`).
- Transcripts are delivered Recall cloud → your backend's `/api/recall-webhook` (configured server-side in `server/src/integrations/recall-dsdk.ts`), tagged with `meeting_id`. The desktop app never relays transcript data itself.
- Unsigned build (`identity: null`). For a clean install (no right-click-Open), get an Apple Developer membership ($99/yr) and configure signing + notarization in `electron-builder.yml`.
- Mac arm64 only (the Recall DSDK supports Apple Silicon).
