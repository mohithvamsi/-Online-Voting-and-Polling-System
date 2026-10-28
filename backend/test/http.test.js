// These checks use placeholder configuration and never contact Supabase.
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_placeholder';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_placeholder';
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
test('HTTP boundaries, safe static serving and rejected invalid requests', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const root = await fetch(base);
  assert.equal(root.status, 200);
  assert((await root.text()).includes('PollRoom'));
  assert(root.headers.get('content-security-policy').includes("script-src 'self'"));
  for (const path of ['/styles.css', '/app.js']) assert.equal((await fetch(base + path)).status, 200);
  for (const path of ['/.env', '/backend/.env', '/database/schema.sql', '/package.json']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  assert.equal((await fetch(base + '/api/polls')).status, 401);
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  const post = (body, type = 'application/json') => fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': type }, body
  });
  assert.equal((await post('{')).status, 400);
  assert.equal((await post('text', 'text/plain')).status, 415);
  assert.equal((await post(JSON.stringify({ email: 'bad', password: '123' }))).status, 400);
  assert.equal((await post('')).status, 400);
});
