const test = require('node:test');
const assert = require('node:assert/strict');
const { credentials, uuid, pollInput, result } = require('../utils/validation');
const now = Date.UTC(2026, 0, 1);
const valid = () => ({ title: 'Choose a workshop day', description: '', options: ['Saturday', 'Sunday'], ends_at: new Date(now + 3600000).toISOString() });
test('normalizes email but preserves password spaces', () => {
  assert.deepEqual(credentials({ email: ' Student@Example.com ', password: ' pass word ' }), { email: 'student@example.com', password: ' pass word ' });
});
test('rejects malformed emails and weak passwords', () => {
  assert.throws(() => credentials({ email: 'abc', password: 'password123' }), { status: 400 });
  assert.throws(() => credentials({ email: 'a@b.com', password: '123' }), { status: 400 });
});
test('accepts UUIDs and rejects injection-like IDs', () => {
  assert.equal(uuid('00000000-0000-4000-8000-000000000001'), '00000000-0000-4000-8000-000000000001');
  assert.throws(() => uuid("1 or 1=1"), { status: 400 });
});
test('validates a complete poll', () => assert.equal(pollInput(valid(), now).options.length, 2));
test('rejects case-insensitive duplicate choices', () => {
  assert.throws(() => pollInput({ ...valid(), options: ['Yes', ' yes '] }, now), { status: 400 });
});
test('rejects invalid, past and out-of-range deadlines', () => {
  for (const ends_at of ['bad', new Date(now-1).toISOString(), new Date(now+31*86400000).toISOString()]) {
    assert.throws(() => pollInput({ ...valid(), ends_at }, now), { status: 400 });
  }
});
test('rejects missing and excessive choices', () => {
  for (const options of [null, ['Only'], Array.from({ length: 7 }, (_, i) => String(i))]) {
    assert.throws(() => pollInput({ ...valid(), options }, now), { status: 400 });
  }
});
test('does not leak raw database errors', () => {
  assert.throws(() => result({ error: { code: 'UNKNOWN', message: 'private database detail' } }), { status: 503, message: 'Database unavailable. Try again shortly.' });
  assert.throws(() => result({ error: { code: '23505' } }), { status: 409 });
});
