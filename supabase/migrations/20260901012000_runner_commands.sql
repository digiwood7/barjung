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

create unique index runner_commands_one_active_idx on public.runner_commands (office_id, command)
where status in ('queued', 'running');
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

  update public.runner_commands
  set status = 'queued', lease_agent_id = null, lease_expires_at = null, updated_at = now()
  where office_id = agent_office and status = 'running' and lease_expires_at < now();

  select id into claimed_id from public.runner_commands
  where office_id = agent_office and status = 'queued'
  order by created_at for update skip locked limit 1;
  if claimed_id is null then return; end if;

  return query update public.runner_commands
  set status = 'running', lease_agent_id = p_agent_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(started_at, now()), updated_at = now()
  where id = claimed_id returning *;
end;
$$;

revoke all on function public.claim_runner_command(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_runner_command(uuid, integer) to service_role;
