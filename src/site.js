import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import { loadHistory } from './history.js';
import {
  digestPath, renderDigestPage, renderFeed, renderIndex, renderRobots, renderSitemap,
} from './render.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site');

// Build the public archive from history.json. Static HTML, no client-side
// anything — the whole point is that a crawler sees the digest without running
// JavaScript, which is exactly what a t.me page never gives it.
const run = () => {
  // Newest first: the index reads as a feed and the pager runs backwards in time.
  const days = loadHistory()
    .filter((day) => day.date && ((day.items || []).length || day.overview))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Publishing an empty site would deindex every page we have. If history.json
  // didn't survive, that's a state problem to fix, not a site to deploy.
  if (!days.length) {
    console.error('[site] history is empty — refusing to build an empty site');
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'digest'), { recursive: true });

  days.forEach((day, i) => {
    // Newest first, so the *next* entry in the list is the older day.
    fs.writeFileSync(
      path.join(OUT, digestPath(day)),
      renderDigestPage(day, { prev: days[i + 1], next: days[i - 1] }),
    );
  });

  fs.writeFileSync(path.join(OUT, 'index.html'), renderIndex(days));
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), renderSitemap(days));
  fs.writeFileSync(path.join(OUT, 'feed.xml'), renderFeed(days));
  fs.writeFileSync(path.join(OUT, 'robots.txt'), renderRobots());
  fs.copyFileSync(path.join(ROOT, 'web', 'avatar.png'), path.join(OUT, 'avatar.png'));

  console.log(`[site] built ${days.length} digest page(s) into site/ for ${config.siteBaseUrl}`);
};

run();
