-- =====================================================================
-- FRIENDS FEATURE — NEW TABLES, ENUM UPDATE, RLS, FUNCTIONS
-- Run this in your Supabase SQL Editor.
-- =====================================================================

-- 1. Extend notification_type enum with 'friend_request'
alter type public.notification_type add value if not exists 'friend_request';

-- 2. FRIEND_REQUESTS table
create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (sender_id, recipient_id)
);

create index if not exists friend_requests_sender_idx    on public.friend_requests (sender_id);
create index if not exists friend_requests_recipient_idx on public.friend_requests (recipient_id);

grant select, insert, update, delete on public.friend_requests to authenticated;
grant all on public.friend_requests to service_role;

-- 3. FRIENDS table (symmetric — one row per direction)
create table if not exists public.friends (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);

create index if not exists friends_user_idx   on public.friends (user_id);
create index if not exists friends_friend_idx on public.friends (friend_id);

grant select, insert, update, delete on public.friends to authenticated;
grant all on public.friends to service_role;

-- 4. Auto-update updated_at on friend_requests
drop trigger if exists friend_requests_touch_updated_at on public.friend_requests;
create trigger friend_requests_touch_updated_at
  before update on public.friend_requests
  for each row execute function public.touch_updated_at();

-- 5. ENABLE RLS
alter table public.friend_requests enable row level security;
alter table public.friends         enable row level security;

-- 6. RLS POLICIES — friend_requests
drop policy if exists "fr_select_own" on public.friend_requests;
create policy "fr_select_own"
  on public.friend_requests for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "fr_insert_sender" on public.friend_requests;
create policy "fr_insert_sender"
  on public.friend_requests for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "fr_update_recipient" on public.friend_requests;
create policy "fr_update_recipient"
  on public.friend_requests for update to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid())
  with check (recipient_id = auth.uid() or sender_id = auth.uid());

drop policy if exists "fr_delete_own" on public.friend_requests;
create policy "fr_delete_own"
  on public.friend_requests for delete to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- 7. RLS POLICIES — friends
drop policy if exists "friends_select_own" on public.friends;
create policy "friends_select_own"
  on public.friends for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friends_insert_own" on public.friends;
create policy "friends_insert_own"
  on public.friends for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "friends_delete_own" on public.friends;
create policy "friends_delete_own"
  on public.friends for delete to authenticated
  using (user_id = auth.uid());

-- 8. Allow seeing profiles of friends (for Friends list display)
drop policy if exists "profiles_select_friends" on public.profiles;
create policy "profiles_select_friends"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.friends f
      where f.user_id = auth.uid()
        and f.friend_id = public.profiles.id
    )
  );

-- 9. Allow seeing profiles of friend_request peers
drop policy if exists "profiles_select_friend_request_peers" on public.profiles;
create policy "profiles_select_friend_request_peers"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.friend_requests fr
      where (fr.sender_id = auth.uid() and fr.recipient_id = public.profiles.id)
         or (fr.recipient_id = auth.uid() and fr.sender_id = public.profiles.id)
    )
  );

-- 10. search_profiles_by_name RPC
create or replace function public.search_profiles_by_name(_query text, _limit int default 15)
returns table (id uuid, username text, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.avatar_url
  from public.profiles p
  where p.id <> auth.uid()
    and (
      lower(p.username)  like '%' || lower(_query) || '%'
      or lower(p.full_name) like '%' || lower(_query) || '%'
    )
  order by
    case when lower(p.username) = lower(_query) then 0
         when lower(p.full_name) = lower(_query) then 1
         else 2
    end,
    p.full_name asc
  limit _limit;
$$;

grant execute on function public.search_profiles_by_name(text, int) to authenticated;

-- 11. Realtime for friend_requests
do $$ begin
  alter publication supabase_realtime add table public.friend_requests;
exception when duplicate_object then null; end $$;
