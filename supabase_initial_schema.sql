create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'admin');
create type public.quote_status as enum ('draft', 'pending', 'quoted', 'accepted', 'declined', 'rejected', 'expired', 'invoiced', 'overdue', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.quotation_status as enum ('sent', 'accepted', 'declined', 'expired');
create type public.invoice_status as enum ('sent', 'paid', 'overdue');
create type public.payment_provider as enum ('flutterwave', 'stripe', 'bank_transfer');
create type public.payment_status as enum ('pending', 'successful', 'failed');
create type public.order_status as enum ('processing', 'shipped', 'delivered', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  company_name text,
  phone text,
  whatsapp text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_signed_in timestamptz
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null,
  moq integer not null default 1 check (moq > 0),
  colors jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  packaging_options jsonb not null default '[]'::jsonb,
  customization_options jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
create unique index product_images_one_primary_idx on public.product_images(product_id) where is_primary;
create index product_images_product_sort_idx on public.product_images(product_id, sort_order);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  status public.quote_status not null default 'pending',
  notes text,
  admin_notes text,
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.quote_request_items (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  color text not null default '',
  size text not null default '',
  packaging text not null default '',
  customization text not null default ''
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  currency text not null default 'NGN',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  notes text,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  status public.quotation_status not null default 'sent',
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  total numeric(12,2) not null default 0 check (total >= 0),
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  line_items jsonb not null default '[]'::jsonb,
  currency text not null default 'NGN',
  due_date date not null,
  payment_instructions text,
  status public.invoice_status not null default 'sent',
  issued_at timestamptz not null default timezone('utc', now())
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  provider public.payment_provider not null,
  provider_reference text,
  transaction_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  method text,
  status public.payment_status not null default 'pending',
  raw_payload jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  status public.order_status not null default 'processing',
  tracking_number text,
  carrier text,
  shipping_details text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  ref_id text,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger quote_requests_set_updated_at before update on public.quote_requests for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, last_signed_in)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), timezone('utc', now()))
  on conflict (id) do update set email = excluded.email, last_signed_in = timezone('utc', now());
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quote_request_items enable row level security;
alter table public.quotations enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select_self_or_admin on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_self_or_admin on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles for insert with check (public.is_admin() or id = auth.uid());

create policy products_public_read on public.products for select using (is_active or public.is_admin());
create policy products_admin_write on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy product_images_public_read on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));
create policy product_images_admin_write on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy quote_requests_customer_or_admin on public.quote_requests for select using (customer_id = auth.uid() or public.is_admin());
create policy quote_requests_customer_insert on public.quote_requests for insert with check (customer_id = auth.uid());
create policy quote_requests_customer_update_or_admin on public.quote_requests for update using (customer_id = auth.uid() or public.is_admin()) with check (customer_id = auth.uid() or public.is_admin());
create policy quote_requests_admin_delete on public.quote_requests for delete using (public.is_admin());

create policy quote_items_related_read on public.quote_request_items for select using (public.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quote_items_customer_insert on public.quote_request_items for insert with check (exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quote_items_customer_or_admin_update on public.quote_request_items for update using (public.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid())) with check (public.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quote_items_admin_delete on public.quote_request_items for delete using (public.is_admin());

create policy quotations_customer_or_admin_read on public.quotations for select using (public.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quotations_admin_write on public.quotations for all using (public.is_admin()) with check (public.is_admin());
create policy invoices_customer_or_admin_read on public.invoices for select using (public.is_admin() or exists (select 1 from public.quotations qt join public.quote_requests q on q.id = qt.quote_request_id where qt.id = quotation_id and q.customer_id = auth.uid()));
create policy invoices_admin_write on public.invoices for all using (public.is_admin()) with check (public.is_admin());
create policy payments_customer_or_admin_read on public.payments for select using (public.is_admin() or exists (select 1 from public.invoices i join public.quotations qt on qt.id = i.quotation_id join public.quote_requests q on q.id = qt.quote_request_id where i.id = invoice_id and q.customer_id = auth.uid()));
create policy payments_admin_write on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy orders_customer_or_admin_read on public.orders for select using (public.is_admin() or exists (select 1 from public.invoices i join public.quotations qt on qt.id = i.quotation_id join public.quote_requests q on q.id = qt.quote_request_id where i.id = invoice_id and q.customer_id = auth.uid()));
create policy orders_admin_write on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy order_history_customer_or_admin_read on public.order_status_history for select using (public.is_admin() or exists (select 1 from public.orders o join public.invoices i on i.id = o.invoice_id join public.quotations qt on qt.id = i.quotation_id join public.quote_requests q on q.id = qt.quote_request_id where o.id = order_id and q.customer_id = auth.uid()));
create policy order_history_admin_write on public.order_status_history for all using (public.is_admin()) with check (public.is_admin());
create policy messages_customer_or_admin_read on public.messages for select using (public.is_admin() or sender_id = auth.uid() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy messages_customer_or_admin_insert on public.messages for insert with check (sender_id = auth.uid() and (public.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid())));
create policy messages_admin_update on public.messages for update using (public.is_admin() or sender_id = auth.uid()) with check (public.is_admin() or sender_id = auth.uid());
create policy notifications_self_or_admin on public.notifications for select using (user_id = auth.uid() or public.is_admin());
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy notifications_admin_insert on public.notifications for insert with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy product_images_storage_public_read on storage.objects for select using (bucket_id = 'product-images');
create policy product_images_storage_admin_insert on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_storage_admin_update on storage.objects for update using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_storage_admin_delete on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());
