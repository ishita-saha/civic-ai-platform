import axios from 'axios';

// Overridable at build time so this isn't hardcoded to a dev machine.
const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const client = axios.create({
  baseURL,
  timeout: 12000,
});

/**
 * The admin's proof of identity.
 */
let adminKey = null;

export function setAdminKey(key) {
  adminKey = key || null;
}

client.interceptors.request.use((config) => {
  if (adminKey) {
    config.headers['X-Admin-Key'] = adminKey;
  }
  return config;
});

/**
 * Normalize complaint data coming from the backend.
 *
 * Important:
 * image_url is preserved explicitly so the Community Feed
 * can display the permanently stored Supabase image.
 */
export function normalizeComplaint(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  const image_url =
    raw.image_url ||
    raw.image?.url ||
    raw.image?.image_url ||
    null;

  const normalized = {
    ...raw,
    image_url,
  };

  // Keep an existing geotag untouched.
  if (
    typeof raw.geotag?.lat === 'number' &&
    typeof raw.geotag?.lng === 'number'
  ) {
    return normalized;
  }

  // Convert flat latitude/longitude into the geotag shape
  // expected by the rest of the application.
  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    normalized.geotag = {
      lat,
      lng,
    };
  }

  return normalized;
}

/**
 * True when the server understood the request but has no such route.
 */
function isMissingRoute(err) {
  const status = err?.response?.status;
  return status === 404 || status === 405;
}

/* ---------------------------------------------------------------------------
   Community
   --------------------------------------------------------------------------- */

/**
 * Get all complaints for the community feed.
 *
 * normalizeComplaint preserves image_url from Supabase.
 */
export async function listComplaints() {
  const { data } = await client.get('/complaints');

  return Array.isArray(data)
    ? data.map(normalizeComplaint)
    : [];
}

/** Create a complaint without an image. */
export async function createComplaint(payload) {
  const { data } = await client.post('/complaints', payload);
  return data;
}

/** Toggles this user's vote and returns the updated case. */
export async function toggleUpvote(id, userId) {
  const { data } = await client.post(
    `/complaints/${encodeURIComponent(id)}/upvote`,
    {
      user_id: userId,
    },
  );

  return normalizeComplaint(data);
}

/** Admin-only: mark a report as real. */
export async function verifyComplaint(
  id,
  { note, verifiedBy } = {},
) {
  const { data } = await client.post(
    `/complaints/${encodeURIComponent(id)}/verify`,
    {
      note: note?.trim() || null,
      verified_by: verifiedBy || null,
    },
  );

  return normalizeComplaint(data);
}

/**
 * One case by reference.
 *
 * Falls back to scanning the complaint list when the
 * individual complaint endpoint is unavailable.
 */
export async function getComplaint(id) {
  try {
    const { data } = await client.get(
      `/complaints/${encodeURIComponent(id)}`,
    );

    if (data) {
      return normalizeComplaint(data);
    }
  } catch (err) {
    if (!isMissingRoute(err)) {
      throw err;
    }
  }

  const match = (await listComplaints()).find(
    (c) => String(c.id) === String(id),
  );

  if (!match) {
    const err = new Error(
      `No case matches reference #${id}.`,
    );

    err.notFound = true;
    throw err;
  }

  return match;
}

/**
 * Move a case along the pipeline.
 */
export async function updateComplaintStatus(
  id,
  status,
  note,
) {
  try {
    const { data } = await client.patch(
      `/complaints/${encodeURIComponent(id)}/status`,
      {
        status,
        note: note?.trim() || null,
      },
    );

    return normalizeComplaint(data);
  } catch (err) {
    if (isMissingRoute(err)) {
      const e = new Error(
        'This backend build has no status endpoint.',
      );

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
  const { data } = await client.post('/auth/login', {
    email: email.trim(),
    password,
  });

  return data;
}

export async function signup({
  name,
  email,
  password,
}) {
  const { data } = await client.post('/auth/signup', {
    name: name.trim(),
    email: email.trim(),
    password,
  });

  return data;
}

/**
 * One-click demo account roster.
 */
export async function fetchDemoAccounts() {
  try {
    const { data } = await client.get(
      '/auth/demo-accounts',
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------------------
   Error handling
   --------------------------------------------------------------------------- */

export function readableError(err) {
  if (err?.code === 'ECONNABORTED') {
    return 'The server took too long to respond.';
  }

  if (err?.notFound || err?.unsupported) {
    return err.message;
  }

  const detail = err?.response?.data?.detail;

  if (typeof detail === 'string' && detail) {
    return detail;
  }

  if (err?.message) {
    return err.message;
  }

  return 'Something went wrong. Please try again.';
}

export default client;
