const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'"],
  'connect-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'font-src': ["'self'"],
  'object-src': ["'none'"], 'frame-ancestors': ["'none'"], 'form-action': ["'self'"],
  'upgrade-insecure-requests': null
} } }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', rateLimit({ windowMs: 900000, limit: 1000,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { message: 'Too many requests. Please try again later.' } } }));
app.use(express.json({ limit: '16kb' }));
app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/students'));
app.use('/api', (req, res) => res.status(404).json({ error: { message: 'API endpoint not found.' } }));
app.use(express.static(path.join(__dirname, '..', 'frontend'), { dotfiles: 'deny' }));
app.use((req, res) => res.status(404).json({ error: { message: 'Page not found.' } }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = Number(error.status);
  let message = error.message;
  if (error.type === 'entity.parse.failed') { status = 400; message = 'Request body must contain valid JSON.'; }
  else if (error.type === 'entity.too.large') { status = 413; message = 'Request is too large.'; }
  else if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500; message = 'Something went wrong. Please try again.';
  }
  if (status >= 500) console.error(`Request failed: ${req.method} ${req.path}; status=${status}`);
  res.status(status).json({ error: { message } });
});
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
  const server = app.listen(port, () => console.log(`Student Management System: http://localhost:${port}`));
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? 'Port in use. Change PORT in backend/.env.' : 'Server could not start.');
    process.exitCode = 1;
  });
}
module.exports = app;
