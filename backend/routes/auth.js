const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { authClient } = require('../supabase');
const { credentials, fail } = require('../utils/validation');
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } }));
router.post('/register', async (req, res) => {
  const { error } = await authClient().auth.signUp(credentials(req.body || {}));
  if (error) fail(error.status === 429 ? 429 : 400,
    'Registration unavailable. Check your details, email limits, and Auth settings.');
  // Generic response avoids revealing whether a particular account exists.
  res.status(202).json({ message: 'If registration is accepted, confirm your email, then sign in.' });
});
router.post('/login', async (req, res) => {
  const { data, error } = await authClient().auth.signInWithPassword(credentials(req.body || {}));
  if (error || !data.session || !data.user.email_confirmed_at) {
    fail(401, 'Unable to sign in. Check credentials and confirm your email.');
  }
  res.json({ token: data.session.access_token, expires_at: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email } });
});
module.exports = router;
