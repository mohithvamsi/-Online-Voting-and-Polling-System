const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { createSupabase } = require('../supabase');
const { verifyAdministrator } = require('../middleware/auth');
const { httpError } = require('../utils/errors');
const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Try again in 15 minutes.' } }
});
router.post('/login', loginLimiter, async (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 256) {
    throw httpError(400, 'Enter a valid email and password.');
  }
  const { data, error } = await createSupabase().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error?.status === 429) throw httpError(429, 'Too many attempts. Please try again later.');
    if (error?.status >= 500) throw httpError(503, 'Authentication service unavailable.');
    throw httpError(401, 'Invalid email or password.');
  }
  await verifyAdministrator(data.session.access_token);
  res.json({ data: {
    access_token: data.session.access_token,
    expires_at: data.session.expires_at,
    email: data.user.email
  } });
});
module.exports = router;
