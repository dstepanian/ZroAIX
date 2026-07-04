import config from './config.js';
import { generateJson } from './gemini.js';
import { fetchLatestChannelPost, sampleChannelPost } from './linkedinSource.js';
import { findLinkedInPackage, saveLinkedInPackage } from './linkedinHistory.js';
import { yerevanDate } from './format.js';

const FIRST_COMMENT = 'Ամենօրյա AI ամփոփումները հայերենով՝ https://t.me/zroaix';

const linkedinSchema = {
  type: 'object',
  properties: {
    professional: { type: 'string' },
    personal: { type: 'string' },
    firstComment: { type: 'string' },
    card: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
            },
            required: ['title', 'detail'],
          },
        },
      },
      required: ['headline', 'items'],
    },
    instagram: {
      type: 'object',
      properties: {
        informative: {
          type: 'object',
          properties: {
            armenian: { type: 'string' },
            english: { type: 'string' },
          },
          required: ['armenian', 'english'],
        },
        personal: {
          type: 'object',
          properties: {
            armenian: { type: 'string' },
            english: { type: 'string' },
          },
          required: ['armenian', 'english'],
        },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['informative', 'personal', 'hashtags'],
    },
  },
  required: ['professional', 'personal', 'firstComment', 'card', 'instagram'],
};

const buildPrompt = (post) => `
You are writing LinkedIn content for ZroAIX, a Telegram channel with AI news in Armenian.

Source Telegram post from @${post.username}:
${post.text}

Source links:
${post.links.length ? post.links.map((link) => `- ${link}`).join('\n') : '- none'}

Create a LinkedIn package in fluent Eastern Armenian.

Rules:
- Return ONLY JSON matching the schema.
- GOAL of both posts: introduce the ZroAIX channel to a LinkedIn audience that may be
  seeing it for the first time, using today's news as the hook, and invite them to subscribe.
- Make clear what ZroAIX is: a channel that reads the day's AI news and posts a short
  daily digest in Armenian — the important things only, in ~30 seconds a day.
- Generate two LinkedIn posts, same goal but different voice:
  1. "professional": a confident editor's-eye CONCLUSION about where AI is heading today.
     Big-picture "so what", not a walkthrough of individual stories.
  2. "personal": the channel creator's voice — today's takeaway and why you run ZroAIX.
- Start each post with a strong one-line hook (max ~14 words) stating the day's overall takeaway.
- Do NOT go story by story. Distill the source into ONE clear conclusion about the day.
  You may mention AT MOST ONE example briefly as proof — do not explain several news items.
- Each post must be 400-750 characters.
- Use 3-4 short paragraphs separated by blank lines. Each paragraph 1-2 sentences.
- End each post by inviting the reader to subscribe / follow ZroAIX for the daily AI digest.
  Because the clickable link lives in the first comment, write the invite WITHOUT a raw URL
  (e.g. "subscribe արեք ZroAIX-ին, Link-ը comment-ում").
- Be welcoming and inviting, but stay genuine and useful — do not sound spammy or hypey.
- In one line, say why it matters for Armenian students, developers, founders, and tech pros.
- Keep company/product/model names in their original form (OpenAI, Anthropic, Mistral, Claude, NVIDIA).
- Do NOT include Telegram URLs in professional or personal.
- Use 0-2 hashtags maximum.
- "firstComment" must be exactly: ${FIRST_COMMENT}
- The image/video card must be clean and readable.
- "card.headline" must be a short takeaway, 2-5 words, max 34 characters.
- "card.headline" must NOT include the date, "օրվա ամփոփում", "ամփոփում", or repeat the channel title.
- "card.items" must contain exactly 3 rows about the source post.
- Each card item needs:
  - "title": short Armenian topic, max 34 characters.
  - "detail": small explanatory Armenian line, 55-85 characters.
- Card text must not copy full source sentences. Rewrite it as designed card copy.
- Card items must not include labels like Signal, Impact, Action.

Also create Instagram captions in the "instagram" object:
- Two variants: "informative" (matches the professional post's tone) and "personal" (matches the personal post's tone).
- Each variant has "armenian" and "english": the SAME message written fully in fluent Eastern Armenian AND in natural, idiomatic English. The English is a real rewrite for an international audience, not a word-for-word translation.
- Each language version: strong hook on the first line, then 3-5 short lines, 300-700 characters.
- Do NOT put hashtags inside "armenian" or "english" (they go only in "hashtags").
- Do NOT put any URL inside the captions.
- "hashtags": 6-8 relevant hashtags mixing English and Armenian/topic tags (for example #AI #ArmenianTech #ZroAIX). Each must start with # and contain no spaces.
`.trim();

const cleanLinkedInPost = (text = '') =>
  String(text)
    .replace(/([։!?]|(?<!\d)\.(?!\d))(?=\S)/gu, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

const sentenceParts = (text) => text.match(/[^։!?]+[։!?]+|[^։!?]+$/gu)?.map((s) => s.trim()).filter(Boolean) || [];

const compactLinkedInPost = (text, maxChars = 1000) => {
  const cleaned = cleanLinkedInPost(text);
  if (cleaned.length <= maxChars) return cleaned;

  const cta = 'Նման կարճ AI ամփոփումներ հավաքում եմ ZroAIX-ում։ Link-ը comment-ում։';
  const hashtags = cleaned.match(/#[\p{L}\p{N}_-]+/gu)?.slice(0, 2).join(' ') || '';
  const sentences = sentenceParts(cleaned.replace(/#[\p{L}\p{N}_-]+/gu, ''));
  const picked = [];

  for (const sentence of sentences) {
    const candidate = [...picked, sentence, cta, hashtags].filter(Boolean).join('\n\n');
    if (candidate.length > maxChars) break;
    picked.push(sentence);
    if (picked.length >= 4) break;
  }

  return [...picked, cta, hashtags].filter(Boolean).join('\n\n').trim();
};

const stripCardHeadlineNoise = (text = '') =>
  String(text)
    .replace(/AI[-ի\s]*օրվա\s*ամփոփում[:：]?/giu, '')
    .replace(/օրվա\s*ամփոփում[:：]?/giu, '')
    .replace(/ամփոփում[:：]?/giu, '')
    .replace(/հուլիսի\s*\d+/giu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const compactCardPhrase = (text = '', maxChars = 42) => {
  const cleaned = String(text)
    .replace(/^[•\-\d.)\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxChars) return cleaned;

  const firstClause = cleaned.split(/[։:.,;՝]/u)[0]?.trim();
  if (firstClause && firstClause.length <= maxChars) return firstClause;

  const words = cleaned.split(/\s+/u);
  const picked = [];
  for (const word of words) {
    const candidate = [...picked, word].join(' ');
    if (candidate.length > maxChars) break;
    picked.push(word);
  }
  return picked.join(' ').trim() || cleaned.slice(0, maxChars).trim();
};

const cleanCardRows = (card = {}) => {
  const rawItems = Array.isArray(card.items)
    ? card.items
    : (Array.isArray(card.bullets) ? card.bullets : []).map((item) => ({ title: item, detail: '' }));
  const rows = rawItems
    .map((item) => {
      if (typeof item === 'string') {
        return { title: compactCardPhrase(item, 34), detail: '' };
      }
      return {
        title: compactCardPhrase(item?.title, 34),
        detail: compactCardPhrase(item?.detail, 90),
      };
    })
    .filter((item) => item.title || item.detail)
    .slice(0, 3);

  const fallback = [
    { title: 'AI-ը մտնում է workflow', detail: 'Թիմերը կարող են փորձարկել ավտոմատացում փոքր քայլերով' },
    { title: 'Գործնական արժեքը աճում է', detail: 'Նոր գործիքները մոտենում են ամենօրյա աշխատանքին' },
    { title: 'Փորձարկելու պահն է', detail: 'Հայ tech թիմերի համար սա արագ սովորելու հնարավորություն է' },
  ];
  return [...rows, ...fallback].slice(0, 3);
};

const cleanCard = (card = {}) => ({
  headline: compactCardPhrase(stripCardHeadlineNoise(card.headline || 'AI փոփոխություն'), 34) || 'AI փոփոխություն',
  bullets: cleanCardRows(card).map((item) => item.title),
  items: cleanCardRows(card),
  date: yerevanDate(),
});

export const buildMockLinkedInPackage = (post = sampleChannelPost()) => ({
  sourcePostId: post.id,
  sourceUrl: post.url,
  generatedAt: new Date().toISOString(),
  professional: [
    'Այսօրվա AI-ի գլխավոր եզրակացությունը մեկ նախադասությամբ․ AI-ն արագ դառնում է ամենօրյա գործիք, ոչ թե ապագայի խոստում։',
    '',
    'Ամեն օր կարդում եմ տասնյակ աղբյուրներ և ZroAIX-ում հավաքում եմ միայն այն AI նորությունները, որոնք իրոք կարևոր են՝ կարճ, հայերեն ամփոփումով։',
    '',
    'Հայ ուսանողների, developers-ի և founders-ի համար սա հնարավորություն է հետևել ոլորտին՝ առանց ամբողջ օրը նորություններ կարդալու։',
    '',
    'Ուզո՞ւմ եք ամեն օր ստանալ AI-ի գլխավորը հայերենով՝ subscribe արեք ZroAIX-ին։ Link-ը comment-ում։',
    '',
    '#AI #ArmenianTech',
  ].join('\n'),
  personal: [
    'Ինչու՞ եմ ամեն օր ZroAIX-ի համար նյութ հավաքում․ որովհետև AI-ի արագությանը մենակ հետևելը դժվար է։',
    '',
    'Այսօրվա ընդհանուր պատկերը պարզ է՝ գործիքները մոտենում են գործնական աշխատանքին, և ով շուտ է փորձարկում, առաջ է անցնում։',
    '',
    'ZroAIX-ը իմ փորձն է՝ ֆիլտրել աղմուկը և հայերենով տալ օրվա ամենակարևոր AI նորությունը՝ 30 վայրկյանում։',
    '',
    'Միացե՛ք համայնքին և subscribe արեք, որ ոչ մի կարևոր բան բաց չթողնեք։ Link-ը comment-ում։',
  ].join('\n'),
  firstComment: FIRST_COMMENT,
  instagram: {
    informative: [
      'AI automation-ը արդեն փոքր թիմերի գործիք է։',
      '',
      'OpenAI-ի նոր քայլը ցույց է տալիս, որ agent-ները գնում են ամենօրյա workflow-ների կողմը։',
      '',
      'Հայ ուսանողների ու developers-ի համար սա արագ փորձարկելու առիթ է։',
      '',
      '· · ·',
      '',
      'AI automation is already a real tool for small teams.',
      '',
      "OpenAI's latest move shows agents are heading into everyday workflows, not just demos.",
      '',
      'For Armenian students and developers, this is a fast, low-cost way to experiment.',
      '',
      IG_LINK_NOTE,
      '',
      '#AI #ArmenianTech #ZroAIX #Automation #TechArmenia #ArtificialIntelligence',
    ].join('\n'),
    personal: [
      'ZroAIX-ի համար նյութ հավաքելիս նորից համոզվեցի՝ AI-ի արժեքը ժամանակ խնայելն է։',
      '',
      'Փոքր թիմերը հիմա կարող են գաղափար փորձարկել առանց մեծ budget-ի։',
      '',
      '· · ·',
      '',
      'While gathering material for ZroAIX, I was reminded that AI’s real value is saving time.',
      '',
      'Small teams can now test an idea without a big budget.',
      '',
      IG_LINK_NOTE,
      '',
      '#AI #ArmenianTech #ZroAIX #BuildInPublic #TechArmenia #Startups',
    ].join('\n'),
  },
  card: {
    headline: 'AI-ը դառնում է գործիք',
    bullets: ['Ավտոմատացումը մոտենում է թիմերին', 'Գործնական արժեքն աճում է', 'Փորձարկելու պահն է'],
    items: [
      {
        title: 'Ավտոմատացումը մոտենում է թիմերին',
        detail: 'AI agent-ները արդեն օգտակար են փոքր աշխատանքային հոսքերում',
      },
      {
        title: 'Գործնական արժեքն աճում է',
        detail: 'Նոր գործիքները օգնում են արագացնել research եւ support-ը',
      },
      {
        title: 'Փորձարկելու պահն է',
        detail: 'Հայ tech թիմերը կարող են փոքր փորձերով հասկանալ արժեքը',
      },
    ],
  },
});

const IG_LINK_NOTE = '🔗 Ամենօրյա AI ամփոփումներ հայերենով · Link in bio · t.me/zroaix';

const tidyCaption = (text = '') =>
  String(text)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const cleanHashtags = (tags = [], max = 8) => {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const tag = String(raw).trim().replace(/\s+/g, '').replace(/^#*/, '#');
    if (tag.length < 2) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out.length ? out : ['#AI', '#ArmenianTech', '#ZroAIX'];
};

// Armenian block first, then a divider, then the English rewrite, then the
// "link in bio" note and the hashtag line — one bilingual Instagram caption.
const buildInstagramCaption = (variant = {}, hashtags = []) =>
  [
    tidyCaption(variant.armenian),
    '· · ·',
    tidyCaption(variant.english),
    IG_LINK_NOTE,
    cleanHashtags(hashtags).join(' '),
  ]
    .filter(Boolean)
    .join('\n\n');

const normalizeInstagram = (instagram = {}) => ({
  informative: buildInstagramCaption(instagram.informative, instagram.hashtags),
  personal: buildInstagramCaption(instagram.personal, instagram.hashtags),
});

const normalizePackage = (post, parsed) => ({
  sourcePostId: post.id,
  sourceUrl: post.url,
  generatedAt: new Date().toISOString(),
  professional: compactLinkedInPost(parsed.professional),
  personal: compactLinkedInPost(parsed.personal),
  firstComment: FIRST_COMMENT,
  card: cleanCard(parsed.card),
  instagram: normalizeInstagram(parsed.instagram),
});

export const createLinkedInPackage = async ({ force = false, sample = false, mock = false, save = true } = {}) => {
  const post = sample ? sampleChannelPost() : await fetchLatestChannelPost(config.sourceChannelUsername);
  const cached = findLinkedInPackage(post.id);
  // Only reuse a cache entry that already has the Instagram captions — older
  // entries were saved before that field existed, so treat them as a miss and
  // regenerate to fill in the bilingual captions.
  if (cached && cached.instagram && !force && !mock && save) {
    return { post, pkg: cached, fromCache: true };
  }

  const pkg = mock ? buildMockLinkedInPackage(post) : normalizePackage(post, await generateJson(buildPrompt(post), linkedinSchema));
  if (pkg.card.bullets.length < 3) {
    pkg.card.bullets = [...pkg.card.bullets, 'Կարճ ու գործնական ամփոփում', 'Հայերեն AI news', '@zroaix'].slice(0, 3);
  }
  if (save) saveLinkedInPackage(pkg);
  return { post, pkg, fromCache: false };
};

export const formatPackageForConsole = ({ post, pkg, fromCache = false }) => `
Source: ${post.url}
${fromCache ? 'Mode: cached\n' : ''}LinkedIn Post 1:

${pkg.professional}

LinkedIn Post 2:

${pkg.personal}

First comment:
${pkg.firstComment}

Card:
${pkg.card.headline}
${(pkg.card.items || (pkg.card.bullets || []).map((bullet) => ({ title: bullet, detail: '' })))
  .map((item) => `- ${item.title}${item.detail ? `\n  ${item.detail}` : ''}`)
  .join('\n')}
${
  pkg.instagram
    ? `
Instagram caption 1 (informative):

${pkg.instagram.informative}

Instagram caption 2 (personal):

${pkg.instagram.personal}`
    : ''
}
`.trim();
