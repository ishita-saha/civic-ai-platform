import { useState } from 'react';
import { AlertCircle, Crosshair, Loader2, MapPin, Send } from 'lucide-react';
import { createComplaint, readableError } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { CATEGORIES } from '../lib/demoData';
import { useToast } from '../lib/toastContext';

/**
 * Posting a problem to the community feed.
 *
 * Lighter than <ReportForm> on purpose. That form is the formal channel: it
 * demands a photo taken on the spot and refuses to submit without a GPS fix,
 * because a crew is going to be dispatched off it. This is the noticeboard — a
 * neighbour saying "the light on Park Avenue is out, anyone else?" — and
 * holding it to the same bar would mean nothing ever gets posted.
 *
 * What the two share is the queue. A post here is the same record the admin
 * triages, so severity is classified from these words the same way, and the
 * upvotes it collects push it up the same list.
 */
const EMPTY = { title: '', description: '', category: 'Roads', location: '' };

export default function PostComposer({ onPosted }) {
  const { user } = useAuth();
  const toast = useToast();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      toast.error('No location available', 'This browser cannot share a position. Type the street instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude, lng: c.longitude });
        setValues((v) => ({
          ...v,
          location: v.location.trim() || `${c.latitude.toFixed(4)}° N, ${c.longitude.toFixed(4)}° E`,
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.info('Location not shared', 'No problem — type the street name and we will use that.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const submit = async (e) => {
    e.preventDefault();

    const found = {};
    if (values.title.trim().length < 6) found.title = 'A few more words — this is the headline neighbours will read.';
    if (values.description.trim().length < 12) found.description = 'Say what is wrong and how long it has been like that.';
    if (!values.location.trim()) found.location = 'Where is it? A street name is enough.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const res = await createComplaint({
        author_id: user.id,
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        location: values.location.trim(),
        geotag: coords,
        timestamp: new Date().toISOString(),
      });

      const record = res?.data ?? res;
      setValues(EMPTY);
      setCoords(null);
      toast.success('Posted to the feed', `Neighbours can back it now — reference #${record?.id}.`);
      onPosted?.(record);
    } catch (err) {
      toast.error('Could not post', readableError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit} noValidate>
      <div className="card-head">
        <h3>Raise a problem</h3>
        <span className="hint">Posting as {user?.name}</span>
      </div>

      <div className="card-body stack" style={{ '--gap': '14px' }}>
        <div className="field">
          <label htmlFor="post-title">
            What&rsquo;s wrong?<span className="req">*</span>
          </label>
          <input
            id="post-title"
            className={`input${errors.title ? ' input-invalid' : ''}`}
            value={values.title}
            onChange={set('title')}
            placeholder="Street light out on Park Avenue"
            maxLength={110}
          />
          {errors.title && (
            <span className="field-error">
              <AlertCircle size={12} aria-hidden="true" /> {errors.title}
            </span>
          )}
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="post-category">Category</label>
            <select id="post-category" className="input" value={values.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="post-location">
              Where<span className="req">*</span>
            </label>
            <div className="row" style={{ '--gap': '8px' }}>
              <input
                id="post-location"
                className={`input${errors.location ? ' input-invalid' : ''}`}
                value={values.location}
                onChange={set('location')}
                placeholder="Park Avenue, Zone 4"
              />
              <button
                type="button"
                className="btn btn-icon"
                onClick={locate}
                disabled={locating}
                title="Use my current location"
                aria-label="Use my current location"
              >
                {locating ? (
                  <Loader2 size={15} className="spin" aria-hidden="true" />
                ) : (
                  <Crosshair size={15} aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.location && (
              <span className="field-error">
                <AlertCircle size={12} aria-hidden="true" /> {errors.location}
              </span>
            )}
            {coords && (
              <span className="hint row" style={{ '--gap': '5px' }}>
                <MapPin size={12} aria-hidden="true" />
                <span className="mono tnum">
                  {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                </span>{' '}
                attached
              </span>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="post-description">
            Details<span className="req">*</span>
          </label>
          <textarea
            id="post-description"
            className={`input${errors.description ? ' input-invalid' : ''}`}
            value={values.description}
            onChange={set('description')}
            placeholder="How long has it been like this? Is anybody at risk? Words like “open manhole” or “live wire” are read by the classifier, so be specific about the hazard."
            maxLength={600}
          />
          <div className="spread">
            {errors.description ? (
              <span className="field-error">
                <AlertCircle size={12} aria-hidden="true" /> {errors.description}
              </span>
            ) : (
              <span className="hint">Severity is classified from what you write here.</span>
            )}
            <span className="hint tnum">{values.description.length}/600</span>
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={15} className="spin" aria-hidden="true" />
                Posting…
              </>
            ) : (
              <>
                <Send size={15} aria-hidden="true" />
                Post to the feed
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
