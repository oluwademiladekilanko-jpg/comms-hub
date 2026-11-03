const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/store');
const { validate } = require('../src/validate');

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comms-'));
  return { store: new Store(path.join(dir, 'db.json')), dir };
}

test('validate: applies defaults and trims strings', () => {
  const { errors, value } = validate('projects', { title: '  Launch site ', owner: 'Sam' });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(value.title, 'Launch site');
  assert.strictEqual(value.status, 'planning');
  assert.strictEqual(value.channel, 'website');
});

test('validate: reports missing and invalid fields', () => {
  const { errors } = validate('projects', { title: '', status: 'nope', dueDate: '2026-02-30' });
  assert.ok(errors.includes('title is required'));
  assert.ok(errors.includes('owner is required'));
  assert.ok(errors.some((e) => e.startsWith('status must be one of')));
  assert.ok(errors.some((e) => e.startsWith('dueDate must be a date')));
});

test('validate: ignores unknown fields', () => {
  const { value } = validate('posts', { title: 'a', body: 'b', id: 99, admin: true });
  assert.strictEqual(value.id, undefined);
  assert.strictEqual(value.admin, undefined);
});

test('store: create, get, update, remove', () => {
  const { store } = tmpStore();
  const created = store.create('projects', { title: 'A', owner: 'B' });
  assert.strictEqual(created.id, 1);
  assert.strictEqual(store.get('projects', 1).title, 'A');
  store.update('projects', 1, { title: 'C' });
  assert.strictEqual(store.get('projects', 1).title, 'C');
  assert.strictEqual(store.remove('projects', 1), true);
  assert.strictEqual(store.remove('projects', 1), false);
});

test('store: persists to disk and reloads', () => {
  const { store, dir } = tmpStore();
  store.create('posts', { title: 'Hello', body: 'World' });
  const reloaded = new Store(path.join(dir, 'db.json'));
  assert.strictEqual(reloaded.all('posts').length, 1);
  assert.strictEqual(reloaded.create('posts', { title: 'Two', body: 'x' }).id, 2);
});
