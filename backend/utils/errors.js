function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
function databaseResult(result) {
  const { error } = result;
  if (!error) return result;
  const errors = {
    '23505': [409, 'That roll number or email already exists.'],
    '23503': [400, 'The selected department does not exist.'],
    '23514': [400, 'Student data does not meet database requirements.'],
    '23502': [400, 'A required student field is missing.'],
    '42501': [403, 'Permission denied. Check administrator access and RLS.']
  };
  const [status, message] = errors[error.code] || [503, 'Database unavailable. Check your Supabase setup and try again.'];
  throw httpError(status, message);
}
module.exports = { httpError, databaseResult };
