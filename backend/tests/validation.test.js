const test = require('node:test');
const assert = require('node:assert/strict');
const { studentInput, uuid } = require('../utils/validation');
const good = { roll_no: ' 26cse001 ', full_name: 'Demo Student', email: 'DEMO@example.com',
  phone: '', department_id: '1', year: '1', status: 'active', admission_date: '2026-01-01' };
test('normalizes roll number, email, and optional phone', () => {
  const student = studentInput(good);
  assert.equal(student.roll_no, '26CSE001');
  assert.equal(student.email, 'demo@example.com');
  assert.equal(student.phone, null);
});
test('rejects invalid student fields', () => {
  for (const patch of [{ year: 5 }, { year: 0 }, { department_id: 0 }, { status: 'admin' },
    { admission_date: '2026-02-30' }, { admission_date: '2999-01-01' }, { email: 'bad' },
    { phone: '123' }, { roll_no: 'x' }, { full_name: '' }]) {
    assert.throws(() => studentInput({ ...good, ...patch }), { status: 400 });
  }
});
test('rejects missing object and malformed UUID', () => {
  assert.throws(() => studentInput(null), { status: 400 });
  assert.throws(() => uuid('bad'), { status: 400 });
});
test('accepts a correctly shaped UUID', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  assert.equal(uuid(id), id);
});
