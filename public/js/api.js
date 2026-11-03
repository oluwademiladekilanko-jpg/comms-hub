// Thin wrapper around fetch() for the REST API. The rest of the UI never builds URLs by hand.
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.details = data.details || [];
    throw err;
  }
  return data;
}

const qs = (params) => {
  const clean = Object.entries(params).filter(([, v]) => v);
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

export const api = {
  meta: () => request('/meta'),
  stats: () => request('/stats'),
  list: (collection, filters = {}) => request(`/${collection}${qs(filters)}`),
  create: (collection, body) => request(`/${collection}`, { method: 'POST', body }),
  update: (collection, id, body) => request(`/${collection}/${id}`, { method: 'PUT', body }),
  remove: (collection, id) => request(`/${collection}/${id}`, { method: 'DELETE' }),
};
