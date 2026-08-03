import 'dotenv/config';

const config = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  channel: process.env.TELEGRAM_CHANNEL,
  ownerChatId: process.env.OWNER_CHAT_ID,
  sourceChannelUsername: (process.env.SOURCE_CHANNEL_USERNAME || 'zroaix').replace(/^@/, ''),
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  siteUrl: process.env.SITE_URL || 'zromek.de',
  // Where the generated digest archive is published — canonical URLs, the
  // sitemap and the feed are absolute, so this has to match the real host exactly.
  siteBaseUrl: process.env.SITE_BASE_URL || 'https://dstepanian.github.io/ZroAIX',
  // Search Console token for the HTML-tag verification method. A github.io path
  // property can't be verified by DNS, and an uploaded HTML file wouldn't survive
  // the next `npm run site` — so the tag has to be rendered by the builder.
  googleVerification: process.env.GOOGLE_SITE_VERIFICATION || '',
  channelHandle: process.env.CHANNEL_HANDLE || process.env.TELEGRAM_CHANNEL || '',
  linkedinCardTheme: process.env.LINKEDIN_CARD_THEME || 'mono',
  digestMin: Number(process.env.DIGEST_MIN || 5),
  digestMax: Number(process.env.DIGEST_MAX || 6),
  // CLI flags
  dry: process.argv.includes('--dry'),
  print: process.argv.includes('--print'),
};

export default config;
