import { fetchFeeds } from './fetchRss.js';
import { FEEDS } from './feeds.js';

const stripHtml = (s = '') =>
  s.replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Pull all feeds, keep items from the last 24h, dedupe by link, cap the list.
export const aggregate = async ({ windowMs = WINDOW_MS, cap = 40 } = {}) => {
  const feeds = await fetchFeeds(FEEDS);
  const now = Date.now();
  const seen = new Set();
  const items = [];

  for (const feed of feeds) {
    const source = feed.title || '';
    for (const item of feed.items || []) {
      const link = (item.link || '').trim();
      if (!link || seen.has(link)) continue;

      const ts = new Date(item.isoDate || item.pubDate || 0).getTime();
      if (!ts || now - ts > windowMs) continue;

      seen.add(link);
      items.push({
        title: (item.title || '').trim(),
        text: stripHtml(item.contentSnippet || item.content || '').slice(0, 400),
        link,
        source,
        date: ts,
      });
    }
  }

  items.sort((a, b) => b.date - a.date);
  return items.slice(0, cap);
};
