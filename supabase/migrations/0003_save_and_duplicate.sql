-- 0003_save_and_duplicate.sql — Phase 3
-- save_survey and duplicate_survey. See DATABASE.md §10. Decisions D4, D5, D6, D7, D9.

-- ---------------------------------------------------------------
-- save_survey: create a Draft (p_survey_id omitted) or replace an
-- existing survey's title, description, questions, and choices.
-- Questions and choices may only be replaced while the survey has
-- zero responses (D4). Positions come from array order.
-- ---------------------------------------------------------------
create or replace function public.save_survey(
    p_title text,
    p_description text,
    p_questions jsonb,
    p_survey_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_id uuid;
    v_status text;
    v_question jsonb;
    v_question_pos bigint;
    v_question_id uuid;
    v_type text;
    v_texts text[];
    v_count integer;
begin
    -- ---- Validate everything before writing anything (D5) ----
    if p_title is null or length(trim(p_title)) = 0 then
        raise exception 'VALIDATION_FAILED';
    end if;

    if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
        raise exception 'VALIDATION_FAILED';
    end if;

    for v_question in select value from jsonb_array_elements(p_questions) loop
        v_type := v_question->>'question_type';

        if coalesce(length(trim(v_question->>'question_text')), 0) = 0 then
            raise exception 'VALIDATION_FAILED';
        end if;

        if jsonb_typeof(v_question->'choices') is distinct from 'array' then
            raise exception 'VALIDATION_FAILED';
        end if;

        select array_agg(trim(c.value->>'choice_text') order by c.ordinality)
        into v_texts
        from jsonb_array_elements(v_question->'choices') with ordinality as c(value, ordinality);

        v_count := coalesce(array_length(v_texts, 1), 0);

        if v_type = 'multiple_choice' then
            if v_count < 2 or v_count > 10 then
                raise exception 'VALIDATION_FAILED';
            end if;
            if exists (select 1 from unnest(v_texts) as t(x) where x is null or x = '') then
                raise exception 'VALIDATION_FAILED';
            end if;
            if (select count(distinct lower(x)) from unnest(v_texts) as t(x)) <> v_count then
                raise exception 'VALIDATION_FAILED';
            end if;
        elsif v_type = 'true_false' then
            if v_texts is distinct from array['True', 'False'] then
                raise exception 'VALIDATION_FAILED';
            end if;
        else
            raise exception 'VALIDATION_FAILED';
        end if;
    end loop;

    -- ---- Create or update the survey row ----
    if p_survey_id is null then
        insert into public.surveys (title, description)
        values (trim(p_title), nullif(trim(coalesce(p_description, '')), ''))
        returning id into v_id;
    else
        select status into v_status
        from public.surveys
        where id = p_survey_id
        for update;

        if not found then
            raise exception 'SURVEY_NOT_FOUND';
        end if;

        if v_status = 'active' then
            raise exception 'SURVEY_ACTIVE';
        end if;

        if exists (select 1 from public.responses where survey_id = p_survey_id) then
            raise exception 'SURVEY_LOCKED';
        end if;

        update public.surveys
        set title = trim(p_title),
            description = nullif(trim(coalesce(p_description, '')), '')
        where id = p_survey_id;

        -- Safe: the survey has no responses, so no answers reference these rows.
        delete from public.questions where survey_id = p_survey_id;

        v_id := p_survey_id;
    end if;

    -- ---- Insert questions and choices in array order ----
    for v_question, v_question_pos in
        select value, ordinality from jsonb_array_elements(p_questions) with ordinality
    loop
        insert into public.questions (survey_id, question_text, question_type, position)
        values (
            v_id,
            trim(v_question->>'question_text'),
            v_question->>'question_type',
            v_question_pos
        )
        returning id into v_question_id;

        insert into public.choices (question_id, choice_text, position)
        select v_question_id, trim(c.value->>'choice_text'), c.ordinality
        from jsonb_array_elements(v_question->'choices') with ordinality as c(value, ordinality);
    end loop;

    return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- duplicate_survey: copy title (as "Copy of ..."), description,
-- questions, and choices into a new Draft. No responses, no slug.
-- ---------------------------------------------------------------
create or replace function public.duplicate_survey(p_survey_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_new_survey_id uuid;
    v_question record;
    v_new_question_id uuid;
begin
    insert into public.surveys (title, description)
    select 'Copy of ' || s.title, s.description
    from public.surveys s
    where s.id = p_survey_id
    returning id into v_new_survey_id;

    if v_new_survey_id is null then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    for v_question in
        select q.id, q.question_text, q.question_type, q.position
        from public.questions q
        where q.survey_id = p_survey_id
        order by q.position
    loop
        insert into public.questions (survey_id, question_text, question_type, position)
        values (v_new_survey_id, v_question.question_text, v_question.question_type, v_question.position)
        returning id into v_new_question_id;

        insert into public.choices (question_id, choice_text, position)
        select v_new_question_id, c.choice_text, c.position
        from public.choices c
        where c.question_id = v_question.id;
    end loop;

    return v_new_survey_id;
end;
$$;

-- ---------------------------------------------------------------
-- Permissions (D7): instructor only
-- ---------------------------------------------------------------
revoke execute on function public.save_survey(text, text, jsonb, uuid) from public, anon;
grant execute on function public.save_survey(text, text, jsonb, uuid) to authenticated;

revoke execute on function public.duplicate_survey(uuid) from public, anon;
grant execute on function public.duplicate_survey(uuid) to authenticated;
