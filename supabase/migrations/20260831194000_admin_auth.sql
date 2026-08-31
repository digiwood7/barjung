create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  username text not null,
  password_hash text not null,
  is_active boolean not null default true,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index admin_users_username_idx on public.admin_users (lower(username));
create trigger admin_users_updated_at before update on public.admin_users
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select, insert, update, delete on public.admin_users to service_role;

create function public.verify_admin_credentials(p_username text, p_password text)
returns table (admin_user_id uuid, office_id uuid, username text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.admin_users%rowtype;
  next_failures integer;
begin
  select * into account
  from public.admin_users
  where lower(admin_users.username) = lower(trim(p_username))
  for update;

  if account.id is null or not account.is_active then return; end if;
  if account.locked_until is not null and account.locked_until > now() then return; end if;

  if account.password_hash = extensions.crypt(p_password, account.password_hash) then
    update public.admin_users
    set failed_attempts = 0, locked_until = null, last_login_at = now()
    where id = account.id;
    return query select account.id, account.office_id, account.username;
    return;
  end if;

  next_failures := account.failed_attempts + 1;
  update public.admin_users
  set failed_attempts = next_failures,
      locked_until = case when next_failures >= 5 then now() + interval '15 minutes' else null end
  where id = account.id;
end;
$$;

revoke all on function public.verify_admin_credentials(text, text) from public, anon, authenticated;
grant execute on function public.verify_admin_credentials(text, text) to service_role;

insert into public.admin_users (id, office_id, username, password_hash)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  'barjeong',
  '$2a$12$m3OU9CqYgdjDeFclBTHeaO5Vu2YrityAA8Idjpl.NOqjuRQJa7Uwa'
)
on conflict (lower(username)) do update
set office_id = excluded.office_id,
    password_hash = excluded.password_hash,
    is_active = true,
    failed_attempts = 0,
    locked_until = null;
