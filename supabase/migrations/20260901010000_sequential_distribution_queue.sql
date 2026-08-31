-- 한 배포 작업 안에서는 네이버 → 인스타그램 → 당근 → 직방 순서로 하나씩만 lease 한다.
create or replace function public.claim_distribution_target(p_agent_id uuid, p_lease_seconds integer default 120)
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

  select target.id into claimed_id
  from public.distribution_targets as target
  join public.distribution_jobs as job on job.id = target.distribution_job_id
  where target.office_id = agent_office
    and target.status = 'queued'
    and not exists (
      select 1
      from public.distribution_targets as active
      where active.distribution_job_id = target.distribution_job_id
        and active.status = 'running'
    )
    and not exists (
      select 1
      from public.distribution_targets as predecessor
      where predecessor.distribution_job_id = target.distribution_job_id
        and (case predecessor.platform
          when 'naver' then 1 when 'instagram' then 2 when 'daangn' then 3 when 'zigbang' then 4 end)
          < (case target.platform
          when 'naver' then 1 when 'instagram' then 2 when 'daangn' then 3 when 'zigbang' then 4 end)
        and predecessor.status not in ('succeeded', 'failed', 'cancelled', 'not_configured')
    )
  order by job.requested_at,
    case target.platform when 'naver' then 1 when 'instagram' then 2 when 'daangn' then 3 when 'zigbang' then 4 end,
    target.created_at
  for update of target skip locked
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
