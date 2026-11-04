# Classroom Survey

Quick in-class understanding checks. The instructor activates a survey and projects a QR code; students scan it and answer on their phones without logging in. Results appear as charts and can be exported as CSV.

## Features

- Instructor login (single instructor account)
- Survey editor with Multiple Choice and True / False questions
- One-click activation with a projector-ready QR code and live response count
- Anonymous, mobile-friendly student page with one submission per browser
- Results with bar charts, counts, and percentages; historical results for Closed and Archived surveys
- CSV export that opens cleanly in Excel and Google Sheets

## How it works

The app is a static React single-page app with no server of its own. The browser talks directly to Supabase (Postgres, Auth, and database functions), and Cloudflare Workers serves the built files.

The Supabase publishable key ships in the app, so all security lives in the database:

- **Row Level Security** lets students read only the Active survey's questions and choices. They can't read responses.
- **Database functions** handle every multi-row write. Students can call only `submit_survey_response`, which validates every answer before saving.
- **Sign-ups are disabled.** The single instructor account is created by hand.

Design decisions D1–D18 are in [`SPEC.md`](SPEC.md) §11.

## Tech stack

React 19, TypeScript 6.0, Vite, Tailwind CSS, React Router, Supabase, Recharts, `qrcode`, and Cloudflare Workers (static assets).

TypeScript is pinned to `~6.0.0` because `typescript-eslint` does not support TypeScript 7 yet.

## Setup

### Prerequisites

- Node.js 20.19+ or 22.12+
- Free accounts on Supabase, Cloudflare, and GitHub

### 1. Install

```bash
git clone https://github.com/JustinMorneau/Survey-Web-App
cd <repository-folder>
npm install
```

### 2. Create the Supabase project

1. Create a project in the Supabase dashboard.
2. Under Authentication, turn off **Allow new users to sign up**.
3. Under Authentication → Users, add the instructor account and check **Auto Confirm User**.
4. In the SQL Editor, run the migrations in `supabase/migrations/` **in order**:

   | File                          | Adds                                        |
   | ----------------------------- | ------------------------------------------- |
   | `0001_schema.sql`             | Tables, indexes, triggers, table privileges |
   | `0002_rls.sql`                | Row Level Security policies                 |
   | `0003_save_and_duplicate.sql` | `save_survey`, `duplicate_survey`           |
   | `0004_activation.sql`         | `activate_survey`, `close_survey`           |
   | `0005_submission.sql`         | `submit_survey_response`                    |
   | `0006_results.sql`            | `get_survey_results`                        |

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values from Project Settings → API:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_PUBLIC_SITE_URL=
```

Use the **publishable** (or "anon public") key, never a secret key. Leave `VITE_PUBLIC_SITE_URL` empty locally.

### 4. Generate database types

```bash
npx supabase login
npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/lib/database.types.ts
```

Regenerate after every migration. On Windows, run this in Git Bash rather than PowerShell.

### 5. Run

```bash
npm run dev
```

## Scripts

| Command           | Does                               |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the development server       |
| `npm run build`   | Type-check and build to `dist/`    |
| `npm run preview` | Serve the production build locally |
| `npm run lint`    | Run ESLint                         |
| `npm run format`  | Format with Prettier               |

## Deployment (Cloudflare Workers)

1. Create a Worker in Cloudflare and connect it to the GitHub repository. Every push to `main` builds and deploys.
2. Build settings: build command `npm run build`, deploy command `npx wrangler deploy`, root directory `/`.
3. Under **Settings → Builds → Variables and secrets**, add the three `VITE_*` variables. They must be **build** variables, because Vite inlines them when building. The runtime "Variables and secrets" section has no effect on this app.
4. `VITE_PUBLIC_SITE_URL` is the Worker's URL including `https://`, for example `https://survey-web-app.example.workers.dev`. QR codes are built from it.

`wrangler.jsonc` publishes `./dist` and serves `index.html` for unknown routes so links like `/s/abc12345` work.

## Testing

Each SQL script in `supabase/tests/` runs in the Supabase SQL Editor. It ends with a `PASSED` message or stops at the first `FAIL:`, and rolls back all of its test data.

| Script                 | Checks                                  |
| ---------------------- | --------------------------------------- |
| `rls_check.sql`        | Row Level Security and table privileges |
| `phase3_rpc_check.sql` | Saving and duplicating surveys          |
| `phase4_rpc_check.sql` | Activating and closing surveys          |
| `phase5_rpc_check.sql` | Student submission validation           |
| `phase6_rpc_check.sql` | Results arithmetic                      |

**Load test.** With a survey Active, send 200 concurrent submissions:

```bash
node --env-file=.env.local scripts/load-test.mjs
```

Then run `supabase/tests/cleanup_load_test.sql` to remove the test responses.

## Before class

- **Wake the database.** Supabase pauses free projects after a period of inactivity. Open the Supabase dashboard (or log in to the app) before class and restore the project if it's paused. Pausing doesn't delete data.
- **Activate the survey** and open **Present**; use **Full Screen** for the projector.
- **Scan the QR code** with your own phone once to confirm it opens.

## Project structure

```text
src/
  components/   Shared UI (dialogs, badges, auth provider, question editor, charts)
  lib/          Supabase client, data access, validation, CSV, error messages
  pages/        One component per route
supabase/
  migrations/   Database schema and functions, applied in order
  tests/        SQL verification scripts
scripts/        Load test
SPEC.md         Specification and design decisions
DATABASE.md     Schema, security, and database functions
API.md          Data access, RPC contracts, error codes, CSV format
UI.md           Screens, states, and messages
TODO.md         Implementation phases
```
