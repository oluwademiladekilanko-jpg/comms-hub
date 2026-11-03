// Field rules for each collection. Keeps validation in one place so the API stays thin.
const CHANNELS = ['website', 'social', 'email', 'newsletter', 'event'];
const PROJECT_STATUS = ['planning', 'in-progress', 'review', 'launched'];
const POST_STATUS = ['draft', 'scheduled', 'published'];

const SCHEMAS = {
  projects: {
    title: { type: 'string', required: true, max: 100 },
    owner: { type: 'string', required: true, max: 60 },
    status: { enum: PROJECT_STATUS, default: 'planning' },
    channel: { enum: CHANNELS, default: 'website' },
    dueDate: { type: 'date' },
    notes: { type: 'string', max: 500 },
  },
  posts: {
    title: { type: 'string', required: true, max: 100 },
    body: { type: 'string', required: true, max: 1000 },
    channel: { enum: CHANNELS, default: 'website' },
    status: { enum: POST_STATUS, default: 'draft' },
    publishDate: { type: 'date' },
  },
};

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Returns { errors: string[], value: object } containing only known fields.
function validate(collection, input) {
  const schema = SCHEMAS[collection];
  const errors = [];
  const value = {};
  const src = input && typeof input === 'object' ? input : {};

  for (const [field, rule] of Object.entries(schema)) {
    let v = src[field];
    if (v === undefined || v === null) {
      if (rule.required) errors.push(`${field} is required`);
      else if (rule.default !== undefined) value[field] = rule.default;
      else value[field] = '';
      continue;
    }
    if (typeof v !== 'string') {
      errors.push(`${field} must be a string`);
      continue;
    }
    v = v.trim();
    if (rule.required && v === '') errors.push(`${field} is required`);
    else if (rule.max && v.length > rule.max) errors.push(`${field} must be at most ${rule.max} characters`);
    else if (rule.enum && !rule.enum.includes(v)) errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
    else if (rule.type === 'date' && v !== '' && !isRealDate(v)) errors.push(`${field} must be a date like 2026-12-31`);
    value[field] = v;
  }
  return { errors, value };
}

module.exports = { validate, SCHEMAS, CHANNELS, PROJECT_STATUS, POST_STATUS };
