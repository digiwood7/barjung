alter table public.runner_commands drop constraint if exists runner_commands_command_check;
alter table public.runner_commands
  add constraint runner_commands_command_check check (command in ('naver_login', 'instagram_login'));
