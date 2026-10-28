function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function text(value, label, min, max) {
  if (typeof value !== 'string') fail(400, `${label} must be text.`);
  value = value.trim();
  if (value.length < min || value.length > max) {
    fail(400, `${label} must contain ${min}–${max} characters.`);
  }
  return value;
}
function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    fail(400, 'Invalid record ID.');
  }
  return value;
}
function credentials(body) {
  const email = text(body.email, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email.');
  // Do not trim passwords: spaces can be intentional.
  const password = body.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    fail(400, 'Password must contain 8–128 characters.');
  }
  return { email, password };
}
function pollInput(body, now = Date.now()) {
  const title = text(body.title, 'Question', 5, 160);
  const description = text(body.description ?? '', 'Description', 0, 1000);
  if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 6) {
    fail(400, 'Provide 2–6 choices.');
  }
  const options = body.options.map(value => text(value, 'Choice', 1, 100));
  if (new Set(options.map(value => value.toLowerCase())).size !== options.length) {
    fail(400, 'Choices must be different.');
  }
  const deadline = typeof body.ends_at === 'string' ? Date.parse(body.ends_at) : NaN;
  if (!Number.isFinite(deadline) || deadline < now + 60000 || deadline > now + 30 * 86400000) {
    fail(400, 'Closing time must be between 1 minute and 30 days from now.');
  }
  return { title, description, options, ends_at: new Date(deadline).toISOString() };
}
function result({ data, error }) {
  if (!error) return data;
  // Only these deliberately defined database errors may be shown to users.
  const messages = {
    P0002: [404, 'Poll not found.'],
    '42501': [403, 'Only the poll creator can do that.'],
    '23505': [409, 'You have already voted, or a duplicate value was submitted.'],
    '22023': [400, 'Invalid poll details or choice.'],
    P0001: [409, 'Poll is closed or already has votes; this action is unavailable.']
  };
  const [status, message] = messages[error.code] || [503, 'Database unavailable. Try again shortly.'];
  fail(status, message);
}
module.exports = { fail, text, uuid, credentials, pollInput, result };
