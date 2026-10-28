const { authClient } = require('../supabase');
const { fail } = require('../utils/validation');
module.exports = async function authenticate(req, res, next) {
  const match = /^Bearer (\S+)$/.exec(req.get('authorization') || '');
  if (!match || match[1].length > 8192) fail(401, 'Sign in to continue.');
  const { data, error } = await authClient().auth.getUser(match[1]);
  if (error || !data.user || !data.user.email_confirmed_at) {
    fail(401, 'Session expired or email unconfirmed. Sign in again.');
  }
  req.user = data.user;
  next();
};
