alter type public.platform_name add value if not exists 'tiktok';
alter type public.platform_name add value if not exists 'youtube';

create table public.property_videos (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null unique references public.properties(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 524288000),
  mime_type text not null check (mime_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  width integer not null check (width > 0),
  height integer not null check (height > width),
  duration_seconds numeric(10,3) not null check (duration_seconds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger property_videos_updated_at before update on public.property_videos
for each row execute function public.set_updated_at();

alter table public.property_videos enable row level security;
create policy office_member_access on public.property_videos for all to authenticated
using (office_id::text = (select auth.jwt() -> 'app_metadata' ->> 'office_id'))
with check (office_id::text = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
revoke all on table public.property_videos from anon;
grant select, insert, update, delete on table public.property_videos to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-videos', 'property-videos', false, 524288000, array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy property_videos_select on storage.objects for select to authenticated
using (bucket_id = 'property-videos' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
create policy property_videos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'property-videos' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
create policy property_videos_update on storage.objects for update to authenticated
using (bucket_id = 'property-videos' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'))
with check (bucket_id = 'property-videos' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
create policy property_videos_delete on storage.objects for delete to authenticated
using (bucket_id = 'property-videos' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
