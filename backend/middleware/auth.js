const { createSupabase } = require('../supabase');
const { httpError, databaseResult } = require('../utils/errors');
async function verifyAdministrator(token) {
  const client = createSupabase(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    if (error && error.status >= 500) throw httpError(503, 'Authentication service unavailable.');
    throw httpError(401, 'Your session is invalid or expired. Please log in.');
  }
  const result = databaseResult(await client.from('admins').select('user_id')
    .eq('user_id', data.user.id).maybeSingle());
  if (!result.data) throw httpError(403, 'This account is not an administrator.');
  return { client, user: data.user };
}
async function requireAdmin(req, res, next) {
  const match = (req.get('Authorization') || '').match(/^Bearer ([^\s]+)$/);
  if (!match || match[1].length > 8192) throw httpError(401, 'Please log in.');
  const verified = await verifyAdministrator(match[1]);
  req.db = verified.client;
  req.user = verified.user;
  next();
}
module.exports = { requireAdmin, verifyAdministrator };
