import config from './config.js';
import { aggregate } from './aggregate.js';
import { getTrending } from './trending.js';
import { curate } from './curate.js';
import { formatDigest, yerevanISO } from './format.js';
import { postToTelegram } from './post.js';
import { appendHistory, lastNDays, postedLinks, postedReleaseNames } from './history.js';

// How far back a story/release stays "already covered". The twice-daily 24h
// windows overlap, and outlets keep re-reporting for a couple of days.
const DEDUP_DAYS = 3;

const run = async () => {
  console.log(`[zroaix] starting${config.dry ? ' (dry run)' : ''}`);

  // Raw news (minus links already posted in recent digests) and Hugging Face
  // trending models in parallel.
  const exclude = postedLinks(DEDUP_DAYS);
  const [raw, trending] = await Promise.all([aggregate({ exclude }), getTrending()]);
  console.log(`[zroaix] ${raw.length} raw news items (${exclude.size} recent links excluded), ${trending.length} trending models`);

  if (!raw.length) {
    console.log('[zroaix] no new items since the last digest — nothing to post');
    return;
  }

  // Curate via Gemini; on failure there's nothing else to post, so abort.
  let items = [];
  let overview = '';
  let releases = [];
  try {
    ({ items, overview, releases } = await curate(raw));
    console.log(`[zroaix] curated ${items.length} items, ${releases.length} releases`);
  } catch (e) {
    console.error('[zroaix] curation failed:', e.message);
  }

  // Resolve each item's source index (1-based, into raw) to a real link + outlet.
  // Out-of-range/missing indexes just yield no link — the story still renders.
  items = items.map((it) => {
    const src = raw[Number(it.source) - 1];
    return { ...it, link: src?.link || null, outlet: src?.outlet || null };
  });
  console.log(`[zroaix] ${items.filter((it) => it.link).length}/${items.length} items linked to source`);

  if (!items.length) {
    console.error('[zroaix] nothing to post — aborting');
    process.exit(1);
  }

  // A release only gets the 🚀 spotlight once, even if outlets keep covering it.
  const seenReleases = postedReleaseNames(DEDUP_DAYS);
  const newReleases = releases.filter((r) => !seenReleases.has((r.name || '').toLowerCase()));
  if (newReleases.length < releases.length) {
    console.log(`[zroaix] dropped ${releases.length - newReleases.length} already-announced release(s)`);
  }
  releases = newReleases;

  // The HF trending line only earns its place when the lineup actually changed.
  const trendingIds = trending.map((t) => t.id);
  const prevTrendingIds = lastNDays(1)[0]?.trending || [];
  const trendingChanged = trendingIds.join() !== prevTrendingIds.join();
  if (!trendingChanged) console.log('[zroaix] trending unchanged — omitting the line');

  const text = formatDigest({ items, overview, releases, trending: trendingChanged ? trending : [] });

  if (config.dry) {
    if (config.print) {
      console.log('\n----- DIGEST PREVIEW -----\n');
      console.log(text.replace(/<\/?[bi]>/g, ''));
      console.log('\n--------------------------\n');
    }
    console.log('[zroaix] dry run — not posting');
    return;
  }

  const result = await postToTelegram(text);
  console.log(`[zroaix] posted message ${result.message_id} to ${config.channel}`);

  // Record this day's snapshot for the weekly recap (one entry per day).
  const count = appendHistory({
    date: yerevanISO(),
    ts: Date.now(),
    overview,
    items,
    releases,
    trending: trendingIds,
  });
  console.log(`[zroaix] history now holds ${count} day(s)`);
};

run()
  .then(() => process.exit(0)) // fetch keep-alive sockets would otherwise hang the process
  .catch((e) => {
    console.error('[zroaix] fatal:', e);
    process.exit(1);
  });
