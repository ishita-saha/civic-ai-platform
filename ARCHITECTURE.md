# How CivicFix is put together

This describes the code as it exists today, not as it is meant to look eventually.
Where something is planned but unbuilt, it says so. If you are picking this up
cold, read [Reality check](#reality-check) first — it will save you an afternoon.

---

## The shape of it

```
Browser (React + Vite, :5173)
   │
   │  JSON over HTTP. Reads unauthenticated; admin writes carry X-Admin-Key.
   ▼
FastAPI (:8000)
   │
   ├── USERS       ← in-memory list. One admin, seeded; citizens from signup.
   ├── COMPLAINTS  ← in-memory list. Posts, votes, severity, verification.
   │
   └── models.py / database.py  ← SQLAlchemy + Postgres. Written, never imported.
```

Two processes, no build step between them, no message queue, no cache. That is
the whole system. The parts that sound impressive in the README — clustering,
vision classification, SLA routing — are not in the codebase; severity is a
keyword pass, and it says so where it is defined.

**A post and a complaint are the same record.** One list, seen from two ends:
residents read it as a feed they can add to and vote on, the administrator reads
it as a queue with controls. Keeping them one list is the reason an upvote on
the feed visibly moves a case in the queue — there is nothing to synchronise.

---

## Reality check

Read this before you trust anything else.

| Thing | Status |
|---|---|
| Citizen report form, photo + GPS | **Works.** End to end. |
| Signup / login, two roles | **Works.** Server-side accounts — see [Auth](#auth). |
| Community feed, one-vote-per-account upvotes | **Works.** Tally lives on the server. |
| Severity classification | **Works, and it is a word list.** `classify_severity` in `main.py`. |
| Triage queue ranked by severity + backing | **Works.** |
| Verify-before-dispatch gate | **Works, and enforced server-side.** 409 on an unverified move. |
| Staff dashboard, three status lanes | **Works.** Reads from the API. |
| Light/dark theme, responsive layout | **Works.** |
| Password handling | **Plaintext.** Deliberate for a demo; see [Auth](#auth). |
| Persistence | **None.** Restart the API and every account, post and vote is gone. |
| Postgres schema (`models.py`) | **Orphaned.** Correct-looking, never imported by `main.py`. |
| Supabase | **Configured, unused.** Keys sit in `backend/.env`; no code calls it. |
| Photo upload | **Filename only.** The image bytes never leave the browser. |
| Duplicate posts | **Manual.** Upvoting an existing post is the workaround, not clustering. |
| Before/after evidence | **UI complete, no real photos.** Demo cases use generated TEST placeholders. |
| Duplicate clustering (DBSCAN) | **Not built.** |
| AI vision classification | **Not built.** `priority_score` is severity band + capped upvote bonus. |
| RAG / SLA routing | **Not built.** Department is derived from the category string. |
| Notifications | **Not built.** |

---

## Frontend

`frontend/src/`, React 19 + Vite. No Tailwind, no component library, no CSS
framework — plain CSS with custom properties.

```
src/
  index.css              design system: tokens, reset, primitives, animation
  App.jsx                shell — topbar, per-role nav, route table, route guards
  components/
    Landing.jsx          public homepage; its calls to action change per role
    PostComposer.jsx     the community feed's "raise a problem" form
    UpvoteButton.jsx     one-vote-per-account toggle, used in three places
    SeverityBadge.jsx    how bad (square mark) vs StatusBadge's where (round dot)
    ReportForm.jsx       the formal channel — photo + live GPS required
    PastWork.jsx         public before/after gallery of closed cases
    BeforeAfter.jsx      the before/after pair, table- and gallery-sized
    Login.jsx            the sign-in form, both roles, with quick accounts
    AuthProvider.jsx     session state, signIn / signUp / signOut
    Toast.jsx            notification host
    StatCard.jsx  StatusBadge.jsx  EmptyState.jsx  CaseTimeline.jsx
  pages/
    Login.jsx  Signup.jsx        auth screens (the routing half)
    citizen/Community.jsx        the resident portal — feed + composer
    citizen/Home.jsx  TrackComplaint.jsx  ComplaintDetails.jsx
    admin/Triage.jsx             the ranked queue with verify / dispatch
    admin/Dashboard.jsx          the full table at /admin/cases
    admin/Analytics.jsx  ComplaintDetails.jsx
  lib/
    api.js               axios client, admin-key interceptor, error flattening
    routes.js            homeFor() / safeNext() — where a role belongs
    format.js            dates, coords, initials, status + severity bucketing
    demoData.js          stand-in resolved cases, category list, photoPair()
    placeholder.js       generated TEST placeholder art (SVG data URIs)
    authContext.js       context + useAuth
    toastContext.js      context + useToast
```

`components/AdminDashboard.jsx` and `components/ComplaintTable.jsx` are the
pre-router versions, superseded by the files under `pages/admin/`. Nothing
imports them.

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

**Routing** is `react-router-dom`. It used to be the URL hash (`#home`,
`#report`, `#admin`) and swapped the moment a case needed its own URL;
`useLegacyHashRedirect` in `App.jsx` still translates those four old links once
on load.

**Three public screens, everything else gated.** `/`, `/login` and `/signup` are
all a signed-out visitor can reach. `RequireAuth` wraps the citizen routes and
`RequireAdmin` wraps `/admin/*`; both send a stranger to the **landing page**,
not to the login form. That is deliberate — the landing page is what explains
the product and carries both calls to action, and dropping someone straight onto
a password field asks them to authenticate to something nobody has described to
them yet.

The attempted path rides along as `/?next=…`, the landing page threads it
through its sign-in and sign-up links, and `safeNext` in `lib/routes.js` decides
whether to honour it — same-site paths only, and an `/admin` destination is
dropped for a citizen who would only be bounced again. A deep link to
`/complaint/42` therefore survives the detour through signup.

`RequireAdmin` treats a signed-in resident differently from a stranger: it
renders an explanation rather than a redirect, because bouncing them to a login
form they have already passed implies the password was the problem.

The nav is built per role rather than shown-and-disabled — an admin has no use
for the citizen report form, a resident has no business seeing a link to a queue
they cannot open, and a signed-out visitor gets no nav at all rather than a row
of links that would all bounce back.

**Animation** is CSS-only. Two easing curves (`--ease-out`, `--ease-spring`) and
a handful of keyframes. Staggered entrances use a `--i` index set inline per
item. Everything collapses under `prefers-reduced-motion` via one global block —
you do not need to remember it per component.

---

## Backend

`backend/main.py`, FastAPI. One file, two in-memory lists.

| Route | What it does |
|---|---|
| `GET /` | health string + counts |
| `POST /auth/signup` | mints a **citizen**. No role is read from the body. |
| `POST /auth/login` | returns the user minus the password; admins also get `admin_key` |
| `GET /auth/demo-accounts` | the roster behind the one-click sign-in buttons |
| `GET /complaints` | the whole list |
| `GET /complaints/{id}` | one case, 404 if absent |
| `POST /complaints` | appends; classifies severity from the text |
| `POST /complaints/{id}/upvote` | toggles one account's vote |
| `POST /complaints/{id}/verify` | admin only |
| `PATCH /complaints/{id}/status` | admin only; 409 if the case is unverified |

**Severity and priority.** `classify_severity` scans the title, description and
category against three word lists and returns `critical` / `high` / `moderate` /
`low`. `priority_of` turns that into a base score and adds `2.5` per upvote,
**capped at 22** — one band's worth. The cap is the design: popularity moves a
case up the queue, it never lets ten people annoyed about a faded sign outrank
one report of a live wire. Changing `UPVOTE_CAP` changes that guarantee.

**The verification gate is server-side.** `PATCH /status` refuses a move to "in
progress" or "resolved" on a case with `verified: False`, whatever the UI sends.
The button that hides itself is the reminder; the 409 is the rule.

**Admin writes need `X-Admin-Key`.** The key is handed out once, in the login
response for the admin account, so it never sits in the JS bundle the way the
old hardcoded frontend passwords did. `lib/api.js` attaches it via a request
interceptor. It is still one shared secret with no expiry.

The POST handler takes `Dict[Any, Any]` — an untyped bag. It picks out the
fields it knows, then copies every remaining key onto the record verbatim. That
is why the frontend can send `complainant`, `geotag` and `reviewer` objects the
backend has never heard of and they survive the round trip.

It is also why there is no validation on that one route. `schemas.py` defines
proper Pydantic models (`ComplaintCreate`, `ComplaintResponse`) that would give
you that for free — they are simply not wired to it yet. The auth and vote
routes *are* typed (`SignupBody`, `Credentials`, `VoteBody`, `StatusBody`).

CORS is `allow_origins=["*"]`. Fine for local development, wrong for anything else.

---

## Data flow: one problem, end to end

1. A resident signs up or signs in. The session — everything about the account
   except the password — goes to `localStorage`, and `api.setAdminKey` is called
   with `admin_key`, which is `undefined` for a citizen.
2. They post to the feed. `POST /complaints` carries `author_id`, the text, the
   category and a place; the API classifies severity from those words, scores
   it, appends it and returns the record. The provider slots it into the top of
   the cached list rather than refetching.
3. Neighbours press the arrow. `POST /complaints/{id}/upvote` adds or removes
   that account id from `voters` and rescores. The API rejects a vote on your
   own post and a vote from an id it does not know.
4. The administrator's queue sorts by that score. Every card shows both inputs —
   the severity band and the backing count — so the ordering is never something
   they have to take on trust.
5. They press **Verify**. `POST /complaints/{id}/verify` sets the flag, the name
   and the timestamp. Only now does a **Start work** control exist.
6. **Start work** → `PATCH /status` with `"In Progress"`, then **Mark resolved**
   → `"Resolved"`, which also stamps `resolved_at`.
7. Both detail pages bucket the record by a regex over its `status` string
   (`format.js → statusOf`) into pending / progress / resolved, and the public
   timeline reads `verified_at` for its second stage.

The formal `ReportForm` route is the same pipeline with a stricter front door:
it will not submit without a photo and a live GPS fix. When somebody is signed
in it attaches their `author_id` too, so a formal report lands on the feed as
theirs and can be backed like any other post.

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

Accounts live on the server. `AuthProvider.jsx` calls `POST /auth/login` or
`POST /auth/signup`, stores the returned session in `localStorage`, and hands
`admin_key` to `lib/api.js`. Signup only ever mints citizens — the API reads no
role from the body, so there is nothing to tamper with — and the single admin
account is seeded in `main.py`.

**Two roles, and exactly one boundary is real.**

| | Enforced where |
|---|---|
| Which pages you can open | Client only. `RequireAuth` / `RequireAdmin` decide what renders. Every route but `/`, `/login` and `/signup` needs a session. |
| Posting and voting as a given account | Client only. The API trusts the `user_id` in the body. |
| Verifying a report, dispatching a crew | **Server.** `X-Admin-Key` or 401. |
| Dispatching an *unverified* report | **Server.** 409 regardless of role. |

So a citizen session cannot verify or dispatch anything however it is edited in
devtools — but it can vote as somebody else, and reads are wide open:

```bash
curl http://127.0.0.1:8000/complaints
```

still returns every reporter's name without touching the frontend.

**Passwords are plaintext**, stored and compared as typed. That is honest about
what this is — a demo with the credentials printed on the login screen and
served from `/auth/demo-accounts` — rather than a hash that would imply the rest
of the chain was safe. Delete that route the moment any of this stops being a
demo.

**To make it real**, four things have to happen together — doing only the first
is theatre:

1. Hash the passwords (`passlib`, bcrypt) and stop returning credentials from
   any route.
2. Issue a signed token on login instead of a shared admin key, and verify it in
   a FastAPI dependency.
3. Put that dependency on the write routes — including `POST /complaints` and
   the vote route — and take the actor from the token, never from the body.
4. Attach the token in `lib/api.js`; the request interceptor that carries
   `X-Admin-Key` today is the seam.

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

- **The engine is built lazily, on purpose.** `database.py` used to call
  `create_engine(DATABASE_URL)` at module scope, which raised the instant
  `DATABASE_URL` was unset — so importing `models` or `routers.complaints` died
  with a SQLAlchemy stack trace instead of a useful message. It now builds the
  engine on first use via `get_engine()`. If you add a module-level
  `engine = ...` back, you reintroduce that.
- **The vote route trusts its body.** `POST /upvote` takes a `user_id` and
  checks only that such a user exists. Nothing stops a script voting as every
  account in `GET /users` — which is the whole ranking, gameable with a loop.
  Fixing this needs step 3 under [Auth](#auth), not a patch to the route.
- **`GET /users` is open** and lists every account's name and email. It exists
  for debugging. It should not survive contact with real users.
- **Severity is a word list.** `classify_severity` matches substrings, so
  "no danger to anyone" scores `critical` on the word *danger*. It is a stand-in
  with an obvious failure mode, not a model.
- **The upvote cap is load-bearing.** `UPVOTE_CAP = 22` is what keeps a popular
  nuisance below an unpopular hazard. Raising it past a band's width silently
  inverts the queue's priorities.
- **An account's posts and votes vanish with the process.** Restart and any
  account created through signup is gone while its browser session still says
  it is signed in — the next write fails, the UI still shows a name.
- **Eight empty `.jsx` files** in `frontend/src/pages/`, plus an unused
  `ReportComplaint.jsx`. Nothing imports them. Importing one would fail the build.
- **The `/complaints` list is unbounded.** No pagination, and the community feed
  renders all of it. Fine at 20 records, not at 20,000.

---

## If you are adding to this

Roughly in order of payoff:

1. **Real auth**, all four steps above. It is first now rather than fourth,
   because the ranking is a vote count and a vote count with no authentication
   behind it is decoration. Everything else on this list assumes it.
2. **Connect Postgres.** The schema is already written — import it, add a
   session dependency, swap the two lists for queries. `voters` wants a join
   table, not a JSON column, or the one-vote-per-account rule becomes a race.
3. **Wire `schemas.py` to `POST /complaints`.** The auth and vote routes are
   typed already; that one still takes an untyped bag.
4. **Store the photo.** Currently only the filename survives, which makes
   "proof of work" a promise the system cannot keep.
5. **Then** the clever parts — replacing the keyword classifier with something
   that reads the photo, clustering nearby posts so twelve reports of one
   pothole become one case with twelve backers, routing by SLA.

Steps 1–4 are what turns this from a convincing demo into something you could
put in front of a ward office. Step 5 is what the README talks about.
