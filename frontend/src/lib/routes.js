/**
 * Where a session belongs, and which redirects are safe to follow.
 *
 * Its own module rather than a couple of exports on the login page: a file that
 * exports both a component and a plain function loses its React Fast Refresh
 * boundary, which is the same reason the contexts are split from the providers.
 */

/** The landing spot for an account when nothing more specific was asked for. */
export function homeFor(user) {
  return user?.role === 'admin' ? '/admin' : '/community';
}

/**
 * Only ever follow a same-site path. Without this check, `/login?next=https://
 * evil.example` turns our own redirect into an open one.
 *
 * A citizen who was bounced off an admin URL is not sent back to it after
 * signing in — they'd only be bounced again. They get their own home instead.
 */
export function safeNext(value, user) {
  const fallback = homeFor(user);
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/admin') && user?.role !== 'admin') return fallback;
  return value;
}
