-- 0014_employees.sql — employees: extra logins that belong to a merchant (owner) login. An
-- employee's profile points at its employer; access comes from memberships to a subset of the
-- employer's locations (role 'admin' = Manager, 'member' = TV only). Deleting the owner's
-- profile cascades the employees' profiles (their auth users are removed by lib/merchants).
alter table public.profiles
  add column if not exists employer_id uuid references public.profiles(id) on delete cascade;
create index if not exists profiles_employer_id_idx on public.profiles(employer_id)
  where employer_id is not null;
