-- Call follow-up schema for employee call outcomes and manager-managed statuses.
create table public.call_followup_statuses (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
--> statement-breakpoint

create table public.call_followup_contacts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  source_row integer not null,
  full_name text not null default '',
  phone text not null,
  created_at timestamptz not null default now(),
  unique (message_id, source_row)
);
--> statement-breakpoint

create table public.call_followup_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.call_followup_contacts(id) on delete cascade,
  status_id uuid not null references public.call_followup_statuses(id),
  employee_id uuid not null references auth.users(id),
  note text not null default '',
  created_at timestamptz not null default now()
);
--> statement-breakpoint

create index call_followup_contacts_message_idx on public.call_followup_contacts(message_id, source_row);
--> statement-breakpoint
create index call_followup_logs_employee_idx on public.call_followup_logs(employee_id, created_at desc);
--> statement-breakpoint
create index call_followup_logs_contact_idx on public.call_followup_logs(contact_id, created_at desc);
--> statement-breakpoint

grant select on public.call_followup_statuses to authenticated;
--> statement-breakpoint
grant insert, update, delete on public.call_followup_statuses to authenticated;
--> statement-breakpoint
grant select, insert on public.call_followup_contacts to authenticated;
--> statement-breakpoint
grant select, insert on public.call_followup_logs to authenticated;
--> statement-breakpoint

alter table public.call_followup_statuses enable row level security;
--> statement-breakpoint
alter table public.call_followup_contacts enable row level security;
--> statement-breakpoint
alter table public.call_followup_logs enable row level security;
--> statement-breakpoint

create policy "authenticated read call statuses"
on public.call_followup_statuses for select to authenticated using (true);
--> statement-breakpoint

create policy "staff manage call statuses"
on public.call_followup_statuses for all to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));
--> statement-breakpoint

create policy "read contacts from visible sheets"
on public.call_followup_contacts for select to authenticated
using (public.is_sender(message_id, auth.uid()) or public.is_recipient(message_id, auth.uid()));
--> statement-breakpoint

create policy "add contacts to visible sheets"
on public.call_followup_contacts for insert to authenticated
with check (public.is_sender(message_id, auth.uid()) or public.is_recipient(message_id, auth.uid()));
--> statement-breakpoint

create policy "read own call logs or staff"
on public.call_followup_logs for select to authenticated
using (employee_id = auth.uid() or public.is_staff(auth.uid()));
--> statement-breakpoint

create policy "employees create own call logs"
on public.call_followup_logs for insert to authenticated
with check (
  employee_id = auth.uid()
  and exists (
    select 1 from public.call_followup_contacts c
    where c.id = contact_id
      and (public.is_sender(c.message_id, auth.uid()) or public.is_recipient(c.message_id, auth.uid()))
  )
);
--> statement-breakpoint

insert into public.call_followup_statuses (label, sort_order)
values ('تم الرد', 1), ('لم يرد', 2), ('الرقم مغلق', 3), ('رقم غير صحيح', 4), ('إعادة الاتصال', 5);
--> statement-breakpoint
