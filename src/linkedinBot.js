import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { createLinkedInPackage, formatPackageForConsole } from './linkedinPackage.js';
import {
  buildLinkedInAnimatedPosterSvg,
  renderLinkedInCardPng,
  writeLinkedInAnimatedPosterSvg,
  writeLinkedInCardPng,
} from './linkedinCard.js';
import { writeLinkedInAnimatedPosterMp4 } from './linkedinPosterVideo.js';
import { sendTelegramDocument, sendTelegramMessage, sendTelegramPhoto } from './post.js';

const args = new Set(process.argv.slice(2));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isOwner = (chatId) => config.ownerChatId && String(chatId) === String(config.ownerChatId);
const argValue = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.split('=').slice(1).join('=');
const themeFromText = (text = '') => {
  if (/\blight\b/i.test(text)) return 'light';
  if (/\bdark\b/i.test(text)) return 'dark';
  return argValue('--theme') || config.linkedinCardTheme;
};
const wantsAnimatedPoster = (text = '') => args.has('--animated') || args.has('--poster') || /\b(animated|poster|svg)\b/i.test(text);
const wantsPosterMp4 = (text = '') => args.has('--mp4') || /\b(mp4|video)\b/i.test(text);

const telegramApi = async (method, body) => {
  if (!config.token) throw new Error('TELEGRAM_BOT_TOKEN missing');
  const res = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method} error: ${data.description}`);
  return data.result;
};

const sendPackage = async ({
  chatId,
  force = false,
  sample = false,
  mock = false,
  theme = config.linkedinCardTheme,
  animatedPoster = false,
  posterMp4 = false,
}) => {
  const result = await createLinkedInPackage({ force, sample, mock });
  const { pkg, post, fromCache } = result;
  const png = await renderLinkedInCardPng(pkg.card, { theme });
  const cacheNote = fromCache ? '\n\n(Already generated before, sending cached draft.)' : '';

  await sendTelegramMessage(chatId, `LinkedIn draft 1:\n\n${pkg.professional}${cacheNote}`);
  await sendTelegramMessage(chatId, `LinkedIn draft 2:\n\n${pkg.personal}`);
  await sendTelegramMessage(chatId, `First comment:\n${pkg.firstComment}`);
  await sendTelegramPhoto(chatId, png, `ZroAIX LinkedIn card (${theme})\nSource: ${post.url}`, 'zroaix-linkedin-card.png');
  if (animatedPoster) {
    const svg = Buffer.from(buildLinkedInAnimatedPosterSvg(pkg.card, { theme }));
    await sendTelegramDocument(
      chatId,
      svg,
      `ZroAIX animated poster SVG (${theme})\nSource: ${post.url}`,
      'zroaix-animated-poster.svg',
      { contentType: 'image/svg+xml' }
    );
  }
  if (posterMp4) {
    const mp4Path = path.join(process.cwd(), 'out', 'zroaix-animated-poster.mp4');
    await writeLinkedInAnimatedPosterMp4(pkg.card, mp4Path, { theme });
    await sendTelegramDocument(
      chatId,
      fs.readFileSync(mp4Path),
      `ZroAIX animated poster MP4 (${theme})\nSource: ${post.url}`,
      'zroaix-animated-poster.mp4',
      { contentType: 'video/mp4' }
    );
  }
  return result;
};

const printPackage = async () => {
  const result = await createLinkedInPackage({
    force: args.has('--force'),
    sample: args.has('--sample'),
    mock: args.has('--mock'),
    save: !args.has('--mock'),
  });
  const outPath = path.join(process.cwd(), 'out', 'zroaix-linkedin-card.png');
  const posterPath = path.join(process.cwd(), 'out', 'zroaix-animated-poster.svg');
  const mp4Path = path.join(process.cwd(), 'out', 'zroaix-animated-poster.mp4');
  const theme = themeFromText();
  await writeLinkedInCardPng(result.pkg.card, outPath, { theme });
  if (wantsAnimatedPoster()) await writeLinkedInAnimatedPosterSvg(result.pkg.card, posterPath, { theme });
  if (wantsPosterMp4()) await writeLinkedInAnimatedPosterMp4(result.pkg.card, mp4Path, { theme });
  console.log(formatPackageForConsole(result));
  console.log(`\nTheme: ${theme}`);
  console.log(`PNG: ${outPath}`);
  if (wantsAnimatedPoster()) console.log(`Animated SVG: ${posterPath}`);
  if (wantsPosterMp4()) console.log(`MP4: ${mp4Path}`);
};

const runOnce = async () => {
  if (!config.ownerChatId) {
    throw new Error('OWNER_CHAT_ID missing. Send /start to the bot first, then put that chat id in .env.');
  }
  await sendPackage({
    chatId: config.ownerChatId,
    force: args.has('--force'),
    sample: args.has('--sample'),
    mock: args.has('--mock'),
    theme: themeFromText(),
    animatedPoster: wantsAnimatedPoster(),
    posterMp4: wantsPosterMp4(),
  });
};

const handleMessage = async (message) => {
  const chatId = message?.chat?.id;
  const text = (message?.text || '').trim();
  if (!chatId || !text) return;

  if (text.startsWith('/start')) {
    await sendTelegramMessage(
      chatId,
      [
        'ZroAIX LinkedIn draft bot is ready.',
        '',
        `Your chat id: ${chatId}`,
        'Put it in OWNER_CHAT_ID, then use /generate_zroaix_linkedin.',
        '',
        'Drafts are sent only to this private chat. The bot does not post to @zroaix or LinkedIn.',
      ].join('\n')
    );
    return;
  }

  if (text.startsWith('/generate_zroaix_linkedin')) {
    if (!isOwner(chatId)) {
      await sendTelegramMessage(chatId, 'This command is only allowed for OWNER_CHAT_ID.');
      return;
    }

    const theme = themeFromText(text);
    const animatedPoster = wantsAnimatedPoster(text);
    const posterMp4 = wantsPosterMp4(text);
    await sendTelegramMessage(
      chatId,
      `Generating today's LinkedIn drafts from @zroaix with ${theme} card theme${animatedPoster ? ' and animated poster' : ''}${
        posterMp4 ? ' and MP4 export' : ''
      }...`
    );
    await sendPackage({ chatId, force: text.includes('force'), theme, animatedPoster, posterMp4 });
  }
};

const runBot = async () => {
  if (!config.token) throw new Error('TELEGRAM_BOT_TOKEN missing');
  console.log('[linkedin-bot] polling for private commands');
  let offset = 0;

  while (true) {
    try {
      const updates = await telegramApi('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleMessage(update.message);
        } catch (e) {
          const chatId = update.message?.chat?.id;
          console.error('[linkedin-bot] command failed:', e.message);
          if (chatId) await sendTelegramMessage(chatId, `Generation failed: ${e.message}`).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[linkedin-bot] polling error:', e.message);
      await sleep(5000);
    }
  }
};

if (args.has('--print')) {
  printPackage().catch((e) => {
    console.error('[linkedin-bot] print failed:', e);
    process.exit(1);
  });
} else if (args.has('--once')) {
  runOnce().catch((e) => {
    console.error('[linkedin-bot] once failed:', e);
    process.exit(1);
  });
} else if (args.has('--health')) {
  const required = ['TELEGRAM_BOT_TOKEN', 'OWNER_CHAT_ID', 'GEMINI_API_KEY'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Missing: ${missing.join(', ')}`);
    process.exit(1);
  }
  fs.accessSync(process.cwd(), fs.constants.R_OK);
  console.log('OK');
} else {
  runBot().catch((e) => {
    console.error('[linkedin-bot] fatal:', e);
    process.exit(1);
  });
}
