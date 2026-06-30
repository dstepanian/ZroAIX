import 'dotenv/config';

const config = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  channel: process.env.TELEGRAM_CHANNEL,
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  siteUrl: process.env.SITE_URL || 'zromek.de',
  channelHandle: process.env.CHANNEL_HANDLE || process.env.TELEGRAM_CHANNEL || '',
  digestMin: Number(process.env.DIGEST_MIN || 4),
  digestMax: Number(process.env.DIGEST_MAX || 6),
  // CLI flags
  dry: process.argv.includes('--dry'),
  print: process.argv.includes('--print'),
};

export default config;
