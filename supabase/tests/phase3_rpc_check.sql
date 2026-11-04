-- phase3_rpc_check.sql — verifies save_survey and duplicate_survey.
--
-- Paste into the Supabase SQL Editor and run. Everything is rolled back.
-- Success: "ALL PHASE 3 RPC CHECKS PASSED". Failure: an error starting with "FAIL:".
-- Run while no real survey is Active (the seed inserts one).

begin;

-- Seed (as postgres): an Active survey and a Closed survey with a response
insert into public.surveys (id, title, status) values
    ('00000000-0000-0000-0000-0000000003a1', 'P3 active', 'active'),
    ('00000000-0000-0000-0000-0000000003a2', 'P3 closed with response', 'closed');
insert into public.responses (survey_id, anonymous_token) values
    ('00000000-0000-0000-0000-0000000003a2', 'p3-token');

set local role authenticated;

do $$
declare
    v_id uuid;
    v_copy uuid;
    n integer;
    v_text text;
    good_questions jsonb := '[
        {"question_text": "What is required for recursion?", "question_type": "multiple_choice",
         "choices": [{"choice_text": "A base case"}, {"choice_text": "A loop"}, {"choice_text": "A pointer"}]},
        {"question_text": "Recursion needs a stopping condition.", "question_type": "true_false",
         "choices": [{"choice_text": "True"}, {"choice_text": "False"}]}
    ]';
begin
    -- Create a new Draft
    v_id := public.save_survey('  P3 new survey  ', 'Desc', good_questions);

    select count(*) into n from public.surveys where id = v_id and status = 'draft' and title = 'P3 new survey';
    if n <> 1 then raise exception 'FAIL: new survey not created as trimmed Draft'; end if;

    select count(*) into n from public.questions where survey_id = v_id;
    if n <> 2 then raise exception 'FAIL: expected 2 questions, found %', n; end if;

    select c.choice_text into v_text
    from public.choices c join public.questions q on q.id = c.question_id
    where q.survey_id = v_id and q.position = 1 and c.position = 2;
    if v_text <> 'A loop' then raise exception 'FAIL: choice order not preserved'; end if;

    -- A Draft with zero questions is allowed
    perform public.save_survey('P3 empty draft', '', '[]');

    -- Update replaces questions
    perform public.save_survey('P3 renamed', '', '[
        {"question_text": "Only question", "question_type": "true_false",
         "choices": [{"choice_text": "True"}, {"choice_text": "False"}]}
    ]', v_id);
    select count(*) into n from public.questions where survey_id = v_id;
    if n <> 1 then raise exception 'FAIL: update did not replace questions'; end if;

    -- Validation failures
    begin
        perform public.save_survey('', '', '[]');
        raise exception 'FAIL: empty title accepted';
    exception when raise_exception then
        if sqlerrm <> 'VALIDATION_FAILED' then raise; end if;
    end;

    begin
        perform public.save_survey('T', '', '[{"question_text": "Q", "question_type": "multiple_choice",
            "choices": [{"choice_text": "Only one"}]}]');
        raise exception 'FAIL: one-choice question accepted';
    exception when raise_exception then
        if sqlerrm <> 'VALIDATION_FAILED' then raise; end if;
    end;

    begin
        perform public.save_survey('T', '', '[{"question_text": "Q", "question_type": "multiple_choice",
            "choices": [{"choice_text": "Same"}, {"choice_text": "same"}]}]');
        raise exception 'FAIL: duplicate choices accepted';
    exception when raise_exception then
        if sqlerrm <> 'VALIDATION_FAILED' then raise; end if;
    end;

    begin
        perform public.save_survey('T', '', '[{"question_text": "Q", "question_type": "true_false",
            "choices": [{"choice_text": "Yes"}, {"choice_text": "No"}]}]');
        raise exception 'FAIL: wrong True/False choices accepted';
    exception when raise_exception then
        if sqlerrm <> 'VALIDATION_FAILED' then raise; end if;
    end;

    begin
        perform public.save_survey('T', '', '[{"question_text": "  ", "question_type": "true_false",
            "choices": [{"choice_text": "True"}, {"choice_text": "False"}]}]');
        raise exception 'FAIL: blank question text accepted';
    exception when raise_exception then
        if sqlerrm <> 'VALIDATION_FAILED' then raise; end if;
    end;

    -- Status and lock rules
    begin
        perform public.save_survey('T', '', '[]', '00000000-0000-0000-0000-0000000003a1');
        raise exception 'FAIL: Active survey was editable';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_ACTIVE' then raise; end if;
    end;

    begin
        perform public.save_survey('T', '', '[]', '00000000-0000-0000-0000-0000000003a2');
        raise exception 'FAIL: survey with responses was editable';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_LOCKED' then raise; end if;
    end;

    begin
        perform public.save_survey('T', '', '[]', '00000000-0000-0000-0000-00000000ffff');
        raise exception 'FAIL: missing survey did not raise';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_NOT_FOUND' then raise; end if;
    end;

    -- Duplicate
    v_copy := public.duplicate_survey(v_id);

    select count(*) into n from public.surveys
    where id = v_copy and status = 'draft' and title = 'Copy of P3 renamed' and public_slug is null;
    if n <> 1 then raise exception 'FAIL: duplicate is not a Draft named "Copy of ..."'; end if;

    select count(*) into n from public.choices c join public.questions q on q.id = c.question_id
    where q.survey_id = v_copy;
    if n <> 2 then raise exception 'FAIL: duplicate copied % choices (expected 2)', n; end if;

    -- Duplicating a survey with responses copies no responses
    v_copy := public.duplicate_survey('00000000-0000-0000-0000-0000000003a2');
    select count(*) into n from public.responses where survey_id = v_copy;
    if n <> 0 then raise exception 'FAIL: duplicate copied responses'; end if;

    begin
        perform public.duplicate_survey('00000000-0000-0000-0000-00000000ffff');
        raise exception 'FAIL: duplicating a missing survey did not raise';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_NOT_FOUND' then raise; end if;
    end;
end;
$$;

-- Students cannot call either function
set local role anon;

do $$
begin
    begin
        perform public.save_survey('Anon', '', '[]');
        raise exception 'FAIL: anon can call save_survey';
    exception when insufficient_privilege then null;
    end;

    begin
        perform public.duplicate_survey('00000000-0000-0000-0000-0000000003a2');
        raise exception 'FAIL: anon can call duplicate_survey';
    exception when insufficient_privilege then null;
    end;
end;
$$;

reset role;

select 'ALL PHASE 3 RPC CHECKS PASSED' as result;

rollback;
