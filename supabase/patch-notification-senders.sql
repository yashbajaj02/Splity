-- Sender name + UPI on notifications (fixes "Someone" and missing QR)

alter table public.notifications
  add column if not exists sender_username text,
  add column if not exists sender_upi text;

update public.notifications n
set
  sender_username = coalesce(n.sender_username, p.username),
  sender_upi = coalesce(n.sender_upi, p.upi_id)
from public.profiles p
where n.sender_id = p.id;

create or replace function public.get_notification_sender_profiles(_sender_ids uuid[])
returns table (id uuid, username text, full_name text, upi_id text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.username, p.full_name, p.upi_id
  from public.profiles p
  where p.id = any(_sender_ids)
    and exists (
      select 1 from public.notifications n
      where n.sender_id = p.id and n.recipient_id = auth.uid()
    );
$$;

grant execute on function public.get_notification_sender_profiles(uuid[]) to authenticated;

drop policy if exists "profiles_select_notification_senders" on public.profiles;
create policy "profiles_select_notification_senders"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.notifications n
      where n.recipient_id = auth.uid() and n.sender_id = id
    )
  );
