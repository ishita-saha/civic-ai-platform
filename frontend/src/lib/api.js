import axios from 'axios';

// Overridable at build time so this isn't hardcoded to a dev machine.
const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const client = axios.create({ baseURL, timeout: 12000 });

/**
 * The admin's proof of identity. It arrives in the login response for the admin
 * account only, so — unlike the hardcoded staff passwords this replaced — it is
 * never in the JS bundle a citizen downloads.
 *
 * Held in a module variable rather than read from storage per request: one
 * writer (AuthProvider, on sign-in and on session restore), one reader.
 */
let adminKey = null;

export function setAdminKey(key) {
  adminKey = key || null;
}

client.interceptors.request.use((config) => {
  if (adminKey) config.headers['X-Admin-Key'] = adminKey;
  return config;
});

/**
 * Two backend builds are in play and they answer in different shapes.
 *
 * The in-memory build (`backend/main.py`) echoes back whatever the report form
 * posted, so `geotag` survives the round trip. The SQLAlchemy build
 * (`backend/routers/complaints.py`) stores flat `latitude`/`longitude` columns
 * and has never heard of `geotag`.
 *
 * Everything downstream — format.js, the tables, the "Open in Maps" links —
 * reads `geotag`. Filling it in once here beats teaching every consumer both
 * shapes. Records that already carry one are passed through untouched.
 */
export function normalizeComplaint(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  if (typeof raw.geotag?.lat === 'number' && typeof raw.geotag?.lng === 'number') return raw;

  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return raw;

  return { ...raw, geotag: { lat, lng } };
}

/**
 * True when the server understood the request but has no such route — which is
 * how the in-memory build answers every endpoint the SQLAlchemy build adds.
 * Distinguishing this from a real failure is what lets the callers below
 * degrade instead of showing an error for a case the user can plainly see.
 */
function isMissingRoute(err) {
  const status = err?.response?.status;
  return status === 404 || status === 405;
}

export async function listComplaints() {
  const { data } = await client.get('/complaints');
  return Array.isArray(data) ? data.map(normalizeComplaint) : [];
}

export async function createComplaint(payload) {
  const { data } = await client.post('/complaints', payload);
  return data;
}

/**
 * One case by reference. `GET /complaints/{id}` only exists on the SQLAlchemy
 * build, so when the route is missing we fall back to scanning the list rather
 * than telling someone their case doesn't exist when it's sitting in the table
 * one screen back.
 *
 * Rejects with `err.notFound = true` when the id genuinely isn't there, so the
 * detail pages can show "no such case" instead of a network error.
 */
export async function getComplaint(id) {
  try {
    const { data } = await client.get(`/complaints/${encodeURIComponent(id)}`);
    if (data) return normalizeComplaint(data);
  } catch (err) {
    // A missing route is a backend-shape problem, not a missing case — keep
    // looking. A timeout or a dead connection is real, so let it through.
    if (!isMissingRoute(err)) throw err;
  }

  const match = (await listComplaints()).find((c) => String(c.id) === String(id));
  if (!match) {
    const err = new Error(`No case matches reference #${id}.`);
    err.notFound = true;
    throw err;
  }
  return match;
}

/**
 * Move a case along the pipeline.
 *
 * Rejects with `err.unsupported = true` when the running backend has no status
 * endpoint — the caller shows the change locally and says plainly that it
 * wasn't saved, which is better than either a silent no-op or a raw 404.
 */
export async function updateComplaintStatus(id, status, note) {
  try {
    const { data } = await client.patch(`/complaints/${encodeURIComponent(id)}/status`, {
      status,
      note: note?.trim() || null,
    });
    return normalizeComplaint(data);
  } catch (err) {
    if (isMissingRoute(err)) {
      const e = new Error('This backend build has no status endpoint.');
      e.unsupported = true;
      throw e;
    }
    throw err;
  }
}

/* ---------------------------------------------------------------------------
   Accounts
   --------------------------------------------------------------------------- */

export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email: email.trim(), password });
  return data;
}

/** Signup mints citizens only — the API ignores any role in the body. */
export async function signup({ name, email, password }) {
  const { data } = await client.post('/auth/signup', {
    name: name.trim(),
    email: email.trim(),
    password,
  });
  return data;
}

/**
 * The one-click sign-in roster. An empty list is a fine answer — the login form
 * just doesn't offer the shortcuts — so a failure here never blocks sign-in.
 */
export async function fetchDemoAccounts() {
  try {
    const { data } = await client.get('/auth/demo-accounts');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------------------
   Community
   --------------------------------------------------------------------------- */

/** Toggles this user's vote and returns the updated case. */
export async function toggleUpvote(id, userId) {
  const { data } = await client.post(`/complaints/${encodeURIComponent(id)}/upvote`, {
    user_id: userId,
  });
  return normalizeComplaint(data);
}

/** Admin-only: mark a report as real. Nothing can be dispatched before this. */
export async function verifyComplaint(id, { note, verifiedBy } = {}) {
  const { data } = await client.post(`/complaints/${encodeURIComponent(id)}/verify`, {
    note: note?.trim() || null,
    verified_by: verifiedBy || null,
  });
  return normalizeComplaint(data);
}

/**
 * axios errors are noisy and leak internals into the UI. Collapse them into
 * one sentence a citizen can actually act on.
 *
 * FastAPI puts the useful sentence in `detail` — "an account already uses that
 * email" beats "Server responded 409", so that wins when it's present.
 */
export function readableError(err) {
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (err?.notFound || err?.unsupported) return err.message;

  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;

  if (err?.response) return `Server responded ${err.response.status}. Please try again.`;
  if (err?.request) return "Can't reach the server. Is the backend running on port 8000?";
  return err?.message || 'Something went wrong.';
}
