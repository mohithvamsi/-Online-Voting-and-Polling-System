const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
function studentInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Send a student object.');
  const text = (key) => typeof body[key] === 'string' ? body[key].trim() : '';
  const roll_no = text('roll_no').toUpperCase();
  const full_name = text('full_name');
  const email = text('email').toLowerCase();
  const phone = text('phone') || null;
  const department_id = Number(body.department_id);
  const year = Number(body.year);
  const status = text('status');
  const admission_date = text('admission_date');
  if (!/^[A-Z0-9-]{3,20}$/.test(roll_no)) fail('Roll number: use 3–20 letters, digits or hyphens.');
  if (full_name.length < 2 || full_name.length > 100) fail('Name must contain 2–100 characters.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email.');
  if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) fail('Phone needs 10–15 digits, optionally starting with +.');
  if (!Number.isSafeInteger(department_id) || department_id < 1) fail('Choose a department.');
  if (!Number.isInteger(year) || year < 1 || year > 4) fail('Year must be 1–4.');
  if (!['active', 'inactive', 'graduated'].includes(status)) fail('Choose a valid status.');
  const date = new Date(admission_date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(admission_date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== admission_date || admission_date < '2000-01-01' || admission_date > new Date().toISOString().slice(0, 10)) fail('Admission date must be a real date from 2000 through today (UTC).');
  return { roll_no, full_name, email, phone, department_id, year, status, admission_date };
}
function uuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) fail('Invalid student ID.');
  return value;
}
module.exports = { studentInput, uuid };
