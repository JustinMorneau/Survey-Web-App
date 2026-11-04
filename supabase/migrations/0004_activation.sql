-- 0004_activation.sql — Phase 4
-- activate_survey and close_survey. See DATABASE.md §10. Decisions D2, D3, D5, D7, D9.

-- ---------------------------------------------------------------
-- activate_survey: close the current Active survey (if any), give
-- this survey a public slug on first activation (D2), and make it
-- Active. Returns the updated survey row.
-- ---------------------------------------------------------------
create or replace function public.activate_survey(p_survey_id uuid)
returns public.surveys
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_survey public.surveys;
    v_slug text;
    v_bytes bytea;
    v_index integer;
    -- 32 characters: no 0, o, 1, or l (D2)
    c_alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
begin
    select * into v_survey
    from public.surveys
    where id = p_survey_id
    for update;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    if v_survey.status = 'active' then
        return v_survey;
    end if;

    if v_survey.status not in ('draft', 'closed') then
        raise exception 'INVALID_STATUS_TRANSITION';
    end if;

    if not exists (select 1 from public.questions where survey_id = p_survey_id) then
        raise exception 'SURVEY_HAS_NO_QUESTIONS';
    end if;

    -- Keep an existing slug so printed QR codes keep working (D2).
    v_slug := v_survey.public_slug;

    while v_slug is null loop
        -- gen_random_uuid() is cryptographically random. Bytes 0-5 and
        -- 10-11 carry no version/variant bits, and 256 is a multiple of 32,
        -- so every character is equally likely.
        v_bytes := uuid_send(gen_random_uuid());
        v_slug := '';
        foreach v_index in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
            v_slug := v_slug || substr(c_alphabet, (get_byte(v_bytes, v_index) % 32) + 1, 1);
        end loop;

        if exists (select 1 from public.surveys where public_slug = v_slug) then
            v_slug := null;  -- collision: try again
        end if;
    end loop;

    -- Only one survey may be Active (only_one_active_survey index).
    update public.surveys
    set status = 'closed'
    where status = 'active' and id <> p_survey_id;

    update public.surveys
    set status = 'active', public_slug = v_slug
    where id = p_survey_id
    returning * into v_survey;

    return v_survey;
end;
$$;

-- ---------------------------------------------------------------
-- close_survey: Active → Closed. Submissions fail immediately after.
-- ---------------------------------------------------------------
create or replace function public.close_survey(p_survey_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_status text;
begin
    select status into v_status
    from public.surveys
    where id = p_survey_id
    for update;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    if v_status <> 'active' then
        raise exception 'INVALID_STATUS_TRANSITION';
    end if;

    update public.surveys set status = 'closed' where id = p_survey_id;
end;
$$;

-- ---------------------------------------------------------------
-- Permissions (D7): instructor only
-- ---------------------------------------------------------------
revoke execute on function public.activate_survey(uuid) from public, anon;
grant execute on function public.activate_survey(uuid) to authenticated;

revoke execute on function public.close_survey(uuid) from public, anon;
grant execute on function public.close_survey(uuid) to authenticated;
