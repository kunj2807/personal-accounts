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

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_name text not null,
  action text not null default '',
  entry_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now(),
  constraint activity_logs_module_name_not_blank check (char_length(btrim(module_name)) > 0)
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
create index if not exists activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
create index if not exists activity_logs_entry_idx on public.activity_logs (entry_id);

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
alter table public.activity_logs enable row level security;

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

drop policy if exists activity_logs_owner on public.activity_logs;
create policy activity_logs_owner on public.activity_logs
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

alter table public.categories drop column if exists is_ledger;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'activity_logs'
      and column_name = 'index'
  ) then
    alter table public.activity_logs rename column "index" to action;
  end if;
end;
$$;

create or replace function public.merge_categories(p_target uuid, p_sources uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sources uuid[];
  found bigint;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(array_agg(distinct source_id), '{}')
  into sources
  from unnest(coalesce(p_sources, '{}')) as source_id
  where source_id is not null;

  if p_target is null or cardinality(sources) = 0 then
    raise exception 'Choose categories to merge';
  end if;

  if p_target = any(sources) then
    raise exception 'The category you keep cannot be one of the categories being merged';
  end if;

  if not exists (
    select 1 from public.categories where id = p_target and user_id = uid
  ) then
    raise exception 'The category you want to keep was not found';
  end if;

  select count(*) into found
  from public.categories
  where user_id = uid and id = any(sources);

  if found <> cardinality(sources) then
    raise exception 'One or more categories were not found';
  end if;

  update public.entries
  set category_id = p_target
  where user_id = uid and category_id = any(sources);

  update public.lending_entries
  set category_id = p_target
  where user_id = uid and category_id = any(sources);

  update public.statements
  set category_id = p_target
  where user_id = uid and category_id = any(sources);

  delete from public.categories
  where user_id = uid and id = any(sources);
end;
$$;

revoke all on function public.merge_categories(uuid, uuid[]) from public;
grant execute on function public.merge_categories(uuid, uuid[]) to authenticated;

create or replace function public.monthly_entry_totals(
  p_year integer,
  p_type text default 'Total',
  p_categories uuid[] default '{}',
  p_banks uuid[] default '{}'
)
returns table (month integer, total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    months.month,
    coalesce(sum(case when e.type = 'Debit' then -e.amount else e.amount end), 0) as total
  from generate_series(1, 12) as months(month)
  left join public.entries e
    on extract(month from e.date)::integer = months.month
   and e.date >= make_date(p_year, 1, 1)
   and e.date <= make_date(p_year, 12, 31)
   and (p_type is null or p_type in ('Total', 'all', 'All') or e.type = p_type)
   and (cardinality(coalesce(p_categories, '{}')) = 0 or e.category_id = any (p_categories))
   and (cardinality(coalesce(p_banks, '{}')) = 0 or e.bank_id = any (p_banks))
  group by months.month
  order by months.month;
$$;

revoke all on function public.monthly_entry_totals(integer, text, uuid[], uuid[]) from public;
grant execute on function public.monthly_entry_totals(integer, text, uuid[], uuid[]) to authenticated;

drop view if exists public.bank_balances;
create view public.bank_balances
with (security_invoker = true) as
select
  b.id,
  b.name,
  b.enable,
  b.is_cash,
  b.created_at,
  coalesce(t.debit, 0) as debit,
  coalesce(t.credit, 0) as credit
from public.banks b
left join lateral (
  select
    coalesce(sum(s.debit), 0) as debit,
    coalesce(sum(s.credit), 0) as credit
  from public.statements s
  where s.bank_id = b.id
) t on true;

grant select on public.bank_balances to authenticated;

drop view if exists public.category_balances;
create view public.category_balances
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.enable,
  c.created_at,
  coalesce(t.debit, 0) as debit,
  coalesce(t.credit, 0) as credit
from public.categories c
left join lateral (
  select
    coalesce(sum(s.debit), 0) as debit,
    coalesce(sum(s.credit), 0) as credit
  from public.statements s
  where s.category_id = c.id
) t on true;

grant select on public.category_balances to authenticated;

-- Deletes the signed-in user's books, then the auth account.
-- Child rows are removed before banks, because transfers block bank deletion.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.entries
  set parent_id = null
  where user_id = uid
    and parent_id is not null;

  delete from public.statements where user_id = uid;
  delete from public.transfers where user_id = uid;
  delete from public.lending_items where user_id = uid;
  delete from public.lending_entries where user_id = uid;
  delete from public.entries where user_id = uid;
  delete from public.deposits where user_id = uid;
  delete from public.custom_form_entries where user_id = uid;
  delete from public.custom_forms where user_id = uid;
  delete from public.activity_logs where user_id = uid;
  delete from public.categories where user_id = uid;
  delete from public.banks where user_id = uid;
  delete from public.users where id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  consent_accepted boolean not null default false,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

alter table public.users enable row level security;

drop policy if exists users_owner_select on public.users;
create policy users_owner_select on public.users
for select to authenticated
using (id = auth.uid());

grant select on public.users to authenticated;

-- Copies a new sign-in account into public.users and records consent in the activity log.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  accepted boolean;
  accepted_at timestamptz;
  accepted_text text;
begin
  display_name := coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), '');
  accepted_text := lower(btrim(coalesce(new.raw_user_meta_data->>'consent_accepted', '')));
  accepted := accepted_text in ('true', 't', '1', 'yes');

  if accepted then
    begin
      accepted_at := nullif(btrim(coalesce(new.raw_user_meta_data->>'consent_accepted_at', '')), '')::timestamptz;
    exception
      when others then
        accepted_at := null;
    end;
    if accepted_at is null then
      accepted_at := now();
    end if;
  else
    accepted_at := null;
  end if;

  insert into public.users (id, name, email, consent_accepted, consent_accepted_at)
  values (new.id, display_name, coalesce(new.email, ''), accepted, accepted_at);

  if accepted then
    insert into public.activity_logs (user_id, module_name, action, entry_id, new_value)
    values (
      new.id,
      'User',
      'add',
      new.id,
      jsonb_build_object(
        'name', display_name,
        'email', coalesce(new.email, ''),
        'consent_accepted', true,
        'consent_accepted_at', accepted_at
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.users (id, name, email, consent_accepted, consent_accepted_at)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data->>'name'), ''), ''),
  coalesce(u.email, ''),
  false,
  null
from auth.users u
where not exists (
  select 1 from public.users existing where existing.id = u.id
);

-- Records consent for an existing signed-in user and writes an activity log.
create or replace function public.accept_own_consent()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.users%rowtype;
  display_name text := '';
  display_email text := '';
  accepted_at timestamptz := now();
  result public.users%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select * into existing from public.users where id = uid;
  if existing.id is not null and existing.consent_accepted then
    return to_jsonb(existing);
  end if;

  select
    coalesce(nullif(btrim(u.raw_user_meta_data->>'name'), ''), ''),
    coalesce(u.email, '')
  into display_name, display_email
  from auth.users u
  where u.id = uid;

  if existing.id is null then
    insert into public.users (id, name, email, consent_accepted, consent_accepted_at)
    values (uid, display_name, display_email, true, accepted_at)
    returning * into result;
  else
    update public.users
    set consent_accepted = true,
        consent_accepted_at = accepted_at
    where id = uid
    returning * into result;
  end if;

  insert into public.activity_logs (user_id, module_name, action, entry_id, old_value, new_value)
  values (
    uid,
    'User',
    case when existing.id is null then 'add' else 'edit' end,
    uid,
    case
      when existing.id is null then null
      else jsonb_build_object(
        'name', existing.name,
        'email', existing.email,
        'consent_accepted', false,
        'consent_accepted_at', existing.consent_accepted_at
      )
    end,
    jsonb_build_object(
      'name', result.name,
      'email', result.email,
      'consent_accepted', true,
      'consent_accepted_at', result.consent_accepted_at
    )
  );

  return to_jsonb(result);
end;
$$;

revoke all on function public.accept_own_consent() from public;
revoke all on function public.accept_own_consent() from anon;
grant execute on function public.accept_own_consent() to authenticated;

notify pgrst, 'reload schema';

commit;
