import config from './config.js';
import { esc, hyDate } from './format.js';

// Telegram gets the digest; this renders the same day into a page a crawler can
// read. t.me is a dead end for search — the archive is the only thing Google can
// index, so every day recorded in history.json becomes one static HTML page.

export const digestPath = (day) => `digest/${day.date}.html`;
const absolute = (p) => `${config.siteBaseUrl.replace(/\/$/, '')}/${p}`;

// Attribute values also have to survive a quote; the Telegram esc() only covers
// & < > because that is all Telegram's HTML parse mode cares about.
const attr = (s = '') => esc(s).replace(/"/g, '&quot;');

// history.json keeps the Yerevan calendar day plus the timestamp of the run that
// produced it. The timestamp is the precise one; the date key is the fallback.
const publishedAt = (day) =>
  (Number.isFinite(day.ts) ? new Date(day.ts).toISOString() : `${day.date}T20:00:00+04:00`);

const oneLine = (s = '') => s.replace(/\s+/g, ' ').trim();
const clamp = (s = '', n = 155) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

const title = (day) => `AI ամփոփում — ${hyDate(day.date)}`;

const summaryOf = (day) =>
  oneLine(day.overview || (day.items || []).map((it) => it.headline).join(' · '));

// https://developers.google.com/search/docs/appearance/structured-data/article
export const blogPostingLd = (day) => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title(day),
  description: clamp(summaryOf(day), 300),
  inLanguage: 'hy',
  datePublished: publishedAt(day),
  dateModified: publishedAt(day),
  mainEntityOfPage: { '@type': 'WebPage', '@id': absolute(digestPath(day)) },
  url: absolute(digestPath(day)),
  author: { '@type': 'Organization', name: 'ZroAIX', url: absolute('index.html') },
  publisher: {
    '@type': 'Organization',
    name: 'ZroAIX',
    url: absolute('index.html'),
    logo: { '@type': 'ImageObject', url: absolute('avatar.png') },
  },
  image: [absolute('avatar.png')],
  keywords: [
    'արհեստական բանականություն', 'AI նորություններ', 'տեխնոլոգիաներ',
    ...(day.releases || []).map((r) => r.name).filter(Boolean),
  ].join(', '),
  // The stories themselves: our Armenian headline, credited to the outlet that
  // reported it. Nothing here claims we are the original reporter.
  ...((day.items || []).length
    ? {
      mentions: day.items.map((it) => ({
        '@type': 'NewsArticle',
        headline: it.headline,
        ...(it.summary ? { description: oneLine(it.summary) } : {}),
        ...(it.link ? { url: it.link } : {}),
        ...(it.outlet
          ? { publisher: { '@type': 'Organization', name: it.outlet } }
          : {}),
      })),
    }
    : {}),
});

export const collectionLd = (days) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'ZroAIX — AI նորություններ հայերեն',
  description: `Արհեստական բանականության օրական ամփոփումներ հայերենով — ${days.length} օրվա արխիվ։`,
  inLanguage: 'hy',
  url: absolute('index.html'),
  mainEntity: {
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: days.length,
    itemListElement: days.map((day, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: title(day),
      url: absolute(digestPath(day)),
    })),
  },
});

// JSON-LD sits inside <script>, where the only dangerous sequence is a literal
// closing tag; escaping the slash keeps the payload valid JSON either way.
const ld = (data) => JSON.stringify(data, null, 2).replace(/<\//g, '<\\/');

const channelUrl = () => `https://t.me/${(config.channelHandle || 'zroaix').replace('@', '')}`;

const layout = ({ title: t, description, canonical, head = '', body }) => `<!doctype html>
<html lang="hy">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${attr(t)}</title>
<meta name="description" content="${attr(description)}">
${config.googleVerification ? `<meta name="google-site-verification" content="${attr(config.googleVerification)}">\n` : ''}<link rel="canonical" href="${attr(canonical)}">
<link rel="alternate" type="application/rss+xml" title="ZroAIX" href="${attr(absolute('feed.xml'))}">
<link rel="icon" href="${attr(absolute('avatar.png'))}">
<meta property="og:site_name" content="ZroAIX">
<meta property="og:title" content="${attr(t)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(absolute('avatar.png'))}">
<meta property="og:type" content="article">
<meta property="og:locale" content="hy_AM">
<meta name="twitter:card" content="summary">
<style>
:root { color-scheme: light dark; --fg: #10131a; --muted: #5b6472; --line: #e3e7ee; --bg: #fff; --accent: #2563eb; }
@media (prefers-color-scheme: dark) {
  :root { --fg: #e8ebf2; --muted: #98a2b3; --line: #262b36; --bg: #0e1116; --accent: #7aa2f7; }
}
* { box-sizing: border-box; }
body { margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 46rem; background: var(--bg); color: var(--fg);
  font: 1rem/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--accent); }
header { border-bottom: 1px solid var(--line); padding-bottom: 1rem; margin-bottom: 1.5rem; }
header a { text-decoration: none; font-weight: 700; font-size: 1.15rem; color: var(--fg); }
h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 .35rem; }
h2 { font-size: 1.15rem; margin: 2rem 0 .75rem; }
h3 { font-size: 1.05rem; margin: 0 0 .3rem; }
.date { color: var(--muted); margin: 0 0 1.25rem; font-size: 1.05rem; }
.overview { margin: 0 0 1.5rem; }
article.story { border-bottom: 1px solid var(--line); padding: 0 0 1rem; margin: 0 0 1.1rem; }
article.story p { margin: 0 0 .4rem; }
article.story .outlet { font-size: .9rem; }
ul.plain { list-style: none; padding: 0; margin: 0; }
ul.plain li { padding: .35rem 0; }
ul.days { list-style: none; padding: 0; margin: 0; }
ul.days li { border-bottom: 1px solid var(--line); padding: .9rem 0; }
ul.days a { font-weight: 600; text-decoration: none; }
ul.days p { margin: .2rem 0 0; color: var(--muted); font-size: .92rem; }
nav.pager { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; font-size: .95rem; }
footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; }
</style>
${head}
</head>
<body>
<header><a href="${attr(absolute('index.html'))}">ZroAIX — AI նորություններ հայերեն</a></header>
${body}
<footer>
<p>Օրական երկու ամփոփում Telegram-ում՝ <a href="${attr(channelUrl())}">${esc(config.channelHandle || '@zroaix')}</a></p>
</footer>
</body>
</html>
`;

const storyBlock = (it, i) => `
<article class="story" id="story-${i + 1}">
<h3>${esc(it.headline || '')}</h3>
${it.summary ? `<p>${esc(it.summary)}</p>` : ''}
${it.link
    ? `<p class="outlet"><a href="${attr(it.link)}" rel="noopener" target="_blank">Աղբյուրը՝ ${esc(it.outlet || 'հղում')}</a></p>`
    : (it.outlet ? `<p class="outlet">Աղբյուրը՝ ${esc(it.outlet)}</p>` : '')}
</article>`;

// prev/next keep every archived day reachable in a couple of hops even once the
// index stops listing the oldest ones.
const pager = (prev, next) => (prev || next
  ? `<nav class="pager">
${prev ? `<a href="${attr(absolute(digestPath(prev)))}">← ${esc(hyDate(prev.date))}</a>` : '<span></span>'}
${next ? `<a href="${attr(absolute(digestPath(next)))}">${esc(hyDate(next.date))} →</a>` : '<span></span>'}
</nav>`
  : '');

export const renderDigestPage = (day, { prev, next } = {}) => layout({
  title: `${title(day)} | ZroAIX`,
  description: clamp(summaryOf(day)),
  canonical: absolute(digestPath(day)),
  head: `<script type="application/ld+json">\n${ld(blogPostingLd(day))}\n</script>`,
  body: `
<h1>${esc(title(day))}</h1>
<p class="date"><time datetime="${attr(publishedAt(day))}">${esc(hyDate(day.date))}</time></p>
${day.overview ? `<p class="overview">${esc(day.overview)}</p>` : ''}
${(day.items || []).length ? `<h2>Գլխավոր նորություններ</h2>
${day.items.map(storyBlock).join('\n')}` : ''}
${(day.releases || []).length ? `<h2>Թողարկումներ</h2>
<ul class="plain">
${day.releases.map((r) => `<li><strong>${esc(r.name || '')}</strong> — ${esc(r.note || '')}</li>`).join('\n')}
</ul>` : ''}
${(day.trending || []).length ? `<h2>Թրենդում Hugging Face-ում</h2>
<ul class="plain">
${day.trending.map((id) => `<li><a href="${attr(`https://huggingface.co/${id}`)}" rel="noopener" target="_blank">${esc(id)}</a></li>`).join('\n')}
</ul>` : ''}
${pager(prev, next)}`,
});

export const renderIndex = (days) => layout({
  title: 'ZroAIX — AI նորություններ հայերեն',
  description: `Արհեստական բանականության օրական ամփոփումներ հայերենով՝ ${days.length} օրվա արխիվ։`,
  canonical: absolute('index.html'),
  head: `<script type="application/ld+json">\n${ld(collectionLd(days))}\n</script>`,
  body: `
<h1>AI նորությունների օրական ամփոփումներ</h1>
<p class="date">${days.length} օր արխիվում</p>
<ul class="days">
${days.map((day) => `<li>
  <a href="${attr(absolute(digestPath(day)))}">${esc(title(day))}</a>
  <p>${esc(clamp(summaryOf(day), 180))}</p>
</li>`).join('\n')}
</ul>`,
});

export const renderSitemap = (days) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(absolute('index.html'))}</loc>${days[0] ? `<lastmod>${esc(publishedAt(days[0]))}</lastmod>` : ''}</url>
${days.map((day) => `  <url><loc>${esc(absolute(digestPath(day)))}</loc><lastmod>${esc(publishedAt(day))}</lastmod></url>`).join('\n')}
</urlset>
`;

export const renderFeed = (days) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>ZroAIX — AI նորություններ հայերեն</title>
<link>${esc(absolute('index.html'))}</link>
<atom:link href="${esc(absolute('feed.xml'))}" rel="self" type="application/rss+xml"/>
<description>Արհեստական բանականության օրական ամփոփումներ հայերենով։</description>
<language>hy</language>
${days.map((day) => `<item>
<title>${esc(title(day))}</title>
<link>${esc(absolute(digestPath(day)))}</link>
<guid isPermaLink="true">${esc(absolute(digestPath(day)))}</guid>
<pubDate>${esc(new Date(publishedAt(day)).toUTCString())}</pubDate>
<description>${esc(clamp(summaryOf(day), 300))}</description>
</item>`).join('\n')}
</channel>
</rss>
`;

export const renderRobots = () => `User-agent: *
Allow: /
Sitemap: ${absolute('sitemap.xml')}
`;
