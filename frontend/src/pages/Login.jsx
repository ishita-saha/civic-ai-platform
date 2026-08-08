import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import LoginForm from '../components/Login';
import { useAuth } from '../lib/authContext';
import { safeNext } from '../lib/routes';
import { useToast } from '../lib/toastContext';

/**
 * Sign-in, for both roles.
 *
 * The form itself is <Login>; this page owns the routing half: where to send
 * someone afterwards, and what to do if they're already signed in.
 */
export default function Login() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  // Already signed in — there is nothing to do here. `replace` keeps this page
  // out of the history so Back doesn't land on a login form that redirects.
  if (user) {
    return <Navigate to={safeNext(params.get('next'), user)} replace state={{ from: location }} />;
  }

  return (
    <LoginForm
      onSignedIn={(session) => {
        toast.success(
          `Signed in as ${session.name}`,
          session.role === 'admin'
            ? 'You have the triage queue and the case controls.'
            : 'Post a problem, or back one your neighbours have raised.',
        );
        navigate(safeNext(params.get('next'), session), { replace: true });
      }}
    />
  );
}
