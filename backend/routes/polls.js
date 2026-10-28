const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { db } = require('../supabase');
const authenticate = require('../middleware/auth');
const { uuid, text, fail, pollInput, result } = require('../utils/validation');
router.use(authenticate);
const writes = rateLimit({ windowMs: 60 * 1000, limit: 20,
  keyGenerator: req => req.user.id, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many changes. Wait a minute.' } });
router.get('/', async (req, res) => {
  const search = text(req.query.search ?? '', 'Search', 0, 80);
  const status = req.query.status ?? 'all';
  if (!['all', 'open', 'closed'].includes(status)) fail(400, 'Invalid status filter.');
  if (req.query.mine !== undefined && !['true', 'false'].includes(req.query.mine)) {
    fail(400, 'Invalid ownership filter.');
  }
  const page = Number(req.query.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) fail(400, 'Invalid page.');
  res.json(result(await db.rpc('list_polls', { p_actor: req.user.id,
    p_search: search, p_status: status, p_mine: req.query.mine === 'true', p_page: page })));
});
router.post('/', writes, async (req, res) => {
  const poll = pollInput(req.body || {});
  const id = result(await db.rpc('create_poll', { p_actor: req.user.id,
    p_title: poll.title, p_description: poll.description,
    p_options: poll.options, p_ends_at: poll.ends_at }));
  res.status(201).json({ id });
});
router.get('/:id', async (req, res) => {
  res.json(result(await db.rpc('poll_detail', { p_poll: uuid(req.params.id), p_actor: req.user.id })));
});
router.post('/:id/votes', writes, async (req, res) => {
  result(await db.rpc('cast_vote', { p_poll: uuid(req.params.id),
    p_option: uuid(req.body?.option_id), p_actor: req.user.id }));
  res.status(201).json({ message: 'Your vote was recorded.' });
});
router.patch('/:id/close', writes, async (req, res) => {
  result(await db.rpc('manage_poll', { p_poll: uuid(req.params.id),
    p_actor: req.user.id, p_action: 'close' }));
  res.json({ message: 'Poll closed. Results are available.' });
});
router.delete('/:id', writes, async (req, res) => {
  result(await db.rpc('manage_poll', { p_poll: uuid(req.params.id),
    p_actor: req.user.id, p_action: 'delete' }));
  res.json({ message: 'Poll deleted.' });
});
module.exports = router;
