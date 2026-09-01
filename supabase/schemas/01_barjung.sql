create extension if not exists pgcrypto;

create type public.employment_status as enum ('active', 'leave', 'inactive');
create type public.property_kind as enum ('one_room', 'two_room', 'officetel');
create type public.property_status as enum ('draft', 'reviewed', 'advertising', 'contracting', 'completed', 'paused', 'closed');
create type public.platform_name as enum ('naver', 'instagram', 'daangn', 'zigbang');
create type public.publish_status as enum ('not_requested', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'not_configured');
create type public.publish_mode as enum ('review', 'automatic');
create type public.address_policy as enum ('lot', 'district', 'hidden');

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_label text not null default '경북대 캠퍼스 권역',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  position text not null,
  employment_status public.employment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  name text not null,
  phone text not null,
  inquiry_type text not null default '',
  desired_conditions text not null default '',
  memo text not null default '',
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, phone)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_number text not null,
  title text not null,
  property_kind public.property_kind not null,
  status public.property_status not null default 'draft',
  exact_address text not null,
  public_address text not null,
  default_address_policy public.address_policy not null default 'district',
  deposit_won bigint not null default 0 check (deposit_won >= 0),
  monthly_rent_won bigint not null default 0 check (monthly_rent_won >= 0),
  maintenance_fee_won bigint not null default 0 check (maintenance_fee_won >= 0),
  available_from text not null default '',
  room_count numeric(4,1) check (room_count >= 0),
  bathroom_count numeric(4,1) check (bathroom_count >= 0),
  direction text not null default '',
  direction_basis text not null default '',
  registered_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, property_number)
);

create table public.property_status_history (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  from_status public.property_status,
  to_status public.property_status not null,
  changed_by uuid references public.employees(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table public.building_register_snapshots (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  source text not null,
  source_identifier text,
  raw_response jsonb not null default '{}'::jsonb,
  normalized_fields jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.employees(id) on delete set null
);

create table public.legal_disclosures (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null unique references public.properties(id) on delete cascade,
  location text not null,
  contract_area text not null,
  property_category text not null,
  transaction_type text not null,
  floor_text text not null,
  available_from text not null,
  rooms_text text not null,
  approval_date text not null,
  parking_text text not null,
  maintenance_text text not null,
  direction_text text not null,
  lot_number_notice text not null,
  measurement_notice text not null,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'invalid')),
  confirmed_at timestamptz,
  confirmed_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0),
  original_size_bytes bigint not null check (original_size_bytes > 0),
  optimized_size_bytes bigint not null check (optimized_size_bytes > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  mime_type text not null,
  checksum_sha256 text not null check (length(checksum_sha256) = 64),
  created_at timestamptz not null default now(),
  unique (property_id, sort_order)
);

create table public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  platform public.platform_name,
  employee_copy text not null,
  legal_block text not null,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.local_agents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  device_name text not null,
  operating_system text not null default 'windows',
  version text not null,
  status text not null default 'offline' check (status in ('online', 'offline', 'degraded')),
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, device_name)
);

create table public.distribution_jobs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  mode public.publish_mode not null default 'review',
  overall_status public.publish_status not null default 'queued',
  idempotency_key text not null,
  requested_by uuid references public.employees(id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (office_id, idempotency_key)
);

create table public.distribution_targets (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  distribution_job_id uuid not null references public.distribution_jobs(id) on delete cascade,
  platform public.platform_name not null,
  status public.publish_status not null default 'queued',
  content_draft_id uuid references public.content_drafts(id) on delete set null,
  error_code text,
  error_summary text,
  retry_count integer not null default 0 check (retry_count >= 0),
  published_url text,
  lease_agent_id uuid references public.local_agents(id) on delete set null,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (distribution_job_id, platform)
);

create table public.distribution_events (
  id bigint generated always as identity primary key,
  office_id uuid not null references public.offices(id) on delete cascade,
  distribution_target_id uuid not null references public.distribution_targets(id) on delete cascade,
  from_status public.publish_status,
  to_status public.publish_status not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  platform public.platform_name not null,
  status text not null default 'not_configured' check (status in ('connected', 'expired', 'action_required', 'not_configured')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, platform)
);

create table public.app_settings (
  office_id uuid primary key references public.offices(id) on delete cascade,
  publish_mode public.publish_mode not null default 'review',
  image_max_edge integer not null default 1920 check (image_max_edge between 800 and 4096),
  image_quality integer not null default 82 check (image_quality between 40 and 95),
  image_target_kb integer not null default 800 check (image_target_kb between 200 and 3000),
  platform_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_office_status_idx on public.properties (office_id, status, created_at desc);
create index customers_office_follow_up_idx on public.customers (office_id, follow_up_at);
create index distribution_targets_queue_idx on public.distribution_targets (status, created_at) where status = 'queued';
create index distribution_targets_lease_idx on public.distribution_targets (lease_expires_at) where status = 'running';
create index local_agents_heartbeat_idx on public.local_agents (office_id, last_heartbeat_at desc);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.log_property_status_change() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    insert into public.property_status_history (office_id, property_id, from_status, to_status)
    values (new.office_id, new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger offices_updated_at before update on public.offices for each row execute function public.set_updated_at();
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger legal_disclosures_updated_at before update on public.legal_disclosures for each row execute function public.set_updated_at();
create trigger local_agents_updated_at before update on public.local_agents for each row execute function public.set_updated_at();
create trigger distribution_targets_updated_at before update on public.distribution_targets for each row execute function public.set_updated_at();
create trigger platform_connections_updated_at before update on public.platform_connections for each row execute function public.set_updated_at();
create trigger app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
create trigger properties_status_history after update of status on public.properties for each row execute function public.log_property_status_change();

create function public.claim_distribution_target(p_agent_id uuid, p_lease_seconds integer default 120)
returns setof public.distribution_targets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_id uuid;
  agent_office uuid;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'lease seconds must be between 30 and 900';
  end if;

  select office_id into agent_office from public.local_agents where id = p_agent_id;
  if agent_office is null then raise exception 'unknown local agent'; end if;

  update public.distribution_targets
  set status = 'queued', lease_agent_id = null, lease_expires_at = null, updated_at = now()
  where office_id = agent_office and status = 'running' and lease_expires_at < now();

  select id into claimed_id
  from public.distribution_targets
  where office_id = agent_office and status = 'queued'
  order by created_at
  for update skip locked
  limit 1;

  if claimed_id is null then return; end if;

  return query
  update public.distribution_targets
  set status = 'running', lease_agent_id = p_agent_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(started_at, now()), updated_at = now()
  where id = claimed_id
  returning *;
end;
$$;

revoke all on function public.claim_distribution_target(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_distribution_target(uuid, integer) to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'offices','employees','customers','properties','property_status_history','building_register_snapshots',
    'legal_disclosures','property_media','content_drafts','local_agents','distribution_jobs',
    'distribution_targets','distribution_events','platform_connections','app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy office_member_access on public.offices for all to authenticated
using (id::text = (select auth.jwt() -> 'app_metadata' ->> 'office_id'))
with check (id::text = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'employees','customers','properties','property_status_history','building_register_snapshots','legal_disclosures',
    'property_media','content_drafts','local_agents','distribution_jobs','distribution_targets','distribution_events',
    'platform_connections','app_settings'
  ] loop
    execute format(
      'create policy office_member_access on public.%I for all to authenticated using (office_id::text = (select auth.jwt() -> ''app_metadata'' ->> ''office_id'')) with check (office_id::text = (select auth.jwt() -> ''app_metadata'' ->> ''office_id''))',
      table_name
    );
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-media', 'property-media', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy property_media_select on storage.objects for select to authenticated
using (bucket_id = 'property-media' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
create policy property_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
create policy property_media_update on storage.objects for update to authenticated
using (bucket_id = 'property-media' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'))
with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));
create policy property_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'property-media' and (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'office_id'));

create table public.runner_commands (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  command text not null check (command in ('naver_login')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  result_message text,
  lease_agent_id uuid references public.local_agents(id) on delete set null,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index runner_commands_one_active_idx on public.runner_commands (office_id, command) where status in ('queued', 'running');
create index runner_commands_queue_idx on public.runner_commands (status, created_at) where status = 'queued';
create trigger runner_commands_updated_at before update on public.runner_commands for each row execute function public.set_updated_at();
alter table public.runner_commands enable row level security;
revoke all on table public.runner_commands from anon, authenticated;
grant all on table public.runner_commands to service_role;

create function public.claim_runner_command(p_agent_id uuid, p_lease_seconds integer default 600)
returns setof public.runner_commands
language plpgsql security invoker set search_path = ''
as $$
declare claimed_id uuid; agent_office uuid;
begin
  if p_lease_seconds < 60 or p_lease_seconds > 900 then raise exception 'lease seconds must be between 60 and 900'; end if;
  select office_id into agent_office from public.local_agents where id = p_agent_id;
  if agent_office is null then raise exception 'unknown local agent'; end if;
  update public.runner_commands set status = 'queued', lease_agent_id = null, lease_expires_at = null, updated_at = now()
  where office_id = agent_office and status = 'running' and lease_expires_at < now();
  select id into claimed_id from public.runner_commands where office_id = agent_office and status = 'queued'
  order by created_at for update skip locked limit 1;
  if claimed_id is null then return; end if;
  return query update public.runner_commands
  set status = 'running', lease_agent_id = p_agent_id, lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(started_at, now()), updated_at = now()
  where id = claimed_id returning *;
end;
$$;

revoke all on function public.claim_runner_command(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_runner_command(uuid, integer) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.distribution_targets;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.local_agents;
exception when duplicate_object then null;
end $$;
