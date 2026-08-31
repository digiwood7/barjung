create table public.media_optimization_jobs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'uploading' check (status in ('uploading', 'queued', 'running', 'succeeded', 'failed')),
  source_files jsonb not null default '[]'::jsonb check (jsonb_typeof(source_files) = 'array'),
  error_summary text,
  lease_agent_id uuid references public.local_agents(id) on delete set null,
  lease_expires_at timestamptz,
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_optimization_jobs_queue_idx on public.media_optimization_jobs (status, queued_at) where status = 'queued';
create trigger media_optimization_jobs_updated_at before update on public.media_optimization_jobs for each row execute function public.set_updated_at();
alter table public.media_optimization_jobs enable row level security;
revoke all on table public.media_optimization_jobs from anon, authenticated;
grant all on table public.media_optimization_jobs to service_role;

create function public.claim_media_optimization_job(p_agent_id uuid, p_lease_seconds integer default 300)
returns setof public.media_optimization_jobs
language plpgsql security invoker set search_path = ''
as $$
declare claimed_id uuid; agent_office uuid;
begin
  if p_lease_seconds < 60 or p_lease_seconds > 1800 then raise exception 'lease seconds must be between 60 and 1800'; end if;
  select office_id into agent_office from public.local_agents where id = p_agent_id;
  if agent_office is null then raise exception 'unknown local agent'; end if;
  update public.media_optimization_jobs set status = 'queued', lease_agent_id = null, lease_expires_at = null, updated_at = now()
  where office_id = agent_office and status = 'running' and lease_expires_at < now();
  select id into claimed_id from public.media_optimization_jobs
  where office_id = agent_office and status = 'queued' order by queued_at, created_at for update skip locked limit 1;
  if claimed_id is null then return; end if;
  return query update public.media_optimization_jobs
  set status = 'running', lease_agent_id = p_agent_id, lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(started_at, now()), updated_at = now()
  where id = claimed_id returning *;
end;
$$;

revoke all on function public.claim_media_optimization_job(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_media_optimization_job(uuid, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-media-staging', 'property-media-staging', false, 26214400, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
