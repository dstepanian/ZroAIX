# ZroAIX

Armenian AI/tech news **digest** bot. Twice a day it pulls AI & tech RSS, grabs a
Hugging Face "trending models" snapshot, uses **Gemini Flash** to pick the 4–6 most
important stories, extract any new model/product releases, and rewrite everything in
Armenian, then posts one clean digest to a Telegram channel. Free to run — no server,
GitHub Actions cron does the scheduling.

```
AI RSS feeds ─┐
              ├─▶ aggregate ─▶ Gemini curate ─▶ format ─▶ Telegram (1 digest post)
HF trending ──┘   (last 24h)   (pick 4-6 + releases, hy)
```

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather
   - `TELEGRAM_CHANNEL` — e.g. `@yourchannel` (add the bot as **admin** of the channel)
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Run

```bash
npm run preview   # dry run, prints the digest to console (no posting)
npm run dry       # dry run, no console print
npm start         # builds AND posts the daily digest, then records the day in history.json

node src/weekly.js --dry --print   # preview the weekly recap (needs >=2 days of history)
node src/weekly.js                 # post the weekly recap
```

## Scheduling (free)

`.github/workflows/digest.yml` runs at **06:00 & 16:00 UTC = 10:00 & 20:00 Yerevan**.
Add the secrets in the repo: **Settings → Secrets and variables → Actions**
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`, `GEMINI_API_KEY`). Optional repo
*variables*: `GEMINI_MODEL`, `SITE_URL`, `CHANNEL_HANDLE`. Use **Run workflow**
on the Actions tab to fire a manual test.

To change times, edit the `cron:` line (it's in UTC; subtract 4h from Yerevan).

### Weekly recap

Each daily run appends a trimmed snapshot (date, overview, headlines, releases) to
`history.json` and the Actions workflow commits it back to the repo (one entry per day,
last 60 kept). `weekly.yml` runs **Sundays 17:00 UTC = 21:00 Yerevan**, reads the last 7
days, and posts a "📅 Շաբաթվա ամփոփում" — the week's big arc and 4–6 highlights. It
self-skips until at least 2 days of history exist. The daily workflow needs
`contents: write` permission for the commit-back (already set).

## Structure

| File | Role |
|------|------|
| `src/feeds.js` | AI/tech RSS source list |
| `src/fetchRss.js` | parallel feed fetch |
| `src/aggregate.js` | merge, last-24h filter, dedupe, strip HTML |
| `src/trending.js` | Hugging Face trending models snapshot |
| `src/gemini.js` | shared Gemini JSON call (used by daily + weekly) |
| `src/curate.js` | Gemini prompts — daily digest + weekly recap |
| `src/format.js` | build the daily and weekly messages |
| `src/post.js` | Telegram Bot API send |
| `src/history.js` | append/load `history.json` (one entry per day) |
| `src/index.js` | orchestrate the daily run |
| `src/weekly.js` | orchestrate the Sunday weekly recap |
