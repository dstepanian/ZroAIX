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

## LinkedIn draft bot

The LinkedIn helper reads the latest public post from `@zroaix`, creates two Armenian
LinkedIn drafts plus a branded `1080x1350` PNG card, and sends them only to your private
chat with `@zroaixbot`. It never posts drafts into `@zroaix` and never posts to LinkedIn.

Add these variables to `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456:ABC-your-zroaixbot-token
OWNER_CHAT_ID=123456789
SOURCE_CHANNEL_USERNAME=zroaix
GEMINI_API_KEY=your-gemini-key
LINKEDIN_CARD_THEME=mono
```

To get `OWNER_CHAT_ID`, open the private chat with `@zroaixbot`, press Start, run the bot
locally with `npm run linkedin:bot`, and send `/start`. The bot replies with your chat id.

Commands:

```bash
npm run linkedin:test   # no Telegram/API send; writes out/zroaix-linkedin-card.png
npm run linkedin:poster # no Telegram/API send; also writes out/zroaix-animated-poster.svg
npm run linkedin:mp4    # no Telegram/API send; writes out/zroaix-animated-poster.mp4
npm run linkedin:bot    # listens for private /generate_zroaix_linkedin commands
npm run linkedin:once   # generates once and sends to OWNER_CHAT_ID
```

Use `LINKEDIN_CARD_THEME=mono`, `LINKEDIN_CARD_THEME=dark`, or `LINKEDIN_CARD_THEME=light` for the default card
style. You can also override per command:

```bash
node src/linkedinBot.js --sample --mock --print --theme=mono
node src/linkedinBot.js --sample --mock --print --theme=light
node src/linkedinBot.js --sample --mock --print --theme=dark
node src/linkedinBot.js --sample --mock --print --animated
node src/linkedinBot.js --sample --mock --print --mp4
```

Private bot command:

```text
/generate_zroaix_linkedin
```

The `/start` message also shows quick buttons for:

```text
PNG dark
PNG light
PNG mono
MP4 dark
MP4 light
MP4 mono
SVG dark
SVG light
SVG mono
```

For a one-off theme from Telegram:

```text
/generate_zroaix_linkedin light
/generate_zroaix_linkedin dark
/generate_zroaix_linkedin mono
/generate_zroaix_linkedin animated
/generate_zroaix_linkedin mp4
```

Add `animated`, `poster`, or `svg` to also receive a square `1080x1080` animated SVG
poster in the same style as the zromek animated posts. Telegram photos flatten SVG
animation, so the bot sends the animated poster as a document attachment.

Add `mp4` or `video` to export the same animated poster as `out/zroaix-animated-poster.mp4`
and receive it as a Telegram document. MP4 export requires `ffmpeg` on PATH, `FFMPEG_PATH`,
or a local `ffmpeg-static` install.

The expected private-chat output is:

1. LinkedIn draft version 1
2. LinkedIn draft version 2
3. First comment with `https://t.me/zroaix`
4. Attached PNG image card
5. Optional animated SVG poster when requested
6. Optional MP4 poster when requested

Generated packages are cached in `linkedin-history.json` by source Telegram post id so the
same channel post is not regenerated accidentally. Add `force` to the command if you want
a fresh version:

```text
/generate_zroaix_linkedin force
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
| `src/linkedinBot.js` | private bot command for LinkedIn drafts |
