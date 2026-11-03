# Classroom Survey Web Application Specification

## Version

**Version:** 1.1

**Status:** Design decisions confirmed (see §11)

## Related Documents

| Document | Covers |
|---|---|
| `DATABASE.md` | Tables, constraints, Row Level Security, database functions, migrations |
| `API.md` | Data access, RPC inputs and outputs, error codes, CSV format |
| `UI.md` | Routes, screens, states, messages, accessibility |
| `TODO.md` | Implementation phases and verification gates |

If this document and a detailed document disagree, the detailed document wins (D1).

------------------------------------------------------------------------

# 1. Overview

## Purpose

The Classroom Survey Web Application is designed to allow instructors to
quickly assess student understanding during class.

Students participate by scanning a QR code displayed by the instructor.
The QR code directs them to the currently active survey, where they can
answer one or more questions from their phone, tablet, or laptop.

The instructor can create surveys before class, activate them with a
single click, and immediately collect responses. Survey data is
permanently stored and can be viewed later through an instructor
dashboard.

The application should be inexpensive to operate and use only free
hosting and database services.

------------------------------------------------------------------------

# 2. Goals

-   Extremely easy for students to use
-   Extremely easy for instructors to prepare surveys
-   Mobile friendly
-   Fast enough for an entire classroom
-   No student login required
-   Permanent storage of survey responses
-   Easy visualization of results
-   Free hosting
-   Open source

------------------------------------------------------------------------

# 3. Target Users

## Instructor

Version 1 supports a single instructor account. The account is created
manually in the Supabase dashboard; public sign-up is disabled (D7).

The instructor can:

-   Log in securely
-   Create, edit, duplicate, delete, archive, and unarchive surveys
-   Activate, close, and reopen surveys
-   Display QR codes
-   View live and historical responses
-   Export results

## Student

Students can:

-   Scan a QR code
-   Complete a survey
-   Submit responses
-   Receive confirmation

No student account is required. Responses are anonymous.

------------------------------------------------------------------------

# 4. Functional Requirements

## Survey Management

-   Create, edit, duplicate, archive, unarchive, and delete surveys.
-   Each survey contains a title, optional description, and one or more
    questions.
-   A survey with zero responses can be fully edited while Draft or
    Closed. Once it has a response, its questions and choices are
    locked; only title and description can change (D4).
-   An Active survey must be closed before it can be edited, archived,
    or deleted (D3).

## Supported Question Types

Version 1 supports:

-   Multiple Choice: 2–10 non-empty, distinct choices
-   True / False: two fixed choices, "True" and "False"

Every question is required (D5).

Future versions may add:

-   Checkbox
-   Short Answer
-   Rating Scale
-   Numeric Response

## Survey Lifecycle

Each survey is one of:

-   Draft
-   Active
-   Closed
-   Archived

Allowed transitions (D3):

``` text
Draft    → Active      (activate)
Active   → Closed      (close)
Closed   → Active      (reopen)
Draft    → Archived    (archive)
Closed   → Archived    (archive)
Archived → Closed      (unarchive)
```

Only one survey may be Active at any time. Activating a survey closes
the currently Active survey. A survey needs at least one question to be
activated.

## QR Code

When a survey is first activated, the application generates:

-   A public slug (8 characters, kept on reactivation) (D2)
-   Public survey URL `<VITE_PUBLIC_SITE_URL>/s/<slug>` (D12)
-   QR Code
-   Downloadable PNG

## Student Survey

Students can answer questions from any modern browser on phones,
tablets, or laptops. Each browser may submit once per survey (D8).

## Results Dashboard

Displays:

-   Response counts
-   Percentages (denominator: responses that answered the question) (D10)
-   Charts
-   Historical results

The present page shows a response count refreshed every 5 seconds (D11).

## CSV Export

Export all survey results as CSV: one row per response, one column per
question (D13).

------------------------------------------------------------------------

# 5. Nonfunctional Requirements

-   Responsive mobile interface
-   Support at least 200 simultaneous students, verified by a
    200-concurrent-submission script (D18)
-   Average page load under 2 seconds, verified with Lighthouse
-   Secure instructor authentication
-   Free cloud hosting (note: Supabase pauses inactive free projects; D17)

------------------------------------------------------------------------

# 6. Database Schema

Summary only. `DATABASE.md` is authoritative (D1).

## surveys

-   id
-   title
-   description
-   status
-   public_slug
-   created_at
-   updated_at

## questions

-   id
-   survey_id
-   question_text
-   question_type
-   position
-   created_at

## choices

-   id
-   question_id
-   choice_text
-   position
-   created_at

## responses

-   id
-   survey_id
-   anonymous_token
-   submitted_at

## answers

-   id
-   response_id
-   question_id
-   choice_id
-   text_answer (reserved for future question types)
-   created_at

------------------------------------------------------------------------

# 7. Technology Stack

Frontend

-   React
-   TypeScript
-   Vite
-   Tailwind CSS

Backend

-   Supabase (Auth, PostgREST, database functions)

Database

-   PostgreSQL

Charts

-   Recharts

QR Code

-   qrcode npm package

Hosting

-   Cloudflare Pages

Version Control

-   GitHub

Testing (D15)

-   Manual checklists in each TODO phase gate
-   SQL scripts for RLS and RPC checks
-   Vitest (optional) for pure logic

------------------------------------------------------------------------

# 8. Project Structure

``` text
classroom-survey/
├── src/
│   ├── components/
│   ├── pages/
│   └── lib/
├── supabase/
│   ├── migrations/      numbered SQL files (D14)
│   └── tests/           SQL scripts for RLS/RPC checks
├── scripts/
│   └── load-test        200-concurrent-submission script (D18)
├── public/
│   └── _redirects       Cloudflare Pages SPA routing
├── .env.example
├── README.md
├── SPEC.md
├── DATABASE.md
├── API.md
├── UI.md
└── TODO.md
```

## Environment Variables

``` text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PUBLIC_SITE_URL
```

------------------------------------------------------------------------

# 9. MVP

-   Instructor authentication
-   Survey creation/editing
-   Multiple-choice questions
-   True/False questions
-   QR code generation
-   Student submission page
-   PostgreSQL storage
-   Results dashboard
-   Historical browsing
-   CSV export

------------------------------------------------------------------------

# 10. Future Enhancements

-   Live updating charts (Supabase Realtime)
-   AI-generated questions
-   LMS integration
-   Question bank
-   Student authentication
-   Attendance tracking
-   Analytics
-   Multiple instructors

------------------------------------------------------------------------

# 11. Design Decisions

These decisions are confirmed. Other documents and `TODO.md` refer to
them by number.

**D1 — Source of truth.** `DATABASE.md`, `API.md`, and `UI.md` are
authoritative for their areas. §6 above is a summary only.

**D2 — Public route and slug.** The student route is `/s/:slug`. The
slug is 8 characters from the alphabet `abcdefghijkmnpqrstuvwxyz23456789`
(no `0`, `o`, `1`, `l`). `activate_survey` generates it on first
activation and keeps it on reactivation, so printed QR codes keep working.

**D3 — Lifecycle transitions.** As listed in §4. An Active survey must
be closed before it can be archived, deleted, or edited. The dashboard
hides Archived surveys by default.

**D4 — Editing.** A survey with zero responses can be fully edited while
Draft or Closed. With at least one response, questions and choices are
locked; title and description stay editable; to change questions,
Duplicate. The editor saves through one atomic `save_survey` RPC.

**D5 — Question rules.** Every question is required. Multiple Choice has
2–10 non-empty, distinct choices. True/False has fixed "True"/"False"
choices created by the editor. A survey needs at least one question to
be activated.

**D6 — Data access.** Multi-row writes go through RPCs: `save_survey`,
`duplicate_survey`, `activate_survey`, `close_survey`,
`submit_survey_response`. Results come from `get_survey_results`.
Simple single-table reads, updates, and deletes use the Supabase client.

**D7 — Security.** Public sign-up is disabled; the instructor account is
created manually. Instructor RPCs are `security invoker` with execute
revoked from `public` and `anon`. `submit_survey_response` is
`security definer` with `set search_path = ''`, executable by `anon`.
`anon` has no INSERT policy on `responses`/`answers` and no SELECT on them.

**D8 — Duplicate protection.** A `crypto.randomUUID()` token is stored
in localStorage. A unique index on `(survey_id, anonymous_token)` is
required. Accepted limitation: a private window or another browser can
submit again.

**D9 — Error contract.** RPCs `raise exception` with an error code as
the message. The frontend maps codes to `UI.md` messages; unknown errors
show a generic message; raw database errors are never shown.

**D10 — Results.** `get_survey_results(p_survey_id)` returns the
`API.md` results shape. Percentage denominator is the number of
responses that answered that question, rounded to one decimal place.
Any view used for results is created with `security_invoker = true`.

**D11 — Present-page response count.** Polled every 5 seconds while the
page is visible. Supabase Realtime is post-MVP.

**D12 — Public URL.** QR codes are built from `VITE_PUBLIC_SITE_URL`,
falling back to `window.location.origin`. Phone testing uses a
Cloudflare deployment, not localhost.

**D13 — CSV format.** One row per response; columns `response_id`,
`submitted_at` (ISO 8601 UTC), then one column per question in position
order with the question text as the header and the chosen choice text
as the cell. Survey metadata goes in the filename. Escape quotes, commas,
and newlines; prefix cells starting with `= + - @` with `'`; write UTF-8
with a BOM.

**D14 — Migrations.** All SQL lives in `supabase/migrations/` as
numbered files, applied with the Supabase CLI or pasted in order into
the SQL editor. The live schema is never changed without a migration file.

**D15 — Testing.** Manual checklist per phase gate, SQL scripts for RLS
and RPC checks, optional Vitest for pure logic, no end-to-end framework
for the MVP.

**D16 — Dates.** Displayed in the browser's local time. The dashboard
date filter uses `created_at`.

**D17 — Free tier.** Supabase pauses inactive free projects. Check the
project before each class, or keep it active.

**D18 — Load target.** Verified with a script that sends 200 concurrent
`submit_survey_response` calls to a test survey.