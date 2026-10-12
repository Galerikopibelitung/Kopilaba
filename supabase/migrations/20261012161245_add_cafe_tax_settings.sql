alter table public.kafe
  add column if not exists pajak_enabled boolean not null default true,
  add column if not exists pajak_persen numeric(5,2) not null default 10;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kafe_pajak_persen_range'
      and conrelid = 'public.kafe'::regclass
  ) then
    alter table public.kafe
      add constraint kafe_pajak_persen_range
      check (pajak_persen >= 0 and pajak_persen <= 100);
  end if;
end $$;
