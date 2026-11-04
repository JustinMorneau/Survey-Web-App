# Classroom Survey Web App — TODO

## Purpose

This roadmap breaks the MVP into seven phases, each small enough to build, verify, and commit on its own.

**Workflow for every phase**

1. Implement the build items.
2. Complete every item in the phase's **Verify & Commit** gate.
3. Commit and push to GitHub only after the gate passes.

Decision numbers (D1–D18) refer to the main specification, §11. Details live in `DATABASE.md`, `API.md`, and `UI.md`.

---

# Phase 1 — Foundation: Project, Supabase, and Deployment Pipeline

Decisions: D1, D3, D7, D8, D12, D14

## Project setup

- [x] Create a new React + TypeScript project with Vite.
- [x] Pin TypeScript to `~6.0.0` (`typescript-eslint` does not support TypeScript 7 yet).
- [x] Add Tailwind CSS.
- [x] Add React Router.
- [x] Add the Supabase JavaScript client.
- [x] Add Recharts.
- [x] Add the `qrcode` package.
- [x] Create the folder structure from the specification §8.
- [x] Add `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_PUBLIC_SITE_URL`.
- [x] Create `.env.local` with the real values (ignored by git).
- [x] Configure ESLint and formatting.
- [x] Create a basic home page.
- [x] Add `wrangler.jsonc` with `./dist` assets and single-page-application routing.

## Supabase and database

- [x] Create a Supabase project.
- [x] Disable public sign-ups and create the instructor account manually (D7).
- [x] Write `0001_schema.sql`: all five tables, constraints, indexes, table privileges, the required token unique index (D8), and the `only_one_active_survey` index.
- [x] Add the `updated_at` trigger and the status-transition trigger (D3).
- [x] Write `0002_rls.sql`: enable RLS, anon read policies, authenticated policies (`DATABASE.md` §9).
- [x] Apply both migrations in the SQL Editor (D14).
- [x] Generate TypeScript types from the schema (`supabase gen types`) after the migrations are applied.
- [x] Create the shared Supabase client in `src/lib/`.

## Deployment pipeline

- [x] Push the project to GitHub.
- [x] Create the Cloudflare Worker (`survey-web-app`) and connect it to the repository.
- [x] Configure the Workers Builds API token.
- [x] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as **build** variables.
- [x] Deploy the application.
- [x] Add `VITE_PUBLIC_SITE_URL` (the `workers.dev` URL) as a build variable and rebuild.

## Verify & Commit

- [x] `npm run build` and lint pass with no errors.
- [x] The `workers.dev` URL loads the home page.
- [x] Refreshing a deep link (for example `/login`) does not return 404.
- [x] Save RLS checks as a script in `supabase/tests/`. Using a test Active survey and the anon key:
  - [x] anon can read the active survey and its questions and choices;
  - [x] anon cannot read Draft, Closed, or Archived surveys;
  - [x] anon cannot read responses or answers;
  - [x] anon cannot insert into any table.
- [x] Authenticated users can read and write all tables.
- [x] An invalid status change (for example Draft → Closed) fails with `INVALID_STATUS_TRANSITION`.
- [x] Attempting to sign up a new user is rejected.
- [x] The anon key cannot read `responses` through the REST API.
- [x] Commit and push.

---

# Phase 2 — Instructor Authentication and Dashboard

Decisions: D3, D9, D16

## Authentication

- [x] Create the instructor login page.
- [x] Connect login to Supabase Auth.
- [x] Add logout.
- [x] Create an authentication context/provider.
- [x] Create a protected-route component.
- [x] Redirect unauthenticated users and expired sessions to `/login`.
- [x] Show the logged-in instructor in the dashboard header.

## Dashboard

- [x] Create the dashboard layout.
- [x] Load surveys with their response counts.
- [x] Display title, status badge (text, not only color), creation date, and response count.
- [x] Add a New Survey button.
- [x] Add search by title.
- [x] Add the status filter, defaulting to "All except Archived" (D3).
- [x] Add the creation-date filter (D16).
- [x] Show only the actions allowed for each status (`UI.md` §4).
- [x] Add Archive and Unarchive actions with confirmation.
- [x] Add Delete with the standard and stronger confirmation dialogs (`UI.md` §11).
- [x] Add empty states for "no surveys" and "no search results".
- [x] Create the shared error-code-to-message mapper (`UI.md` §17, D9).

## Verify & Commit

- [x] Log in, log out, and confirm a page refresh keeps the session.
- [x] A wrong password shows a friendly error.
- [x] Visiting `/dashboard` while logged out redirects to `/login`.
- [x] Search, status filter, and date filter work together.
- [x] Archive and Unarchive work, each with a confirmation.
- [x] Deleting a survey removes its questions, choices, and responses.
- [x] An Active survey offers no Delete or Archive action.
- [x] Commit and push.

---

# Phase 3 — Survey Editor and Duplication

Decisions: D4, D5, D6, D7, D9

## Database

- [x] Write `0003_save_and_duplicate.sql` with `save_survey` and `duplicate_survey` (`DATABASE.md` §10).
- [x] Revoke execute on both from `public` and `anon` (D7).
- [x] Apply the migration and regenerate `database.types.ts`.
- [x] Run `supabase/tests/phase3_rpc_check.sql`.

## Editor

- [x] Switch to `createBrowserRouter` (required for `useBlocker`) and remove `App.tsx`.
- [x] Create the editor page for `/surveys/new` and `/surveys/:id/edit`.
- [x] Add title and optional description fields.
- [x] Add, delete, and reorder questions.
- [x] Support Multiple Choice questions with 2–10 choices.
- [x] Support True / False questions with fixed choices (D5).
- [x] Add, delete, and reorder choices.
- [x] Confirm before changing a question to True / False.
- [x] Validate fields and show errors next to the affected field.
- [x] Save through `save_survey` with "Saving..." / "Saved" feedback.
- [x] Load an existing survey for editing.
- [x] Show locked mode for surveys with responses, saving title and description directly (D4).
- [x] Block opening the editor for Active and Archived surveys.
- [x] Warn about unsaved changes when leaving the editor.

## Duplication

- [x] Add the Duplicate action to the dashboard and to locked mode.
- [x] Call `duplicate_survey` and open the editor for the copy.

## Verify & Commit

- [x] Create a survey with both question types and save it. After reload, all content and order are intact.
- [x] Reorder, edit, and delete questions and choices. After reload, the changes persist.
- [x] Validation errors appear next to the affected field, and `save_survey` rejects invalid data sent directly.
- [x] A survey with responses opens in locked mode, and `save_survey` returns `SURVEY_LOCKED` for it.
- [x] Duplicating copies questions and choices but no responses, creates a Draft named "Copy of ...", and opens the editor.
- [x] Calling `save_survey` or `duplicate_survey` with the anon key fails.
- [x] Commit and push.

---

# Phase 4 — Activation and Presenting

Decisions: D2, D3, D5, D7, D11, D12

## Database

- [ ] Write `0004_activation.sql` with `activate_survey` and `close_survey` (`DATABASE.md` §10).
- [ ] Generate slugs per D2, retrying on collision and keeping them on reactivation.
- [ ] Revoke execute on both from `public` and `anon` (D7).

## Interface

- [ ] Add Activate, Reopen, and Close actions to the dashboard.
- [ ] Make the editor's Activate button save first, then activate.
- [ ] Create the Present Survey page.
- [ ] Build the public URL from `VITE_PUBLIC_SITE_URL` (D12).
- [ ] Generate and display a large QR code.
- [ ] Display the readable fallback URL.
- [ ] Show the response count, polling every 5 seconds while visible (D11).
- [ ] Add a Download QR Code (PNG) button.
- [ ] Add a Close Survey button with confirmation.
- [ ] Optimize the page for full-screen projection.

## Verify & Commit

- [ ] Activating survey A and then survey B leaves A Closed and B Active, and only one survey is Active.
- [ ] Reactivating a Closed survey keeps its original slug.
- [ ] Activating a survey with no questions shows "Add at least one question before activating."
- [ ] Calling `activate_survey` or `close_survey` with the anon key fails.
- [ ] The QR code scanned with a real phone opens the production URL.
- [ ] The downloaded PNG scans correctly.
- [ ] The present page is readable full-screen on a projector-sized display.
- [ ] Commit and push.

---

# Phase 5 — Student Survey and Submission

Decisions: D2, D5, D7, D8, D9

## Database

- [ ] Write `0005_submission.sql` with `submit_survey_response` as `security definer` with `set search_path = ''` (`DATABASE.md` §10).
- [ ] Grant execute to `anon` and `authenticated`; revoke from `public`.

## Student page

- [ ] Create the public route `/s/:slug`.
- [ ] Load the active survey by slug.
- [ ] Show "no longer accepting responses" when no Active survey matches.
- [ ] Render title, description, and both question types.
- [ ] Make whole choice rows tappable with 44px minimum targets.
- [ ] Validate that every question is answered and scroll to the first missing one.
- [ ] Add a near-full-width Submit button with "Submitting..." state.
- [ ] Show the confirmation page after success.

## Duplicate protection

- [ ] Create the browser token with `crypto.randomUUID()` and store it in localStorage as `cs_anon_token` (D8).
- [ ] Set `cs_submitted_<surveyId>` after success or `DUPLICATE_RESPONSE`.
- [ ] Show "already submitted" on page load when the flag exists.
- [ ] Map every submission error code to its message (`UI.md` §17).
- [ ] Handle a survey that closes while the student is filling it in.

## Verify & Commit

- [ ] Submit from a real phone against production.
- [ ] Submit from two different browsers.
- [ ] A second submission from the same browser shows "already submitted".
- [ ] Removing only the `cs_submitted_<surveyId>` flag (keeping the token) and resubmitting still fails with `DUPLICATE_RESPONSE`, proving the database enforces it.
- [ ] Submitting after the survey is closed shows the closed message.
- [ ] Calling the RPC directly with a choice from another question returns `INVALID_CHOICE`.
- [ ] Calling the RPC with a missing answer returns `MISSING_REQUIRED_ANSWER`.
- [ ] The anon key still cannot read responses or answers.
- [ ] Commit and push.

---

# Phase 6 — Results, History, and CSV Export

Decisions: D7, D10, D13, D15, D16

## Database

- [ ] Write `0006_results.sql` with `get_survey_results` (`DATABASE.md` §10).
- [ ] Revoke execute from `public` and `anon`.

## Results

- [ ] Create the results page for each survey.
- [ ] Add the View Results action to the dashboard and the Present page.
- [ ] Show the total response count and status.
- [ ] Show each question's answered count.
- [ ] Show count and percentage for each choice (D10).
- [ ] Add horizontal bar charts with counts and percentages as text.
- [ ] Add the "No responses yet" empty state.
- [ ] Add Refresh, Back to Dashboard, and Present QR (Active only) buttons.
- [ ] Confirm results work for Closed and Archived surveys.

## CSV export

- [ ] Add the Export CSV button.
- [ ] Export one row per response with `response_id` and ISO `submitted_at`.
- [ ] Add one column per question with choice text in each cell.
- [ ] Name the file `<title-slug>_<YYYY-MM-DD>.csv`.
- [ ] Escape quotes, commas, and line breaks.
- [ ] Prefix cells starting with `= + - @` with `'`.
- [ ] Write UTF-8 with a BOM.
- [ ] (Optional) Add Vitest tests for the CSV builder and percentage calculation (D15).

## Verify & Commit

- [ ] Counts match a manual SQL count, and percentages sum to about 100% per question.
- [ ] Closed and Archived surveys show results.
- [ ] The CSV opens correctly in Excel and Google Sheets, including text with commas, quotes, line breaks, and non-English characters.
- [ ] Calling `get_survey_results` with the anon key fails.
- [ ] Commit and push.

---

# Phase 7 — Polish, Accessibility, and Release Check

Decisions: D15, D17, D18

## Polish and accessibility

- [ ] Make page layouts consistent.
- [ ] Review mobile, tablet, and desktop layouts (`UI.md` §12).
- [ ] Confirm every async page has a loading state and every mutation button disables while running.
- [ ] Confirm every page has its empty and error states.
- [ ] Check color contrast.
- [ ] Test keyboard navigation and visible focus on every page.
- [ ] Confirm labels, `fieldset`/`legend` for radio groups, and field-linked error messages.

## Release check (production)

- [ ] Do a full classroom rehearsal: create, activate, submit from at least 3 devices, view results, export CSV, close, archive.
- [ ] Verify production login, submissions, and results.
- [ ] Write and run the 200-concurrent-submission script in `scripts/` (D18).
- [ ] Confirm mobile page load is under 2 seconds with Lighthouse.
- [ ] Re-run the RLS and permission scripts against production.
- [ ] Re-run the sign-up `curl` with a real-domain address (for example a `+signuptest` alias) and confirm it returns `signup_disabled`.
- [ ] Write `README.md` with setup, migration, and deployment steps.
- [ ] Document the Supabase free-tier pause behavior in the README (D17).
- [ ] Commit, push, and tag `v1.0`.

---

# Phase 8 — Post-MVP Enhancements

- [ ] Add live updating results with Supabase Realtime.
- [ ] Add question bank.
- [ ] Add survey import/export as JSON.
- [ ] Add Markdown import.
- [ ] Add short-answer questions.
- [ ] Add checkbox questions.
- [ ] Add rating-scale questions.
- [ ] Add numeric questions.
- [ ] Add AI-assisted question generation.
- [ ] Add LMS integration.
- [ ] Add multiple instructors.
- [ ] Add course and semester organization.
- [ ] Add analytics across multiple surveys.