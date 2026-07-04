import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { createLinkedInPackage, formatPackageForConsole } from './linkedinPackage.js';
import { renderLinkedInCardPng, writeLinkedInCardPng } from './linkedinCard.js';
import { sendTelegramMessage, sendTelegramPhoto } from './post.js';

const args = new Set(process.argv.slice(2));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isOwner = (chatId) => config.ownerChatId && String(chatId) === String(config.ownerChatId);
const argValue = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.split('=').slice(1).join('=');
const themeFromText = (text = '') => {
  if (/\blight\b/i.test(text)) return 'light';
  if (/\bdark\b/i.test(text)) return 'dark';
  return argValue('--theme') || config.linkedinCardTheme;
};

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

const sendPackage = async ({ chatId, force = false, sample = false, mock = false, theme = config.linkedinCardTheme }) => {
  const result = await createLinkedInPackage({ force, sample, mock });
  const { pkg, post, fromCache } = result;
  const png = await renderLinkedInCardPng(pkg.card, { theme });
  const cacheNote = fromCache ? '\n\n(Already generated before, sending cached draft.)' : '';

  await sendTelegramMessage(chatId, `LinkedIn draft 1:\n\n${pkg.professional}${cacheNote}`);
  await sendTelegramMessage(chatId, `LinkedIn draft 2:\n\n${pkg.personal}`);
  await sendTelegramMessage(chatId, `First comment:\n${pkg.firstComment}`);
  await sendTelegramPhoto(chatId, png, `ZroAIX LinkedIn card (${theme})\nSource: ${post.url}`, 'zroaix-linkedin-card.png');
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
  const theme = themeFromText();
  await writeLinkedInCardPng(result.pkg.card, outPath, { theme });
  console.log(formatPackageForConsole(result));
  console.log(`\nTheme: ${theme}`);
  console.log(`PNG: ${outPath}`);
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
    await sendTelegramMessage(chatId, `Generating today's LinkedIn drafts from @zroaix with ${theme} card theme...`);
    await sendPackage({ chatId, force: text.includes('force'), theme });
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
