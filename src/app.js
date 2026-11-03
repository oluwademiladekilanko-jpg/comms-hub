const express = require('express');
const path = require('path');
const { validate, CHANNELS, PROJECT_STATUS, POST_STATUS } = require('./validate');

const SORTERS = {
  // soonest due date first, undated last
  projects: (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.id - b.id,
  // newest first
  posts: (a, b) => b.id - a.id,
};
const SEARCH_FIELDS = { projects: ['title', 'owner', 'notes'], posts: ['title', 'body'] };

function resourceRouter(store, name) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { status, channel, q } = req.query;
    let items = store.all(name).slice();
    if (status) items = items.filter((x) => x.status === status);
    if (channel) items = items.filter((x) => x.channel === channel);
    if (q) {
      const needle = String(q).toLowerCase();
      items = items.filter((x) => SEARCH_FIELDS[name].some((f) => String(x[f]).toLowerCase().includes(needle)));
    }
    res.json(items.sort(SORTERS[name]));
  });

  router.get('/:id', (req, res) => {
    const item = store.get(name, Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  });

  router.post('/', (req, res) => {
    const { errors, value } = validate(name, req.body);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });
    res.status(201).json(store.create(name, value));
  });

  // PUT merges the supplied fields into the existing record, then re-validates the result.
  router.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = store.get(name, id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { errors, value } = validate(name, { ...existing, ...req.body });
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });
    res.json(store.update(name, id, value));
  });

  router.delete('/:id', (req, res) => {
    if (!store.remove(name, Number(req.params.id))) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });

  return router;
}

function count(items, key, values) {
  return Object.fromEntries(values.map((v) => [v, items.filter((x) => x[key] === v).length]));
}

function createApp(store) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/api/meta', (req, res) =>
    res.json({ channels: CHANNELS, projectStatuses: PROJECT_STATUS, postStatuses: POST_STATUS })
  );

  app.get('/api/stats', (req, res) => {
    const projects = store.all('projects');
    const posts = store.all('posts');
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      projects: {
        total: projects.length,
        byStatus: count(projects, 'status', PROJECT_STATUS),
        overdue: projects.filter((p) => p.dueDate && p.dueDate < today && p.status !== 'launched').length,
      },
      posts: { total: posts.length, byStatus: count(posts, 'status', POST_STATUS) },
    });
  });

  app.use('/api/projects', resourceRouter(store, 'projects'));
  app.use('/api/posts', resourceRouter(store, 'posts'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
