create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  kind text not null check (kind in ('couple', 'group', 'team')),
  theme_key text check (theme_key is null or theme_key in ('rose', 'lavender', 'peach', 'mint', 'sky')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 50),
  memory_date date not null,
  caption text check (caption is null or char_length(caption) <= 250),
  milestone_tag text check (milestone_tag is null or char_length(milestone_tag) <= 40),
  image_path text not null unique,
  image_mime_type text not null check (image_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index memories_space_date_idx on public.memories (space_id, memory_date, created_at)
  where deleted_at is null;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_memory_created_idx on public.comments (memory_id, created_at);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('💛', '❤️', '🥹', '😂', '✨', '🙌')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (memory_id, user_id)
);

create index reactions_memory_idx on public.reactions (memory_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger spaces_touch_updated_at before update on public.spaces
for each row execute function public.touch_updated_at();
create trigger memories_touch_updated_at before update on public.memories
for each row execute function public.touch_updated_at();
create trigger comments_touch_updated_at before update on public.comments
for each row execute function public.touch_updated_at();
create trigger reactions_touch_updated_at before update on public.reactions
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  candidate := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if candidate is null then
    candidate := split_part(coalesce(new.email, 'friend'), '@', 1);
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(candidate, 60))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members sm
    where sm.space_id = target_space_id
      and sm.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id = auth.uid() or exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

create or replace function public.can_access_memory(target_memory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memories m
    where m.id = target_memory_id
      and m.deleted_at is null
      and public.is_space_member(m.space_id)
  );
$$;

revoke all on function public.is_space_member(uuid) from public;
revoke all on function public.can_view_profile(uuid) from public;
revoke all on function public.can_access_memory(uuid) from public;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_access_memory(uuid) to authenticated;

create or replace function public.create_space(p_name text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 50 then
    raise exception 'Space name must be between 1 and 50 characters.' using errcode = '22023';
  end if;
  if p_kind not in ('couple', 'group', 'team') then
    raise exception 'Choose a valid space type.' using errcode = '22023';
  end if;

  insert into public.spaces (name, kind, created_by)
  values (trim(p_name), p_kind, auth.uid())
  returning id into created_space_id;

  insert into public.space_members (space_id, user_id)
  values (created_space_id, auth.uid());

  return created_space_id;
end;
$$;

create or replace function public.create_space_invite(p_space_id uuid)
returns table (invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text;
  invite_expiry timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not public.is_space_member(p_space_id) then
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

create or replace function public.accept_space_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found_invite public.space_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a space.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_token, '')) <> 64 then
    raise exception 'This invitation is invalid or has expired.' using errcode = '22023';
  end if;

  select * into found_invite
  from public.space_invites si
  where si.token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
  for update;

  if not found or found_invite.redeemed_at is not null or found_invite.expires_at <= now() then
    raise exception 'This invitation is invalid, expired, or already used.' using errcode = '22023';
  end if;

  perform 1 from public.spaces s where s.id = found_invite.space_id for update;
  insert into public.space_members (space_id, user_id)
  values (found_invite.space_id, auth.uid())
  on conflict (space_id, user_id) do nothing;

  update public.space_invites
  set redeemed_at = now()
  where id = found_invite.id;

  return found_invite.space_id;
end;
$$;

create or replace function public.leave_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_total integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;

  perform 1 from public.spaces s where s.id = p_space_id for update;
  if not found or not public.is_space_member(p_space_id) then
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

create or replace function public.delete_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_total integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;

  perform 1 from public.spaces s where s.id = p_space_id for update;
  if not found or not public.is_space_member(p_space_id) then
    raise exception 'Space not found.' using errcode = '42501';
  end if;

  select count(*) into member_total from public.space_members sm where sm.space_id = p_space_id;
  if member_total <> 1 then
    raise exception 'Only the last remaining member can delete a space.' using errcode = '42501';
  end if;

  delete from public.spaces where id = p_space_id;
end;
$$;

revoke all on function public.create_space(text, text) from public;
revoke all on function public.create_space_invite(uuid) from public;
revoke all on function public.accept_space_invite(text) from public;
revoke all on function public.leave_space(uuid) from public;
revoke all on function public.delete_space(uuid) from public;
grant execute on function public.create_space(text, text) to authenticated;
grant execute on function public.create_space_invite(uuid) to authenticated;
grant execute on function public.accept_space_invite(text) to authenticated;
grant execute on function public.leave_space(uuid) to authenticated;
grant execute on function public.delete_space(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;
alter table public.memories enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;

revoke all on public.profiles, public.spaces, public.space_members,
  public.space_invites, public.memories, public.comments, public.reactions from anon;
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

create policy "profiles are visible to yourself and shared-space members"
on public.profiles for select to authenticated
using (public.can_view_profile(id));

create policy "users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can read their spaces"
on public.spaces for select to authenticated
using (public.is_space_member(id));

create policy "members can update space details and theme"
on public.spaces for update to authenticated
using (public.is_space_member(id))
with check (public.is_space_member(id));

create policy "members can see their membership list"
on public.space_members for select to authenticated
using (user_id = auth.uid() or public.is_space_member(space_id));

create policy "members can read active memories"
on public.memories for select to authenticated
using (deleted_at is null and public.is_space_member(space_id));

create policy "members can add memories"
on public.memories for insert to authenticated
with check (created_by = auth.uid() and public.is_space_member(space_id));

create policy "members can edit memories"
on public.memories for update to authenticated
using (public.is_space_member(space_id))
with check (public.is_space_member(space_id));

create policy "members can remove memories"
on public.memories for delete to authenticated
using (public.is_space_member(space_id));

create policy "members can read comments"
on public.comments for select to authenticated
using (public.can_access_memory(memory_id));

create policy "members can comment"
on public.comments for insert to authenticated
with check (user_id = auth.uid() and public.can_access_memory(memory_id));

create policy "comment authors can edit their comments"
on public.comments for update to authenticated
using (user_id = auth.uid() and public.can_access_memory(memory_id))
with check (user_id = auth.uid() and public.can_access_memory(memory_id));

create policy "comment authors can delete their comments"
on public.comments for delete to authenticated
using (user_id = auth.uid() and public.can_access_memory(memory_id));

create policy "members can read reactions"
on public.reactions for select to authenticated
using (public.can_access_memory(memory_id));

create policy "members can add their reaction"
on public.reactions for insert to authenticated
with check (user_id = auth.uid() and public.can_access_memory(memory_id));

create policy "members can update their reaction"
on public.reactions for update to authenticated
using (user_id = auth.uid() and public.can_access_memory(memory_id))
with check (user_id = auth.uid() and public.can_access_memory(memory_id));

create policy "members can remove their reaction"
on public.reactions for delete to authenticated
using (user_id = auth.uid() and public.can_access_memory(memory_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-images', 'memory-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "space members can view private memory images"
on storage.objects for select to authenticated
using (
  bucket_id = 'memory-images'
  and exists (
    select 1 from public.spaces s
    where s.id::text = split_part(name, '/', 1)
      and public.is_space_member(s.id)
  )
);

create policy "space members can upload private memory images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'memory-images'
  and exists (
    select 1 from public.spaces s
    where s.id::text = split_part(name, '/', 1)
      and public.is_space_member(s.id)
  )
);

create policy "space members can replace private memory images"
on storage.objects for update to authenticated
using (
  bucket_id = 'memory-images'
  and exists (
    select 1 from public.spaces s
    where s.id::text = split_part(name, '/', 1)
      and public.is_space_member(s.id)
  )
)
with check (
  bucket_id = 'memory-images'
  and exists (
    select 1 from public.spaces s
    where s.id::text = split_part(name, '/', 1)
      and public.is_space_member(s.id)
  )
);

create policy "space members can delete private memory images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'memory-images'
  and exists (
    select 1 from public.spaces s
    where s.id::text = split_part(name, '/', 1)
      and public.is_space_member(s.id)
  )
);

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['memories', 'comments', 'reactions'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
