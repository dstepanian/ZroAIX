import config from './config.js';

const MONTHS_HY = [
  'հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի',
  'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի',
];

// Today's date in Yerevan, e.g. "28 հունիսի".
const yerevanDate = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Yerevan', day: 'numeric', month: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day').value;
  const month = Number(parts.find((p) => p.type === 'month').value);
  return `${day} ${MONTHS_HY[month - 1]}`;
};

// Today's calendar date in Yerevan as YYYY-MM-DD (used as the history key).
const yerevanISO = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yerevan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

// Armenian date range from two YYYY-MM-DD strings, e.g. "23–29 հունիսի"
// or "28 հունիսի – 4 հուլիսի" across a month boundary.
const yerevanRange = (startISO, endISO) => {
  const [, am, ad] = startISO.split('-').map(Number);
  const [, bm, bd] = endISO.split('-').map(Number);
  if (am === bm) return `${ad}–${bd} ${MONTHS_HY[bm - 1]}`;
  return `${ad} ${MONTHS_HY[am - 1]} – ${bd} ${MONTHS_HY[bm - 1]}`;
};

const esc = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Build the Telegram digest message (HTML parse mode).
// Airy layout: blank lines between blocks, 🔸 markers, bold labels.
export const formatDigest = ({ items = [], overview = '', releases = [], trending = [] }, { date } = {}) => {
  const out = [];

  out.push(`🤖 <b>AI օրվա ամփոփում — ${date || yerevanDate()}</b>`);
  out.push('');

  // AI big-picture line for the day.
  if (overview) {
    out.push(`🧠 ${esc(overview)}`);
    out.push('');
  }

  // Main news.
  if (items.length) {
    out.push('📰 <b>Գլխավոր նորություններ</b>');
    out.push('');
    items.forEach((it) => {
      const src = it.link
        ? `  <a href="${esc(it.link)}">🔗 ${esc(it.outlet || 'աղբյուր')}</a>`
        : '';
      out.push(`🔸 ${esc(it.summary || it.headline)}${src}`);
      out.push(''); // breathing room between stories
    });
  }

  // New model/product releases the editor flagged in today's items.
  if (releases.length) {
    out.push('🚀 <b>Թողարկումներ</b>');
    releases.forEach((r) => {
      out.push(`🔹 <b>${esc(r.name)}</b> — ${esc(r.note)}`);
    });
    out.push('');
  }

  // "Trending on Hugging Face" reference line — what the ML community is engaging with.
  if (trending.length) {
    const parts = trending.map((t) => {
      const task = t.task ? ` <i>(${esc(t.task)})</i>` : '';
      return `${esc(t.name)}${task}`;
    });
    out.push(`🔥 <b>Թրենդում Hugging Face-ում՝</b> ${parts.join(' · ')}`);
    out.push('');
  }

  out.push('➖➖➖➖➖➖➖➖➖➖');
  const handle = config.channelHandle ? `  |  ${esc(config.channelHandle)}` : '';
  out.push(`⚡ <b>${esc(config.siteUrl)}</b>${handle}`);

  return out.join('\n');
};

// Build the weekly recap message (HTML parse mode).
export const formatWeekly = (history, { overview = '', highlights = [] }) => {
  const out = [];
  const start = history[0]?.date;
  const end = history[history.length - 1]?.date;

  out.push(`📅 <b>Շաբաթվա ամփոփում — ${yerevanRange(start, end)}</b>`);
  out.push('');

  if (overview) {
    out.push(`🧠 ${esc(overview)}`);
    out.push('');
  }

  if (highlights.length) {
    out.push('📌 <b>Շաբաթվա գլխավոր թեմաները</b>');
    out.push('');
    highlights.forEach((h) => {
      out.push(`🔸 ${esc(h)}`);
      out.push('');
    });
    out.pop();
  }

  out.push('');
  out.push('➖➖➖➖➖➖➖➖➖➖');
  const handle = config.channelHandle ? `  |  ${esc(config.channelHandle)}` : '';
  out.push(`⚡ <b>${esc(config.siteUrl)}</b>${handle}`);

  return out.join('\n');
};

export { yerevanDate, yerevanISO };
