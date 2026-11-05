alter table public.messages
 add constraint messages_not_empty_check
 check (trim(content) <> '' or photo_width is not null ) not valid;