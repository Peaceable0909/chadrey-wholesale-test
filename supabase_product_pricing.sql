-- Chadrey Wholesale: indicative product pricing
--
-- Additive and safe to run more than once. Existing products keep working:
-- an empty price ladder simply means "price on request".
--
-- price_tiers is a quantity ladder, lowest quantity first:
--   [{ "min_qty": 50, "price": 12500 }, { "min_qty": 200, "price": 11800 }]
-- Prices are indicative only (imports move with exchange rates and freight);
-- the final price is always the one on the quotation the team issues.
--
-- Row level security is unchanged: these columns follow the existing products
-- policies (public can read active products, only admins can write).

alter table public.products
  add column if not exists price_currency text not null default 'NGN',
  add column if not exists price_unit text not null default 'pc',
  add column if not exists price_tiers jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_price_tiers_is_array') then
    alter table public.products
      add constraint products_price_tiers_is_array check (jsonb_typeof(price_tiers) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_price_currency_length') then
    alter table public.products
      add constraint products_price_currency_length check (char_length(price_currency) between 2 and 8);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_price_unit_length') then
    alter table public.products
      add constraint products_price_unit_length check (char_length(price_unit) between 1 and 24);
  end if;
end
$$;

comment on column public.products.price_currency is 'ISO currency code for price_tiers, for example NGN, USD or THB.';
comment on column public.products.price_unit is 'What one price covers: pc, set, pair, carton, kg …';
comment on column public.products.price_tiers is 'Indicative quantity ladder: [{"min_qty": 50, "price": 12500}, ...]. Empty array = price on request.';

-- Make PostgREST pick up the new columns straight away.
notify pgrst, 'reload schema';
