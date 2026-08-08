# Test data, real data, and the database

How to strip the demo content out, what the database layer actually is today,
what it is missing, and how to get from "in-memory demo" to "real users you can
watch arrive".

This describes the code as it exists. Where something is unbuilt it says so —
there is no point writing migration steps for a table nobody has created.

---

## 1. Where the fake data lives

Everything below is seeded or generated. Nothing in this list came from a user.

| # | What | Where | Size | Who sees it |
|---|---|---|---|---|
| 1 | 6 accounts — 1 admin, 5 residents | `backend/main.py` → `USERS` | 6 rows | Everyone; passwords are on the login screen |
| 2 | 6 community posts, with votes already on them | `backend/main.py` → `_seed()` | 6 rows | The feed and the triage queue |
| 3 | The quick sign-in roster | `backend/main.py` → `GET /auth/demo-accounts` | 4 accounts | The login page |
| 4 | 2 "resolved" cases with before/after write-ups | `frontend/src/lib/demoData.js` → `demoResolved` | 2 records | Landing case study, Past work gallery |
| 5 | The before/after images themselves | `frontend/src/lib/placeholder.js` → `testPhoto()` | generated SVG | Anywhere a photo appears |
| 6 | 91 Supabase complaint rows | `seed_data/seed.py` | 91 rows | Only if you ran it |

Two of these are load-bearing in ways that are easy to miss.

**The demo accounts are not just convenience.** `USERS` is the *only* place an
account can come from besides signup, and the single admin lives there. Delete
that list without providing another way to create an administrator and nobody
can verify a report again — the API has no other path to `role: "admin"`, by
design.

**The generated images are deliberately obvious.** `placeholder.js` stamps them
`TEST` and `not a real photograph`. They replaced stock photos, which put a
picture of a chrome tap in the evidence column of a streetlight repair. An image
that contradicts its caption teaches people to distrust the evidence column, and
that column is the entire product. If you delete these, delete them by wiring up
real uploads — not by swapping in prettier stock.

---

## 2. Removing it

In this order. Each step says what visibly changes, because "it went blank" is
otherwise indistinguishable from "I broke it".

### 2.1 Keep an administrator before deleting the seeded one

Nothing else works without this. Either provision one from an environment
variable at startup:

```python
# backend/main.py — replace the literal admin entry in USERS
import os

ADMIN_EMAIL = os.environ["CIVICFIX_ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["CIVICFIX_ADMIN_PASSWORD"]

USERS = [
    {
        "id": "admin-1",
        "name": os.environ.get("CIVICFIX_ADMIN_NAME", "Administrator"),
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,     # hash this — see §6
        "role": "admin",
        "title": "Municipal Commissioner",
        "created_at": iso(now()),
    },
]
```

…or, once Postgres is connected (§5), insert the row directly and drop the
list entirely. Crashing at startup on a missing variable is the right behaviour
here: a deployment with no administrator is not a working deployment, and you
want to find that out on boot rather than on the first hazard report.

### 2.2 Empty the seeded posts

```python
# backend/main.py
COMPLAINTS: List[Dict[str, Any]] = []      # was: _seed()
```

Then delete `_seed()` and `make_post()` — `make_post` exists only to build seed
rows; `create_complaint` is what real posts go through.

**What changes:** the feed shows its empty state, the triage queue shows "inbox
zero", and the landing page's counters read 0. All correct, all intentional.

### 2.3 Delete the quick sign-in roster

```python
# backend/main.py — delete the whole route
@app.get("/auth/demo-accounts")
def demo_accounts(): ...
```

**What changes:** the login page drops its one-press buttons and shows the plain
form. It already handles this — `rosterState` goes to `failed` and it says so.
Adjust that copy once it is no longer a demo, because "start the backend" stops
being the likely cause.

Also drop `GET /users`. It lists every account's name and email to anybody who
asks, and it exists for debugging.

### 2.4 Remove the frontend's stand-in resolved cases

```js
// frontend/src/lib/demoData.js
export const demoResolved = [];
```

**What changes:** the landing page's "what a finished case looks like" section
has nothing to render — it reads `demoResolved[0]` directly and will throw. Fix
it in the same edit: either drop that `<section>` from
`frontend/src/components/Landing.jsx`, or feed it the first real resolved case
out of `complaints`.

`CATEGORIES` and `photoPair()` in that file are **not** demo data — the report
form and the before/after component both need them. Keep them.

### 2.5 Retire the placeholder images

Only once real photos are stored (§5.4). Delete `frontend/src/lib/placeholder.js`
and its `testPhoto()` calls. Until uploads work, an obvious placeholder is more
honest than an empty frame.

### 2.6 Clear the Supabase rows if you ran the seeder

`seed_data/seed.py` inserts 91 rows into a Supabase `complaints` table over
PostgREST. If you ran it:

```sql
-- Everything the seeder wrote is identifiable by its description prefix
delete from complaints where description like '%Cluster #%';
delete from complaints where description like '[%] % issue:%';
delete from complaints where description = 'SCHEMA_PROBE';
```

That last one matters: the seeder probes for a valid `status` value by inserting
rows and deleting them again, and it swallows failures on the cleanup. Probe
rows survive a partial run.

---

## 3. The database as it stands

### 3.1 What is actually running

Nothing. The API serves from two Python lists and never opens a connection:

```
backend/main.py        USERS, COMPLAINTS          ← the live store, in memory
backend/database.py    engine, session, get_db()  ← written, imported by nobody
backend/models.py      4 SQLAlchemy tables        ← written, never created
backend/schemas.py     3 Pydantic models          ← partially used
backend/routers/       complaints.py is DB-backed ← mounted nowhere
                       auth.py, admin.py, analytics.py are EMPTY FILES
```

Restart the process and every account, post and vote is gone. The seeded ones
come back; anything a real person did does not.

### 3.2 `database.py` — the connection layer

Reads `DATABASE_URL` from `backend/.env`, rewriting `postgres://` to
`postgresql://` (hosting dashboards hand out the old scheme; SQLAlchemy 1.4
rejects it).

The engine is built **on first use**, not at import:

```python
def get_engine():
    global _engine
    if _engine is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not set...")
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    return _engine
```

This is deliberate. A module-level `create_engine(DATABASE_URL)` raised the
instant the variable was unset, so importing `models` died with a SQLAlchemy
stack trace instead of a useful message. **If you add a module-level
`engine = ...` back, you reintroduce that.**

`get_db()` is a FastAPI dependency that yields a session and closes it. It is
ready to use; nothing uses it.

`pool_pre_ping=True` matters against Supabase and most managed Postgres: they
drop idle connections, and without the ping your first query after a quiet spell
fails on a stale socket.

### 3.3 `models.py` — the schema

Four tables, Postgres-specific (UUID primary keys defaulting to
`gen_random_uuid()`).

**`users`** — `id`, `name`, `email` (unique), `role`, `created_at`.

**`departments`** — `id`, `name`, `description`, `rules`. Currently the app
derives a department from the category string instead; this table is for when
routing becomes real.

**`complaints`** — `id`, `user_id` → users, `description`, `photo_url`,
`latitude`, `longitude`, `category`, `severity`, `confidence`, `department_id` →
departments, `priority_score`, `status` (defaults `"submitted"`), `cluster_id`,
`created_at`.

**`status_history`** — `id`, `complaint_id` → complaints, `status`, `note`,
`timestamp`. This is the durable version of the in-memory `history` list.

**`notifications`** — `id`, `user_id`, `message`, `read`, `created_at`. Unused.

There is **no Alembic setup**. Tables are created by calling
`Base.metadata.create_all(get_engine())` once, or by running equivalent SQL. Add
Alembic before the first schema change you have to make on live data — retrofitting
it onto a populated database is a bad afternoon.

`gen_random_uuid()` is built in from Postgres 13. On anything older:
`create extension if not exists pgcrypto;` first.

### 3.4 The gap nobody has closed

`models.py` was written before the community feed existed. **It cannot store
what the app currently produces.** Every row below is a column you must add
before Postgres can replace the lists:

| In-memory field | Column in `models.py` | Status |
|---|---|---|
| `description`, `latitude`, `longitude`, `category`, `severity`, `priority_score`, `status`, `created_at` | same | ✅ fine |
| `title` | — | ❌ **missing.** The feed's headline. |
| `location` (human-readable place) | — | ❌ missing; only coordinates exist |
| `author` | `user_id` | ⚠️ shape differs — join instead of an embedded object |
| `complainant` (name/phone/email) | — | ❌ missing; belongs on `users` or its own table |
| `voters` (list of user ids) | — | ❌ **needs its own table.** See below. |
| `upvotes` | — | derive with `count(*)`; do not store a counter |
| `verified`, `verified_by`, `verified_at` | — | ❌ missing; the dispatch gate depends on these |
| `resolved_at` | — | ❌ missing |
| `department` (string) | `department_id` (FK) | ⚠️ resolve the string to a row |
| `history[]` | `status_history` table | ✅ fine — insert one row per transition |
| `photo` bytes | `photo_url` | ⚠️ column exists, nothing writes it |
| **user `password`** | — | ❌ **missing.** `users` has no password column at all. |

**Votes need a table, not a JSON column.** The one-vote-per-account rule is
currently a Python `if user_id in voters` — two simultaneous requests can both
pass that check and append twice. In Postgres the rule is a constraint the
database enforces, which is the entire reason to move:

```sql
create table complaint_votes (
  complaint_id uuid not null references complaints(id) on delete cascade,
  user_id      uuid not null references users(id)      on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (complaint_id, user_id)      -- one vote per person, enforced
);

create index on complaint_votes (complaint_id);
```

Then the count is a query, and it cannot drift from reality:

```sql
select c.*, count(v.user_id) as upvotes
from complaints c
left join complaint_votes v on v.complaint_id = c.id
group by c.id
order by c.priority_score desc;
```

**Keep `priority_score` a stored column, recomputed on write.** It is
`severity_base + min(votes * 2.5, 22)` — cheap to compute, expensive to sort by
if it is derived at query time on every request. Recompute it inside the same
transaction as the vote insert.

### 3.5 Supabase

`backend/.env` holds `SUPABASE_URL` and `SUPABASE_KEY`. **No application code
reads them** — only `seed_data/seed.py`, which talks to Supabase's PostgREST
endpoint directly rather than through SQLAlchemy.

Two traps:

- `frontend/src/supabaseClient.js` calls `createClient()` with
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, neither of which is defined
  anywhere. It throws on import. Harmless only because nothing imports it —
  delete it or configure it, but do not leave it.
- **Check which key is in `.env` before copying it anywhere.** If it is the
  `service_role` key it bypasses row-level security, and pasting it into a
  `VITE_`-prefixed variable ships it inside the public JS bundle to every
  visitor. The frontend needs the **anon** key and nothing else.

Supabase is Postgres, so `DATABASE_URL` from its connection settings works with
`database.py` unchanged. You get Realtime subscriptions on top (§7.3).

---

## 4. Which storage to pick

| | In-memory (now) | Postgres / Supabase | SQLite |
|---|---|---|---|
| Survives restart | ✗ | ✓ | ✓ |
| Multiple API processes | ✗ | ✓ | ✗ (one writer) |
| Enforces one-vote-per-account | ✗ | ✓ | ✓ |
| Realtime subscriptions | ✗ | ✓ (Supabase) | ✗ |
| Setup cost | none | ~an hour | ~ten minutes |

SQLite is a legitimate stop on the way — `models.py` works against it if you
swap the UUID columns for `String` and generate ids in Python. If the answer is
"this will have real users on it", go to Postgres directly and skip the port.

---

## 5. Wiring Postgres in

### 5.1 Connect and create the tables

```bash
# backend/.env
DATABASE_URL=postgresql://user:password@host:5432/civicfix
```

```bash
cd backend
python -c "from database import get_engine; import models; models.Base.metadata.create_all(get_engine()); print('tables created')"
```

If that prints `tables created`, the connection works and the schema exists. If
it raises `RuntimeError: DATABASE_URL is not set`, the `.env` is not where
`load_dotenv()` is looking — it must be `backend/.env`, and you must run from
`backend/`.

### 5.2 Add the missing columns

Extend `models.py` before you write any code against it — the table in §3.4 is
the checklist. At minimum: `title`, `location`, `verified`, `verified_by`,
`verified_at`, `resolved_at` on `complaints`; `password_hash` and `last_seen_at`
on `users`; and the whole `complaint_votes` table.

### 5.3 Move the routes over, one at a time

`backend/routers/complaints.py` is already written against the ORM and is a
working reference — it just isn't mounted:

```python
# backend/main.py
from routers import complaints as complaints_router
app.include_router(complaints_router.router)
```

Do **not** flip everything at once. Order that keeps a working app at each step:

1. `GET /complaints` reads from the DB, writes still go to the list. Compare the
   two outputs until they match.
2. `POST /complaints` writes to the DB. The list is now dead; delete it.
3. Votes: insert into `complaint_votes`, recompute `priority_score` in the same
   transaction, catch the unique-violation as "already voted" rather than a 500.
4. Verify and status: same shape, plus one `status_history` insert per
   transition. **Keep the 409 on dispatching an unverified case** — that check
   is the product rule, and it belongs in the route, not in the UI.
5. Accounts last, with §6 done first.

The frontend needs no changes if the JSON shape holds. That is the contract:
`lib/api.js` and `lib/format.js` are where any reshaping should happen, not
scattered through components.

### 5.4 Photos

`photo_url` is a column nothing writes; today only the *filename* reaches the
server. Real uploads mean object storage (Supabase Storage, S3) and a signed
URL in that column — not bytes in Postgres. Until that exists, "closed with
photo proof" is a promise the system cannot keep.

---

## 6. Real users instead of test users

Four things, and doing only the first is theatre.

### 6.1 Hash the passwords

They are stored and compared in plaintext today. That is a deliberate demo
choice — the credentials are printed on the login screen — and it is the first
thing that has to go.

```bash
pip install "passlib[bcrypt]"
```

```python
from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# signup
user["password_hash"] = pwd.hash(body.password)

# login
if not user or not pwd.verify(body.password, user["password_hash"]):
    raise HTTPException(401, "That email and password combination is not recognised.")
```

Then delete `GET /auth/demo-accounts` and `GET /users`, and make sure no route
returns a password field. `public_user()` already strips it — keep that
invariant when you move to the ORM, where it is easy to return the whole row by
accident.

### 6.2 Issue a real token

`admin_key` is one shared secret with no expiry, handed to the admin on login.
It is better than credentials in the JS bundle and it is not a session.

```bash
pip install "python-jose[cryptography]"
```

Sign a JWT carrying `sub` (user id) and `role`, verify it in a dependency, and
**take the actor from the token, never from the request body.**

### 6.3 Close the two holes that opens

- `POST /complaints/{id}/upvote` takes a `user_id` in its body and checks only
  that such a user exists. A loop over `GET /users` can vote as everybody — the
  entire ranking, gameable. Take the voter from the token.
- `POST /complaints` takes `author_id` the same way. Same fix.

Until then, the vote count is decoration. This is why real auth is first on the
list and not fourth.

### 6.4 Attach the token in the frontend

`lib/api.js` already has the seam — the request interceptor that adds
`X-Admin-Key`:

```js
client.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

`AuthProvider` writes the session; that is the one place to change. Every
consumer of `useAuth()` keeps working.

**One thing to fix while you are there:** the session in `localStorage` is an
unsigned object. Editing it in devtools changes what the UI renders — you cannot
verify a report that way (the server checks), but you can make the app *look*
like an admin. A signed token makes the client's claim checkable.

---

## 7. Watching real users, in real time

### 7.1 What exists now

One fetch of `/complaints` when `ComplaintsProvider` mounts, plus a manual
**Refresh** button on the feed and the triage queue. That is it. Two people
looking at the feed will not see each other's posts until one of them reloads.

`lastUpdated` is already threaded through the provider and rendered — the
plumbing for "how stale is this" is in place.

### 7.2 Cheapest real upgrade — polling

Ten lines, no new dependency, and it is genuinely enough for a ward office:

```js
// frontend/src/components/ComplaintsProvider.jsx
useEffect(() => {
  const id = setInterval(() => {
    // Don't poll a tab nobody is looking at.
    if (document.visibilityState === 'visible') refresh();
  }, 15000);
  return () => clearInterval(id);
}, [refresh]);
```

Pass a quiet flag through `refresh` so the loading bar and the toasts do not
fire every fifteen seconds — a background poll that flashes the UI is worse than
no poll.

### 7.3 Actual push — pick one

**Supabase Realtime.** `@supabase/supabase-js` is already a dependency. Once the
data is in Supabase, subscribe to the table and the browser is told when a row
changes — no polling, no endpoint to write:

```js
supabase
  .channel('complaints')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' },
      (payload) => patchOne(payload.new.id, payload.new))
  .subscribe();
```

Fix `supabaseClient.js` first (§3.5) and use the **anon** key with row-level
security on.

**Server-Sent Events.** If you are not on Supabase, SSE is the smaller half of
WebSockets and fits this shape — the server talks, the browser listens:

```python
from fastapi.responses import StreamingResponse

@app.get("/events")
async def events():
    async def stream():
        while True:
            yield f"data: {json.dumps(await next_change())}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")
```

`EventSource` on the browser side reconnects on its own. Note that a single
uvicorn worker holding many open streams needs `--workers` and a shared
broadcast channel (Redis pub/sub) the moment you run more than one process.

**WebSockets** only if you need the browser to push too. Nothing here does.

### 7.4 Who is actually online

There is no concept of an active user today — sessions live in `localStorage`
and the server never hears about them. Add one column and one query:

```sql
alter table users add column last_seen_at timestamptz;
```

Touch it in the auth dependency on every authenticated request, then:

```sql
-- online in the last five minutes
select count(*) from users where last_seen_at > now() - interval '5 minutes';

-- signups per day, last fortnight
select date_trunc('day', created_at) as day, count(*)
from users where created_at > now() - interval '14 days'
group by day order by day;

-- posts and votes today
select count(*) from complaints where created_at > current_date;
select count(*) from complaint_votes where created_at > current_date;

-- the queue an administrator is actually facing
select severity, count(*) from complaints
where status = 'Pending' and verified = false
group by severity;
```

Those four queries are the whole "monitoring dashboard" for a long time. Put
them behind an admin-only `/admin/metrics` route and render them on the
analytics page, which already exists.

### 7.5 Seeing it from the outside

- **Request log.** uvicorn prints every request with its status. `POST
  /auth/signup 201` is a real user arriving; a run of `401`s on `/auth/login` is
  somebody locked out or somebody guessing.
- **`/docs`.** FastAPI's generated UI. Every route, callable, with the schemas.
  Fastest way to check the API does what you think before blaming the frontend.
- **`curl http://127.0.0.1:8000/`** answers with live user and post counts.
- **Supabase dashboard**, if you go that way: table editor, live SQL, and the
  auth log, without writing any of it.

---

## 8. Go-live checklist

Order matters — each step assumes the ones above it.

- [ ] `DATABASE_URL` set; `create_all` run; tables exist
- [ ] Missing columns added (§3.4), `complaint_votes` created with its composite PK
- [ ] Passwords hashed; plaintext comparison gone
- [ ] `GET /auth/demo-accounts` and `GET /users` deleted
- [ ] Tokens issued and verified; voter and author taken from the token
- [ ] Admin provisioned from the environment or the DB, seeded list deleted
- [ ] `COMPLAINTS = []`; `_seed()` and `make_post()` deleted
- [ ] `demoResolved = []`; the landing case study handles an empty list
- [ ] Photo upload to object storage; `photo_url` written
- [ ] `CORS allow_origins` narrowed from `["*"]` to your actual origin
- [ ] `supabaseClient.js` configured with the **anon** key, or deleted
- [ ] Polling or Realtime in place, and `last_seen_at` recording activity
- [ ] Alembic initialised, before the first schema change on live data

Verify the whole chain end to end:

```bash
curl -X POST http://127.0.0.1:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Real Person","email":"real@example.com","password":"a-real-password"}'
```

Then restart the API and sign in as that account. If it still works, the data is
real. If it doesn't, you are still on the lists.
