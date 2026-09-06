# Spotit

A civic issue reporting platform. You photograph the pothole, your phone
stamps where you were standing, and the report lands in a queue a ward
office can actually work through.

**Live demo:** https://spotitmain.vercel.app/

---

## The core idea

The whole system turns on one rule: **the photo has to be taken where the
problem is.** No live GPS fix, no submission.

That sounds like a small detail — it's the entire point. The old way let
people type "near the big tree, Ward 62," and crews lost half a day driving
around looking for three big trees and no pothole. Location-locked reporting
removes that guesswork.

---

## What works right now

- **Accounts** — sign up as a resident, sign in as a resident or as the
  administrator. Signup only ever creates citizens; there is no way to
  create an admin account from the browser.
- **Community feed** — residents post civic issues and back each other's
  reports with an upvote. One vote per account — pressing twice removes
  your vote instead of inflating the count.
- **Automatic severity tagging** — each report is scanned on submission and
  sorted into Critical / High / Moderate / Low, so a genuine hazard is never
  buried under something cosmetic.
- **A ranked triage queue** — severity plus a capped bonus for community
  backing. Popularity can move a case up the queue, but it can never let a
  minor nuisance outrank a real hazard.
- **A verification gate** — an administrator has to confirm a report is
  real before work can start on it. This is enforced by the server, not
  just hidden in the interface.
- **Formal citizen reporting** — a stricter reporting channel requiring
  contact details, a category, a photo, live GPS, and issuing a reference
  number on submission.
- **Staff dashboard** — every case sorted into Awaiting Triage / In
  Progress / Resolved, searchable, with how long each case has been open.
- **Before/after proof on closed cases** — a visual pair showing the issue
  as reported and the same spot once resolved, plus the inspector who
  signed off on it.
- **A public "Past Work" gallery** — every finished job, before and after,
  with no reporter names or contact details attached.
- **Accessible, responsive UI** — light/dark themes, keyboard navigation,
  reduced-motion support, and a layout that works on a phone.

---

## What's still a prototype

Being upfront about this, because the alternative is finding out mid-demo:

- **Nothing is saved permanently yet.** Restart the backend and all
  accounts, posts, and votes reset to the seeded demo data. The database
  schema is written but not yet connected.
- **Photos aren't stored server-side yet** — only the filename reaches the
  backend today; the image itself stays in the browser.
- **Login is demo-grade.** Passwords are stored as plain text and sessions
  aren't cryptographically signed — acceptable for a prototype with printed
  demo credentials, not for real users.
- **No duplicate detection yet.** Several people reporting the same pothole
  currently creates several cases; upvoting an existing post is the manual
  workaround.
- **Severity tagging is keyword-based, not a trained AI model** — it's
  explainable and fast, and it's the planned next upgrade.

This is intentional prototype scoping, not oversight — the roadmap below is
the order these get solved in.

---

## Try it yourself

**Live site:** https://spotitmain.vercel.app/

| Role          | Email                  | Password   |
| ------------- | ---------------------- | ---------- |
| Administrator | `ishita@spotit.gov.in` | `admin123` |
| Resident      | `aritra@demo.in`       | `civic123` |
| Resident      | `priya@demo.in`        | `civic123` |
| Resident      | `farhan@demo.in`       | `civic123` |
| Resident      | `meera@demo.in`        | `civic123` |
| Resident      | `debjit@demo.in`       | `civic123` |

Sign in as one resident and upvote a post made by another to see the
ranking shift live in the triage queue — you can't upvote your own post.

---

## Running it locally

Requires **Python 3.10+** and **Node 18+**.

**Backend** — from `backend/`:

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py                # or: uvicorn main:app --reload
```

Runs on `http://127.0.0.1:8000`. Interactive API docs at `/docs`.

**Frontend** — from `frontend/`:

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` and expects the API on port 8000 (override
with `VITE_API_URL` in `frontend/.env` if needed).

Start the backend first — the frontend will show a connection error
otherwise, and that error is accurate.

---

## Tech stack

- **Frontend:** React 19, Vite, plain CSS with design tokens (no Tailwind),
  `lucide-react` icons, axios
- **Backend:** FastAPI, Pydantic
- **Planned data layer:** PostgreSQL via SQLAlchemy, Supabase (schema
  written, not yet connected)

---

## Project structure

```
backend/     FastAPI app — the live API and business logic
frontend/    React + Vite client
seed_data/   Database seeding script for Supabase
```

See `ARCHITECTURE.md` for a full breakdown of how the pieces fit together,
and `DATA-AND-DATABASE.md` for the plan to move from demo data to a
production database.

---

## Roadmap

In the order that gets the most value fastest:

1. **Real authentication** — hashed passwords, signed session tokens, and
   server-side identity checks on every write (currently the biggest gap
   between "impressive demo" and "production-ready").
2. **Connect the database** — the schema already exists; it needs to be
   wired in so data survives a restart.
3. **Real photo storage** — so "before/after proof" is something the system
   can actually back up.
4. **Smarter severity detection** — move from keyword matching toward a
   model that can read the photo itself.
5. **Duplicate report clustering** — so ten reports of one pothole become
   one case with ten backers, not ten separate cases.

---

## A note on demo data

The two "resolved" cases shown in the Past Work gallery are fabricated
examples, included so that section isn't empty on a fresh install — real
resolved cases replace them automatically. Their before/after images are
deliberately generated placeholders stamped **TEST**, not real photographs.
An image that contradicts its caption teaches people to distrust the
evidence column — and that column is the entire point of the product. An
honest placeholder beats a convincing fake.

---

## About

Built for SVH Hackathon.
