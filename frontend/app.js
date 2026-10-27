// Tokens deliberately stay in memory: refreshing requires login again.
const $ = (selector) => document.querySelector(selector);
let token = '';
let expiryTimer;
let page = 1;
let totalPages = 1;
let loadVersion = 0;
let editingId = null;
let deletingId = null;
let departments = [];
const studentDialog = $('#student-dialog');
const deleteDialog = $('#delete-dialog');
const studentForm = $('#student-form');
function notify(message, type = 'info') {
  const box = $('#message');
  box.textContent = message;
  box.className = `message ${type}`;
  box.hidden = false;
}
function showFormError(selector, message) {
  const box = $(selector); box.textContent = message; box.hidden = !message;
}
function resetSession(message = '') {
  token = ''; clearTimeout(expiryTimer); loadVersion += 1;
  editingId = null; deletingId = null; departments = [];
  if (studentDialog.open) studentDialog.close();
  if (deleteDialog.open) deleteDialog.close();
  $('#dashboard-view').hidden = true; $('#account').hidden = true; $('#login-view').hidden = false;
  $('#student-rows').replaceChildren(); $('#account-email').textContent = ''; $('#login-form').reset();
  for (const key of ['total', 'active', 'graduated', 'departments']) $(`#stat-${key}`).textContent = '—';
  if (message) notify(message);
  $('#login-email').focus();
}
async function api(path, options = {}) {
  const requestToken = token;
  const headers = { Accept: 'application/json', ...options.headers };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`;
  let response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('Request timed out. Check your connection and try again.');
    throw new Error('Cannot reach the server. Check that the backend is running.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message || 'Request failed.';
    if ([401, 403].includes(response.status) && requestToken && requestToken === token) resetSession(message);
    throw new Error(message);
  }
  // Ignore a protected response that belongs to an old login.
  if (requestToken && requestToken !== token) throw new Error('Session changed. Please try again.');
  return result;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function fillDepartmentSelects() {
  const filter = $('#filter-department'); const field = $('#department');
  filter.replaceChildren(new Option('All departments', ''));
  field.replaceChildren(new Option('Choose department', ''));
  for (const department of departments) {
    const label = `${department.code} — ${department.name}`;
    filter.add(new Option(label, String(department.id))); field.add(new Option(label, String(department.id)));
  }
}
function actionButton(label, action, id, name) {
  const button = element('button', label, 'secondary');
  button.type = 'button'; button.dataset.action = action; button.dataset.id = id;
  button.setAttribute('aria-label', `${label} ${name}`); return button;
}
function renderStudents(students) {
  const fragment = document.createDocumentFragment();
  for (const student of students) {
    const row = document.createElement('tr'); row.append(element('td', student.roll_no));
    const name = document.createElement('td');
    name.append(element('strong', student.full_name), element('small', student.email)); row.append(name);
    row.append(element('td', student.departments?.code || 'Unavailable'), element('td', String(student.year)));
    const status = document.createElement('td'); status.append(element('span', student.status, `badge ${student.status}`)); row.append(status);
    const cell = document.createElement('td'); const actions = element('div', undefined, 'actions');
    actions.append(actionButton('Edit', 'edit', student.id, student.full_name), actionButton('Delete', 'delete', student.id, student.full_name));
    cell.append(actions); row.append(cell); fragment.append(row);
  }
  $('#student-rows').replaceChildren(fragment);
}
async function loadDashboard() {
  const version = ++loadVersion;
  $('#list-state').textContent = 'Loading student records…'; $('#student-rows').replaceChildren();
  $('#previous-page').disabled = true; $('#next-page').disabled = true;
  const filters = new FormData($('#filter-form')); const query = new URLSearchParams({ page: String(page) });
  for (const key of ['q', 'department_id', 'status']) {
    const value = String(filters.get(key) || '').trim(); if (value) query.set(key, value);
  }
  try {
    const [students, summary] = await Promise.all([api(`/students?${query}`), api('/summary')]);
    if (version !== loadVersion || !token) return;
    totalPages = students.meta.pages;
    if (page > totalPages) { page = totalPages; return loadDashboard(); }
    renderStudents(students.data);
    for (const key of ['total', 'active', 'graduated', 'departments']) $(`#stat-${key}`).textContent = String(summary.data[key]);
    $('#result-count').textContent = `${students.meta.total} matching students`;
    $('#page-label').textContent = `Page ${page} of ${totalPages}`;
    $('#list-state').textContent = students.data.length ? '' : 'No students found. Add a student or change your filters.';
    $('#previous-page').disabled = page <= 1; $('#next-page').disabled = page >= totalPages;
  } catch (error) {
    if (version !== loadVersion || !token) return;
    $('#list-state').textContent = 'Unable to load records. Use Apply to retry.'; $('#result-count').textContent = '';
    for (const key of ['total', 'active', 'graduated', 'departments']) $(`#stat-${key}`).textContent = '—';
    notify(error.message, 'error');
  }
}
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = $('#login-button'); button.disabled = true; button.textContent = 'Logging in…'; $('#message').hidden = true;
  try {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(values) });
    token = result.data.access_token;
    const milliseconds = result.data.expires_at * 1000 - Date.now();
    if (milliseconds <= 0) { resetSession('Session expired. Please log in again.'); return; }
    expiryTimer = setTimeout(() => resetSession('Session expired. Please log in again.'), Math.min(milliseconds, 2147483647));
    departments = (await api('/departments')).data;
    if (!departments.length) throw new Error('No departments configured. Run database/schema.sql.');
    fillDepartmentSelects(); $('#filter-form').reset(); page = 1;
    $('#account-email').textContent = result.data.email; $('#account').hidden = false; $('#login-view').hidden = true;
    $('#dashboard-view').hidden = false; $('#login-password').value = '';
    notify('You are logged in.', 'success'); await loadDashboard();
  } catch (error) { resetSession(); notify(error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Log in'; }
});
$('#logout').addEventListener('click', () => resetSession('You have logged out of this browser tab.'));
$('#filter-form').addEventListener('submit', (event) => { event.preventDefault(); page = 1; loadDashboard(); });
$('#reset-filters').addEventListener('click', () => { $('#filter-form').reset(); page = 1; loadDashboard(); });
$('#previous-page').addEventListener('click', () => { if (page > 1) { page -= 1; loadDashboard(); } });
$('#next-page').addEventListener('click', () => { if (page < totalPages) { page += 1; loadDashboard(); } });
function prepareStudentDialog(student = null) {
  editingId = student?.id || null; studentForm.reset(); showFormError('#student-error', '');
  $('#student-dialog-title').textContent = student ? 'Edit student' : 'Add student';
  const today = new Date().toISOString().slice(0, 10); $('#admission-date').max = today;
  if (student) {
    for (const key of ['roll_no', 'full_name', 'email', 'phone', 'department_id', 'year', 'status', 'admission_date']) {
      studentForm.elements.namedItem(key).value = student[key] ?? '';
    }
  } else $('#admission-date').value = today;
  studentDialog.showModal();
}
$('#add-student').addEventListener('click', () => prepareStudentDialog());
$('#close-student').addEventListener('click', () => { if (!$('#save-student').disabled) studentDialog.close(); });
studentForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const button = $('#save-student'); button.disabled = true; button.textContent = 'Saving…'; showFormError('#student-error', '');
  try {
    const id = editingId; const values = Object.fromEntries(new FormData(studentForm));
    await api(id ? `/students/${id}` : '/students', { method: id ? 'PUT' : 'POST', body: JSON.stringify(values) });
    if (!token) return;
    studentDialog.close(); notify(id ? 'Student updated.' : 'Student added.', 'success');
    if (!id) page = 1; await loadDashboard();
  } catch (error) { if (studentDialog.open) showFormError('#student-error', error.message); }
  finally { button.disabled = false; button.textContent = 'Save student'; }
});
// Prevent closing the form while a save is in progress, avoiding duplicate accidental submissions.
studentDialog.addEventListener('cancel', (event) => { if ($('#save-student').disabled) event.preventDefault(); });
$('#student-rows').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]'); if (!button) return; button.disabled = true;
  try {
    const result = await api(`/students/${button.dataset.id}`); if (!token) return;
    if (button.dataset.action === 'edit') prepareStudentDialog(result.data);
    else {
      deletingId = result.data.id; $('#delete-description').textContent = `Delete ${result.data.full_name} (${result.data.roll_no})?`;
      showFormError('#delete-error', ''); deleteDialog.showModal();
    }
  } catch (error) { if (token) notify(error.message, 'error'); } finally { button.disabled = false; }
});
$('#cancel-delete').addEventListener('click', () => { if (!$('#confirm-delete').disabled) deleteDialog.close(); });
deleteDialog.addEventListener('cancel', (event) => { if ($('#confirm-delete').disabled) event.preventDefault(); });
$('#confirm-delete').addEventListener('click', async () => {
  if (!deletingId) return;
  const button = $('#confirm-delete'); button.disabled = true; showFormError('#delete-error', '');
  try {
    await api(`/students/${deletingId}`, { method: 'DELETE' }); if (!token) return;
    deleteDialog.close(); deletingId = null; notify('Student deleted.', 'success'); await loadDashboard();
  } catch (error) { if (deleteDialog.open) showFormError('#delete-error', error.message); }
  finally { button.disabled = false; }
});
