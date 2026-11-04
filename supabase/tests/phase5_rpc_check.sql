-- phase5_rpc_check.sql — verifies submit_survey_response.
--
-- Paste into the Supabase SQL Editor and run. Everything is rolled back,
-- including closing any real Active survey for the duration of the test.
-- Success: "ALL PHASE 5 RPC CHECKS PASSED". Failure: an error starting with "FAIL:".

begin;

-- Seed (as postgres)
update public.surveys set status = 'closed' where status = 'active';

insert into public.surveys (id, title, status) values
    ('00000000-0000-0000-0000-0000000005a1', 'P5 active', 'active'),
    ('00000000-0000-0000-0000-0000000005a2', 'P5 closed', 'closed');

insert into public.questions (id, survey_id, question_text, question_type, position) values
    ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005a1', 'MC', 'multiple_choice', 1),
    ('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-0000000005a1', 'TF', 'true_false', 2),
    ('00000000-0000-0000-0000-0000000005b3', '00000000-0000-0000-0000-0000000005a2', 'Other', 'true_false', 1);

insert into public.choices (id, question_id, choice_text, position) values
    ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005b1', 'A', 1),
    ('00000000-0000-0000-0000-0000000005c2', '00000000-0000-0000-0000-0000000005b1', 'B', 2),
    ('00000000-0000-0000-0000-0000000005c3', '00000000-0000-0000-0000-0000000005b2', 'True', 1),
    ('00000000-0000-0000-0000-0000000005c4', '00000000-0000-0000-0000-0000000005b2', 'False', 2),
    ('00000000-0000-0000-0000-0000000005c5', '00000000-0000-0000-0000-0000000005b3', 'True', 1);

-- Every check runs as a student
set local role anon;

do $$
declare
    v_result jsonb;
    v_survey constant uuid := '00000000-0000-0000-0000-0000000005a1';
    v_good constant jsonb := '[
        {"question_id": "00000000-0000-0000-0000-0000000005b1", "choice_id": "00000000-0000-0000-0000-0000000005c2"},
        {"question_id": "00000000-0000-0000-0000-0000000005b2", "choice_id": "00000000-0000-0000-0000-0000000005c3"}
    ]';

begin
    -- Valid submission
    v_result := public.submit_survey_response(v_survey, 'p5-token-1', v_good);
    if (v_result->>'success')::boolean is not true or v_result->>'response_id' is null then
        raise exception 'FAIL: valid submission returned %', v_result;
    end if;

    -- Same token again
    begin
        perform public.submit_survey_response(v_survey, 'p5-token-1', v_good);
        raise exception 'FAIL: duplicate token accepted';
    exception when raise_exception then
        if sqlerrm <> 'DUPLICATE_RESPONSE' then raise; end if;
    end;

    -- Choice from a different question
    begin
        perform public.submit_survey_response(v_survey, 'p5-token-2', '[
            {"question_id": "00000000-0000-0000-0000-0000000005b1", "choice_id": "00000000-0000-0000-0000-0000000005c3"},
            {"question_id": "00000000-0000-0000-0000-0000000005b2", "choice_id": "00000000-0000-0000-0000-0000000005c4"}
        ]');
        raise exception 'FAIL: choice from another question accepted';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_CHOICE' then raise; end if;
    end;

    -- Question from a different survey
    begin
        perform public.submit_survey_response(v_survey, 'p5-token-3', '[
            {"question_id": "00000000-0000-0000-0000-0000000005b3", "choice_id": "00000000-0000-0000-0000-0000000005c5"},
            {"question_id": "00000000-0000-0000-0000-0000000005b2", "choice_id": "00000000-0000-0000-0000-0000000005c4"}
        ]');
        raise exception 'FAIL: question from another survey accepted';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_QUESTION' then raise; end if;
    end;

    -- Same question answered twice
    begin
        perform public.submit_survey_response(v_survey, 'p5-token-4', '[
            {"question_id": "00000000-0000-0000-0000-0000000005b1", "choice_id": "00000000-0000-0000-0000-0000000005c1"},
            {"question_id": "00000000-0000-0000-0000-0000000005b1", "choice_id": "00000000-0000-0000-0000-0000000005c2"}
        ]');
        raise exception 'FAIL: repeated question accepted';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_QUESTION' then raise; end if;
    end;

    -- Not a UUID
    begin
        perform public.submit_survey_response(v_survey, 'p5-token-5', '[
            {"question_id": "not-a-uuid", "choice_id": "00000000-0000-0000-0000-0000000005c1"}
        ]');
        raise exception 'FAIL: malformed question id accepted';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_QUESTION' then raise; end if;
    end;

    -- Missing an answer
    begin
        perform public.submit_survey_response(v_survey, 'p5-token-6', '[
            {"question_id": "00000000-0000-0000-0000-0000000005b1", "choice_id": "00000000-0000-0000-0000-0000000005c1"}
        ]');
        raise exception 'FAIL: incomplete submission accepted';
    exception when raise_exception then
        if sqlerrm <> 'MISSING_REQUIRED_ANSWER' then raise; end if;
    end;

    -- Blank token
    begin
        perform public.submit_survey_response(v_survey, '   ', v_good);
        raise exception 'FAIL: blank token accepted';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_TOKEN' then raise; end if;
    end;

    -- Survey not Active
    begin
        perform public.submit_survey_response('00000000-0000-0000-0000-0000000005a2', 'p5-token-7', '[]');
        raise exception 'FAIL: closed survey accepted a submission';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_NOT_ACTIVE' then raise; end if;
    end;

    -- Survey does not exist
    begin
        perform public.submit_survey_response('00000000-0000-0000-0000-00000000ffff', 'p5-token-8', '[]');
        raise exception 'FAIL: missing survey did not raise';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_NOT_FOUND' then raise; end if;
    end;

    -- Students still can't read results
    begin
        perform 1 from public.responses;
        raise exception 'FAIL: anon can read responses';
    exception when insufficient_privilege then null;
    end;
end;
$$;

reset role;

-- Exactly one response with two answers was stored
do $$
declare
    n integer;
begin
    select count(*) into n from public.responses
    where survey_id = '00000000-0000-0000-0000-0000000005a1';
    if n <> 1 then raise exception 'FAIL: % responses stored (expected 1)', n; end if;

    select count(*) into n from public.answers a
    join public.responses r on r.id = a.response_id
    where r.survey_id = '00000000-0000-0000-0000-0000000005a1';
    if n <> 2 then raise exception 'FAIL: % answers stored (expected 2)', n; end if;
end;
$$;

select 'ALL PHASE 5 RPC CHECKS PASSED' as result;

rollback;
