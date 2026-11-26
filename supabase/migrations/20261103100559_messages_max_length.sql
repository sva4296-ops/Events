alter table public.messages
    add constraint messages_max_length
    check ( char_length(content) <= 2000 ) not valid;