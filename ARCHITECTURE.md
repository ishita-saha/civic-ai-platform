# How CivicFix is put together

This describes the code as it exists today, not as it is meant to look eventually.
Where something is planned but unbuilt, it says so. If you are picking this up
cold, read [Reality check](#reality-check) first — it will save you an afternoon.

---

## The shape of it

```
Browser (React + Vite, :5173)
   │
   │  JSON over HTTP, no auth header
   ▼
FastAPI (:8000)
   │
   ├── mock_complaints  ← an in-memory Python list. This is the live store.
   │
   └── models.py / database.py  ← SQLAlchemy + Postgres. Written, never imported.
```

Two processes, no build step between them, no message queue, no cache. That is
the whole system. The parts that sound impressive in the README — clustering,
vision classification, SLA routing — are not in the codebase.

---

## Reality check

Read this before you trust anything else.

| Thing | Status |
|---|---|
| Citizen report form, photo + GPS | **Works.** End to end. |
| Staff dashboard, three status lanes | **Works.** Reads from the API. |
| Light/dark theme, responsive layout | **Works.** |
| Staff login | **Cosmetic.** Client-side only — see [Auth](#auth). |
| Persistence | **None.** Restart the API and every report is gone. |
| Postgres schema (`models.py`) | **Orphaned.** Correct-looking, never imported by `main.py`. |
| Supabase | **Configured, unused.** Keys sit in `backend/.env`; no code calls it. |
| Photo upload | **Filename only.** The image bytes never leave the browser. |
| Before/after evidence | **UI complete, no real photos.** Demo cases use generated TEST placeholders. |
| Duplicate clustering (DBSCAN) | **Not built.** |
| AI vision classification | **Not built.** `priority_score` is hardcoded to `85`. |
| RAG / SLA routing | **Not built.** Department is derived from the category string. |
| Notifications | **Not built.** |

---

## Frontend

`frontend/src/`, React 19 + Vite. No Tailwind, no component library, no CSS
framework — plain CSS with custom properties.

```
src/
  index.css              design system: tokens, reset, primitives, animation
  App.jsx                shell — topbar, tab routing, data fetch, providers
  components/
    Landing.jsx          public homepage
    ReportForm.jsx       citizen submission flow
    PastWork.jsx         public before/after gallery of closed cases
    AdminDashboard.jsx   staff view — stats, search, three lanes
    ComplaintTable.jsx   the table itself
    BeforeAfter.jsx      the before/after pair, table- and gallery-sized
    Login.jsx            staff sign-in screen
    AuthProvider.jsx     session state
    Toast.jsx            notification host
    StatCard.jsx  StatusBadge.jsx  EmptyState.jsx
  lib/
    api.js               axios client + error flattening
    format.js            dates, coordinates, initials, status bucketing
    demoData.js          stand-in resolved cases, category list, photoPair()
    placeholder.js       generated TEST placeholder art (SVG data URIs)
    authContext.js       context + useAuth
    toastContext.js      context + useToast
```

**Styling rule.** Every colour, radius, shadow and easing curve is a custom
property in `:root` in `index.css`. Components reference tokens, never raw hex.
Dark mode is a second token block under `:root[data-theme='dark']` — no
component knows which theme is active. If you find yourself typing `#` inside a
component, add a token instead.

**Why context files are split from providers.** `authContext.js` and
`toastContext.js` hold only the context object and the hook; the provider
component lives in `components/`. A module that exports both a component and a
hook loses its React Fast Refresh boundary and forces a full page reload on
every edit. Two files, no reloads.

**Routing** is the URL hash (`#home`, `#report`, `#work`, `#admin`), read on load
and on `hashchange`. Deliberately not React Router — four flat views did not
justify the dependency. The moment one needs a URL parameter (`#case/SOLV-892`),
swap it; `react-router-dom` is already in `package.json`.

**Animation** is CSS-only. Two easing curves (`--ease-out`, `--ease-spring`) and
a handful of keyframes. Staggered entrances use a `--i` index set inline per
item. Everything collapses under `prefers-reduced-motion` via one global block —
you do not need to remember it per component.

---

## Backend

`backend/main.py`, FastAPI. Three route handlers, ~60 lines.

- `GET  /` — health string
- `GET  /complaints` — returns the in-memory list
- `POST /complaints` — appends to it

The POST handler takes `Dict[Any, Any]` — an untyped bag. It picks out the
fields it knows, then copies every remaining key onto the record verbatim. That
is why the frontend can send `complainant`, `geotag` and `reviewer` objects the
backend has never heard of and they survive the round trip.

It is also why there is no validation. `schemas.py` defines proper Pydantic
models (`ComplaintCreate`, `ComplaintResponse`) that would give you that for
free — they are simply not wired to the routes yet. **This is the single
highest-value hour of work in the repo.**

CORS is `allow_origins=["*"]`. Fine for local development, wrong for anything else.

---

## Data flow: one report, end to end

1. Citizen picks a photo. The browser creates an object URL for preview and
   immediately calls `navigator.geolocation.getCurrentPosition`.
2. Submit stays disabled until that call returns a fix. This is the product's
   one real rule — no GPS, no report.
3. `POST /complaints` sends contact details, title, description, category, the
   coordinate object, the photo **filename**, and an ISO timestamp.
4. FastAPI assigns `id = len(list) + 1`, sets `status = "Pending"` and
   `priority_score = 85`, appends, returns the record.
5. The frontend shows the reference number and re-fetches the list.
6. The dashboard buckets every record by a regex over its `status` string
   (`format.js → statusOf`) into pending / progress / resolved.

**Status is free text, matched by regex.** `"Pending"`, `"In Progress"`,
`"Solved"` and `"Resolved"` all work because `statusOf` is loose about it. This
is forgiving of the backend's inconsistency and will quietly mis-bucket anything
unexpected. An enum on both sides would be better.

---

## Evidence photos

A closed case is supposed to rest on two images: the place as reported, and the
place once the crew finished. `BeforeAfter.jsx` renders that pair everywhere it
appears — the homepage case study, the `#work` gallery, and the resolved lane of
the staff table — at two sizes, `mini` and `full`.

The two shapes it has to absorb are reconciled in one place, `photoPair()` in
`demoData.js`: demo records carry `before_photo` / `after_photo`, while a
backend that only ever stored one image exposes `completed_photo`. That single
field maps to the *after* pane, and the before pane renders "Not on file"
rather than silently disappearing — a missing before-photo is information, not
an empty cell.

**The demo images are generated, not photographed.** `placeholder.js` builds SVG
data URIs stamped `TEST` and `not a real photograph`. This replaced stock
photos of unrelated subjects — a chrome tap illustrating a streetlight repair.
A picture that contradicts its caption trains people to distrust the evidence
column, which is the one column this product exists to make trustworthy. If you
wire up real uploads, drop the `testPhoto()` calls from `demoData.js`; nothing
else needs to change.

**The `#work` gallery is public and shows no complainant details** — no name, no
phone number — unlike the staff dashboard. Who reported a pothole is nobody's
business; whether it was fixed is everybody's. Keep that split if you extend it.

## Auth

`AuthProvider.jsx` holds two hardcoded staff accounts and writes a session to
`localStorage`. The dashboard tab renders `<Login>` instead of `<AdminDashboard>`
when there is no session.

**This is a UI gate, not access control.** The credentials are in the JS bundle.
The API is unauthenticated. Anyone can run:

```bash
curl http://127.0.0.1:8000/complaints
```

and get every reporter's name and phone number without touching the frontend.
The login stops a casual visitor landing on a page full of personal data. It
stops nothing else.

**To make it real**, three things have to happen together — doing only the first
is theatre:

1. Replace the body of `signIn` in `AuthProvider.jsx` with a call to Supabase
   Auth or a real `/auth/login`. Keep the return shape and every consumer of
   `useAuth()` keeps working.
2. Add a FastAPI dependency that verifies a bearer token, and put it on
   `GET /complaints`.
3. Attach the token in `lib/api.js` via an axios request interceptor.

**Do not copy `SUPABASE_KEY` from `backend/.env` into the frontend** without
checking which key it is. If it is the `service_role` key it bypasses row-level
security, and pasting it into a `VITE_`-prefixed variable ships it inside the
public JS bundle to every visitor. The frontend needs the **anon** key, and
nothing else.

---

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | Postgres. Read by `database.py`, which nothing imports. |
| `SUPABASE_URL` / `SUPABASE_KEY` | `backend/.env` | Unused by the running app. |
| `VITE_API_URL` | `frontend/.env` (optional) | API base. Defaults to `http://127.0.0.1:8000`. |

`frontend/src/supabaseClient.js` calls `createClient` with two `VITE_` variables
that are not defined anywhere. It throws on import — harmless only because
nothing imports it. Delete it or configure it; leaving it is a trap for whoever
touches it next.

---

## Known sharp edges

- **`database.py` crashes on import when `DATABASE_URL` is unset.** `create_engine(None)`
  raises at module scope. Currently invisible because `main.py` never imports it.
- **IDs collide after a delete.** `id = len(mock_complaints) + 1` reuses numbers
  as soon as anything is removed. Fine for a list that only grows; a bug the
  moment it doesn't.
- **`main.py:52`** reads `data.location if hasattr(data, 'location')` on a `dict`.
  A dict never has a `.location` attribute, so this always falls through to
  `data.get(...)`. Harmless, but it is dead code hiding a misunderstanding.
- **Eight empty `.jsx` files** in `frontend/src/pages/`, plus an unused
  `ReportComplaint.jsx`. Nothing imports them. Importing one would fail the build.
- **The `/complaints` list is unbounded.** No pagination. Fine at 20 records,
  not at 20,000.

---

## If you are adding to this

Roughly in order of payoff:

1. **Wire `schemas.py` to the routes.** Typed request bodies, free validation,
   automatic OpenAPI docs at `/docs`.
2. **Connect Postgres.** The schema is already written — import it, add a
   session dependency, swap the list for queries.
3. **Store the photo.** Currently only the filename survives, which makes
   "proof of work" a promise the system cannot keep.
4. **Real auth**, all three steps above.
5. **Then** the clever parts — clustering, classification, routing.

Steps 1–4 are what turns this from a convincing demo into something you could
put in front of a ward office. Step 5 is what the README talks about.
