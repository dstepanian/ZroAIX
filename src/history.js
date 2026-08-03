import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'history.json');
// The weekly recap only needs the last 7 days, but history.json is also the
// source of the public archive — a day that falls out of here is a page that
// 404s and gets deindexed, so it holds a year.
const MAX_ENTRIES = Number(process.env.HISTORY_DAYS || 365);

export const loadHistory = () => {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// Union two lists, keeping the first occurrence per key.
const unionBy = (a = [], b = [], key) => {
  const seen = new Set();
  return [...a, ...b].filter((x) => {
    const k = key(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// Combine the day's earlier snapshot with a later run on the same day: union
// items by link and releases by name (the bot posts twice a day and both runs'
// stories matter for dedup and the weekly recap), keep the latest overview/trending.
const mergeDay = (prev, next) => ({
  ...next,
  items: unionBy(prev.items, next.items, (it) => it.link || it.headline),
  releases: unionBy(prev.releases, next.releases, (r) => (r.name || '').toLowerCase()),
});

// One entry per calendar day (Yerevan).
export const appendHistory = (entry) => {
  const hist = loadHistory();
  const idx = hist.findIndex((e) => e.date === entry.date);
  if (idx >= 0) hist[idx] = mergeDay(hist[idx], entry);
  else hist.push(entry);

  hist.sort((a, b) => (a.date < b.date ? -1 : 1));
  const trimmed = hist.slice(-MAX_ENTRIES);
  fs.writeFileSync(FILE, JSON.stringify(trimmed, null, 2) + '\n');
  return trimmed.length;
};

export const lastNDays = (n) => loadHistory().slice(-n);

// Links of every story posted in the last n days — used to drop already-covered
// raw feed items before curation (the twice-daily 24h windows overlap).
export const postedLinks = (n) => {
  const links = new Set();
  for (const day of lastNDays(n)) {
    for (const it of day.items || []) if (it.link) links.add(it.link);
  }
  return links;
};

// Lowercased release names announced in the last n days — a launch should only
// appear in the 🚀 section once, not in every digest that mentions it.
export const postedReleaseNames = (n) => {
  const names = new Set();
  for (const day of lastNDays(n)) {
    for (const r of day.releases || []) if (r.name) names.add(r.name.toLowerCase());
  }
  return names;
};
