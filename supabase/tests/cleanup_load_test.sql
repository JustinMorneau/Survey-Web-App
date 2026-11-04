-- cleanup_load_test.sql — removes responses created by scripts/load-test.mjs.
-- Their answers are removed by cascade.

delete from public.responses where anonymous_token like 'loadtest-%';

select count(*) as load_test_responses_remaining
from public.responses where anonymous_token like 'loadtest-%';
