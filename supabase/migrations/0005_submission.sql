-- 0005_submission.sql — Phase 5
-- submit_survey_response: the only function students (anon) may call.
-- See DATABASE.md §10. Decisions D5, D7, D8, D9.
--
-- SECURITY DEFINER: runs as the function owner, so it can insert into
-- responses and answers even though anon has no privileges on them.
-- Every input is therefore validated here before anything is written.

create or replace function public.submit_survey_response(
    p_survey_id uuid,
    p_anonymous_token text,
    p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_status text;
    v_token text := trim(coalesce(p_anonymous_token, ''));
    v_question_ids uuid[];
    v_choice_ids uuid[];
    v_answer_count integer;
    v_question_count integer;
    v_response_id uuid;
begin
    -- ---- Survey must exist and be Active ----
    -- FOR SHARE: a concurrent close_survey waits until this submission
    -- commits, while many submissions can run at the same time.
    select status into v_status
    from public.surveys
    where id = p_survey_id
    for share;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    if v_status <> 'active' then
        raise exception 'SURVEY_NOT_ACTIVE';
    end if;

    -- ---- Browser token (D8) ----
    if length(v_token) = 0 or length(v_token) > 200 then
        raise exception 'INVALID_TOKEN';
    end if;

    -- ---- Parse answers ----
    if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
        raise exception 'MISSING_REQUIRED_ANSWER';
    end if;

    begin
        select array_agg((a.value->>'question_id')::uuid order by a.ordinality)
        into v_question_ids
        from jsonb_array_elements(p_answers) with ordinality as a(value, ordinality);
    exception when invalid_text_representation then
        raise exception 'INVALID_QUESTION';
    end;

    begin
        select array_agg((a.value->>'choice_id')::uuid order by a.ordinality)
        into v_choice_ids
        from jsonb_array_elements(p_answers) with ordinality as a(value, ordinality);
    exception when invalid_text_representation then
        raise exception 'INVALID_CHOICE';
    end;

    v_answer_count := coalesce(array_length(v_question_ids, 1), 0);

    -- ---- Every question belongs to this survey, at most one answer each ----
    if exists (
        select 1
        from unnest(v_question_ids) as q(id)
        where q.id is null
           or not exists (
               select 1 from public.questions pq
               where pq.id = q.id and pq.survey_id = p_survey_id
           )
    ) then
        raise exception 'INVALID_QUESTION';
    end if;

    if (select count(distinct q.id) from unnest(v_question_ids) as q(id)) <> v_answer_count then
        raise exception 'INVALID_QUESTION';
    end if;

    -- ---- Every choice belongs to its question ----
    if exists (
        select 1
        from unnest(v_question_ids, v_choice_ids) as a(question_id, choice_id)
        where a.choice_id is null
           or not exists (
               select 1 from public.choices c
               where c.id = a.choice_id and c.question_id = a.question_id
           )
    ) then
        raise exception 'INVALID_CHOICE';
    end if;

    -- ---- Every question is answered (D5) ----
    select count(*) into v_question_count
    from public.questions
    where survey_id = p_survey_id;

    if v_answer_count <> v_question_count then
        raise exception 'MISSING_REQUIRED_ANSWER';
    end if;

    -- ---- Store the response and answers ----
    begin
        insert into public.responses (survey_id, anonymous_token)
        values (p_survey_id, v_token)
        returning id into v_response_id;
    exception when unique_violation then
        raise exception 'DUPLICATE_RESPONSE';
    end;

    insert into public.answers (response_id, question_id, choice_id)
    select v_response_id, a.question_id, a.choice_id
    from unnest(v_question_ids, v_choice_ids) as a(question_id, choice_id);

    return jsonb_build_object('success', true, 'response_id', v_response_id);
end;
$$;

-- ---------------------------------------------------------------
-- Permissions (D7): the one function students may call
-- ---------------------------------------------------------------
revoke execute on function public.submit_survey_response(uuid, text, jsonb) from public;
grant execute on function public.submit_survey_response(uuid, text, jsonb) to anon, authenticated;
