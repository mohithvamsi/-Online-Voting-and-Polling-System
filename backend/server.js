const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('node:path');
const { db } = require('./supabase');
const app = express();
app.disable('x-powered-by');
// Default deployment is one Node process, with no reverse proxy.
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
  connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'],
  objectSrc: ["'none'"], frameAncestors: ["'none'"],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
} } }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 200,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many requests. Wait a minute.' } }));
app.use(express.json({ limit: '16kb' }));
app.use('/api', (req, res, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Send application/json.' });
  }
  next();
});
app.get('/api/health', async (req, res) => {
  const { error } = await db.from('polls').select('id').limit(1);
  res.status(error ? 503 : 200).json({ status: error ? 'unavailable' : 'ok', database: !error });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/polls', require('./routes/polls'));
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use(express.static(path.join(__dirname, '..', 'frontend'), { dotfiles: 'deny' }));
app.use((req, res) => res.status(404).send('Page not found.'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = status < 500 ? error.message : 'Service unavailable. Try again shortly.';
  if (error.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body.'; }
  if (error.type === 'entity.too.large') { status = 413; message = 'Request is too large.'; }
  if (status >= 500) console.error('Request failed:', req.method, req.path, status);
  res.status(status).json({ error: message });
});
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  const server = app.listen(port, () => console.log(`Open http://localhost:${port}`));
  server.on('error', error => { console.error(`Server could not start: ${error.code}`); process.exit(1); });
}
module.exports = app;
