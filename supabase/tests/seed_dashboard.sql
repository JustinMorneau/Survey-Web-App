-- seed_dashboard.sql — Phase 2 test data
--
-- Creates surveys in every status so the dashboard can be tested before
-- the survey editor exists (Phase 3). Every title starts with "[Seed]".
-- Remove them afterwards with cleanup_seed.sql.
--
-- Run in the Supabase SQL Editor. Safe to run once; running it twice
-- creates duplicates (the Active one is skipped if any survey is Active).

begin;

-- Draft, created today, no responses
insert into public.surveys (title, description, status)
values ('[Seed] Recursion Concept Check', 'Draft with no responses', 'draft');

-- Draft, created 30 days ago (for the date filter)
insert into public.surveys (title, status, created_at, updated_at)
values ('[Seed] Old Sorting Review', 'draft', now() - interval '30 days', now() - interval '30 days');

-- Active (only if no survey is currently Active)
insert into public.surveys (title, status, public_slug)
select '[Seed] Pointer Warm-up', 'active', 'seedactv'
where not exists (select 1 from public.surveys where status = 'active');

-- Closed, no responses
insert into public.surveys (title, status, created_at, updated_at)
values ('[Seed] Big-O Quick Check', 'closed', now() - interval '7 days', now() - interval '7 days');

-- Closed, 3 responses (tests the stronger delete warning)
with s as (
    insert into public.surveys (title, status, created_at, updated_at)
    values ('[Seed] Linked List Exit Ticket', 'closed', now() - interval '3 days', now() - interval '3 days')
    returning id
)
insert into public.responses (survey_id, anonymous_token)
select s.id, 'seed-token-' || n from s, generate_series(1, 3) as n;

-- Archived, 2 responses
with s as (
    insert into public.surveys (title, status, created_at, updated_at)
    values ('[Seed] Hash Table Recap', 'archived', now() - interval '14 days', now() - interval '14 days')
    returning id
)
insert into public.responses (survey_id, anonymous_token)
select s.id, 'seed-token-' || n from s, generate_series(1, 2) as n;

commit;

-- Show what was created
select title, status, created_at::date as created,
       (select count(*) from public.responses r where r.survey_id = s.id) as responses
from public.surveys s
where title like '[Seed]%'
order by created_at desc;
