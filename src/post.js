import config from './config.js';

export const postPhotoToTelegram = async (photoBuffer, caption) => {
  if (!config.token || !config.channel) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL missing');
  }

  const form = new FormData();
  form.append('chat_id', config.channel);
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  form.append('photo', new Blob([photoBuffer], { type: 'image/png' }), 'weekly.png');

  const res = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result;
};

// Post the digest to the Telegram channel via the Bot API (no deps).
export const postToTelegram = async (text) => {
  if (!config.token || !config.channel) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL missing');
  }

  const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.channel,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result;
};
