import config from './config.js';

export const sendTelegramMessage = async (chatId, text, { parseMode, disableWebPagePreview = true } = {}) => {
  if (!config.token) {
    throw new Error('TELEGRAM_BOT_TOKEN missing');
  }
  if (!chatId) {
    throw new Error('Telegram chat_id missing');
  }

  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: disableWebPagePreview,
  };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result;
};

export const sendTelegramPhoto = async (chatId, photoBuffer, caption, filename = 'image.png', { parseMode } = {}) => {
  if (!config.token) {
    throw new Error('TELEGRAM_BOT_TOKEN missing');
  }
  if (!chatId) {
    throw new Error('Telegram chat_id missing');
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  if (parseMode) form.append('parse_mode', parseMode);
  form.append('photo', new Blob([photoBuffer], { type: 'image/png' }), filename);

  const res = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result;
};

export const postPhotoToTelegram = async (photoBuffer, caption) => {
  if (!config.token || !config.channel) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL missing');
  }

  return sendTelegramPhoto(config.channel, photoBuffer, caption, 'weekly.png', { parseMode: 'HTML' });
};

// Post the digest to the Telegram channel via the Bot API (no deps).
export const postToTelegram = async (text) => {
  if (!config.token || !config.channel) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL missing');
  }

  return sendTelegramMessage(config.channel, text, { parseMode: 'HTML', disableWebPagePreview: true });
};
