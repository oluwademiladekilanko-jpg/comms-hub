import { api } from './api.js';

const $ = (sel) => document.querySelector(sel);

// Build DOM nodes safely (textContent, never innerHTML) so user input can't inject markup.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node[k] = v;
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

const fmtDate = (s) =>
  s ? new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const today = () => new Date().toISOString().slice(0, 10);
const label = (s) => s.replace('-', ' ');

let toastTimer;
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

function fillSelect(select, values, { blank } = {}) {
  select.replaceChildren();
  if (blank) select.append(el('option', { value: '', textContent: blank }));
  values.forEach((v) => select.append(el('option', { value: v, textContent: label(v) })));
}

// ---------- Stats ----------
async function loadStats() {
  const s = await api.stats();
  const card = (n, text, cls = '') => el('div', { class: `stat ${cls}` }, el('strong', { textContent: n }), el('span', { textContent: text }));
  $('#stats').replaceChildren(
    card(s.projects.total, 'Projects'),
    card(s.projects.byStatus['in-progress'], 'In progress'),
    card(s.projects.overdue, 'Overdue', s.projects.overdue ? 'warn' : ''),
    card(s.posts.byStatus.scheduled, 'Scheduled posts'),
    card(s.posts.byStatus.published, 'Published posts')
  );
}

// ---------- Projects ----------
function projectCard(p, meta) {
  const overdue = p.dueDate && p.dueDate < today() && p.status !== 'launched';
  const statusSelect = el('select', {
    id: `ps-${p.id}`,
    onchange: async (e) => {
      await run(() => api.update('projects', p.id, { status: e.target.value }), 'Status updated');
    },
  });
  fillSelect(statusSelect, meta.projectStatuses);
  statusSelect.value = p.status;

  return el('li', { class: 'card' },
    el('h3', { textContent: p.title }),
    el('div', { class: 'meta' },
      el('span', { class: `badge ${p.status}`, textContent: label(p.status) }),
      el('span', { textContent: `Owner: ${p.owner}` }),
      el('span', { textContent: `Channel: ${p.channel}` }),
      p.dueDate ? el('span', { class: overdue ? 'overdue' : '', textContent: `${overdue ? 'Overdue: ' : 'Due '}${fmtDate(p.dueDate)}` }) : null
    ),
    p.notes ? el('p', { textContent: p.notes }) : null,
    el('div', { class: 'card-footer' },
      el('label', { htmlFor: `ps-${p.id}` }, 'Status', statusSelect),
      el('button', { class: 'danger', type: 'button', textContent: 'Delete', onclick: () => remove('projects', p) })
    )
  );
}

async function loadProjects() {
  const meta = await metaPromise;
  const items = await api.list('projects', {
    q: $('#project-q').value.trim(),
    status: $('#project-status-filter').value,
    channel: $('#project-channel-filter').value,
  });
  $('#project-list').replaceChildren(
    ...(items.length ? items.map((p) => projectCard(p, meta)) : [el('li', { class: 'empty', textContent: 'No projects match.' })])
  );
}

// ---------- Posts ----------
function postCard(p, meta) {
  const statusSelect = el('select', {
    id: `po-${p.id}`,
    onchange: async (e) => {
      await run(() => api.update('posts', p.id, { status: e.target.value }), 'Status updated');
    },
  });
  fillSelect(statusSelect, meta.postStatuses);
  statusSelect.value = p.status;

  return el('li', { class: 'card' },
    el('h3', { textContent: p.title }),
    el('div', { class: 'meta' },
      el('span', { class: `badge ${p.status}`, textContent: p.status }),
      el('span', { textContent: `Channel: ${p.channel}` }),
      p.publishDate ? el('span', { textContent: `Publish: ${fmtDate(p.publishDate)}` }) : null
    ),
    el('p', { textContent: p.body }),
    el('div', { class: 'card-footer' },
      el('label', { htmlFor: `po-${p.id}` }, 'Status', statusSelect),
      el('button', { class: 'danger', type: 'button', textContent: 'Delete', onclick: () => remove('posts', p) })
    )
  );
}

async function loadPosts() {
  const meta = await metaPromise;
  const items = await api.list('posts');
  $('#post-list').replaceChildren(
    ...(items.length ? items.map((p) => postCard(p, meta)) : [el('li', { class: 'empty', textContent: 'No announcements yet.' })])
  );
}

// ---------- Actions ----------
async function refresh() {
  await Promise.all([loadStats(), loadProjects(), loadPosts()]);
}

async function run(fn, successMessage) {
  try {
    await fn();
    toast(successMessage);
    await refresh();
  } catch (err) {
    toast(err.message);
  }
}

async function remove(collection, item) {
  if (!confirm(`Delete "${item.title}"?`)) return;
  await run(() => api.remove(collection, item.id), 'Deleted');
}

function wireForm(formSelector, errorSelector, collection, successMessage) {
  const form = $(formSelector);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $(errorSelector).textContent = '';
    try {
      await api.create(collection, Object.fromEntries(new FormData(form)));
      form.reset();
      toast(successMessage);
      await refresh();
    } catch (err) {
      $(errorSelector).textContent = [err.message, ...err.details].join(': ');
    }
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Boot ----------
const metaPromise = api.meta();

(async function init() {
  try {
    const meta = await metaPromise;
    fillSelect($('#project-form [name=channel]'), meta.channels);
    fillSelect($('#post-form [name=channel]'), meta.channels);
    fillSelect($('#post-form [name=status]'), meta.postStatuses);
    fillSelect($('#project-status-filter'), meta.projectStatuses, { blank: 'All' });
    fillSelect($('#project-channel-filter'), meta.channels, { blank: 'All' });

    wireForm('#project-form', '#project-error', 'projects', 'Project added');
    wireForm('#post-form', '#post-error', 'posts', 'Announcement added');

    $('#project-q').addEventListener('input', debounce(loadProjects, 250));
    $('#project-status-filter').addEventListener('change', loadProjects);
    $('#project-channel-filter').addEventListener('change', loadProjects);

    await refresh();
  } catch (err) {
    toast('Could not reach the server. Is it running?');
    console.error(err);
  }
})();
