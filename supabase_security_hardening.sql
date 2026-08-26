create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  insert into public.profiles (id, email, name, last_signed_in)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), timezone('utc', now()))
  on conflict (id) do update set email = excluded.email, last_signed_in = timezone('utc', now());
  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter function private.handle_new_user() owner to postgres;
alter function private.is_admin() owner to postgres;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists profiles_admin_insert on public.profiles;
drop policy if exists products_public_read on public.products;
drop policy if exists products_admin_write on public.products;
drop policy if exists product_images_public_read on public.product_images;
drop policy if exists product_images_admin_write on public.product_images;
drop policy if exists quote_requests_customer_or_admin on public.quote_requests;
drop policy if exists quote_requests_customer_update_or_admin on public.quote_requests;
drop policy if exists quote_requests_admin_delete on public.quote_requests;
drop policy if exists quote_items_related_read on public.quote_request_items;
drop policy if exists quote_items_customer_insert on public.quote_request_items;
drop policy if exists quote_items_customer_or_admin_update on public.quote_request_items;
drop policy if exists quote_items_admin_delete on public.quote_request_items;
drop policy if exists quotations_customer_or_admin_read on public.quotations;
drop policy if exists quotations_admin_write on public.quotations;
drop policy if exists invoices_customer_or_admin_read on public.invoices;
drop policy if exists invoices_admin_write on public.invoices;
drop policy if exists payments_customer_or_admin_read on public.payments;
drop policy if exists payments_admin_write on public.payments;
drop policy if exists orders_customer_or_admin_read on public.orders;
drop policy if exists orders_admin_write on public.orders;
drop policy if exists order_history_customer_or_admin_read on public.order_status_history;
drop policy if exists order_history_admin_write on public.order_status_history;
drop policy if exists messages_customer_or_admin_read on public.messages;
drop policy if exists messages_customer_or_admin_insert on public.messages;
drop policy if exists messages_admin_update on public.messages;
drop policy if exists notifications_self_or_admin on public.notifications;
drop policy if exists notifications_self_update on public.notifications;
drop policy if exists notifications_admin_insert on public.notifications;
drop policy if exists product_images_storage_admin_insert on storage.objects;
drop policy if exists product_images_storage_admin_update on storage.objects;
drop policy if exists product_images_storage_admin_delete on storage.objects;

create policy profiles_select_self_or_admin on public.profiles for select using (id = auth.uid() or private.is_admin());
create policy profiles_update_self_or_admin on public.profiles for update using (id = auth.uid() or private.is_admin()) with check (id = auth.uid() or private.is_admin());
create policy profiles_admin_insert on public.profiles for insert with check (private.is_admin() or id = auth.uid());
create policy products_public_read on public.products for select using (is_active or private.is_admin());
create policy products_admin_write on public.products for all using (private.is_admin()) with check (private.is_admin());
create policy product_images_public_read on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or private.is_admin())));
create policy product_images_admin_write on public.product_images for all using (private.is_admin()) with check (private.is_admin());
create policy quote_requests_customer_or_admin on public.quote_requests for select using (customer_id = auth.uid() or private.is_admin());
create policy quote_requests_customer_update_or_admin on public.quote_requests for update using (customer_id = auth.uid() or private.is_admin()) with check (customer_id = auth.uid() or private.is_admin());
create policy quote_requests_admin_delete on public.quote_requests for delete using (private.is_admin());
create policy quote_items_related_read on public.quote_request_items for select using (private.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quote_items_customer_insert on public.quote_request_items for insert with check (exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quote_items_customer_or_admin_update on public.quote_request_items for update using (private.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid())) with check (private.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quote_items_admin_delete on public.quote_request_items for delete using (private.is_admin());
create policy quotations_customer_or_admin_read on public.quotations for select using (private.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy quotations_admin_write on public.quotations for all using (private.is_admin()) with check (private.is_admin());
create policy invoices_customer_or_admin_read on public.invoices for select using (private.is_admin() or exists (select 1 from public.quotations qt join public.quote_requests q on q.id = qt.quote_request_id where qt.id = quotation_id and q.customer_id = auth.uid()));
create policy invoices_admin_write on public.invoices for all using (private.is_admin()) with check (private.is_admin());
create policy payments_customer_or_admin_read on public.payments for select using (private.is_admin() or exists (select 1 from public.invoices i join public.quotations qt on qt.id = i.quotation_id join public.quote_requests q on q.id = qt.quote_request_id where i.id = invoice_id and q.customer_id = auth.uid()));
create policy payments_admin_write on public.payments for all using (private.is_admin()) with check (private.is_admin());
create policy orders_customer_or_admin_read on public.orders for select using (private.is_admin() or exists (select 1 from public.invoices i join public.quotations qt on qt.id = i.quotation_id join public.quote_requests q on q.id = qt.quote_request_id where i.id = invoice_id and q.customer_id = auth.uid()));
create policy orders_admin_write on public.orders for all using (private.is_admin()) with check (private.is_admin());
create policy order_history_customer_or_admin_read on public.order_status_history for select using (private.is_admin() or exists (select 1 from public.orders o join public.invoices i on i.id = o.invoice_id join public.quotations qt on qt.id = i.quotation_id join public.quote_requests q on q.id = qt.quote_request_id where o.id = order_id and q.customer_id = auth.uid()));
create policy order_history_admin_write on public.order_status_history for all using (private.is_admin()) with check (private.is_admin());
create policy messages_customer_or_admin_read on public.messages for select using (private.is_admin() or sender_id = auth.uid() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid()));
create policy messages_customer_or_admin_insert on public.messages for insert with check (sender_id = auth.uid() and (private.is_admin() or exists (select 1 from public.quote_requests q where q.id = quote_request_id and q.customer_id = auth.uid())));
create policy messages_admin_update on public.messages for update using (private.is_admin() or sender_id = auth.uid()) with check (private.is_admin() or sender_id = auth.uid());
create policy notifications_self_or_admin on public.notifications for select using (user_id = auth.uid() or private.is_admin());
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid() or private.is_admin()) with check (user_id = auth.uid() or private.is_admin());
create policy notifications_admin_insert on public.notifications for insert with check (private.is_admin());
create policy product_images_storage_admin_insert on storage.objects for insert with check (bucket_id = 'product-images' and private.is_admin());
create policy product_images_storage_admin_update on storage.objects for update using (bucket_id = 'product-images' and private.is_admin()) with check (bucket_id = 'product-images' and private.is_admin());
create policy product_images_storage_admin_delete on storage.objects for delete using (bucket_id = 'product-images' and private.is_admin());
