-- Chadrey Wholesale flow architecture expansion
-- Additive migration: preserves existing rows and tightens profile role changes.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Business address',
  recipient_name text not null,
  company_name text,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null default 'Nigeria',
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_addresses_customer_idx on public.customer_addresses(customer_id);
create unique index if not exists customer_addresses_one_default_idx on public.customer_addresses(customer_id) where is_default;

create table if not exists public.quote_status_history (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  from_status public.quote_status,
  to_status public.quote_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists quote_status_history_quote_idx on public.quote_status_history(quote_request_id, created_at);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id);

alter table public.customer_addresses enable row level security;
alter table public.quote_status_history enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.current_profile_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

-- Replace the broad profile update policy so a customer cannot self-promote.
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (public.is_admin() or (id = auth.uid() and role = public.current_profile_role()));

create policy customer_addresses_self_or_admin on public.customer_addresses
for all using (customer_id = auth.uid() or public.is_admin())
with check (customer_id = auth.uid() or public.is_admin());

create policy quote_status_history_customer_or_admin_read on public.quote_status_history
for select using (public.is_admin() or exists (
  select 1 from public.quote_requests q
  where q.id = quote_request_id and q.customer_id = auth.uid()
));
create policy quote_status_history_admin_insert on public.quote_status_history
for insert with check (public.is_admin());

create policy admin_audit_logs_admin_read on public.admin_audit_logs
for select using (public.is_admin());
create policy admin_audit_logs_admin_insert on public.admin_audit_logs
for insert with check (public.is_admin() and actor_id = auth.uid());

create index if not exists quote_requests_customer_status_idx on public.quote_requests(customer_id, status, created_at desc);
create index if not exists quotations_quote_status_idx on public.quotations(quote_request_id, status, issued_at desc);
create index if not exists invoices_status_due_idx on public.invoices(status, due_date);
create index if not exists payments_invoice_status_idx on public.payments(invoice_id, status, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists messages_quote_created_idx on public.messages(quote_request_id, created_at);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
