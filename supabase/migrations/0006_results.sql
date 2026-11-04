-- 0006_results.sql — Phase 6
-- get_survey_results: response totals, per-choice counts, and percentages.
-- See DATABASE.md §10 and API.md §12. Decisions D7, D10.

create or replace function public.get_survey_results(p_survey_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
    v_title text;
    v_status text;
    v_total integer;
    v_result jsonb;
begin
    select title, status into v_title, v_status
    from public.surveys
    where id = p_survey_id;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    select count(*) into v_total
    from public.responses
    where survey_id = p_survey_id;

    select jsonb_build_object(
        'survey_id', p_survey_id,
        'title', v_title,
        'status', v_status,
        'response_count', v_total,
        'questions', coalesce(jsonb_agg(per_question.question_json order by per_question.position), '[]'::jsonb)
    )
    into v_result
    from (
        select
            q.position,
            jsonb_build_object(
                'question_id', q.id,
                'question_text', q.question_text,
                'question_type', q.question_type,
                -- D10: denominator is the number of responses that answered this question
                'response_count', answered.n,
                'choices', (
                    select coalesce(
                        jsonb_agg(
                            jsonb_build_object(
                                'choice_id', c.id,
                                'choice_text', c.choice_text,
                                'count', picked.n,
                                'percentage', case
                                    when answered.n = 0 then 0
                                    else round(picked.n * 100.0 / answered.n, 1)
                                end
                            )
                            order by c.position
                        ),
                        '[]'::jsonb
                    )
                    from public.choices c
                    cross join lateral (
                        select count(*) as n
                        from public.answers a
                        where a.choice_id = c.id
                    ) as picked
                    where c.question_id = q.id
                )
            ) as question_json
        from public.questions q
        cross join lateral (
            select count(*) as n
            from public.answers a
            where a.question_id = q.id and a.choice_id is not null
        ) as answered
        where q.survey_id = p_survey_id
    ) as per_question;

    return v_result;
end;
$$;

-- Permissions (D7): instructor only
revoke execute on function public.get_survey_results(uuid) from public, anon;
grant execute on function public.get_survey_results(uuid) to authenticated;
