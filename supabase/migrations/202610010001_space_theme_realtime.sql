-- Share palette changes with connected members without recreating any data.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spaces'
    ) then
    alter publication supabase_realtime add table public.spaces;
  end if;
end;
$$;
