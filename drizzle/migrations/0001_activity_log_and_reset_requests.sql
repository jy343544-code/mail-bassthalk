create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_user_id uuid,
  message_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
grant select, insert on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "supervisor reads activity" on public.activity_log for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor'));
create policy "log own client activity" on public.activity_log for insert to authenticated
  with check (actor_id = auth.uid() and action in ('login','logout','view_message','screenshot_attempt','devtools_attempt','print_attempt','save_attempt','copy_attempt'));

create table public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select on public.password_reset_requests to authenticated;
grant all on public.password_reset_requests to service_role;
alter table public.password_reset_requests enable row level security;
create policy "supervisor reads reset requests" on public.password_reset_requests for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor'));

comment on table public.screenshot_events is 'DEPRECATED: replaced by activity_log';