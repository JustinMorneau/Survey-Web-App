-- 0001_schema.sql — Phase 1
-- Tables, constraints, indexes, triggers, and table privileges.
-- See DATABASE.md §5–§8. Decision numbers refer to SPEC.md §11.

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table public.surveys (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(trim(title)) > 0),
    description text,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed', 'archived')),
    public_slug text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.questions (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references public.surveys(id) on delete cascade,
    question_text text not null check (length(trim(question_text)) > 0),
    question_type text not null
        check (question_type in ('multiple_choice', 'true_false')),
    position integer not null,
    created_at timestamptz not null default now()
);

create table public.choices (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references public.questions(id) on delete cascade,
    choice_text text not null check (length(trim(choice_text)) > 0),
    position integer not null,
    created_at timestamptz not null default now()
);

create table public.responses (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references public.surveys(id) on delete cascade,
    anonymous_token text not null,
    submitted_at timestamptz not null default now()
);

create table public.answers (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references public.responses(id) on delete cascade,
    question_id uuid not null references public.questions(id) on delete cascade,
    choice_id uuid references public.choices(id) on delete set null,
    text_answer text,
    created_at timestamptz not null default now(),
    unique (response_id, question_id)
);

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------

create index surveys_status_idx on public.surveys(status);
create index surveys_created_at_idx on public.surveys(created_at);

create index questions_survey_id_idx on public.questions(survey_id);

create index choices_question_id_idx on public.choices(question_id);

create index responses_survey_id_idx on public.responses(survey_id);
create index responses_submitted_at_idx on public.responses(submitted_at);

-- D8: one submission per browser token per survey (required)
create unique index responses_unique_student_per_survey
    on public.responses(survey_id, anonymous_token);

create index answers_response_id_idx on public.answers(response_id);
create index answers_question_id_idx on public.answers(question_id);
create index answers_choice_id_idx on public.answers(choice_id);

-- Only one survey may be Active at a time
create unique index only_one_active_survey
    on public.surveys ((status))
    where status = 'active';

-- ---------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------

create or replace function public.update_updated_at_column()
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
before update on public.surveys
for each row
execute function public.update_updated_at_column();

-- D3: allowed status transitions
create or replace function public.enforce_survey_status_transition()
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
before update of status on public.surveys
for each row
execute function public.enforce_survey_status_transition();

-- ---------------------------------------------------------------
-- Table privileges (defense in depth; RLS in 0002 still applies)
-- Students (anon) may only ever SELECT survey content. They submit
-- through the submit_survey_response function added in Phase 5.
-- ---------------------------------------------------------------

revoke all on public.surveys, public.questions, public.choices,
              public.responses, public.answers
    from anon;

grant select on public.surveys, public.questions, public.choices
    to anon;

grant select, insert, update, delete
    on public.surveys, public.questions, public.choices,
       public.responses, public.answers
    to authenticated;
