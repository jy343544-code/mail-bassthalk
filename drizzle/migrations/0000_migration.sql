create type public.app_role as enum ('supervisor','manager','employee');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  subject text not null,
  body text not null default '',
  file_path text,
  file_name text,
  sheet_url text,
  created_at timestamptz not null default now()
);
create table public.message_recipients (
  message_id uuid not null references public.messages(id) on delete cascade,
  recipient_id uuid not null,
  read_at timestamptz,
  primary key (message_id, recipient_id)
);
create table public.screenshot_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  message_id uuid,
  kind text not null,
  created_at timestamptz not null default now()
);

grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select on public.messages to authenticated;
grant all on public.messages to service_role;
grant select, update on public.message_recipients to authenticated;
grant all on public.message_recipients to service_role;
grant select, insert on public.screenshot_events to authenticated;
grant all on public.screenshot_events to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
alter table public.screenshot_events enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role in ('supervisor','manager')) $$;

create or replace function public.is_recipient(_message_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.message_recipients where message_id = _message_id and recipient_id = _user_id) $$;

create policy "profiles readable by signed in" on public.profiles for select to authenticated using (true);

create policy "own roles or staff" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "messages visible" on public.messages for select to authenticated
  using (sender_id = auth.uid() or public.is_staff(auth.uid()) or public.is_recipient(id, auth.uid()));

create policy "recipients visible" on public.message_recipients for select to authenticated
  using (recipient_id = auth.uid() or public.is_staff(auth.uid()));
create policy "mark own read" on public.message_recipients for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "log own screenshot" on public.screenshot_events for insert to authenticated
  with check (user_id = auth.uid());
create policy "supervisor sees screenshots" on public.screenshot_events for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor'));

alter publication supabase_realtime add table public.message_recipients;