import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../lib/authContext';

export default function Login({ onSignedIn }) {
  const { signIn, demoStaff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      onSignedIn?.();
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const fillFrom = (staff) => {
    setEmail(staff.email);
    setPassword(staff.password);
    setError('');
  };

  return (
    <div className="page-enter" style={{ maxWidth: 420, margin: '40px auto 0' }}>
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
          <Lock size={20} aria-hidden="true" />
        </span>
        <h2 className="page-title">Staff sign in</h2>
        <p className="page-lede" style={{ margin: '6px auto 0' }}>
          The dashboard shows reporters&rsquo; names and phone numbers, so it sits behind a login.
        </p>
      </div>

      <form className="card" onSubmit={submit} noValidate>
        <div className="card-body stack" style={{ '--gap': '16px' }}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              className={`input${error ? ' input-invalid' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@kmc.gov.in"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={`input${error ? ' input-invalid' : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <span className="field-error">
              <AlertCircle size={13} aria-hidden="true" /> {error}
            </span>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Checking…
              </>
            ) : (
              <>
                <KeyRound size={16} aria-hidden="true" />
                Sign in
              </>
            )}
          </button>
        </div>
      </form>

      {/* This is a demo build, so the accounts are on the screen rather than
          in a README nobody opens. */}
      <div className="card" style={{ marginTop: 16, background: 'var(--c-surface-2)' }}>
        <div className="card-body stack" style={{ '--gap': '10px' }}>
          <div>
            <span className="eyebrow">Demo accounts</span>
            <p className="hint" style={{ marginTop: 4 }}>
              Nothing real is behind these — the API itself is still open. Click one to fill the
              form.
            </p>
          </div>
          {demoStaff.map((s) => (
            <button
              key={s.email}
              type="button"
              className="btn"
              style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: 10 }}
              onClick={() => fillFrom(s)}
            >
              <span className="avatar" aria-hidden="true">
                {s.name
                  .replace(/\b(dr|er)\.?\s/gi, '')
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 560 }}>{s.name}</span>
                <span className="hint mono" style={{ display: 'block', fontWeight: 400 }}>
                  {s.email} · {s.password}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
