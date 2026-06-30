import config from './config.js';
import { lastNDays } from './history.js';
import { curateWeekly } from './curate.js';
import { formatWeekly } from './format.js';
import { postToTelegram } from './post.js';

const run = async () => {
  console.log(`[weekly] starting${config.dry ? ' (dry run)' : ''}`);

  const history = lastNDays(7);
  if (history.length < 2) {
    console.log(`[weekly] only ${history.length} day(s) of history — skipping until there's more`);
    return;
  }
  console.log(`[weekly] summarizing ${history.length} day(s): ${history[0].date} … ${history[history.length - 1].date}`);

  const summary = await curateWeekly(history);
  console.log(`[weekly] ${summary.highlights.length} highlights`);

  const text = formatWeekly(history, summary);

  if (config.dry) {
    if (config.print) {
      console.log('\n----- WEEKLY PREVIEW -----\n');
      console.log(text.replace(/<\/?[bi]>/g, ''));
      console.log('\n--------------------------\n');
    }
    console.log('[weekly] dry run — not posting');
    return;
  }

  const result = await postToTelegram(text);
  console.log(`[weekly] posted message ${result.message_id} to ${config.channel}`);
};

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[weekly] fatal:', e);
    process.exit(1);
  });
