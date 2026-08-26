# Content Calendar System

Automatically generates one content idea per day (Sept 1 – Dec 31, 2026 to start),
rotating through 4 pillars in a continuous cycle, and writes it into a Google Sheet —
adapted per platform:

- **Facebook** → always a written post (text, or text + image)
- **Instagram & TikTok** → same format as each other (Reel, Story, or B-roll — whichever
  fits the day's idea best)

Uses **Google's Gemini API**, which has a genuinely free tier (no credit card required)
— that's what generates each day's idea and Facebook draft.

## 1. One-time setup

1. Install [Node.js](https://nodejs.org) (v18+) if you don't have it. ✅ (you've done this)
2. Open a terminal in this folder and run:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
   (Or on Windows: make a copy of `.env.example` in File Explorer and rename it to `.env`)
4. Fill in `.env`:
   - `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` — path to the JSON key file from the Google Cloud
     setup steps (easiest: put the file in this folder, rename it to
     `service-account-key.json`, and leave this line as-is).
   - `GOOGLE_SHEET_ID` — from your Sheet's URL:
     `https://docs.google.com/spreadsheets/d/THIS_PART/edit`
   - `GEMINI_API_KEY` — get this FREE at https://aistudio.google.com/apikey
     (sign in with any Google account, click "Create API Key" — no card, no payment,
     nothing to set up).
5. Make sure you shared the Google Sheet with the service account's email
   (found inside the JSON key file as `client_email`) with **Editor** access.

## 2. Test it first (no writing, just prints to your terminal)

```
node index.js --dry-run --start=2026-09-01 --end=2026-09-03
```

This generates 3 days of content and prints it, without touching the Sheet or the
"used topics" log — safe to run as many times as you want.

## 3. Run it for real

Generate the first month:
```
node index.js --start=2026-09-01 --end=2026-09-30
```

Then each following month:
```
node index.js --start=2026-10-01 --end=2026-10-31
node index.js --start=2026-11-01 --end=2026-11-30
node index.js --start=2026-12-01 --end=2026-12-31
```

Each run checks the "Used Topics" tab first, so pillars never repeat an idea, even
across separate runs.

## 4. Making it fully hands-off (no manual running)

Once you've confirmed it works, wire it into a scheduler so it runs on its own —
completely free, no server needed:

- **GitHub Actions** (recommended, free): put this project in a private GitHub repo,
  add a workflow file that runs `node index.js` automatically (e.g. daily), and store
  your `.env` values as GitHub Secrets instead of a local `.env` file. I can write this
  workflow file for you once the script is tested and working locally.

## How the pillar rotation works

The rotation is a pure day-counter — it counts days since Sept 1, 2026 and cycles
through the 4 pillars (mod 4), with **no reset** at week or month boundaries. See
`src/pillarRotation.js` — `ROTATION_EPOCH` is the only date that should never change
once you've started posting.

## Sheet structure

| Date | Day of Week | Pillar | Content Topic | IG / TikTok Format | Facebook Format | Facebook Post Draft | Reference / Notes |
|---|---|---|---|---|---|---|---|

Plus a hidden **Used Topics** tab that logs every topic ever generated per pillar, so
nothing repeats.
