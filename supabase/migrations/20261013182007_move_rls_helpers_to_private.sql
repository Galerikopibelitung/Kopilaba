-- Keep SECURITY DEFINER helper functions out of the exposed public API schema.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.kopilaba_is_super_admin() set schema private;
alter function public.kopilaba_current_role() set schema private;
alter function public.kopilaba_current_kafe_id() set schema private;

create or replace function private.kopilaba_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'kopigaleri77@gmail.com'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    );
$$;

create or replace function private.kopilaba_current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when private.kopilaba_is_super_admin() then 'super_admin'
    else (select p.role from public.profiles p where p.id = auth.uid() limit 1)
  end;
$$;

create or replace function private.kopilaba_current_kafe_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.kafe_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function private.kopilaba_is_super_admin() from public, anon;
revoke all on function private.kopilaba_current_role() from public, anon;
revoke all on function private.kopilaba_current_kafe_id() from public, anon;
grant execute on function private.kopilaba_is_super_admin() to authenticated;
grant execute on function private.kopilaba_current_role() to authenticated;
grant execute on function private.kopilaba_current_kafe_id() to authenticated;
commit;