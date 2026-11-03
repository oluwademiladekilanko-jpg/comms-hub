const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { Store } = require('../src/store');

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comms-api-'));
  const store = new Store(path.join(dir, 'db.json'), path.join(__dirname, '..', 'data', 'seed.json'));
  const server = createApp(store).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('GET /api/health', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: 'ok' });
  }));

test('GET /api/projects returns seeded projects, soonest due first', () =>
  withServer(async (base) => {
    const items = await (await fetch(`${base}/api/projects`)).json();
    assert.strictEqual(items.length, 4);
    assert.strictEqual(items[0].dueDate, '2026-09-30');
  }));

test('GET /api/projects supports filtering and search', () =>
  withServer(async (base) => {
    const launched = await (await fetch(`${base}/api/projects?status=launched`)).json();
    assert.deepStrictEqual(launched.map((p) => p.id), [4]);
    const found = await (await fetch(`${base}/api/projects?q=newsletter`)).json();
    assert.deepStrictEqual(found.map((p) => p.id), [2]);
  }));

test('POST /api/projects creates a project (201)', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/projects`, json({ title: 'New', owner: 'Me' }));
    assert.strictEqual(res.status, 201);
    const created = await res.json();
    assert.strictEqual(created.status, 'planning');
    const again = await fetch(`${base}/api/projects/${created.id}`);
    assert.strictEqual(again.status, 200);
  }));

test('POST /api/projects rejects invalid input (400 with details)', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/projects`, json({ title: '' }));
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.details.length >= 2);
  }));

test('PUT /api/projects/:id merges and re-validates', () =>
  withServer(async (base) => {
    const put = (id, body) =>
      fetch(`${base}/api/projects/${id}`, { ...json(body), method: 'PUT' });
    const ok = await put(3, { status: 'in-progress' });
    assert.strictEqual(ok.status, 200);
    const updated = await ok.json();
    assert.strictEqual(updated.status, 'in-progress');
    assert.strictEqual(updated.title, 'Spring open house campaign');
    assert.strictEqual((await put(3, { status: 'bogus' })).status, 400);
    assert.strictEqual((await put(999, { status: 'review' })).status, 404);
  }));

test('DELETE /api/posts/:id returns 204 then 404', () =>
  withServer(async (base) => {
    assert.strictEqual((await fetch(`${base}/api/posts/1`, { method: 'DELETE' })).status, 204);
    assert.strictEqual((await fetch(`${base}/api/posts/1`, { method: 'DELETE' })).status, 404);
  }));

test('GET /api/stats summarises both collections', () =>
  withServer(async (base) => {
    const s = await (await fetch(`${base}/api/stats`)).json();
    assert.strictEqual(s.projects.total, 4);
    // Computed from the seed so the test doesn't break as real dates pass.
    const seed = require('../data/seed.json').projects;
    const today = new Date().toISOString().slice(0, 10);
    const expected = seed.filter((p) => p.dueDate && p.dueDate < today && p.status !== 'launched').length;
    assert.strictEqual(s.projects.overdue, expected);
    assert.strictEqual(s.posts.byStatus.scheduled, 1);
  }));

test('unknown API route returns JSON 404; bad JSON returns 400', () =>
  withServer(async (base) => {
    const nf = await fetch(`${base}/api/nope`);
    assert.strictEqual(nf.status, 404);
    assert.ok((await nf.json()).error);
    const bad = await fetch(`${base}/api/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops',
    });
    assert.strictEqual(bad.status, 400);
  }));
