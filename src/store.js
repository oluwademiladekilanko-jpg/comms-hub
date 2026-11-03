// Tiny JSON-file "database". Swap this class for SQLite/Postgres later without touching the routes.
const fs = require('fs');
const path = require('path');

class Store {
  constructor(file, seedFile) {
    this.file = file;
    if (fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else if (seedFile && fs.existsSync(seedFile)) {
      this.data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
      this.save();
    } else {
      this.data = { projects: [], posts: [], nextId: { projects: 1, posts: 1 } };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // atomic replace: no half-written file if we crash
  }

  all(collection) {
    return this.data[collection];
  }

  get(collection, id) {
    return this.data[collection].find((x) => x.id === id) || null;
  }

  create(collection, value) {
    const now = new Date().toISOString();
    const item = { id: this.data.nextId[collection]++, ...value, createdAt: now, updatedAt: now };
    this.data[collection].push(item);
    this.save();
    return item;
  }

  update(collection, id, value) {
    const item = this.get(collection, id);
    if (!item) return null;
    Object.assign(item, value, { updatedAt: new Date().toISOString() });
    this.save();
    return item;
  }

  remove(collection, id) {
    const i = this.data[collection].findIndex((x) => x.id === id);
    if (i === -1) return false;
    this.data[collection].splice(i, 1);
    this.save();
    return true;
  }
}

module.exports = { Store };
