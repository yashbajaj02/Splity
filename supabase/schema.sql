-- =====================================================================
-- SPLITWISE-STYLE EXPENSE SHARING — FULL SCHEMA + RLS
-- Run this whole script in Supabase SQL Editor.
-- =====================================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type public.member_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('group_invite', 'settlement_request', 'settlement_confirmed', 'expense_added');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('pending', 'accepted', 'declined', 'read');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 1. PROFILES
-- =====================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  email        text,
  full_name    text,
  upi_id       text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Case-insensitive uniqueness for usernames (Alice == alice)
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- =====================================================================
-- 2. GROUPS
-- =====================================================================
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.groups to authenticated;
grant all on public.groups to service_role;

-- =====================================================================
-- 3. GROUP_MEMBERS (invites + membership, status pending/accepted)
-- =====================================================================
create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     public.member_status not null default 'pending',
  role       text not null default 'member', -- 'admin' | 'member'
  invited_by uuid references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists group_members_user_idx  on public.group_members (user_id);
create index if not exists group_members_group_idx on public.group_members (group_id);

grant select, insert, update, delete on public.group_members to authenticated;
grant all on public.group_members to service_role;

-- =====================================================================
-- 4. EXPENSES
-- =====================================================================
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  paid_by     uuid not null references auth.users(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_group_idx on public.expenses (group_id);

grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

-- =====================================================================
-- 5. EXPENSE_SPLITS (how much each user owes for an expense)
-- =====================================================================
create table if not exists public.expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount_owed numeric(12,2) not null check (amount_owed >= 0),
  unique (expense_id, user_id)
);

create index if not exists expense_splits_expense_idx on public.expense_splits (expense_id);
create index if not exists expense_splits_user_idx    on public.expense_splits (user_id);

grant select, insert, update, delete on public.expense_splits to authenticated;
grant all on public.expense_splits to service_role;

-- =====================================================================
-- 6. NOTIFICATIONS (group invites + settlement requests)
-- =====================================================================
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id    uuid references auth.users(id) on delete set null,
  type         public.notification_type not null,
  status       public.notification_status not null default 'pending',
  group_id     uuid references public.groups(id) on delete cascade,
  amount       numeric(12,2),
  message      text,
  sender_username text,
  sender_upi   text,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- =====================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS to avoid recursion)
-- =====================================================================
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id
      and user_id = _user_id
      and status  = 'accepted'
  );
$$;

create or replace function public.is_group_admin(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = _group_id and created_by = _user_id
  )
  or exists (
    select 1 from public.group_members
    where group_id = _group_id
      and user_id  = _user_id
      and status   = 'accepted'
      and role     = 'admin'
  );
$$;

create or replace function public.is_involved_in_expense(_expense_id uuid, _user_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.expenses
    where id = _expense_id and paid_by = _user_id
  ) or exists (
    select 1 from public.expense_splits
    where expense_id = _expense_id and user_id = _user_id
  );
$$;

-- Find a user by exact username (case-insensitive) for invites.
-- Returns only id + username, so the full profile table stays private.
create or replace function public.find_user_by_username(_username text)
returns table (id uuid, username text, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select id, username, full_name, avatar_url
  from public.profiles
  where lower(username) = lower(_username)
  limit 1;
$$;

-- Sender profiles for notifications (invite before shared group membership).
create or replace function public.get_notification_sender_profiles(_sender_ids uuid[])
returns table (id uuid, username text, full_name text, upi_id text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.upi_id
  from public.profiles p
  where p.id = any(_sender_ids)
    and exists (
      select 1 from public.notifications n
      where n.sender_id = p.id
        and n.recipient_id = auth.uid()
    );
$$;

grant execute on function public.is_group_member(uuid, uuid)       to authenticated;
grant execute on function public.is_group_admin(uuid, uuid)        to authenticated;
grant execute on function public.is_involved_in_expense(uuid, uuid) to authenticated;
grant execute on function public.find_user_by_username(text)       to authenticated;
grant execute on function public.get_notification_sender_profiles(uuid[]) to authenticated;

-- =====================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep updated_at fresh on profiles
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Backfill profiles for users who signed up before the trigger existed
insert into public.profiles (id, email, full_name)
select id, email, raw_user_meta_data->>'full_name'
from auth.users
on conflict (id) do nothing;

-- =====================================================================
-- ENABLE RLS
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.notifications  enable row level security;

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

-- ---------- PROFILES ----------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_select_group_peers" on public.profiles;
create policy "profiles_select_group_peers"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.group_members me
      join public.group_members them on them.group_id = me.group_id
      where me.user_id = auth.uid()
        and me.status  = 'accepted'
        and them.user_id = public.profiles.id
    )
  );

drop policy if exists "profiles_select_notification_senders" on public.profiles;
create policy "profiles_select_notification_senders"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.notifications n
      where n.recipient_id = auth.uid()
        and n.sender_id = id
    )
  );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- GROUPS ----------
drop policy if exists "groups_select_members" on public.groups;
create policy "groups_select_members"
  on public.groups for select to authenticated
  using (created_by = auth.uid() or public.is_group_member(id, auth.uid()));

drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own"
  on public.groups for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "groups_update_admin" on public.groups;
create policy "groups_update_admin"
  on public.groups for update to authenticated
  using (public.is_group_admin(id, auth.uid()))
  with check (public.is_group_admin(id, auth.uid()));

drop policy if exists "groups_delete_creator" on public.groups;
create policy "groups_delete_creator"
  on public.groups for delete to authenticated
  using (created_by = auth.uid());

-- ---------- GROUP_MEMBERS ----------
drop policy if exists "gm_select" on public.group_members;
create policy "gm_select"
  on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id, auth.uid()));

drop policy if exists "gm_insert_invite" on public.group_members;
create policy "gm_insert_invite"
  on public.group_members for insert to authenticated
  with check (
    public.is_group_admin(group_id, auth.uid())
    or public.is_group_member(group_id, auth.uid())
    or (user_id = auth.uid() and exists (
          select 1 from public.groups g
          where g.id = group_id and g.created_by = auth.uid()
        ))
  );

drop policy if exists "gm_update_own" on public.group_members;
create policy "gm_update_own"
  on public.group_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "gm_update_admin" on public.group_members;
create policy "gm_update_admin"
  on public.group_members for update to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()));

drop policy if exists "gm_delete" on public.group_members;
create policy "gm_delete"
  on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

-- ---------- EXPENSES ----------
drop policy if exists "expenses_select_members" on public.expenses;
drop policy if exists "expenses_select_involved" on public.expenses;
create policy "expenses_select_involved"
  on public.expenses for select to authenticated
  using (public.is_involved_in_expense(id, auth.uid()));

drop policy if exists "expenses_insert_members" on public.expenses;
create policy "expenses_insert_members"
  on public.expenses for insert to authenticated
  with check (
    public.is_group_member(group_id, auth.uid())
    and created_by = auth.uid()
    and paid_by = auth.uid()
  );

drop policy if exists "expenses_update_owner" on public.expenses;
create policy "expenses_update_owner"
  on public.expenses for update to authenticated
  using (created_by = auth.uid() or public.is_group_admin(group_id, auth.uid()))
  with check (created_by = auth.uid() or public.is_group_admin(group_id, auth.uid()));

drop policy if exists "expenses_delete_owner" on public.expenses;
create policy "expenses_delete_owner"
  on public.expenses for delete to authenticated
  using (
    public.is_group_admin(group_id, auth.uid())
    or (
      created_by = auth.uid()
      and created_at >= now() - interval '5 hours'
    )
  );

-- ---------- EXPENSE_SPLITS ----------
drop policy if exists "splits_select_members" on public.expense_splits;
drop policy if exists "splits_select_involved" on public.expense_splits;
create policy "splits_select_involved"
  on public.expense_splits for select to authenticated
  using (public.is_involved_in_expense(expense_id, auth.uid()));

drop policy if exists "splits_insert_members" on public.expense_splits;
create policy "splits_insert_members"
  on public.expense_splits for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_group_member(e.group_id, auth.uid())
    )
  );

drop policy if exists "splits_update_members" on public.expense_splits;
create policy "splits_update_members"
  on public.expense_splits for update to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and e.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "splits_delete_members" on public.expense_splits;
create policy "splits_delete_members"
  on public.expense_splits for delete to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and e.created_by = auth.uid()
    )
  );

-- ---------- NOTIFICATIONS ----------
drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

drop policy if exists "notif_insert_sender" on public.notifications;
create policy "notif_insert_sender"
  on public.notifications for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "notif_update_recipient" on public.notifications;
create policy "notif_update_recipient"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_delete_own"
  on public.notifications for delete to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

-- =====================================================================
-- REALTIME (for live in-app notifications)
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null; end $$;
