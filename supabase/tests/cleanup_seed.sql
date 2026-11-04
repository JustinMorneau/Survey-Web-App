-- cleanup_seed.sql — removes every survey whose title starts with "[Seed]".
-- Questions, choices, responses, and answers are removed by cascade.
-- An Active seed survey is closed first, because Active surveys can't be deleted.

begin;

update public.surveys set status = 'closed'
where title like '[Seed]%' and status = 'active';

delete from public.surveys where title like '[Seed]%';

commit;

select count(*) as seed_surveys_remaining
from public.surveys where title like '[Seed]%';
