const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { studentInput, uuid } = require('../utils/validation');
const { httpError, databaseResult } = require('../utils/errors');
const router = express.Router();
const columns = 'id,roll_no,full_name,email,phone,department_id,year,status,admission_date,created_at,updated_at,departments(code,name)';
// Apply authorization only to the actual protected endpoint families.
router.use(['/departments', '/summary', '/students'], requireAdmin);
router.get('/departments', async (req, res) => {
  const result = databaseResult(await req.db.from('departments').select('id,code,name').order('name'));
  res.json({ data: result.data });
});
router.get('/summary', async (req, res) => {
  const results = await Promise.all([
    req.db.from('students').select('id', { count: 'exact', head: true }),
    req.db.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    req.db.from('students').select('id', { count: 'exact', head: true }).eq('status', 'graduated'),
    req.db.from('departments').select('id', { count: 'exact', head: true })
  ]);
  results.forEach(databaseResult);
  res.json({ data: { total: results[0].count, active: results[1].count,
    graduated: results[2].count, departments: results[3].count } });
});
router.get('/students', async (req, res) => {
  const pageText = req.query.page === undefined ? '1' : req.query.page;
  const q = req.query.q === undefined ? '' : req.query.q;
  const department = req.query.department_id;
  const status = req.query.status;
  if (typeof pageText !== 'string' || !/^[1-9]\d{0,5}$/.test(pageText)) {
    throw httpError(400, 'Page must be a positive number up to 999999.');
  }
  if (typeof q !== 'string' || q.length > 60 || (q && !/^[\p{L}\p{N}\s@.\-]+$/u.test(q))) {
    throw httpError(400, 'Search allows up to 60 letters, digits, spaces, @, dots or hyphens.');
  }
  if (department !== undefined && (typeof department !== 'string' || !/^[1-9]\d{0,8}$/.test(department))) {
    throw httpError(400, 'Invalid department filter.');
  }
  if (status !== undefined && !['active', 'inactive', 'graduated'].includes(status)) {
    throw httpError(400, 'Invalid status filter.');
  }
  const page = Number(pageText);
  const pageSize = 20;
  let query = req.db.from('students').select(columns, { count: 'exact' });
  const search = q.trim();
  if (search) query = query.or(`full_name.ilike.%${search}%,roll_no.ilike.%${search}%,email.ilike.%${search}%`);
  if (department) query = query.eq('department_id', Number(department));
  if (status) query = query.eq('status', status);
  const result = databaseResult(await query.order('created_at', { ascending: false })
    .order('id', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1));
  res.json({ data: result.data, meta: { page, pageSize, total: result.count,
    pages: Math.max(1, Math.ceil(result.count / pageSize)) } });
});
router.get('/students/:id', async (req, res) => {
  const result = databaseResult(await req.db.from('students').select(columns)
    .eq('id', uuid(req.params.id)).maybeSingle());
  if (!result.data) throw httpError(404, 'Student not found.');
  res.json({ data: result.data });
});
router.post('/students', async (req, res) => {
  const result = databaseResult(await req.db.from('students').insert(studentInput(req.body))
    .select(columns).single());
  res.status(201).json({ data: result.data });
});
router.put('/students/:id', async (req, res) => {
  const id = uuid(req.params.id);
  const input = studentInput(req.body);
  const result = databaseResult(await req.db.from('students').update(input)
    .eq('id', id).select(columns).maybeSingle());
  if (!result.data) throw httpError(404, 'Student not found.');
  res.json({ data: result.data });
});
router.delete('/students/:id', async (req, res) => {
  const result = databaseResult(await req.db.from('students').delete()
    .eq('id', uuid(req.params.id)).select('id').maybeSingle());
  if (!result.data) throw httpError(404, 'Student not found.');
  res.json({ data: { id: result.data.id, deleted: true } });
});
module.exports = router;
