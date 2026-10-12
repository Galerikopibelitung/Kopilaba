alter table public.transaksi
  add column if not exists bayar_tunai integer not null default 0;

alter table public.transaksi
  add column if not exists bayar_qris integer not null default 0;
