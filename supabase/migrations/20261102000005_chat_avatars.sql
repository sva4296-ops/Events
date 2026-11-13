-- Profile photos in the chat. Avatars were readable only by their owner; now also
-- by anyone who can read a message that person sent. No wider: someone who never
-- wrote in a chat you're part of stays private. public.messages' own RLS already
-- limits the subquery to chats the caller can view.

create index if not exists messages_sender_idx on public.messages (sender_id);

drop policy if exists "view avatars of chat senders" on storage.objects;
create policy "view avatars of chat senders" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.messages m
      where m.sender_id::text = (storage.foldername(name))[1]
    )
  );
