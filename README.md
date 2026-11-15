# FYP360

Final Year Project management system for KIET — admin, staff (supervisor / jury) and student group portals, built with React + Vite and Supabase.

## Database ER diagram

[![FYP360 ER diagram](docs/erd.png)](docs/erd.png)

**Download:** [PNG image](https://github.com/hyrafypproject136-wq/FYP360-/raw/main/docs/erd.png) · [SVG (sharp at any zoom)](https://github.com/hyrafypproject136-wq/FYP360-/raw/main/docs/erd.svg) · [Table details](SCHEMA.md)

## Features
- **Admin:** groups (default 4 members), shared group logins, staff accounts, supervisor and jury assignment, disqualify / dissolve groups, settings, activity log.
- **Proposals:** 3 ideas per group (abstract 200–250 words + APIs), supervisor recommends, coordinator approves.
- **Meetings & marks:** attendance and class marks per meeting, jury evaluation, external marks, publish results per phase.
- **Submissions:** deadlines, file checks (documents 20 MB, video 50 MB), late uploads blocked, supervisor review, extensions.
- **Change requests:** group → jury → coordinator, with comments.
- **Announcements** and group notifications.

## Marks
| Phase | Parts | Total |
|---|---|---|
| FYP-1 | Advisor 30 + Proposal 10 + Internal 60, then ×0.4 | 40 |
| FYP-2 | Advisor 10 + Internal 30 + External 20 | 60 |

Pass = total ≥ 60 **and** FYP-2 ≥ 36.

## Run it
```bash
npm install
cp .env.example .env.local   # add your Supabase URL and anon key
npm run dev                  # http://localhost:3001
```

Testing steps: [TESTING.md](TESTING.md)

## Tech
React 19 · TypeScript · Vite · Tailwind CSS v4 · Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row Level Security)
