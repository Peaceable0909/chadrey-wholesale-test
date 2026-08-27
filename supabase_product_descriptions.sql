alter table public.products add column if not exists short_description text not null default '';
update public.products set short_description = left(regexp_replace(description, '\s+', ' ', 'g'), 180) where short_description = '';
