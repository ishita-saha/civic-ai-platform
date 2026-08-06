import { ArrowRight, Camera, MapPin, ShieldCheck } from 'lucide-react';
import BeforeAfter from './BeforeAfter';
import { demoResolved } from '../lib/demoData';
import { statusOf } from '../lib/format';

const PIPELINE = [
  {
    n: 1,
    title: 'Filed',
    body: 'Your photo, the GPS fix and your contact details land in the triage queue. You get a reference number on the spot.',
  },
  {
    n: 2,
    title: 'Triaged',
    body: 'Someone at the desk reads it and hands it to a department — roads, sanitation, lighting, water, drainage.',
  },
  {
    n: 3,
    title: 'Crew assigned',
    body: 'A named engineer goes against your case. Not "the council" — a person, with an employee ID.',
  },
  {
    n: 4,
    title: 'Closed with proof',
    body: 'The crew photographs the finished work and an inspector signs it off. Both show up on the public dashboard.',
  },
];

export default function Landing({ complaints, onReport, onSeeWork }) {
  const resolvedCount = complaints.filter((c) => statusOf(c) === 'resolved').length || demoResolved.length;
  const example = demoResolved[0];

  return (
    <div className="landing page-enter">
      {/* ---- Hero ---- */}
      <section className="hero">
        <span className="eyebrow">Kolkata Municipal Corporation · pilot</span>
        <h1>
          Report it once.
          <br />
          <em>Then watch it actually get fixed.</em>
        </h1>
        <p className="hero-lede">
          Photograph the pothole, the streetlight that&rsquo;s been dark a fortnight, the bin nobody
          has emptied. Your phone stamps where you were standing, so the crew turns up at the right
          address instead of the wrong end of the street.
        </p>

        <div className="hero-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onReport}>
            <Camera size={17} aria-hidden="true" />
            Report an issue
          </button>
          <button type="button" className="btn btn-lg" onClick={onSeeWork}>
            See what&rsquo;s been fixed
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="tally">
          <span>
            <b>{complaints.length}</b> reports filed
          </span>
          <span>
            <b>{resolvedCount}</b> closed with photo proof
          </span>
          <span>
            <b>100%</b> carrying a GPS fix
          </span>
        </div>
      </section>

      {/* ---- The one rule ---- */}
      <section className="band">
        <div className="band-head">
          <span className="eyebrow">The one rule</span>
          <h2>The photo has to be taken where the problem is</h2>
        </div>
        <div className="prose">
          <p>
            The old paper form let you type an address. People wrote things like{' '}
            <strong>&ldquo;near the big tree, Ward 62&rdquo;</strong>. A crew would book half a day,
            drive out, find three big trees and no pothole, and log the job as unfound. The report
            went back in the queue and the hole stayed there.
          </p>
          <p>
            So the form here won&rsquo;t submit without a live GPS fix taken at the same moment as
            the photo. It&rsquo;s a small amount of friction for you and it removes an entire
            category of wasted trip for them.
          </p>
        </div>
      </section>

      {/* ---- Pipeline ---- */}
      <section className="band">
        <div className="band-head">
          <span className="eyebrow">After you press submit</span>
          <h2>Where your report goes</h2>
          <p>
            Four states, and you can see all of them on the dashboard — including the ones still
            sitting in the queue.
          </p>
        </div>

        <div className="timeline">
          {PIPELINE.map((s, i) => (
            <div className="step anim-rise" key={s.n} style={{ '--i': i }}>
              <span className="step-mark">{s.n}</span>
              <div>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Worked example ---- */}
      <section className="band">
        <div className="band-head">
          <span className="eyebrow">One that closed</span>
          <h2>What a finished case looks like</h2>
        </div>

        <div className="case-study">
          <div style={{ padding: 14 }}>
            <BeforeAfter item={example} />
          </div>
          <div className="case-study-body stack" style={{ '--gap': '12px' }}>
            <div>
              <span className="mono hint">#{example.id}</span>
              <h4 style={{ fontSize: 16, margin: '4px 0 6px' }}>{example.title}</h4>
              <p className="hint" style={{ lineHeight: 1.6 }}>
                {example.description}
              </p>
            </div>

            <div className="stack" style={{ '--gap': '4px' }}>
              <p className="ba-note" style={{ margin: 0 }}>
                <b style={{ color: 'var(--c-ink-2)' }}>Reported:</b> {example.before_note}
              </p>
              <p className="ba-note" style={{ margin: 0 }}>
                <b style={{ color: 'var(--c-ink-2)' }}>Done:</b> {example.after_note}
              </p>
            </div>

            <div className="stack" style={{ '--gap': '7px', fontSize: 13.5 }}>
              <span className="row" style={{ '--gap': '7px' }}>
                <MapPin size={13} aria-hidden="true" style={{ color: 'var(--c-ink-4)' }} />
                {example.location}
              </span>
              <span className="row" style={{ '--gap': '7px' }}>
                <ShieldCheck size={13} aria-hidden="true" style={{ color: 'var(--c-ok)' }} />
                Signed off by {example.reviewer.name}, {example.reviewer.designation}
              </span>
            </div>

            <p className="hint">
              Handled by {example.department} · {example.officer_assigned}
            </p>
          </div>
        </div>
      </section>

      {/* ---- Close ---- */}
      <section className="band">
        <div className="band-head" style={{ marginBottom: 18 }}>
          <h2>Found something broken?</h2>
          <p>It takes about a minute, and you need to be standing next to it.</p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={onReport}>
          <Camera size={17} aria-hidden="true" />
          Report an issue
        </button>
      </section>
    </div>
  );
}
