-- Personal Account schema.
-- Run this whole file in the Supabase SQL editor.
-- Authentication → Providers → Email can stay enabled so the app signup page works.
-- For local testing, turn on "Confirm email" off, or confirm the user from the dashboard.

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  enable boolean not null default true,
  is_cash boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banks_name_not_blank check (char_length(btrim(name)) > 0)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  enable boolean not null default true,
  is_ledger boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (char_length(btrim(name)) > 0)
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type text not null,
  amount numeric(14, 2) not null,
  description text not null default '',
  bank_id uuid references public.banks (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_type_check check (type in ('Debit', 'Credit')),
  constraint entries_amount_positive check (amount > 0),
  constraint entries_parent_id_fkey foreign key (parent_id) references public.entries (id) on delete set null
);

create table if not exists public.lending_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  due_date date,
  type text not null,
  amount numeric(14, 2) not null,
  remaining_amount numeric(14, 2) not null,
  description text not null default '',
  bank_id uuid references public.banks (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lending_type_check check (type in ('Debit', 'Credit')),
  constraint lending_amount_positive check (amount > 0)
);

create table if not exists public.lending_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid not null references public.lending_entries (id) on delete cascade,
  date date not null,
  type text not null,
  amount numeric(14, 2) not null,
  description text not null default '',
  bank_id uuid references public.banks (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lending_items_type_check check (type in ('Debit', 'Credit')),
  constraint lending_items_amount_positive check (amount > 0)
);

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type text not null,
  amount numeric(14, 2) not null,
  description text not null default '',
  bank_id uuid references public.banks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposits_type_check check (type in ('Deposit', 'Withdrawal')),
  constraint deposits_amount_positive check (amount > 0)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  amount numeric(14, 2) not null,
  description text not null default '',
  from_bank_id uuid not null references public.banks (id) on delete restrict,
  to_bank_id uuid not null references public.banks (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_amount_positive check (amount > 0),
  constraint transfers_banks_differ check (from_bank_id <> to_bank_id)
);

create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date,
  description text not null default '',
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  bank_id uuid references public.banks (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  ref_id uuid,
  item_ref_id uuid,
  entry_kind text,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  sidebar boolean not null default false,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_forms_title_not_blank check (char_length(btrim(title)) > 0)
);

create table if not exists public.custom_form_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  form_id uuid not null references public.custom_forms (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists banks_user_idx on public.banks (user_id);
create index if not exists categories_user_idx on public.categories (user_id);
create index if not exists entries_user_date_idx on public.entries (user_id, date desc);
create index if not exists lending_user_date_idx on public.lending_entries (user_id, date desc);
create index if not exists deposits_user_date_idx on public.deposits (user_id, date desc);
create index if not exists transfers_user_date_idx on public.transfers (user_id, date desc);
create index if not exists statements_user_date_idx on public.statements (user_id, date);
create index if not exists statements_category_idx on public.statements (category_id);
create index if not exists statements_bank_idx on public.statements (bank_id);
create index if not exists custom_forms_user_idx on public.custom_forms (user_id);

drop trigger if exists banks_set_updated_at on public.banks;
create trigger banks_set_updated_at before update on public.banks
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at before update on public.entries
for each row execute function public.set_updated_at();

drop trigger if exists lending_set_updated_at on public.lending_entries;
create trigger lending_set_updated_at before update on public.lending_entries
for each row execute function public.set_updated_at();

drop trigger if exists deposits_set_updated_at on public.deposits;
create trigger deposits_set_updated_at before update on public.deposits
for each row execute function public.set_updated_at();

drop trigger if exists transfers_set_updated_at on public.transfers;
create trigger transfers_set_updated_at before update on public.transfers
for each row execute function public.set_updated_at();

drop trigger if exists custom_forms_set_updated_at on public.custom_forms;
create trigger custom_forms_set_updated_at before update on public.custom_forms
for each row execute function public.set_updated_at();

drop trigger if exists custom_form_entries_set_updated_at on public.custom_form_entries;
create trigger custom_form_entries_set_updated_at before update on public.custom_form_entries
for each row execute function public.set_updated_at();

alter table public.banks enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.lending_entries enable row level security;
alter table public.lending_items enable row level security;
alter table public.deposits enable row level security;
alter table public.transfers enable row level security;
alter table public.statements enable row level security;
alter table public.custom_forms enable row level security;
alter table public.custom_form_entries enable row level security;

drop policy if exists banks_owner on public.banks;
create policy banks_owner on public.banks
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists categories_owner on public.categories;
create policy categories_owner on public.categories
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists entries_owner on public.entries;
create policy entries_owner on public.entries
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists lending_owner on public.lending_entries;
create policy lending_owner on public.lending_entries
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists lending_items_owner on public.lending_items;
create policy lending_items_owner on public.lending_items
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists deposits_owner on public.deposits;
create policy deposits_owner on public.deposits
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists transfers_owner on public.transfers;
create policy transfers_owner on public.transfers
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists statements_owner on public.statements;
create policy statements_owner on public.statements
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists custom_forms_owner on public.custom_forms;
create policy custom_forms_owner on public.custom_forms
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists custom_form_entries_owner on public.custom_form_entries;
create policy custom_form_entries_owner on public.custom_form_entries
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create or replace function public.list_form_entries(
  p_form_id uuid,
  p_sort text default 'created_at',
  p_dir text default 'desc',
  p_type text default 'text'
)
returns setof public.custom_form_entries
language sql
stable
security invoker
set search_path = public
as $$
  select e.*
  from public.custom_form_entries e
  where e.form_id = p_form_id
    and e.user_id = auth.uid()
    and p_sort ~ '^[A-Za-z0-9_]+$'
  order by
    case when p_sort = 'created_at' and p_dir = 'asc' then e.created_at end asc nulls last,
    case when p_sort = 'created_at' and p_dir <> 'asc' then e.created_at end desc nulls last,
    case
      when p_sort <> 'created_at' and p_type = 'number' and p_dir = 'asc' and (e.data ->> p_sort) ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (e.data ->> p_sort)::numeric
    end asc nulls last,
    case
      when p_sort <> 'created_at' and p_type = 'number' and p_dir <> 'asc' and (e.data ->> p_sort) ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (e.data ->> p_sort)::numeric
    end desc nulls last,
    case
      when p_sort <> 'created_at' and p_type <> 'number' and p_dir = 'asc'
      then lower(e.data ->> p_sort)
    end asc nulls last,
    case
      when p_sort <> 'created_at' and p_type <> 'number' and p_dir <> 'asc'
      then lower(e.data ->> p_sort)
    end desc nulls last,
    e.created_at desc;
$$;

revoke all on function public.list_form_entries(uuid, text, text, text) from public;
grant execute on function public.list_form_entries(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
