import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { readableError } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { homeFor, safeNext } from '../lib/routes';
import { useToast } from '../lib/toastContext';

/**
 * Resident sign-up.
 *
 * There is no role selector, and no admin option anywhere on this page. The API
 * ignores any role sent in the body and always mints a citizen — the single
 * admin account is seeded server-side. Both halves of that matter: a disabled
 * "admin" radio would still be a promise the server had to keep.
 */

function validate(values) {
  const e = {};
  if (values.name.trim().length < 2) e.name = 'Tell us what to call you.';
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) e.email = 'Check the email address.';
  if (values.password.length < 6) e.password = 'At least 6 characters.';
  else if (values.password !== values.confirm) e.confirm = 'The two passwords do not match.';
  return e;
}

const EMPTY = { name: '', email: '', password: '', confirm: '' };

export default function Signup() {
  const { user, signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (key) => (e) => {
    const next = { ...values, [key]: e.target.value };
    setValues(next);
    // Re-validate live only after the first attempt — nobody wants to be told
    // their email is invalid while they're still typing it.
    if (touched) setErrors(validate(next));
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setFailure('');

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const session = await signUp({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      toast.success(`Welcome, ${session.name}`, 'Your account is live — you are signed in.');
      // Resumes wherever the guard bounced them from; the feed otherwise.
      navigate(safeNext(params.get('next'), session), { replace: true });
    } catch (err) {
      setFailure(readableError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter" style={{ maxWidth: 440, margin: '32px auto 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <span
          className="stat-icon"
          style={{
            '--tone': 'var(--c-brand)',
            '--tone-soft': 'var(--c-brand-soft)',
            width: 44,
            height: 44,
            borderRadius: 'var(--r-md)',
            margin: '0 auto 14px',
          }}
        >
          <UserPlus size={20} aria-hidden="true" />
        </span>
        <h2 className="page-title">Create a resident account</h2>
        <p className="page-lede" style={{ margin: '6px auto 0' }}>
          You need one to post a problem or to back somebody else&rsquo;s. It takes about twenty
          seconds.
        </p>
      </div>

      <form className="card" onSubmit={submit} noValidate>
        <div className="card-body stack" style={{ '--gap': '16px' }}>
          <div className="field">
            <label htmlFor="name">
              Name<span className="req">*</span>
            </label>
            <input
              id="name"
              className={`input${errors.name ? ' input-invalid' : ''}`}
              value={values.name}
              onChange={set('name')}
              placeholder="Aritra Ganguly"
              autoComplete="name"
              autoFocus
            />
            {errors.name && (
              <span className="field-error">
                <AlertCircle size={12} aria-hidden="true" /> {errors.name}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="email">
              Email<span className="req">*</span>
            </label>
            <input
              id="email"
              type="email"
              className={`input${errors.email ? ' input-invalid' : ''}`}
              value={values.email}
              onChange={set('email')}
              placeholder="you@example.com"
              autoComplete="email"
            />
            {errors.email && (
              <span className="field-error">
                <AlertCircle size={12} aria-hidden="true" /> {errors.email}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">
              Password<span className="req">*</span>
            </label>
            <input
              id="password"
              type="password"
              className={`input${errors.password ? ' input-invalid' : ''}`}
              value={values.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
            {errors.password && (
              <span className="field-error">
                <AlertCircle size={12} aria-hidden="true" /> {errors.password}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="confirm">
              Confirm password<span className="req">*</span>
            </label>
            <input
              id="confirm"
              type="password"
              className={`input${errors.confirm ? ' input-invalid' : ''}`}
              value={values.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
            />
            {errors.confirm && (
              <span className="field-error">
                <AlertCircle size={12} aria-hidden="true" /> {errors.confirm}
              </span>
            )}
          </div>

          {failure && (
            <span className="field-error">
              <AlertCircle size={13} aria-hidden="true" /> {failure}
            </span>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus size={16} aria-hidden="true" />
                Create account
              </>
            )}
          </button>

          <p className="hint" style={{ textAlign: 'center' }}>
            Already have one? <Link to="/login">Sign in</Link> · Municipal staff:{' '}
            <Link to="/login?as=admin">administrator sign-in</Link>
          </p>
        </div>
      </form>

      <p
        className="hint"
        style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 14, lineHeight: 1.5 }}
      >
        <ShieldCheck size={14} aria-hidden="true" style={{ marginTop: 2, flex: 'none' }} />
        <span>
          Sign-up creates resident accounts only. Municipal staff accounts are issued by the
          corporation and cannot be created here.
        </span>
      </p>
    </div>
  );
}
