# CivicFix

A civic issue reporting tool. You photograph the pothole, your phone stamps
where you were standing, and the report lands in a queue a ward office can
actually work through.

The whole thing turns on one rule: **the photo has to be taken where the problem
is.** No live GPS fix, no submission. That sounds like a small detail and it is
the entire point — the old way let people type "near the big tree, Ward 62", and
crews lost half-days driving out to find three big trees and no pothole.

---

## What works right now

- **Accounts** — sign up as a resident, sign in as a resident or as the one
  administrator (Ishita). Signup mints citizens only; the API ignores any role
  sent in the body, so the admin account cannot be created from the browser.
- **A community feed** — residents post problems and back each other's with an
  upvote. One vote per account, tracked by account id rather than a counter, so
  pressing twice removes your vote instead of inflating the case.
- **Severity classification on filing** — a keyword pass over the report's own
  words puts it in one of four bands. "Open manhole" outranks "faded paint"
  whether or not anyone has upvoted it.
- **A ranked triage queue** — severity plus a *capped* bonus for backing, so
  popularity moves a case up but never lets a nuisance outrank a hazard.
- **A verification gate** — the administrator has to confirm a report is real
  before work can start on it. The API enforces this, not just the button: a
  status change to "in progress" on an unverified case is refused with a 409.
- **Citizen reporting** — the formal channel: contact details, issue, category,
  photo, live GPS verification, and a reference number on submit.
- **Staff dashboard** — every case bucketed into awaiting triage / in progress /
  resolved, with search across all fields and how long each case has been open.
- **Closed cases carry proof** — a before/after pair showing how the place
  looked when it was reported and how it looked when the crew finished, plus the
  named inspector who signed it off.
- **A public "Past work" gallery** — every finished job, before and after, with
  no reporter names or phone numbers attached.
- **Light and dark themes**, keyboard navigation, reduced-motion support, and a
  layout that survives a phone screen.

## What doesn't, yet

Being straight about this up front, because the alternative is you finding out
during a demo:

- **Nothing is persisted.** Accounts, posts and votes live in Python lists.
  Restart the API and they're gone, back to the seeded demo set. The Postgres
  schema is written but not connected.
- **Photos aren't stored.** Only the filename reaches the server. The image
  never leaves the browser.
- **Auth is half-real.** Passwords are stored and compared in plaintext, and the
  session is an unsigned object in `localStorage` — edit it in devtools and the
  UI believes you. What *is* enforced server-side is the admin's write access:
  verifying or dispatching needs a key only an admin login returns. Citizen
  reads are wide open; the API answers anyone. See
  [ARCHITECTURE.md](ARCHITECTURE.md#auth).
- **No notifications.** You get a reference number on screen and that's it.
- **No duplicate detection.** Four people reporting one pothole still makes four
  cases — upvoting an existing post is the manual workaround, not a fix.
- **The classifier is keywords, not AI.** `classify_severity` in `main.py` is a
  word list. It is explainable and it is not a model. Department is still
  derived from the category dropdown.

That last one matters: earlier versions of this README advertised DBSCAN
clustering, vision classification and RAG-based SLA routing. None of it is in
the codebase. It's the roadmap, and it's listed as such below.

---

## Running it

You need Python 3.10+ and Node 18+.

**Backend** — from `backend/`:

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py                # or: uvicorn main:app --reload
```

Serves on `http://127.0.0.1:8000`. Interactive API docs at `/docs`. It prints
the URL on startup — if you see no such line, no server started.

Both commands do the same thing. `python main.py` is there because running a
FastAPI file directly used to import the module, define the app, start nothing
and exit `0` — silently, which is indistinguishable from a backend that "isn't
working".

> **The frontend says it can't reach the server, or a request 404s on a route
> you can see in the code.** The API holds everything in memory and does not
> reload accounts or posts from anywhere, so a process started before you pulled
> is still serving the old routes. Stop it and start it again. `curl
> http://127.0.0.1:8000/` should answer with a count of users and posts.

> **`ModuleNotFoundError: No module named 'fastapi'`** means the venv is active
> but empty — run the `pip install` line above. If it says the same thing
> *without* the venv active, you're on system Python and the packages are
> somewhere else. `python -c "import sys; print(sys.executable)"` tells you
> which interpreter you actually got.

**Frontend** — from `frontend/`:

```bash
npm install
npm run dev
```

Serves on `http://localhost:5173`. It expects the API on port 8000; override
with `VITE_API_URL` in `frontend/.env` if you moved it.

Start the backend first, or the dashboard loads empty and shows a connection
error. That error is accurate — it means exactly what it says.

**Signing in.** The landing page at `/` is the front door and the only screen
reachable without an account — every other route bounces a signed-out visitor
back to it, carrying the destination so signing in resumes where they were
headed. The accounts are printed on the login screen itself; one press signs you
straight in. There is exactly one administrator:

| Role | Email | Password |
|---|---|---|
| Administrator | `ishita@civicfix.gov.in` | `admin123` |
| Resident | `aritra@demo.in` | `civic123` |
| Resident | `priya@demo.in` | `civic123` |
| Resident | `farhan@demo.in` | `civic123` |
| Resident | `meera@demo.in` | `civic123` |
| Resident | `debjit@demo.in` | `civic123` |

To see upvoting work, sign in as one resident and back a post another one made
— you cannot upvote your own. The count feeds straight into the ordering of the
administrator's queue.

---

## Layout

```
backend/     FastAPI app. main.py is the live one; models.py and
             database.py are a Postgres layer that isn't wired up yet.
frontend/    React 19 + Vite. Plain CSS, no framework.
seed_data/   Supabase seeding script.
```

[ARCHITECTURE.md](ARCHITECTURE.md) covers how the pieces fit, why the odd
decisions were made, and where the sharp edges are.

[DATA-AND-DATABASE.md](DATA-AND-DATABASE.md) is the one to read before putting
real people on it: an inventory of every piece of demo data and how to remove
it, what the Postgres layer is and what it still can't store, how to swap the
in-memory lists for real tables and real accounts, and how to watch live
activity once there is any.

---

## Stack

React 19, Vite 8, plain CSS with custom properties, `lucide-react` for icons,
axios. FastAPI and Pydantic on the server. SQLAlchemy and Supabase are present
as dependencies but not yet in the request path.

No Tailwind — the design system is a single ~2,400-line stylesheet at
`frontend/src/index.css` (about 7 kB gzipped), built on custom properties. Every colour and easing
curve is a token; dark mode is a second token block and no component knows which
theme is running.

---

## Roadmap

In the order that actually pays off:

1. Wire `schemas.py` into the routes — typed bodies and real validation.
2. Connect Postgres. The schema exists; it needs importing and a session dependency.
3. Store the photos, so "proof of work" is a claim the system can back.
4. Real auth: token verification on the API, not just a screen in front of it.
5. Then the interesting part — clustering nearby reports, classifying photos,
   routing by SLA rules.

Steps 1–4 are what make this deployable. Step 5 is what makes it clever. Doing
5 before 1–4 gets you a clever demo that loses everyone's data.

---

## A note on the demo data

The two resolved cases — the Park Avenue streetlight and the Central Market
resurfacing — are fabricated, along with their inspectors and employee IDs.
They're there so the resolved lane isn't empty on a fresh install. Real cases
replace them automatically as soon as the backend returns any. See
`frontend/src/lib/demoData.js`.

Their before/after images are **generated placeholders stamped `TEST`**, not
photographs. They used to be stock photos, which meant a picture of a chrome tap
sat in the evidence column of a streetlight repair. An image that contradicts
its caption teaches people to distrust the whole column — and that column is the
entire point of the product. Better an obvious placeholder than a convincing
lie. See `frontend/src/lib/placeholder.js`.
