const decodeHtml = (html = '') =>
  html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cleanText = (html = '') =>
  decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const parseMessageBlocks = (html) =>
  html
    .split(/<div class="tgme_widget_message_wrap\b/g)
    .slice(1)
    .map((block) => `<div class="tgme_widget_message_wrap${block}`);

const extractLinks = (html = '') => {
  const links = [];
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const url = decodeHtml(match[1]);
    if (!url.startsWith('https://')) continue;
    if (url.includes('t.me/s/')) continue;
    if (!links.includes(url)) links.push(url);
  }
  return links.slice(0, 5);
};

export const parseLatestChannelPost = (html, username) => {
  const posts = parseMessageBlocks(html)
    .map((block) => {
      const id = block.match(/data-post="([^"]+)"/)?.[1];
      const textHtml = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
      const datetime = block.match(/datetime="([^"]+)"/)?.[1] || null;
      const text = cleanText(textHtml);
      return {
        id,
        username,
        url: id ? `https://t.me/${id}` : `https://t.me/${username}`,
        datetime,
        text,
        links: extractLinks(textHtml),
      };
    })
    .filter((post) => post.id && post.text && !post.text.includes('This media is not supported'));

  return posts.at(-1) || null;
};

export const fetchLatestChannelPost = async (username) => {
  const cleanUsername = username.replace(/^@/, '');
  const res = await fetch(`https://t.me/s/${cleanUsername}`, {
    headers: {
      'user-agent': 'Mozilla/5.0 zroaix-linkedin-bot',
      accept: 'text/html',
    },
  });

  if (!res.ok) {
    throw new Error(`Could not fetch @${cleanUsername}: HTTP ${res.status}`);
  }

  const latest = parseLatestChannelPost(await res.text(), cleanUsername);
  if (!latest) {
    throw new Error(`No public preview posts found for @${cleanUsername}`);
  }
  return latest;
};

export const sampleChannelPost = () => ({
  id: 'zroaix/sample',
  username: 'zroaix',
  url: 'https://t.me/zroaix',
  datetime: new Date().toISOString(),
  text: [
    'OpenAI-ը ներկայացրել է նոր գործիք, որը օգնում է թիմերին արագ կառուցել AI agent-ներ աշխատանքի ավտոմատացման համար։',
    '',
    'Գործիքը կարևոր է հատկապես փոքր թիմերի համար, քանի որ թույլ է տալիս առանց մեծ ինժեներական ռեսուրսի փորձարկել հաճախորդների սպասարկման, տվյալների վերլուծության և ներքին workflow-ների ավտոմատացում։',
  ].join('\n'),
  links: ['https://openai.com/'],
});
