import test from 'node:test';
import assert from 'node:assert/strict';

// config.js reads the environment at import time, so the token has to be set
// before the module graph loads — hence a file of its own (node --test gives
// each test file its own process).
process.env.GOOGLE_SITE_VERIFICATION = 'abc123"><script>x</script>';
const { renderDigestPage, renderIndex } = await import('../src/render.js');

const day = { date: '2026-08-02', ts: Date.parse('2026-08-02T16:45:13.816Z'), overview: 'Օրվա ամփոփում։', items: [] };

test('every page carries the Search Console tag when a token is configured', () => {
  for (const html of [renderDigestPage(day), renderIndex([day])]) {
    assert.match(html, /<meta name="google-site-verification" content="/);
    // A token is pasted from a web UI — it must not be able to open a tag.
    assert.doesNotMatch(html, /content="abc123"><script>/);
    assert.match(html, /content="abc123&quot;&gt;&lt;script&gt;/);
  }
});
