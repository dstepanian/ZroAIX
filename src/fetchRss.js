import RSSParser from 'rss-parser';

const parser = new RSSParser({
  timeout: 15000,
  headers: { 'User-Agent': 'zroaix/1.0 (+https://zromek.de)' },
});

const fetchFeed = async (url) => {
  try {
    return await parser.parseURL(url);
  } catch (e) {
    console.error('Feed error:', url, e.message);
    return { items: [] };
  }
};

// Fetch all feeds in parallel; failures yield empty item lists.
export const fetchFeeds = async (urls) => {
  const results = await Promise.all(urls.map(fetchFeed));
  return results;
};
