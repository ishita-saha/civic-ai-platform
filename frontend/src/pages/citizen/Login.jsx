import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import LoginForm from '../../components/Login';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../lib/toastContext';

/**
 * Staff sign-in.
 *
 * Lives under `citizen/` only because that's where the route table put it — it
 * is the shared, unauthenticated shell, and the one page an admin route is
 * allowed to bounce you to.
 *
 * The form itself is <Login>; this page owns the routing half: where to send
 * someone afterwards, and what to do if they're already signed in.
 */

/**
 * Only ever follow a same-site path. Without this check, `/login?next=https://
 * evil.example` turns our own redirect into an open one.
 */
function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

export default function Login() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const next = safeNext(params.get('next'));

  // Already signed in — there is nothing to do here. `replace` keeps this page
  // out of the history so Back doesn't land on a login form that redirects.
  if (user) return <Navigate to={next} replace state={{ from: location }} />;

  return (
    <LoginForm
      onSignedIn={() => {
        toast.success('Signed in', 'Welcome back.');
        navigate(next, { replace: true });
      }}
    />
  );
}
