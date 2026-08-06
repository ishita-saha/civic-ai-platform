import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Crosshair,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { createComplaint, readableError } from '../lib/api';
import { CATEGORIES } from '../lib/demoData';
import { useToast } from '../lib/toastContext';

const EMPTY = { fullName: '', phone: '', email: '', title: '', description: '', category: 'Roads' };

function validate(values, hasPhoto, geoOk) {
  const e = {};
  if (!values.fullName.trim()) e.fullName = 'We need a name to follow up with you.';
  if (!values.phone.trim()) e.phone = 'A contact number is required.';
  else if (values.phone.replace(/\D/g, '').length < 7) e.phone = "That doesn't look like a phone number.";
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim()))
    e.email = 'Check the email address.';
  if (!values.title.trim()) e.title = 'Give the issue a short title.';
  if (!hasPhoto) e.photo = 'A photo of the issue is required.';
  else if (!geoOk) e.photo = 'We still need to confirm where the photo was taken.';
  return e;
}

export default function ReportForm({ onSubmitted }) {
  const toast = useToast();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);

  // idle | locating | ok | failed
  const [geoState, setGeoState] = useState('idle');
  const [coords, setCoords] = useState(null);
  const [geoMessage, setGeoMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const previewRef = useRef('');

  /**
   * Object URLs leak until revoked. This is the only place preview URLs are
   * created or released, so exactly one is ever alive.
   */
  const swapPreview = (url) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  };

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const set = (key) => (e) => {
    const next = { ...values, [key]: e.target.value };
    setValues(next);
    // Re-validate live, but only after the first submit attempt — nobody wants
    // to be told their name is invalid while they're still typing it.
    if (touched) setErrors(validate(next, !!file, geoState === 'ok'));
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGeoState('failed');
      setGeoMessage('This browser cannot share location. Try a different one.');
      return;
    }

    setGeoState('locating');
    setGeoMessage('Pinpointing where this photo was taken…');

    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude, lng: c.longitude, accuracy: c.accuracy });
        setGeoState('ok');
        setGeoMessage('');
        // The photo error is stale the moment we get a fix — drop just that key.
        setErrors(({ photo: _resolved, ...rest }) => rest);
      },
      (err) => {
        setGeoState('failed');
        setGeoMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was blocked. Enable it for this site, then retry.'
            : 'Could not get a location fix. Move to open sky and retry.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const acceptFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('That file is not an image', 'Upload a JPG, PNG or HEIC photo of the issue.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Photo is too large', 'Keep it under 10 MB.');
      return;
    }
    setFile(f);
    swapPreview(URL.createObjectURL(f));
    locate();
  };

  const clearPhoto = () => {
    setFile(null);
    swapPreview('');
    setCoords(null);
    setGeoState('idle');
    setGeoMessage('');
  };

  const reset = () => {
    clearPhoto();
    setValues(EMPTY);
    setErrors({});
    setTouched(false);
    setReceipt(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    const found = validate(values, !!file, geoState === 'ok');
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Not quite ready', 'Check the highlighted fields and try again.');
      document.querySelector('.input-invalid, .dropzone')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await createComplaint({
        complainant: {
          fullName: values.fullName.trim(),
          phone: values.phone.trim(),
          email: values.email.trim() || null,
        },
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        location: `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`,
        geotag: coords,
        image_name: file?.name ?? null,
        timestamp: new Date().toISOString(),
      });

      const id = res?.data?.id ?? res?.id;
      setReceipt({ id, title: values.title.trim() });
      toast.success('Report filed', id ? `Your reference is #${id}.` : 'Thanks for reporting it.');
      onSubmitted?.();
    } catch (err) {
      toast.error('Could not submit', readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="card page-enter" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="card-body stack" style={{ '--gap': '14px', textAlign: 'center' }}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <span
              className="stat-icon"
              style={{
                '--tone': 'var(--c-ok)',
                '--tone-soft': 'var(--c-ok-soft)',
                width: 48,
                height: 48,
                borderRadius: 'var(--r-md)',
                animation: 'pop var(--t-slow) var(--ease-spring)',
              }}
            >
              <CheckCircle2 size={24} aria-hidden="true" />
            </span>
          </div>

          <h2 style={{ fontSize: 20 }}>Thanks — that&rsquo;s logged.</h2>
          <p className="page-lede" style={{ margin: '0 auto' }}>
            “{receipt.title}” is sitting with the triage desk. Hang on to the reference below —
            there are no SMS alerts yet, so it&rsquo;s how you find your case on the dashboard.
          </p>

          {receipt.id != null && (
            <p className="hint">
              Reference <span className="mono chip">#{receipt.id}</span>
            </p>
          )}

          <div className="row" style={{ justifyContent: 'center', marginTop: 4 }}>
            <button type="button" className="btn btn-primary" onClick={reset}>
              <RotateCcw size={15} aria-hidden="true" />
              Report something else
            </button>
          </div>
        </div>
      </div>
    );
  }

  const photoDone = !!file && geoState === 'ok';
  const detailsDone = !!values.fullName.trim() && !!values.phone.trim();
  const issueDone = !!values.title.trim();

  return (
    <div className="page-enter" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 className="page-title">Report a problem</h2>
        <p className="page-lede">
          Three short steps. The photo has to be taken where the problem is — we check the GPS so
          crews aren&rsquo;t sent to the wrong street.
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="card-body stack" style={{ '--gap': '28px' }}>
          {/* ---- 1. Contact ---- */}
          <div className={`section${detailsDone ? ' section-done' : ''}`}>
            <span className="section-num" aria-hidden="true">
              {detailsDone ? <CheckCircle2 size={15} /> : 1}
            </span>
            <div className="stack" style={{ '--gap': '14px' }}>
              <div>
                <h4>How do we reach you?</h4>
                <p className="hint">Only the department handling your case sees this.</p>
              </div>

              <div className="grid-3">
                <div className="field">
                  <label htmlFor="fullName">
                    Full name<span className="req">*</span>
                  </label>
                  <input
                    id="fullName"
                    className={`input${errors.fullName ? ' input-invalid' : ''}`}
                    value={values.fullName}
                    onChange={set('fullName')}
                    placeholder="Aritra Ganguly"
                    autoComplete="name"
                    aria-invalid={!!errors.fullName}
                  />
                  {errors.fullName && (
                    <span className="field-error">
                      <AlertCircle size={12} aria-hidden="true" /> {errors.fullName}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="phone">
                    Phone<span className="req">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    className={`input tnum${errors.phone ? ' input-invalid' : ''}`}
                    value={values.phone}
                    onChange={set('phone')}
                    placeholder="+91 98300 00000"
                    autoComplete="tel"
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && (
                    <span className="field-error">
                      <AlertCircle size={12} aria-hidden="true" /> {errors.phone}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className={`input${errors.email ? ' input-invalid' : ''}`}
                    value={values.email}
                    onChange={set('email')}
                    placeholder="optional"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <span className="field-error">
                      <AlertCircle size={12} aria-hidden="true" /> {errors.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ---- 2. The issue ---- */}
          <div className={`section${issueDone ? ' section-done' : ''}`}>
            <span className="section-num" aria-hidden="true">
              {issueDone ? <CheckCircle2 size={15} /> : 2}
            </span>
            <div className="stack" style={{ '--gap': '14px' }}>
              <div>
                <h4>What&rsquo;s wrong?</h4>
                <p className="hint">Plain language is fine. Detail helps us route it faster.</p>
              </div>

              <div className="field">
                <label htmlFor="title">
                  Short title<span className="req">*</span>
                </label>
                <input
                  id="title"
                  className={`input${errors.title ? ' input-invalid' : ''}`}
                  value={values.title}
                  onChange={set('title')}
                  placeholder="Streetlight out on Park Avenue"
                  aria-invalid={!!errors.title}
                />
                {errors.title && (
                  <span className="field-error">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.title}
                  </span>
                )}
              </div>

              <div className="field">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  className="input"
                  value={values.category}
                  onChange={set('category')}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="description">Details</label>
                <textarea
                  id="description"
                  className="input"
                  value={values.description}
                  onChange={set('description')}
                  placeholder="How long has it been like this? Is anyone at risk? Anything a crew should know before turning up?"
                  maxLength={600}
                />
                <span className="hint tnum">{values.description.length}/600</span>
              </div>
            </div>
          </div>

          {/* ---- 3. Photo + GPS ---- */}
          <div className={`section${photoDone ? ' section-done' : ''}`}>
            <span className="section-num" aria-hidden="true">
              {photoDone ? <CheckCircle2 size={15} /> : 3}
            </span>
            <div className="stack" style={{ '--gap': '14px' }}>
              <div>
                <h4>
                  Photo &amp; location<span className="req">*</span>
                </h4>
                <p className="hint">
                  Take the photo on the spot — your device&rsquo;s GPS stamps the report.
                </p>
              </div>

              {!preview ? (
                <div
                  className={`dropzone${dragging ? ' dropzone-active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    acceptFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Photo of the issue"
                    onChange={(e) => acceptFile(e.target.files?.[0])}
                  />
                  <span className="dropzone-icon">
                    <Camera size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <div style={{ color: 'var(--c-ink)', fontWeight: 550, fontSize: 14 }}>
                      Take a photo or drop one here
                    </div>
                    <div className="hint" style={{ marginTop: 3 }}>
                      JPG, PNG or HEIC · up to 10 MB
                    </div>
                  </div>
                </div>
              ) : (
                <div className="preview">
                  <img src={preview} alt="The issue you photographed" />
                  <div className="stack" style={{ '--gap': '8px', flex: 1, minWidth: 0 }}>
                    <div>
                      <div
                        style={{
                          color: 'var(--c-ink)',
                          fontWeight: 550,
                          fontSize: 13.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.name}
                      </div>
                      <div className="hint tnum">{(file.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <div>
                      <button type="button" className="btn btn-ghost" onClick={clearPhoto}>
                        <Trash2 size={14} aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {geoState === 'locating' && (
                <div className="geo geo-pending">
                  <span className="ping" aria-hidden="true" />
                  <span>{geoMessage}</span>
                </div>
              )}

              {geoState === 'ok' && coords && (
                <div className="geo geo-ok">
                  <ShieldCheck size={15} aria-hidden="true" style={{ flex: 'none' }} />
                  <span>
                    Location verified —{' '}
                    <span className="mono tnum">
                      {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                    </span>
                    {coords.accuracy ? ` (±${Math.round(coords.accuracy)} m)` : ''}
                  </span>
                </div>
              )}

              {geoState === 'failed' && (
                <div className="geo geo-fail" style={{ flexWrap: 'wrap' }}>
                  <AlertCircle size={15} aria-hidden="true" style={{ flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 180 }}>{geoMessage}</span>
                  <button type="button" className="btn" onClick={locate}>
                    <Crosshair size={14} aria-hidden="true" />
                    Retry
                  </button>
                </div>
              )}

              {errors.photo && geoState !== 'failed' && geoState !== 'locating' && (
                <span className="field-error">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.photo}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="card-head"
          style={{ borderTop: '1px solid var(--c-line)', borderBottom: 0, padding: '16px 20px' }}
        >
          <p className="hint">
            {photoDone
              ? 'All set — this report is ready to file.'
              : 'A geotagged photo is required before you can submit.'}
          </p>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Filing…
              </>
            ) : (
              <>
                <Send size={16} aria-hidden="true" />
                Submit report
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
