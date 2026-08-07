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

- **Citizen reporting** — contact details, issue, category, photo, live GPS
  verification, and a reference number on submit.
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

- **Nothing is persisted.** Reports live in a Python list. Restart the API and
  they're gone. The Postgres schema is written but not connected.
- **Photos aren't stored.** Only the filename reaches the server. The image
  never leaves the browser.
- **The login is cosmetic.** It keeps the dashboard off the landing page. It is
  not access control — the API answers anyone. See
  [ARCHITECTURE.md](ARCHITECTURE.md#auth).
- **No notifications.** You get a reference number on screen and that's it.
- **No duplicate detection.** Four people reporting one pothole makes four cases.
- **No AI anything.** `priority_score` is hardcoded to `85`. Department is
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
uvicorn main:app --reload
```

Serves on `http://127.0.0.1:8000`. Interactive API docs at `/docs`.

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

**Signing in.** The dashboard sits behind a staff login. The demo accounts are
printed on the login screen itself; click one to fill the form.

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

---

## Stack

React 19, Vite 8, plain CSS with custom properties, `lucide-react` for icons,
axios. FastAPI and Pydantic on the server. SQLAlchemy and Supabase are present
as dependencies but not yet in the request path.

No Tailwind — the design system is a single ~1,600-line stylesheet at
`frontend/src/index.css` (about 5 kB gzipped), built on custom properties. Every colour and easing
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
