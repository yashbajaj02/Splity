-- ============================================================
-- FIX: friends INSERT RLS violation on accept_friend_request
--
-- PROBLEM:
--   The RLS INSERT policy on friends is:
--     WITH CHECK (user_id = auth.uid())
--
--   When the recipient accepts, they can insert the row where
--   user_id = auth.uid() (themselves), but NOT the symmetric
--   row where user_id = sender_id, because auth.uid() != sender_id.
--
-- SOLUTION:
--   A SECURITY DEFINER function that validates the caller is
--   the actual recipient, then inserts both rows using elevated
--   privileges (bypassing RLS safely).
--
-- Run this in your Supabase SQL Editor.
-- ============================================================

create or replace function public.accept_friend_request(
  p_sender_id    uuid,
  p_recipient_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify the caller is actually the recipient.
  if auth.uid() <> p_recipient_id then
    raise exception 'not authorized';
  end if;

  -- Verify a pending request actually exists from sender -> recipient.
  if not exists (
    select 1 from public.friend_requests
    where sender_id    = p_sender_id
      and recipient_id = p_recipient_id
      and status       = 'pending'
  ) then
    raise exception 'no pending friend request found';
  end if;

  -- Insert symmetric friendship rows (both directions).
  insert into public.friends (user_id, friend_id)
  values (p_recipient_id, p_sender_id)
  on conflict (user_id, friend_id) do nothing;

  insert into public.friends (user_id, friend_id)
  values (p_sender_id, p_recipient_id)
  on conflict (user_id, friend_id) do nothing;

  -- Mark the request as accepted.
  update public.friend_requests
  set status     = 'accepted',
      updated_at = now()
  where sender_id    = p_sender_id
    and recipient_id = p_recipient_id;
end;
$$;

grant execute on function public.accept_friend_request(uuid, uuid) to authenticated;
