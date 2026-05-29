/**
 * LocalStorage-backed database adapter
 * API-compatible with the original Base44 db.entities.* interface
 */

const ENTITIES = ['Employee', 'Outlet', 'Deployment', 'Leave', 'Alert', 'AuditLog', 'AppUser'];

// ─── Storage helpers ──────────────────────────────────────────────────────────
const read = (entity) => {
  try {
    return JSON.parse(localStorage.getItem(`ops_${entity}`) || '[]');
  } catch {
    return [];
  }
};

const write = (entity, data) => {
  localStorage.setItem(`ops_${entity}`, JSON.stringify(data));
};

// ─── UUID generator ───────────────────────────────────────────────────────────
const uuid = () => crypto.randomUUID();

// ─── Query helpers ────────────────────────────────────────────────────────────
const applyFilter = (records, query) => {
  if (!query || Object.keys(query).length === 0) return records;
  return records.filter(r =>
    Object.entries(query).every(([k, v]) => r[k] === v)
  );
};

const applySort = (records, sortStr) => {
  if (!sortStr) return records;
  const desc = sortStr.startsWith('-');
  const field = desc ? sortStr.slice(1) : sortStr;
  return [...records].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
};

// ─── Entity adapter factory ───────────────────────────────────────────────────
const createEntityAdapter = (entity) => ({
  filter: async (query) => applyFilter(read(entity), query),

  list: async (sort, limit) => {
    let records = read(entity);
    if (sort) records = applySort(records, sort);
    if (limit) records = records.slice(0, limit);
    return records;
  },

  get: async (id) => read(entity).find(r => r.id === id) || null,

  create: async (data) => {
    const records = read(entity);
    const newRecord = {
      id: uuid(),
      created_date: new Date().toISOString(),
      ...data
    };
    write(entity, [...records, newRecord]);
    return newRecord;
  },

  update: async (id, data) => {
    const records = read(entity);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`${entity} record "${id}" not found`);
    records[idx] = { ...records[idx], ...data };
    write(entity, records);
    return records[idx];
  },

  delete: async (id) => {
    const records = read(entity);
    write(entity, records.filter(r => r.id !== id));
    return { id };
  },
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export const hashPassword = (password) => btoa(encodeURIComponent(password));
export const verifyPassword = (password, hash) => hashPassword(password) === hash;

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('ops_current_user') || 'null');
  } catch {
    return null;
  }
};

export const setCurrentUser = (user) => {
  if (user) {
    // Store without password_hash for security
    const { password_hash, ...safeUser } = user;
    localStorage.setItem('ops_current_user', JSON.stringify(safeUser));
  } else {
    localStorage.removeItem('ops_current_user');
  }
};

// ─── Public db object ─────────────────────────────────────────────────────────
export const db = {
  entities: Object.fromEntries(
    ENTITIES.map(e => [e, createEntityAdapter(e)])
  ),
};
