import config from './config.js';
import { aggregate } from './aggregate.js';
import { getTrending } from './trending.js';
import { curate } from './curate.js';
import { formatDigest, yerevanISO } from './format.js';
import { postToTelegram } from './post.js';
import { appendHistory } from './history.js';

const run = async () => {
  console.log(`[zroaix] starting${config.dry ? ' (dry run)' : ''}`);

  // Raw news and Hugging Face trending models in parallel.
  const [raw, trending] = await Promise.all([aggregate(), getTrending()]);
  console.log(`[zroaix] ${raw.length} raw news items, ${trending.length} trending models`);

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

  if (!items.length) {
    console.error('[zroaix] nothing to post — aborting');
    process.exit(1);
  }

  const text = formatDigest({ items, overview, releases, trending });

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
  });
  console.log(`[zroaix] history now holds ${count} day(s)`);
};

run()
  .then(() => process.exit(0)) // fetch keep-alive sockets would otherwise hang the process
  .catch((e) => {
    console.error('[zroaix] fatal:', e);
    process.exit(1);
  });
