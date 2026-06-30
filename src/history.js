import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'history.json');
const MAX_ENTRIES = 60; // ~2 months; weekly only needs the last 7

export const loadHistory = () => {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// One entry per calendar day (Yerevan). A later run on the same day overwrites
// the earlier snapshot, so we always keep the most recent state for that day.
export const appendHistory = (entry) => {
  const hist = loadHistory();
  const idx = hist.findIndex((e) => e.date === entry.date);
  if (idx >= 0) hist[idx] = entry;
  else hist.push(entry);

  hist.sort((a, b) => (a.date < b.date ? -1 : 1));
  const trimmed = hist.slice(-MAX_ENTRIES);
  fs.writeFileSync(FILE, JSON.stringify(trimmed, null, 2) + '\n');
  return trimmed.length;
};

export const lastNDays = (n) => loadHistory().slice(-n);
