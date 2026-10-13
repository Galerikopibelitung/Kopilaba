-- Isolate every cafe's business data at the database boundary.
-- Existing transaction/menu/attendance rows are preserved. Legacy shared categories are
-- copied per cafe and menu references are reassigned before the new policies are enabled.

begin;

alter table public.kategori
  add column if not exists kafe_id uuid references public.kafe(id) on delete cascade;

-- Category names were previously globally unique. Make uniqueness per cafe so cafes
-- can maintain independent category lists with the same names.
alter table public.kategori drop constraint if exists kategori_nama_key;
create unique index if not exists kategori_kafe_nama_key
  on public.kategori (kafe_id, nama) where kafe_id is not null;

-- Give each existing cafe its own category records, preserving category names and
-- updating each menu to reference the corresponding cafe-scoped category.
insert into public.kategori (nama, created_at, kafe_id)
select old.nama, old.created_at, k.id
from public.kategori old
cross join public.kafe k
where old.kafe_id is null
  and not exists (
    select 1 from public.kategori existing
    where existing.kafe_id = k.id and existing.nama = old.nama
  );

update public.menu m
set kategori_id = scoped.id
from public.kategori old
join public.kategori scoped on scoped.nama = old.nama
where m.kategori_id = old.id
  and old.kafe_id is null
  and scoped.kafe_id = m.kafe_id;

create or replace function public.kopilaba_is_super_admin()
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

create or replace function public.kopilaba_current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.kopilaba_is_super_admin() then 'super_admin'
    else (select p.role from public.profiles p where p.id = auth.uid() limit 1)
  end;
$$;

create or replace function public.kopilaba_current_kafe_id()
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

revoke all on function public.kopilaba_is_super_admin() from public, anon;
revoke all on function public.kopilaba_current_role() from public, anon;
revoke all on function public.kopilaba_current_kafe_id() from public, anon;
grant execute on function public.kopilaba_is_super_admin() to authenticated;
grant execute on function public.kopilaba_current_role() to authenticated;
grant execute on function public.kopilaba_current_kafe_id() to authenticated;

-- Remove the broad policies that allowed any signed-in user to access every cafe.
drop policy if exists "Allow all for authenticated" on public.kafe;
drop policy if exists "Allow all for authenticated" on public.profiles;
drop policy if exists "Allow all for authenticated" on public.transaksi;
drop policy if exists "Allow all for authenticated" on public.menu;
drop policy if exists "Allow all for authenticated" on public.kategori;
drop policy if exists "Allow all for authenticated" on public.absensi;

drop policy if exists "KopiLaba cafe select scope" on public.kafe;
drop policy if exists "KopiLaba cafe insert scope" on public.kafe;
drop policy if exists "KopiLaba cafe update scope" on public.kafe;
drop policy if exists "KopiLaba cafe delete scope" on public.kafe;

create policy "KopiLaba cafe select scope" on public.kafe
for select to authenticated
using (
  public.kopilaba_is_super_admin()
  or id = public.kopilaba_current_kafe_id()
  or pemilik_id = auth.uid()
);

create policy "KopiLaba cafe insert scope" on public.kafe
for insert to authenticated
with check (
  public.kopilaba_is_super_admin()
  or (pemilik_id = auth.uid() and public.kopilaba_current_role() is null)
);

create policy "KopiLaba cafe update scope" on public.kafe
for update to authenticated
using (
  public.kopilaba_is_super_admin()
  or (id = public.kopilaba_current_kafe_id() and public.kopilaba_current_role() = 'pemilik')
)
with check (
  public.kopilaba_is_super_admin()
  or (
    id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
    and pemilik_id = auth.uid()
  )
);

create policy "KopiLaba cafe delete scope" on public.kafe
for delete to authenticated
using (public.kopilaba_is_super_admin());

-- Profiles: users can read their own row; owners can see baristas of their cafe;
-- only a cafe owner can create/update/delete barista profiles in that same cafe.
drop policy if exists "KopiLaba profiles select scope" on public.profiles;
drop policy if exists "KopiLaba profiles insert scope" on public.profiles;
drop policy if exists "KopiLaba profiles update scope" on public.profiles;
drop policy if exists "KopiLaba profiles delete scope" on public.profiles;

create policy "KopiLaba profiles select scope" on public.profiles
for select to authenticated
using (
  public.kopilaba_is_super_admin()
  or id = auth.uid()
  or (
    role = 'barista'
    and kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

create policy "KopiLaba profiles insert scope" on public.profiles
for insert to authenticated
with check (
  public.kopilaba_is_super_admin()
  or (
    id = auth.uid()
    and role = 'pemilik'
    and exists (
      select 1 from public.kafe k
      where k.id = profiles.kafe_id and k.pemilik_id = auth.uid()
    )
  )
  or (
    role = 'barista'
    and kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

create policy "KopiLaba profiles update scope" on public.profiles
for update to authenticated
using (
  public.kopilaba_is_super_admin()
  or id = auth.uid()
  or (
    role = 'barista'
    and kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
)
with check (
  public.kopilaba_is_super_admin()
  or (
    id = auth.uid()
    and role = public.kopilaba_current_role()
    and kafe_id is not distinct from public.kopilaba_current_kafe_id()
  )
  or (
    role = 'barista'
    and kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

create policy "KopiLaba profiles delete scope" on public.profiles
for delete to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    role = 'barista'
    and kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

-- Transactions are visible and writable only within the signed-in user's cafe.
drop policy if exists "KopiLaba transactions scope" on public.transaksi;
create policy "KopiLaba transactions scope" on public.transaksi
for all to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() in ('pemilik', 'barista')
  )
)
with check (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() in ('pemilik', 'barista')
  )
);

-- Menu records can be read by the cafe's staff; only owners manage the catalog.
drop policy if exists "KopiLaba menu scope" on public.menu;
create policy "KopiLaba menu scope" on public.menu
for select to authenticated
using (
  public.kopilaba_is_super_admin()
  or kafe_id = public.kopilaba_current_kafe_id()
);

create policy "KopiLaba menu insert scope" on public.menu
for insert to authenticated
with check (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

create policy "KopiLaba menu update scope" on public.menu
for update to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
)
with check (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

create policy "KopiLaba menu delete scope" on public.menu
for delete to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

-- Categories are cafe-scoped. Legacy global rows remain available to super admin only.
drop policy if exists "KopiLaba categories scope" on public.kategori;
create policy "KopiLaba categories scope" on public.kategori
for select to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and kafe_id is not null
  )
);

create policy "KopiLaba categories insert scope" on public.kategori
for insert to authenticated
with check (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

create policy "KopiLaba categories update scope" on public.kategori
for update to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
)
with check (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

create policy "KopiLaba categories delete scope" on public.kategori
for delete to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() = 'pemilik'
  )
);

-- Attendance belongs to one cafe. Both owners and baristas may use their cafe's attendance.
drop policy if exists "KopiLaba attendance scope" on public.absensi;
create policy "KopiLaba attendance scope" on public.absensi
for all to authenticated
using (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() in ('pemilik', 'barista')
  )
)
with check (
  public.kopilaba_is_super_admin()
  or (
    kafe_id = public.kopilaba_current_kafe_id()
    and public.kopilaba_current_role() in ('pemilik', 'barista')
  )
);

-- RLS is the row boundary; SQL privileges must also not expose destructive table-level
-- operations such as TRUNCATE to the public anon role.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from public;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.kafe, public.profiles, public.transaksi,
  public.menu, public.kategori, public.absensi, public.kopilaba_retention_devices
to authenticated;

-- Never allow changing a profile's primary key; only the explicitly used fields are mutable.
revoke update on public.profiles from authenticated;
grant update (nama, telepon, role, kafe_id) on public.profiles to authenticated;

-- Keep stable identifiers immutable while allowing normal cafe settings and menu edits.
revoke update on public.kafe from authenticated;
grant update (nama, alamat, telepon, qris_url, pajak_enabled, pajak_persen)
on public.kafe to authenticated;

revoke update on public.menu from authenticated;
grant update (kafe_id, nama, harga, hpp, stok, foto, kategori_id)
on public.menu to authenticated;

revoke update on public.transaksi from authenticated;
grant update (kafe_id, menu_id, item, qty, total, tipe, status, created_at, subtotal,
  pajak, pajak_enabled, bayar, kembalian, metode, bayar_tunai, bayar_qris, pajak_persen)
on public.transaksi to authenticated;

revoke update on public.absensi from authenticated;
grant update (pegawai_id, kafe_id, tanggal, jam_masuk, jam_keluar, created_at)
on public.absensi to authenticated;

revoke update on public.kategori from authenticated;
grant update (nama, kafe_id) on public.kategori to authenticated;

commit;
