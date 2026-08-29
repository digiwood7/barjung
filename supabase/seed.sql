insert into public.offices (id, name, region_label)
values ('00000000-0000-4000-8000-000000000001', '바를정공인중개사사무소', '경북대 캠퍼스 권역')
on conflict (id) do nothing;

insert into public.employees (id, office_id, name, phone, position, employment_status)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', '정다혜', '010-0000-0000', '대표 공인중개사', 'active'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', '김민지', '010-0000-0001', '중개보조원', 'active')
on conflict (id) do nothing;

insert into public.app_settings (office_id) values ('00000000-0000-4000-8000-000000000001') on conflict (office_id) do nothing;

insert into public.local_agents (id, office_id, device_name, operating_system, version)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'BARJUNG-OFFICE-01', 'windows', '0.1.0')
on conflict (id) do nothing;

insert into public.platform_connections (office_id, platform)
select '00000000-0000-4000-8000-000000000001', platform
from unnest(enum_range(null::public.platform_name)) platform
on conflict (office_id, platform) do nothing;
