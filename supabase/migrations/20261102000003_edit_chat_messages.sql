-- Editing your own chat message. An RPC rather than an update policy: RLS can't
-- limit which columns change, and sender_label, the photo size etc. must not.

alter table public.messages add column if not exists edited_at timestamptz;

create or replace function public.edit_message(p_message_id uuid, p_content text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := trim(p_content);
begin
  update public.messages
  set content = cleaned, edited_at = now()
  where id = p_message_id
    and sender_id = auth.uid()
    -- Only a photo can go without text.
    and (cleaned <> '' or photo_width is not null);

  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.edit_message(uuid, text) from public, anon;
grant execute on function public.edit_message(uuid, text) to authenticated;
