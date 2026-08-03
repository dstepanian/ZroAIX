import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blogPostingLd, collectionLd, digestPath, renderDigestPage, renderFeed, renderSitemap,
} from '../src/render.js';
import { hyDate } from '../src/format.js';

const day = {
  date: '2026-07-04',
  ts: Date.parse('2026-07-04T16:22:46.933Z'),
  overview: 'Օրվա գլխավոր թեման AI մոդելների զարգացումն է։',
  items: [
    {
      headline: 'Anthropic-ը մեկնարկում է դեղերի մշակման ծրագրեր',
      summary: 'Anthropic-ը սկսում է դեղերի մշակման սեփական ծրագրերը։',
      link: 'https://the-decoder.com/anthropic-launches-drug-discovery/',
      outlet: 'The Decoder',
    },
  ],
  releases: [{ name: 'Leanstral 1.5', note: 'բաց կոդով մոդել Lean 4-ի համար' }],
  trending: ['mistralai/Leanstral-1.5'],
};

test('an Armenian date renders from the history key alone', () => {
  assert.equal(hyDate('2026-07-04'), 'հուլիսի 4, 2026');
  assert.equal(hyDate('2026-01-31'), 'հունվարի 31, 2026');
  // A malformed key must not produce "undefined NaN" in a title.
  assert.equal(hyDate('nonsense'), 'nonsense');
});

test('BlogPosting carries the fields Google needs for an article', () => {
  const ld = blogPostingLd(day);
  assert.equal(ld['@type'], 'BlogPosting');
  assert.equal(ld.headline, 'AI ամփոփում — հուլիսի 4, 2026');
  assert.equal(ld.inLanguage, 'hy');
  assert.equal(ld.datePublished, '2026-07-04T16:22:46.933Z');
  assert.equal(ld.publisher.name, 'ZroAIX');
  assert.match(ld.mainEntityOfPage['@id'], /\/digest\/2026-07-04\.html$/);
  // Each story is credited to the outlet that actually reported it.
  assert.equal(ld.mentions[0].publisher.name, 'The Decoder');
  assert.equal(ld.mentions[0].url, day.items[0].link);
});

test('a day with no timestamp still dates itself from the calendar key', () => {
  const ld = blogPostingLd({ ...day, ts: undefined });
  assert.equal(ld.datePublished, '2026-07-04T20:00:00+04:00');
  assert.equal(new Date(ld.datePublished).toISOString(), '2026-07-04T16:00:00.000Z');
});

test('the rendered page embeds valid, non-breaking JSON-LD', () => {
  const hostile = '</script><script>alert(1)</script> "quoted"';
  const html = renderDigestPage({
    ...day,
    overview: hostile,
    items: [{ ...day.items[0], headline: hostile, link: `https://x.test/?a="b` }],
  });
  const embedded = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/)[1];

  assert.doesNotMatch(embedded, /<\/script>/, 'a headline cannot break out of the JSON-LD block');
  assert.equal(JSON.parse(embedded)['@type'], 'BlogPosting');
  // A quote in a summary or a source URL must not escape its attribute.
  assert.match(html, /content="[^"]*&quot;quoted&quot;/);
  assert.match(html, /href="https:\/\/x\.test\/\?a=&quot;b"/);
  assert.doesNotMatch(html.replace(embedded, ''), /<script>alert/, 'nothing escapes into the page body');
});

test('a page links its stories, releases and trending models out', () => {
  const html = renderDigestPage(day);
  assert.match(html, /The Decoder/);
  assert.match(html, /Leanstral 1\.5/);
  assert.match(html, /huggingface\.co\/mistralai\/Leanstral-1\.5/);
  assert.match(html, /rel="canonical" href="[^"]*\/digest\/2026-07-04\.html"/);
});

test('the pager walks backwards in time and stops at both ends', () => {
  const older = { ...day, date: '2026-07-03' };
  const newer = { ...day, date: '2026-07-05' };
  const middle = renderDigestPage(day, { prev: older, next: newer });
  assert.match(middle, /← հուլիսի 3, 2026/);
  assert.match(middle, /հուլիսի 5, 2026 →/);
  assert.doesNotMatch(renderDigestPage(day), /class="pager"/);
});

test('sitemap and feed list the index and every day', () => {
  const days = [day, { ...day, date: '2026-07-03' }];
  const xml = renderSitemap(days);
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.equal([...xml.matchAll(/<loc>/g)].length, 3, 'index + 2 days');

  const feed = renderFeed(days);
  assert.equal([...feed.matchAll(/<item>/g)].length, 2);
  assert.match(feed, /<pubDate>Sat, 04 Jul 2026 16:22:46 GMT<\/pubDate>/);
});

test('the index advertises every day as an ordered list', () => {
  const ld = collectionLd([day, { ...day, date: '2026-07-03' }]);
  assert.equal(ld.mainEntity.numberOfItems, 2);
  assert.equal(ld.mainEntity.itemListElement[0].position, 1);
  assert.match(ld.mainEntity.itemListElement[1].url, /2026-07-03/);
});

test('paths are ascii and derived from the calendar day', () => {
  assert.equal(digestPath(day), 'digest/2026-07-04.html');
});
