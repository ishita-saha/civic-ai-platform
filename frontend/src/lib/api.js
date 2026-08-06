import axios from 'axios';

// Overridable at build time so this isn't hardcoded to a dev machine.
const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const client = axios.create({ baseURL, timeout: 12000 });

export async function listComplaints() {
  const { data } = await client.get('/complaints');
  return Array.isArray(data) ? data : [];
}

export async function createComplaint(payload) {
  const { data } = await client.post('/complaints', payload);
  return data;
}

/**
 * axios errors are noisy and leak internals into the UI. Collapse them into
 * one sentence a citizen can actually act on.
 */
export function readableError(err) {
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (err?.response) return `Server responded ${err.response.status}. Please try again.`;
  if (err?.request) return "Can't reach the server. Is the backend running on port 8000?";
  return err?.message || 'Something went wrong.';
}
