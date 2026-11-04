-- phase6_rpc_check.sql — verifies get_survey_results.
--
-- Paste into the Supabase SQL Editor and run. Everything is rolled back.
-- Success: "ALL PHASE 6 RPC CHECKS PASSED". Failure: an error starting with "FAIL:".

begin;

-- Seed (as postgres): one survey with 4 responses, one with none
insert into public.surveys (id, title, status) values
    ('00000000-0000-0000-0000-0000000006a1', 'P6 results', 'closed'),
    ('00000000-0000-0000-0000-0000000006a2', 'P6 empty', 'draft');

insert into public.questions (id, survey_id, question_text, question_type, position) values
    ('00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006a1', 'First', 'multiple_choice', 1),
    ('00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006a1', 'Second', 'true_false', 2),
    ('00000000-0000-0000-0000-0000000006b3', '00000000-0000-0000-0000-0000000006a2', 'Empty', 'true_false', 1);

insert into public.choices (id, question_id, choice_text, position) values
    ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006b1', 'A', 1),
    ('00000000-0000-0000-0000-0000000006c2', '00000000-0000-0000-0000-0000000006b1', 'B', 2),
    ('00000000-0000-0000-0000-0000000006c3', '00000000-0000-0000-0000-0000000006b1', 'C', 3),
    ('00000000-0000-0000-0000-0000000006c4', '00000000-0000-0000-0000-0000000006b2', 'True', 1),
    ('00000000-0000-0000-0000-0000000006c5', '00000000-0000-0000-0000-0000000006b2', 'False', 2),
    ('00000000-0000-0000-0000-0000000006c6', '00000000-0000-0000-0000-0000000006b3', 'True', 1),
    ('00000000-0000-0000-0000-0000000006c7', '00000000-0000-0000-0000-0000000006b3', 'False', 2);

insert into public.responses (id, survey_id, anonymous_token) values
    ('00000000-0000-0000-0000-0000000006d1', '00000000-0000-0000-0000-0000000006a1', 't1'),
    ('00000000-0000-0000-0000-0000000006d2', '00000000-0000-0000-0000-0000000006a1', 't2'),
    ('00000000-0000-0000-0000-0000000006d3', '00000000-0000-0000-0000-0000000006a1', 't3'),
    ('00000000-0000-0000-0000-0000000006d4', '00000000-0000-0000-0000-0000000006a1', 't4');

-- Question 1: A, A, A, B  -> 75.0 / 25.0 / 0
-- Question 2: True, True, False (one response has no answer) -> 66.7 / 33.3 of 3
insert into public.answers (response_id, question_id, choice_id) values
    ('00000000-0000-0000-0000-0000000006d1', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006c1'),
    ('00000000-0000-0000-0000-0000000006d2', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006c1'),
    ('00000000-0000-0000-0000-0000000006d3', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006c1'),
    ('00000000-0000-0000-0000-0000000006d4', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006c2'),
    ('00000000-0000-0000-0000-0000000006d1', '00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006c4'),
    ('00000000-0000-0000-0000-0000000006d2', '00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006c4'),
    ('00000000-0000-0000-0000-0000000006d3', '00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006c5');

set local role authenticated;

do $$
declare
    r jsonb;
    q1 jsonb;
    q2 jsonb;
begin
    r := public.get_survey_results('00000000-0000-0000-0000-0000000006a1');

    if (r->>'response_count')::int <> 4 then
        raise exception 'FAIL: response_count is % (expected 4)', r->>'response_count';
    end if;
    if r->>'title' <> 'P6 results' or r->>'status' <> 'closed' then
        raise exception 'FAIL: title/status missing';
    end if;
    if jsonb_array_length(r->'questions') <> 2 then
        raise exception 'FAIL: expected 2 questions';
    end if;

    q1 := r->'questions'->0;
    q2 := r->'questions'->1;

    if q1->>'question_text' <> 'First' then raise exception 'FAIL: questions out of order'; end if;
    if (q1->>'response_count')::int <> 4 then raise exception 'FAIL: q1 answered count'; end if;
    if q1->'choices'->0->>'choice_text' <> 'A' then raise exception 'FAIL: choices out of order'; end if;
    if (q1->'choices'->0->>'count')::int <> 3 then raise exception 'FAIL: A count'; end if;
    if (q1->'choices'->0->>'percentage')::numeric <> 75.0 then raise exception 'FAIL: A percentage'; end if;
    if (q1->'choices'->1->>'percentage')::numeric <> 25.0 then raise exception 'FAIL: B percentage'; end if;
    if (q1->'choices'->2->>'count')::int <> 0 then raise exception 'FAIL: C should be 0'; end if;

    -- Denominator is answers to this question (3), not all responses (4)
    if (q2->>'response_count')::int <> 3 then raise exception 'FAIL: q2 answered count'; end if;
    if (q2->'choices'->0->>'percentage')::numeric <> 66.7 then
        raise exception 'FAIL: True percentage is %', q2->'choices'->0->>'percentage';
    end if;
    if (q2->'choices'->1->>'percentage')::numeric <> 33.3 then raise exception 'FAIL: False percentage'; end if;

    -- Survey with no responses: zeros, not errors
    r := public.get_survey_results('00000000-0000-0000-0000-0000000006a2');
    if (r->>'response_count')::int <> 0 then raise exception 'FAIL: empty survey count'; end if;
    if (r->'questions'->0->'choices'->0->>'percentage')::numeric <> 0 then
        raise exception 'FAIL: empty survey percentage';
    end if;

    -- Missing survey
    begin
        perform public.get_survey_results('00000000-0000-0000-0000-00000000ffff');
        raise exception 'FAIL: missing survey did not raise';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_NOT_FOUND' then raise; end if;
    end;
end;
$$;

-- Students cannot read results
set local role anon;

do $$
begin
    perform public.get_survey_results('00000000-0000-0000-0000-0000000006a1');
    raise exception 'FAIL: anon can call get_survey_results';
exception when insufficient_privilege then null;
end;
$$;

reset role;

select 'ALL PHASE 6 RPC CHECKS PASSED' as result;

rollback;
