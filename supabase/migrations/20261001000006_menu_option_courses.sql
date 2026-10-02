-- PovesteaNoastra: a menu option has any number of courses, not a fixed
-- starter/main/dessert. courses = [{ "name": "Antreu", "dish": "Supă cremă" }, ...]
-- in display order. Course names are organizer content (stored as typed).

alter table public.menu_options
  add column if not exists courses jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_options_courses_array_check') then
    alter table public.menu_options
      add constraint menu_options_courses_array_check check (jsonb_typeof(courses) = 'array');
  end if;
end $$;

-- Move the fixed columns (from 20261001000005) into courses, then drop them.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menu_options' and column_name = 'starter'
  ) then
    update public.menu_options o
    set courses = coalesce((
      select jsonb_agg(jsonb_build_object('name', v.name, 'dish', trim(v.dish)) order by v.ord)
      from (values (1, 'Antreu', o.starter), (2, 'Fel principal', o.main), (3, 'Desert', o.dessert)) as v (ord, name, dish)
      where coalesce(trim(v.dish), '') <> ''
    ), '[]'::jsonb)
    where o.courses = '[]'::jsonb;

    alter table public.menu_options
      drop column starter,
      drop column main,
      drop column dessert;
  end if;
end $$;
