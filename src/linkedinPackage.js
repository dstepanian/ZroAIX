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
  },
  required: ['professional', 'personal', 'firstComment', 'card'],
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
- Generate two LinkedIn posts:
  1. "professional": useful professional insight version.
  2. "personal": more human build-in-public version, written as the channel creator.
- Start each post with a strong hook.
- Each post must be 450-850 characters.
- Use exactly 4 short paragraphs separated by blank lines.
- Each paragraph must be 1-2 sentences.
- Focus on 1-3 strongest ideas, not every item in the source post.
- Do not sound like an ad.
- Explain why this matters for Armenian students, developers, founders, and tech professionals.
- Mention ZroAIX only near the end.
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
    'AI automation-ը արդեն փոքր թիմերի համար էլ իրական գործիք է դառնում։',
    '',
    'OpenAI-ի նոր գործիքը ցույց է տալիս մի կարևոր միտում․ AI agent-ները գնում են ոչ թե միայն demo-ների, այլ ամենօրյա workflow-ների կողմը։',
    '',
    'Հայաստանում սա կարող է օգտակար լինել հատկապես ուսանողների, developers-ի և founders-ի համար, որովհետև թույլ է տալիս արագ փորձարկել customer support, research և ներքին պրոցեսների ավտոմատացում։',
    '',
    'Նման կարճ AI ամփոփումներ հավաքում եմ ZroAIX-ում։ Link-ը comment-ում։',
    '',
    '#AI #Armenia',
  ].join('\n'),
  personal: [
    'Այսօր ZroAIX-ի համար նյութեր հավաքելիս մի բան նորից պարզ դարձավ․ AI-ի արժեքը արդեն ոչ թե “wow effect”-ն է, այլ ժամանակ խնայելը։',
    '',
    'OpenAI-ի agent workflow-ների ուղղությունը հետաքրքիր է, որովհետև փոքր թիմերը կարող են ավելի արագ փորձարկել գաղափարներ՝ առանց մեծ budget-ի։',
    '',
    'Ինձ համար սա հենց ZroAIX-ի պատճառներից մեկն է․ հայերենով ֆիլտրել այն նորությունները, որոնք կարող են գործնական արժեք ունենալ մեր tech համայնքի համար։',
    '',
    'Link-ը comment-ում։',
  ].join('\n'),
  firstComment: FIRST_COMMENT,
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

const normalizePackage = (post, parsed) => ({
  sourcePostId: post.id,
  sourceUrl: post.url,
  generatedAt: new Date().toISOString(),
  professional: compactLinkedInPost(parsed.professional),
  personal: compactLinkedInPost(parsed.personal),
  firstComment: FIRST_COMMENT,
  card: cleanCard(parsed.card),
});

export const createLinkedInPackage = async ({ force = false, sample = false, mock = false, save = true } = {}) => {
  const post = sample ? sampleChannelPost() : await fetchLatestChannelPost(config.sourceChannelUsername);
  const cached = findLinkedInPackage(post.id);
  if (cached && !force && !mock && save) {
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
`.trim();
