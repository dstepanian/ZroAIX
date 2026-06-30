import config from './config.js';
import { generateJson } from './gemini.js';

const buildPrompt = (rawItems, min, max) => `
You are an AI/technology news editor for an Armenian-speaking audience.
Below are ${rawItems.length} raw news items from the last 24 hours, drawn from AI and
tech outlets and lab blogs.

Your job:
1. Pick the ${min}-${max} most important / significant items. Prioritize real
   developments: new AI models and products, major research, funding and acquisitions,
   regulation and policy, and industry-shaping moves. Ignore low-quality posts, ads,
   thin opinion pieces, listicles, how-to/SEO filler, and near-duplicate stories.
2. Write each as ONE clear, neutral sentence in fluent Armenian (Eastern Armenian).
   Precision and tone scale with the stakes: for sensitive or high-stakes stories —
   armed conflict, casualties or deaths, military or government action, legal and
   criminal matters, safety incidents, or anything involving harm to people — be
   measured and exact. Preserve key qualifiers, attribute contested claims to their
   source (e.g. "ըստ զեկույցի", "ինչպես հաղորդվում է"), and do not sensationalize,
   speculate, make light of, or overstate certainty beyond what the source supports.
   Do not flatten such stories into a flippant one-liner.
3. Keep company, product, model and technical names in their original form
   (e.g. OpenAI, GPT-5, Gemini, Claude, NVIDIA, Hugging Face, Llama, ChatGPT, API) —
   do not transliterate them.
4. "headline" = a short Armenian title (max ~7 words). "summary" = one Armenian sentence.
   "source" = the NUMBER of the single raw item (from the numbered list below) that the
   story is primarily based on. If you merge several, pick the most important one.
5. "overview" = ONE or TWO sentences in Armenian capturing the OVERALL picture / theme of
   the day across all the items (the big trend, not a single story). Neutral, editorial tone.
6. "releases" = ONLY genuinely new model/product/tool launches or major version releases
   announced in today's items. For each: "name" in its original form (e.g. "Gemini 2.5",
   "Llama 4") and "note" = a short Armenian phrase saying what it is. If there are none,
   return an empty array. Do not invent releases.

Return ONLY JSON matching the schema. No markdown, no commentary.

Raw items:
${rawItems.map((it, n) => `${n + 1}. ${it.title}: ${it.text}`).join('\n')}
`.trim();

const dailySchema = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          summary: { type: 'string' },
          source: { type: 'integer' },
        },
        required: ['headline', 'summary', 'source'],
      },
    },
    releases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['name', 'note'],
      },
    },
  },
  required: ['overview', 'items'],
};

// Daily digest. Returns { overview, items: [{ headline, summary }], releases: [{ name, note }] }.
// Throws on failure so the caller can decide on a fallback.
export const curate = async (rawItems) => {
  if (!rawItems.length) return { overview: '', items: [], releases: [] };
  const parsed = await generateJson(buildPrompt(rawItems, config.digestMin, config.digestMax), dailySchema);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const releases = Array.isArray(parsed.releases) ? parsed.releases : [];
  return {
    overview: (parsed.overview || '').trim(),
    items: items.slice(0, config.digestMax),
    releases: releases.slice(0, 4),
  };
};

const buildWeeklyPrompt = (days) => `
You are an AI/technology news editor for an Armenian-speaking audience writing a WEEKLY recap.
Below are daily summaries from the past ${days.length} days (oldest first). Each day has its
overview and the day's headlines.

Your job:
1. "overview" = 2-3 sentences in fluent Eastern Armenian capturing the week's big arc —
   the dominant themes and how the AI/tech story evolved across the week.
2. "highlights" = the 4-6 most important developments of the WEEK as single Armenian
   sentences. Deduplicate stories that repeated across days, and focus on what mattered for
   the whole week rather than one-off daily noise. Keep company/product/model names original.

Return ONLY JSON matching the schema. No markdown, no commentary.

Daily data:
${days.map((d) => `## ${d.date}
Overview: ${d.overview || '—'}
Headlines:
${(d.items || []).map((i) => `- ${i.headline}: ${i.summary}`).join('\n')}`).join('\n\n')}
`.trim();

const weeklySchema = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    highlights: { type: 'array', items: { type: 'string' } },
  },
  required: ['overview', 'highlights'],
};

// Weekly recap. Returns { overview, highlights: [string] }.
export const curateWeekly = async (days) => {
  const parsed = await generateJson(buildWeeklyPrompt(days), weeklySchema);
  const highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
  return { overview: (parsed.overview || '').trim(), highlights: highlights.slice(0, 6) };
};
