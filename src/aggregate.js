import { fetchFeeds } from './fetchRss.js';
import { FEEDS } from './feeds.js';

const stripHtml = (s = '') =>
  s.replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Pretty outlet names keyed by domain — the RSS feed title is often messy
// ("AI News & Artificial Intelligence | TechCrunch"), so we derive from the link.
const OUTLETS = {
  'techcrunch.com': 'TechCrunch',
  'venturebeat.com': 'VentureBeat',
  'theverge.com': 'The Verge',
  'arstechnica.com': 'Ars Technica',
  'technologyreview.com': 'MIT Tech Review',
  'the-decoder.com': 'The Decoder',
  'huggingface.co': 'Hugging Face',
  'openai.com': 'OpenAI',
  'deepmind.google': 'DeepMind',
  'simonwillison.net': 'Simon Willison',
};

// Clean outlet name from a URL: known map first, else prettify the bare domain.
const outletName = (link = '') => {
  try {
    const host = new URL(link).hostname.replace(/^www\./, '');
    if (OUTLETS[host]) return OUTLETS[host];
    const base = host.split('.').slice(-2, -1)[0] || host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return '';
  }
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Pull all feeds, keep items from the last 24h, dedupe by link, cap the list.
// `exclude` = links already posted in recent digests, skipped before the cap.
export const aggregate = async ({ windowMs = WINDOW_MS, cap = 40, exclude = new Set() } = {}) => {
  const feeds = await fetchFeeds(FEEDS);
  const now = Date.now();
  const seen = new Set();
  const items = [];

  for (const feed of feeds) {
    const source = feed.title || '';
    for (const item of feed.items || []) {
      const link = (item.link || '').trim();
      if (!link || seen.has(link) || exclude.has(link)) continue;

      const ts = new Date(item.isoDate || item.pubDate || 0).getTime();
      if (!ts || now - ts > windowMs) continue;

      seen.add(link);
      items.push({
        title: (item.title || '').trim(),
        text: stripHtml(item.contentSnippet || item.content || '').slice(0, 400),
        link,
        source,
        outlet: outletName(link),
        date: ts,
      });
    }
  }

  items.sort((a, b) => b.date - a.date);
  return items.slice(0, cap);
};
