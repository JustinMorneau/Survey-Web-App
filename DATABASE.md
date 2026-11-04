# Classroom Survey Web App — Database Design

## Overview

The application uses PostgreSQL through Supabase.

The database stores surveys, questions, answer choices, student submissions, and individual answers.

Students are anonymous and use the `anon` role. The single instructor uses the `authenticated` role through Supabase Auth.

Because the anon key is public, all security is enforced in the database through Row Level Security (RLS), function permissions, and validation inside database functions.

Decision numbers (D1–D18) refer to the main specification, §11.

---

# 1. Entity Relationships

```text
surveys
  |
  +---- questions
          |
          +---- choices

surveys
  |
  +---- responses
          |
          +---- answers
                  |
                  +---- questions
                  |
                  +---- choices
```

---

# 2. Migrations (D14)

All schema changes live in `supabase/migrations/` as numbered SQL files. Apply them with the Supabase CLI (`supabase db push`), or paste them in order into the SQL editor.

Never change the live schema without a matching migration file.

Suggested files, added in the TODO phase that needs them:

```text
0001_schema.sql              tables, indexes, triggers        (Phase 1)
0002_rls.sql                 RLS and policies                 (Phase 1)
0003_save_and_duplicate.sql  save_survey, duplicate_survey    (Phase 3)
0004_activation.sql          activate_survey, close_survey    (Phase 4)
0005_submission.sql          submit_survey_response           (Phase 5)
0006_results.sql             get_survey_results               (Phase 6)
```

SQL test scripts for RLS and RPC checks live in `supabase/tests/`.

---

# 3. Authentication Settings (D7)

In the Supabase dashboard:

- disable public sign-ups;
- create the instructor account manually.

This is required. The authenticated policies below grant full access to any signed-in user, so open sign-up would give anyone full access.

---

# 4. Survey Status (D3)

Allowed values:

```text
draft
active
closed
archived
```

Allowed transitions:

```text
draft    → active
active   → closed
closed   → active
draft    → archived
closed   → archived
archived → closed
```

Only one survey may be Active at a time. Transitions are enforced by a trigger (§6).

---

# 5. Tables

## surveys

```sql
create table surveys (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(trim(title)) > 0),
    description text,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed', 'archived')),
    public_slug text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index surveys_status_idx on surveys(status);
create index surveys_created_at_idx on surveys(created_at);
```

## questions

```sql
create table questions (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    question_text text not null check (length(trim(question_text)) > 0),
    question_type text not null
        check (question_type in ('multiple_choice', 'true_false')),
    position integer not null,
    created_at timestamptz not null default now()
);

create index questions_survey_id_idx on questions(survey_id);
```

## choices

```sql
create table choices (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references questions(id) on delete cascade,
    choice_text text not null check (length(trim(choice_text)) > 0),
    position integer not null,
    created_at timestamptz not null default now()
);

create index choices_question_id_idx on choices(question_id);
```

Choice-count rules (2–10 for Multiple Choice, exactly "True"/"False" for True/False) are enforced in `save_survey` (D5).

## responses

```sql
create table responses (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    anonymous_token text not null,
    submitted_at timestamptz not null default now()
);

create index responses_survey_id_idx on responses(survey_id);
create index responses_submitted_at_idx on responses(submitted_at);
```

Duplicate prevention is required (D8):

```sql
create unique index responses_unique_student_per_survey
on responses(survey_id, anonymous_token);
```

## answers

```sql
create table answers (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references responses(id) on delete cascade,
    question_id uuid not null references questions(id) on delete cascade,
    choice_id uuid references choices(id) on delete set null,
    text_answer text,
    created_at timestamptz not null default now(),
    unique(response_id, question_id)
);

create index answers_response_id_idx on answers(response_id);
create index answers_question_id_idx on answers(question_id);
create index answers_choice_id_idx on answers(choice_id);
```

`text_answer` is reserved for future question types and is always null in v1.

Because questions and choices are locked once a survey has responses (D4), the `on delete cascade` / `on delete set null` paths are only reached when a whole survey is deleted.

---

# 6. Triggers

## Updated timestamp

```sql
create or replace function update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger surveys_updated_at
before update on surveys
for each row
execute function update_updated_at_column();
```

## Status transitions (D3)

```sql
create or replace function enforce_survey_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.status = old.status then
        return new;
    end if;

    if (old.status, new.status) not in (
        ('draft', 'active'),
        ('active', 'closed'),
        ('closed', 'active'),
        ('draft', 'archived'),
        ('closed', 'archived'),
        ('archived', 'closed')
    ) then
        raise exception 'INVALID_STATUS_TRANSITION';
    end if;

    return new;
end;
$$;

create trigger surveys_status_transition
before update of status on surveys
for each row
execute function enforce_survey_status_transition();
```

New surveys must be inserted as `draft`; this is enforced by the authenticated INSERT policy (§9).

---

# 7. Enforcing One Active Survey

```sql
create unique index only_one_active_survey
on surveys ((status))
where status = 'active';
```

`activate_survey` closes the current Active survey and activates the selected one in a single transaction (§10).

---

# 8. Public Slugs (D2)

- 8 characters from `abcdefghijkmnpqrstuvwxyz23456789` (no `0`, `o`, `1`, `l`);
- generated from a cryptographically random source by `activate_survey` on first activation;
- regenerated on a unique-index collision;
- kept when a Closed survey is reactivated;
- never sequential and never derived from the UUID.

Public route:

```text
/s/x7kf2qmb
```

---

# 9. Row Level Security

Enable RLS on every table:

```sql
alter table surveys enable row level security;
alter table questions enable row level security;
alter table choices enable row level security;
alter table responses enable row level security;
alter table answers enable row level security;
```

## Table privileges (defense in depth)

Supabase grants every table privilege to `anon` by default. The schema migration narrows that so students can only ever read survey content, even if a policy were written wrong:

```sql
revoke all on public.surveys, public.questions, public.choices,
              public.responses, public.answers
    from anon;

grant select on public.surveys, public.questions, public.choices
    to anon;

grant select, insert, update, delete
    on public.surveys, public.questions, public.choices,
       public.responses, public.answers
    to authenticated;
```

## Anonymous students (read only, active survey only)

```sql
create policy "anon read active surveys"
on surveys for select to anon
using (status = 'active');

create policy "anon read active survey questions"
on questions for select to anon
using (
    exists (
        select 1 from surveys
        where surveys.id = questions.survey_id
        and surveys.status = 'active'
    )
);

create policy "anon read active survey choices"
on choices for select to anon
using (
    exists (
        select 1
        from questions
        join surveys on surveys.id = questions.survey_id
        where questions.id = choices.question_id
        and surveys.status = 'active'
    )
);
```

There are no `anon` policies on `responses` or `answers`. Students cannot read results and cannot insert directly; they submit only through `submit_survey_response` (D7).

## Authenticated instructor

```sql
create policy "auth read surveys"
on surveys for select to authenticated using (true);

create policy "auth insert draft surveys"
on surveys for insert to authenticated
with check (status = 'draft');

create policy "auth update surveys"
on surveys for update to authenticated
using (true) with check (true);

create policy "auth delete non-active surveys"
on surveys for delete to authenticated
using (status <> 'active');
```

`questions`, `choices`, `responses`, and `answers` each get one policy:

```sql
create policy "auth manage <table>"
on <table> for all to authenticated
using (true) with check (true);
```

---

# 10. Database Functions (D6, D7, D9)

All functions raise errors with the error code as the message, for example `raise exception 'SURVEY_NOT_ACTIVE';`. `API.md` lists every code.

## Permissions

Supabase grants execute on new functions to `public`, `anon`, and `authenticated` by default. Every instructor function must revoke that:

```sql
revoke execute on function <function_signature> from public, anon;
grant execute on function <function_signature> to authenticated;
```

The submission function is the only function `anon` may run:

```sql
revoke execute on function submit_survey_response(uuid, text, jsonb) from public;
grant execute on function submit_survey_response(uuid, text, jsonb) to anon, authenticated;
```

## Function summary

| Function                 | Security | Callable by         | Purpose                                                  |
| ------------------------ | -------- | ------------------- | -------------------------------------------------------- |
| `save_survey`            | invoker  | authenticated       | Create or update a survey with its questions and choices |
| `duplicate_survey`       | invoker  | authenticated       | Copy a survey, questions, and choices as a Draft         |
| `activate_survey`        | invoker  | authenticated       | Close the current Active survey, activate this one       |
| `close_survey`           | invoker  | authenticated       | Close an Active survey                                   |
| `submit_survey_response` | definer  | anon, authenticated | Validate and store one student submission                |
| `get_survey_results`     | invoker  | authenticated       | Aggregate counts and percentages                         |

## save_survey (D4, D5)

```sql
save_survey(
    p_title text,
    p_description text,
    p_questions jsonb,
    p_survey_id uuid default null   -- omitted or null creates a new Draft
) returns uuid
```

Rules:

`p_survey_id` comes last because a parameter with a default must follow those without one. The default makes it optional in the generated TypeScript types, so the client omits it to create a survey.

- raise `VALIDATION_FAILED` before writing anything if any rule in D5 fails;
- raise `SURVEY_NOT_FOUND` if `p_survey_id` does not exist;
- raise `SURVEY_ACTIVE` if the survey is Active;
- raise `SURVEY_LOCKED` if the survey has any responses (title and description of a locked survey are updated directly through the client instead);
- delete the survey's existing questions (cascading to choices) and insert the new ones, with positions taken from array order;
- run in one transaction and return the survey ID.

Deleting and re-inserting is safe because it is only allowed when the survey has zero responses.

## duplicate_survey

```sql
duplicate_survey(p_survey_id uuid) returns uuid
```

Creates a Draft titled `Copy of <title>`, copies the description, questions, and choices, copies no responses and no slug, and returns the new survey ID.

## activate_survey (D2, D3, D5)

```sql
activate_survey(p_survey_id uuid)
returns public.surveys
```

In one transaction:

1. raise `SURVEY_NOT_FOUND` if the survey does not exist;
2. if it is already Active, return it unchanged;
3. raise `INVALID_STATUS_TRANSITION` unless it is Draft or Closed;
4. raise `SURVEY_HAS_NO_QUESTIONS` if it has no questions;
5. generate `public_slug` if null, from `gen_random_uuid()` bytes (cryptographically random, no extension needed), retrying on collision;
6. close the currently Active survey, if any;
7. set status to `active` and return the updated survey row.

## close_survey

```sql
close_survey(p_survey_id uuid) returns void
```

Sets status to `closed`. Raises `SURVEY_NOT_FOUND`, or `INVALID_STATUS_TRANSITION` if the survey is not Active. Submissions fail immediately afterward.

## submit_survey_response (D7, D8)

```sql
submit_survey_response(
    p_survey_id uuid,
    p_anonymous_token text,
    p_answers jsonb
) returns jsonb
```

Declared `security definer` with `set search_path = ''`, using schema-qualified table names. In one transaction:

1. raise `SURVEY_NOT_FOUND` if the survey does not exist;
2. raise `SURVEY_NOT_ACTIVE` if it is not Active;
3. raise `INVALID_QUESTION` if any `question_id` does not belong to the survey;
4. raise `INVALID_CHOICE` if any `choice_id` does not belong to its question;
5. raise `MISSING_REQUIRED_ANSWER` unless every question has exactly one answer;
6. insert the response; a unique-index violation raises `DUPLICATE_RESPONSE`;
7. insert all answers;
8. return `{"success": true, "response_id": "<uuid>"}`.

## get_survey_results (D10)

```sql
get_survey_results(p_survey_id uuid) returns jsonb
```

Returns the shape in `API.md` §12. For each choice:

```text
percentage = round(choice_count * 100.0 / question_answer_count, 1)
```

`question_answer_count` is the number of responses that answered that question. When it is 0, percentages are 0.

Underlying aggregation:

```sql
select
    q.id as question_id,
    q.question_text,
    c.id as choice_id,
    c.choice_text,
    count(a.id) as answer_count
from questions q
join choices c on c.question_id = q.id
left join answers a on a.choice_id = c.id
where q.survey_id = p_survey_id
group by q.id, q.question_text, q.position, c.id, c.choice_text, c.position
order by q.position, c.position;
```

If a view is used instead of a function, create it with `with (security_invoker = true)` so RLS still applies.

---

# 11. Data Retention

Survey responses are never deleted automatically.

Deleting a survey deletes its questions, choices, responses, and answers. Active surveys cannot be deleted. The UI strongly encourages Archive instead of Delete for surveys with responses.

On the Supabase free tier, inactive projects are paused (D17). Pausing does not delete data, but the project must be resumed before class.

---

# 12. Future Schema Extensions

Possible future tables:

```text
courses
semesters
question_bank
instructors
survey_instructors
tags
```

These are intentionally excluded from Version 1.
