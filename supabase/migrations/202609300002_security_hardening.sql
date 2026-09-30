-- Keep privileged implementation functions outside PostgREST's exposed public schema.
-- Existing policies and triggers refer to function OIDs, so moving these functions
-- preserves their bindings while public RPC wrappers keep the client API stable.
create schema if not exists ustogether_private;
revoke all on schema ustogether_private from public, anon, authenticated;
grant usage on schema ustogether_private to authenticated;

alter function public.create_profile_for_new_user() set schema ustogether_private;
alter function public.is_space_member(uuid) set schema ustogether_private;
alter function public.can_view_profile(uuid) set schema ustogether_private;
alter function public.can_access_memory(uuid) set schema ustogether_private;
alter function public.create_space(text, text) set schema ustogether_private;
alter function public.create_space_invite(uuid) set schema ustogether_private;
alter function public.accept_space_invite(text) set schema ustogether_private;
alter function public.leave_space(uuid) set schema ustogether_private;
alter function public.delete_space(uuid) set schema ustogether_private;

alter function ustogether_private.create_profile_for_new_user() set search_path = '';
alter function ustogether_private.is_space_member(uuid) set search_path = '';
alter function ustogether_private.can_view_profile(uuid) set search_path = '';
alter function ustogether_private.create_space(text, text) set search_path = '';
alter function ustogether_private.accept_space_invite(text) set search_path = '';

-- SQL function bodies are stored as text; update the helper's old schema reference.
create or replace function ustogether_private.can_access_memory(target_memory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memories m
    where m.id = target_memory_id
      and m.deleted_at is null
      and ustogether_private.is_space_member(m.space_id)
  );
$$;

create or replace function ustogether_private.create_space_invite(p_space_id uuid)
returns table (invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text;
  invite_expiry timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not ustogether_private.is_space_member(p_space_id) then
    raise exception 'Only members can invite people to this space.' using errcode = '42501';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.space_invites (space_id, created_by, token_hash, expires_at)
  values (
    p_space_id,
    auth.uid(),
    encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'), 'hex'),
    invite_expiry
  );

  return query select raw_token, invite_expiry;
end;
$$;

create or replace function ustogether_private.leave_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_total integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;

  perform 1 from public.spaces s where s.id = p_space_id for update;
  if not found or not ustogether_private.is_space_member(p_space_id) then
    raise exception 'Space not found.' using errcode = '42501';
  end if;

  select count(*) into member_total from public.space_members sm where sm.space_id = p_space_id;
  if member_total <= 1 then
    raise exception 'The last member must delete the space instead.' using errcode = '22023';
  end if;

  delete from public.space_members
  where space_id = p_space_id and user_id = auth.uid();
end;
$$;

create or replace function ustogether_private.delete_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_total integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;

  perform 1 from public.spaces s where s.id = p_space_id for update;
  if not found or not ustogether_private.is_space_member(p_space_id) then
    raise exception 'Space not found.' using errcode = '42501';
  end if;

  select count(*) into member_total from public.space_members sm where sm.space_id = p_space_id;
  if member_total <> 1 then
    raise exception 'Only the last remaining member can delete a space.' using errcode = '42501';
  end if;

  delete from public.spaces where id = p_space_id;
end;
$$;

-- Supabase may have explicit EXECUTE grants to API roles in addition to PUBLIC.
revoke all on all functions in schema ustogether_private from public, anon, authenticated;
grant execute on function ustogether_private.is_space_member(uuid) to authenticated;
grant execute on function ustogether_private.can_view_profile(uuid) to authenticated;
grant execute on function ustogether_private.can_access_memory(uuid) to authenticated;
grant execute on function ustogether_private.create_space(text, text) to authenticated;
grant execute on function ustogether_private.create_space_invite(uuid) to authenticated;
grant execute on function ustogether_private.accept_space_invite(text) to authenticated;
grant execute on function ustogether_private.leave_space(uuid) to authenticated;
grant execute on function ustogether_private.delete_space(uuid) to authenticated;

-- The public entry points execute with the caller's role. Their private
-- implementations still enforce sign-in and space membership before writing.
create function public.create_space(p_name text, p_kind text)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select ustogether_private.create_space($1, $2); $$;

create function public.create_space_invite(p_space_id uuid)
returns table (invite_token text, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $$ select * from ustogether_private.create_space_invite($1); $$;

create function public.accept_space_invite(p_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select ustogether_private.accept_space_invite($1); $$;

create function public.leave_space(p_space_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select ustogether_private.leave_space($1); $$;

create function public.delete_space(p_space_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select ustogether_private.delete_space($1); $$;

revoke all on function public.create_space(text, text) from public, anon, authenticated;
revoke all on function public.create_space_invite(uuid) from public, anon, authenticated;
revoke all on function public.accept_space_invite(text) from public, anon, authenticated;
revoke all on function public.leave_space(uuid) from public, anon, authenticated;
revoke all on function public.delete_space(uuid) from public, anon, authenticated;
grant execute on function public.create_space(text, text) to authenticated;
grant execute on function public.create_space_invite(uuid) to authenticated;
grant execute on function public.accept_space_invite(text) to authenticated;
grant execute on function public.leave_space(uuid) to authenticated;
grant execute on function public.delete_space(uuid) to authenticated;

-- The initial migration's column grants did not remove Supabase's existing
-- table-level UPDATE grants. Reset them before granting the intended columns.
revoke all on public.profiles, public.spaces, public.space_members,
  public.space_invites, public.memories, public.comments, public.reactions
  from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.spaces to authenticated;
grant update (name, theme_key) on public.spaces to authenticated;
grant select on public.space_members to authenticated;
grant select, insert, delete on public.memories to authenticated;
grant update (title, memory_date, caption, milestone_tag) on public.memories to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant update (emoji) on public.reactions to authenticated;

notify pgrst, 'reload schema';
