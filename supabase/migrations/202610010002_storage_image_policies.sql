-- An unqualified name inside the spaces subquery resolves to spaces.name.
-- Use the object path explicitly while retaining member-only private storage.
alter policy "space members can view private memory images" on storage.objects
using (bucket_id = 'memory-images' and exists (
  select 1 from public.spaces s
  where s.id::text = split_part(storage.objects.name, '/', 1)
    and ustogether_private.is_space_member(s.id)
));

alter policy "space members can upload private memory images" on storage.objects
with check (bucket_id = 'memory-images' and exists (
  select 1 from public.spaces s
  where s.id::text = split_part(storage.objects.name, '/', 1)
    and ustogether_private.is_space_member(s.id)
));

alter policy "space members can replace private memory images" on storage.objects
using (bucket_id = 'memory-images' and exists (
  select 1 from public.spaces s
  where s.id::text = split_part(storage.objects.name, '/', 1)
    and ustogether_private.is_space_member(s.id)
))
with check (bucket_id = 'memory-images' and exists (
  select 1 from public.spaces s
  where s.id::text = split_part(storage.objects.name, '/', 1)
    and ustogether_private.is_space_member(s.id)
));

alter policy "space members can delete private memory images" on storage.objects
using (bucket_id = 'memory-images' and exists (
  select 1 from public.spaces s
  where s.id::text = split_part(storage.objects.name, '/', 1)
    and ustogether_private.is_space_member(s.id)
));
