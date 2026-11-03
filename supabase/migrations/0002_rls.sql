-- 0002_rls.sql — Phase 1
-- Row Level Security. See DATABASE.md §9.

alter table public.surveys enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.responses enable row level security;
alter table public.answers enable row level security;

-- ---------------------------------------------------------------
-- Anonymous students: read only the Active survey's content.
-- No anon policies exist on responses or answers.
-- ---------------------------------------------------------------

create policy "anon read active surveys"
on public.surveys for select to anon
using (status = 'active');

create policy "anon read active survey questions"
on public.questions for select to anon
using (
    exists (
        select 1 from public.surveys s
        where s.id = questions.survey_id
        and s.status = 'active'
    )
);

create policy "anon read active survey choices"
on public.choices for select to anon
using (
    exists (
        select 1
        from public.questions q
        join public.surveys s on s.id = q.survey_id
        where q.id = choices.question_id
        and s.status = 'active'
    )
);

-- ---------------------------------------------------------------
-- Authenticated instructor (single account; sign-ups disabled, D7)
-- ---------------------------------------------------------------

create policy "auth read surveys"
on public.surveys for select to authenticated
using (true);

create policy "auth insert draft surveys"
on public.surveys for insert to authenticated
with check (status = 'draft');

create policy "auth update surveys"
on public.surveys for update to authenticated
using (true) with check (true);

create policy "auth delete non-active surveys"
on public.surveys for delete to authenticated
using (status <> 'active');

create policy "auth manage questions"
on public.questions for all to authenticated
using (true) with check (true);

create policy "auth manage choices"
on public.choices for all to authenticated
using (true) with check (true);

create policy "auth manage responses"
on public.responses for all to authenticated
using (true) with check (true);

create policy "auth manage answers"
on public.answers for all to authenticated
using (true) with check (true);
