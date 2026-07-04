import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'linkedin-history.json');
const MAX_ENTRIES = 120;

export const loadLinkedInHistory = () => {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const findLinkedInPackage = (sourcePostId) =>
  loadLinkedInHistory().find((entry) => entry.sourcePostId === sourcePostId) || null;

export const saveLinkedInPackage = (entry) => {
  const history = loadLinkedInHistory();
  const idx = history.findIndex((item) => item.sourcePostId === entry.sourcePostId);
  if (idx >= 0) history[idx] = entry;
  else history.push(entry);

  history.sort((a, b) => (a.generatedAt < b.generatedAt ? -1 : 1));
  const trimmed = history.slice(-MAX_ENTRIES);
  fs.writeFileSync(FILE, JSON.stringify(trimmed, null, 2) + '\n');
  return entry;
};
