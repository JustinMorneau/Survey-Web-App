-- rls_check.sql — Phase 1 verification (re-run in Phase 7 against production)
--
-- Paste into the Supabase SQL editor and run.
-- It inserts test data, checks permissions as the anon and authenticated
-- roles, and ROLLS BACK everything at the end, so it leaves no data behind.
--
-- Success: the result shows "ALL RLS CHECKS PASSED".
-- Failure: the run stops with an error message starting with "FAIL:".
--
-- Note: the seed inserts an Active survey, so run this while no real
-- survey is Active (the one-active-survey index would reject the seed).

begin;

-- ---------------------------------------------------------------
-- Seed test data (as the postgres role, which bypasses RLS)
-- ---------------------------------------------------------------
insert into public.surveys (id, title, status) values
    ('00000000-0000-0000-0000-0000000000a1', 'RLS test active',   'active'),
    ('00000000-0000-0000-0000-0000000000a2', 'RLS test draft',    'draft'),
    ('00000000-0000-0000-0000-0000000000a3', 'RLS test closed',   'closed'),
    ('00000000-0000-0000-0000-0000000000a4', 'RLS test archived', 'archived');

insert into public.questions (id, survey_id, question_text, question_type, position) values
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Active Q', 'true_false', 1),
    ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'Draft Q',  'true_false', 1);

insert into public.choices (id, question_id, choice_text, position) values
    ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'True', 1),
    ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2', 'True', 1);

insert into public.responses (id, survey_id, anonymous_token) values
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'test-token');

insert into public.answers (response_id, question_id, choice_id) values
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');

-- ---------------------------------------------------------------
-- Checks as anon (students)
-- ---------------------------------------------------------------
set local role anon;

do $$
declare
    n integer;
begin
    -- Can read only the Active survey
    select count(*) into n from public.surveys
    where id::text like '00000000-0000-0000-0000-0000000000a_';
    if n <> 1 then
        raise exception 'FAIL: anon sees % test surveys (expected 1)', n;
    end if;

    perform 1 from public.surveys where id = '00000000-0000-0000-0000-0000000000a1';
    if not found then
        raise exception 'FAIL: anon cannot read the Active survey';
    end if;

    -- Can read only the Active survey's questions and choices
    select count(*) into n from public.questions
    where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
    if n <> 1 then
        raise exception 'FAIL: anon sees % test questions (expected 1)', n;
    end if;

    select count(*) into n from public.choices
    where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');
    if n <> 1 then
        raise exception 'FAIL: anon sees % test choices (expected 1)', n;
    end if;

    -- Cannot read responses or answers
    begin
        select count(*) into n from public.responses;
        if n > 0 then
            raise exception 'FAIL: anon can read responses';
        end if;
    exception when insufficient_privilege then null;
    end;

    begin
        select count(*) into n from public.answers;
        if n > 0 then
            raise exception 'FAIL: anon can read answers';
        end if;
    exception when insufficient_privilege then null;
    end;

    -- Cannot insert into any table
    begin
        insert into public.surveys (title) values ('anon survey');
        raise exception 'FAIL: anon inserted a survey';
    exception when insufficient_privilege then null;
    end;

    begin
        insert into public.questions (survey_id, question_text, question_type, position)
        values ('00000000-0000-0000-0000-0000000000a1', 'anon q', 'true_false', 2);
        raise exception 'FAIL: anon inserted a question';
    exception when insufficient_privilege then null;
    end;

    begin
        insert into public.choices (question_id, choice_text, position)
        values ('00000000-0000-0000-0000-0000000000b1', 'anon choice', 2);
        raise exception 'FAIL: anon inserted a choice';
    exception when insufficient_privilege then null;
    end;

    begin
        insert into public.responses (survey_id, anonymous_token)
        values ('00000000-0000-0000-0000-0000000000a1', 'anon-direct');
        raise exception 'FAIL: anon inserted a response directly';
    exception when insufficient_privilege then null;
    end;

    begin
        insert into public.answers (response_id, question_id)
        values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1');
        raise exception 'FAIL: anon inserted an answer directly';
    exception when insufficient_privilege then null;
    end;

    -- Cannot update or delete
    begin
        update public.surveys set title = 'hacked'
        where id = '00000000-0000-0000-0000-0000000000a1';
        raise exception 'FAIL: anon updated a survey';
    exception when insufficient_privilege then null;
    end;

    begin
        delete from public.surveys where id = '00000000-0000-0000-0000-0000000000a1';
        raise exception 'FAIL: anon deleted a survey';
    exception when insufficient_privilege then null;
    end;
end;
$$;

-- ---------------------------------------------------------------
-- Checks as authenticated (instructor)
-- ---------------------------------------------------------------
set local role authenticated;

do $$
declare
    n integer;
begin
    -- Can read everything
    select count(*) into n from public.surveys
    where id::text like '00000000-0000-0000-0000-0000000000a_';
    if n <> 4 then
        raise exception 'FAIL: authenticated sees % test surveys (expected 4)', n;
    end if;

    select count(*) into n from public.responses
    where id = '00000000-0000-0000-0000-0000000000d1';
    if n <> 1 then
        raise exception 'FAIL: authenticated cannot read responses';
    end if;

    select count(*) into n from public.answers
    where response_id = '00000000-0000-0000-0000-0000000000d1';
    if n <> 1 then
        raise exception 'FAIL: authenticated cannot read answers';
    end if;

    -- Can insert a Draft survey, but not a survey in another status
    insert into public.surveys (title) values ('auth draft');

    begin
        insert into public.surveys (title, status) values ('auth closed', 'closed');
        raise exception 'FAIL: authenticated inserted a non-draft survey';
    exception when insufficient_privilege then null;
    end;

    -- Can update
    update public.surveys set title = 'RLS test draft (renamed)'
    where id = '00000000-0000-0000-0000-0000000000a2';
    get diagnostics n = row_count;
    if n <> 1 then
        raise exception 'FAIL: authenticated could not update a survey';
    end if;

    -- Invalid status transition is rejected (D3)
    begin
        update public.surveys set status = 'closed'
        where id = '00000000-0000-0000-0000-0000000000a2';
        raise exception 'FAIL: draft -> closed was allowed';
    exception when raise_exception then
        if sqlerrm <> 'INVALID_STATUS_TRANSITION' then
            raise;
        end if;
    end;

    -- Valid transition is accepted
    update public.surveys set status = 'archived'
    where id = '00000000-0000-0000-0000-0000000000a2';

    -- Cannot delete the Active survey (silently affects 0 rows)
    delete from public.surveys where id = '00000000-0000-0000-0000-0000000000a1';
    get diagnostics n = row_count;
    if n <> 0 then
        raise exception 'FAIL: authenticated deleted the Active survey';
    end if;

    -- Can delete a Closed survey
    delete from public.surveys where id = '00000000-0000-0000-0000-0000000000a3';
    get diagnostics n = row_count;
    if n <> 1 then
        raise exception 'FAIL: authenticated could not delete a Closed survey';
    end if;

end;
$$;

reset role;

select 'ALL RLS CHECKS PASSED' as result;

rollback;
