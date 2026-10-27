// Local HTTP/middleware tests only. Placeholder configuration makes no remote requests.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_testconfiguration';
const app = require('../server');
let server;
let base;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await new Promise((resolve) => server.close(resolve)); });
test('health endpoint and security headers', async () => {
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { status: 'ok' } });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.equal(response.headers.get('x-powered-by'), null);
});
test('serves the frontend and assets from frontend only', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('Administrator login'));
  assert.equal((await fetch(base + '/styles.css')).status, 200);
  assert.equal((await fetch(base + '/app.js')).status, 200);
  for (const path of ['/backend/.env', '/.env', '/database/schema.sql', '/server.js']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
});
test('protects every student and reporting endpoint without remote calls', async () => {
  for (const [method, path] of [['GET','/api/students'], ['POST','/api/students'],
    ['PUT','/api/students/123'], ['DELETE','/api/students/123'],
    ['GET','/api/summary'], ['GET','/api/departments']]) {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.message, 'Please log in.');
  }
});
test('unknown API endpoint returns 404', async () => {
  assert.equal((await fetch(base + '/api/no-such-endpoint')).status, 404);
});
test('invalid login input and invalid JSON return friendly errors', async () => {
  const invalid = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bad' })
  });
  assert.equal(invalid.status, 400);
  const malformed = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json'
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.message, 'Request body must contain valid JSON.');
});
test('oversized JSON is rejected', async () => {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(20000) })
  });
  assert.equal(response.status, 413);
});
