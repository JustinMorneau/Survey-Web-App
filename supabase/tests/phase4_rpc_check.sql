-- phase4_rpc_check.sql — verifies activate_survey and close_survey.
--
-- Paste into the Supabase SQL Editor and run. Everything is rolled back,
-- including any real survey the test closes along the way.
-- Success: "ALL PHASE 4 RPC CHECKS PASSED". Failure: an error starting with "FAIL:".

begin;

-- Seed (as postgres)
insert into public.surveys (id, title, status) values
    ('00000000-0000-0000-0000-0000000004a1', 'P4 survey A', 'draft'),
    ('00000000-0000-0000-0000-0000000004a2', 'P4 survey B', 'draft'),
    ('00000000-0000-0000-0000-0000000004a3', 'P4 no questions', 'draft'),
    ('00000000-0000-0000-0000-0000000004a4', 'P4 archived', 'archived');

insert into public.questions (survey_id, question_text, question_type, position) values
    ('00000000-0000-0000-0000-0000000004a1', 'Q', 'true_false', 1),
    ('00000000-0000-0000-0000-0000000004a2', 'Q', 'true_false', 1),
    ('00000000-0000-0000-0000-0000000004a4', 'Q', 'true_false', 1);

set local role authenticated;

do $$
declare
    v_row public.surveys;
    v_slug_a text;
    n integer;
begin
    -- Activate A: becomes Active with a well-formed slug
    v_row := public.activate_survey('00000000-0000-0000-0000-0000000004a1');
    if v_row.status <> 'active' then raise exception 'FAIL: A is not Active'; end if;
    if v_row.public_slug !~ '^[a-kmnp-z2-9]{8}$' then
        raise exception 'FAIL: bad slug "%"', v_row.public_slug;
    end if;
    v_slug_a := v_row.public_slug;

    -- Activating an already Active survey returns it unchanged
    v_row := public.activate_survey('00000000-0000-0000-0000-0000000004a1');
    if v_row.public_slug <> v_slug_a then raise exception 'FAIL: slug changed on re-activate'; end if;

    -- Activate B: A is closed, only one survey is Active
    perform public.activate_survey('00000000-0000-0000-0000-0000000004a2');
    select count(*) into n from public.surveys where status = 'active';
    if n <> 1 then raise exception 'FAIL: % Active surveys (expected 1)', n; end if;
    select count(*) into n from public.surveys
    where id = '00000000-0000-0000-0000-0000000004a1' and status = 'closed';
    if n <> 1 then raise exception 'FAIL: A was not closed'; end if;

    -- Reopen A: keeps its original slug
    v_row := public.activate_survey('00000000-0000-0000-0000-0000000004a1');
    if v_row.public_slug <> v_slug_a then raise exception 'FAIL: slug not kept on reopen'; end if;

    -- A and B have different slugs
    select count(distinct public_slug) into n from public.surveys
    where id in ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004a2');
    if n <> 2 then raise exception 'FAIL: slugs are not unique'; end if;

    -- Survey with no questions
    begin
        perform public.activate_survey('00000000-0000-0000-0000-0000000004a3');
        raise exception 'FAIL: survey with no questions was activated';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_HAS_NO_QUESTIONS' then raise; end if;
    end;

    -- Archived survey
    begin
        perform public.activate_survey('00000000-0000-0000-0000-0000000004a4');
        raise exception 'FAIL: Archived survey was activated';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_STATUS_TRANSITION' then raise; end if;
    end;

    -- Missing survey
    begin
        perform public.activate_survey('00000000-0000-0000-0000-00000000ffff');
        raise exception 'FAIL: missing survey did not raise';
    exception when raise_exception then
        if sqlerrm <> 'SURVEY_NOT_FOUND' then raise; end if;
    end;

    -- Close A
    perform public.close_survey('00000000-0000-0000-0000-0000000004a1');
    select count(*) into n from public.surveys
    where id = '00000000-0000-0000-0000-0000000004a1' and status = 'closed';
    if n <> 1 then raise exception 'FAIL: close_survey did not close A'; end if;

    -- Closing a survey that isn't Active
    begin
        perform public.close_survey('00000000-0000-0000-0000-0000000004a1');
        raise exception 'FAIL: closing a Closed survey was allowed';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_STATUS_TRANSITION' then raise; end if;
    end;

    begin
        perform public.close_survey('00000000-0000-0000-0000-00000000ffff');
        raise exception 'FAIL: closing a missing survey did not raise';
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
        perform public.activate_survey('00000000-0000-0000-0000-0000000004a2');
        raise exception 'FAIL: anon can call activate_survey';
    exception when insufficient_privilege then null;
    end;

    begin
        perform public.close_survey('00000000-0000-0000-0000-0000000004a2');
        raise exception 'FAIL: anon can call close_survey';
    exception when insufficient_privilege then null;
    end;
end;
$$;

reset role;

select 'ALL PHASE 4 RPC CHECKS PASSED' as result;

rollback;
