-- Run ONCE in a fresh Supabase project, using SQL Editor.
begin;
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.departments (
  id integer generated always as identity primary key,
  code varchar(10) not null unique check (code ~ '^[A-Z0-9-]{2,10}$'),
  name varchar(100) not null unique check (char_length(btrim(name)) between 2 and 100)
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  roll_no varchar(20) not null unique check (roll_no ~ '^[A-Z0-9-]{3,20}$'),
  full_name varchar(100) not null check (char_length(btrim(full_name)) between 2 and 100),
  email varchar(254) not null check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone varchar(16) check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  department_id integer not null references public.departments(id) on delete restrict,
  year smallint not null check (year between 1 and 4),
  status varchar(12) not null default 'active' check (status in ('active', 'inactive', 'graduated')),
  admission_date date not null check (admission_date >= date '2000-01-01' and admission_date <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index students_email_unique on public.students (lower(email));
create index students_department_index on public.students (department_id);
create index students_status_index on public.students (status);
create index students_created_index on public.students (created_at desc, id desc);
create function public.set_student_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_student_updated_at() from public, anon, authenticated;
create trigger students_updated_at before update on public.students
for each row execute function public.set_student_updated_at();
alter table public.admins enable row level security;
alter table public.departments enable row level security;
alter table public.students enable row level security;
revoke all on table public.admins, public.departments, public.students from public, anon, authenticated;
revoke all on sequence public.departments_id_seq from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.admins to authenticated;
create policy admins_read_own_membership on public.admins for select to authenticated
using (user_id = (select auth.uid()));
grant select on public.departments to authenticated;
create policy departments_admin_read on public.departments for select to authenticated
using (exists (select 1 from public.admins where user_id = (select auth.uid())));
grant select, insert, update, delete on public.students to authenticated;
create policy students_admin_select on public.students for select to authenticated
using (exists (select 1 from public.admins where user_id = (select auth.uid())));
create policy students_admin_insert on public.students for insert to authenticated
with check (exists (select 1 from public.admins where user_id = (select auth.uid())));
create policy students_admin_update on public.students for update to authenticated
using (exists (select 1 from public.admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.admins where user_id = (select auth.uid())));
create policy students_admin_delete on public.students for delete to authenticated
using (exists (select 1 from public.admins where user_id = (select auth.uid())));
-- Demo lookup data only. No student personal data is seeded.
insert into public.departments (code, name) values
('CSE', 'Computer Science and Engineering'),
('ECE', 'Electronics and Communication Engineering'),
('EEE', 'Electrical and Electronics Engineering'),
('MECH', 'Mechanical Engineering'),
('CIVIL', 'Civil Engineering');
commit;
