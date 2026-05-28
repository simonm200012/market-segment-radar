create table if not exists public.vehicle_ledgers (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vehicle_ledgers enable row level security;

create policy "Allow anon garage ledger read"
  on public.vehicle_ledgers
  for select
  to anon
  using (true);

create policy "Allow anon garage ledger upsert"
  on public.vehicle_ledgers
  for insert
  to anon
  with check (true);

create policy "Allow anon garage ledger update"
  on public.vehicle_ledgers
  for update
  to anon
  using (true)
  with check (true);
