-- PovesteaNoastra — performance pass, from Supabase's Performance Advisor.
-- Nothing here changes who can see or do what.

-- 1. Unread counts: start from the caller's own events instead of checking
-- access on every message of every event. Same rule as before: owner,
-- co-organizer or confirmed guest.
create or replace function public.my_unread_chat_counts()
returns table (event_id uuid, unread integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (
    select auth.uid() as id
  ),
  my_events as (
    select e.id
    from public.events e, me
    where e.organizer_id = me.id
    union
    select em.event_id
    from public.event_members em, me
    where em.user_id = me.id and em.role = 'co_organizer'
    union
    select g.event_id
    from public.event_guests g, me
    where g.guest_user_id = me.id and g.rsvp_status = 'confirmed'
  )
  select m.event_id, count(*)::int
  from my_events
  join public.messages m on m.event_id = my_events.id
  cross join me
  left join public.chat_reads cr on cr.user_id = me.id and cr.event_id = m.event_id
  where m.sender_id <> me.id
    and (cr.last_read_at is null or m.created_at > cr.last_read_at)
  group by m.event_id;
$$;

-- 2. RLS: `(select auth.uid())` is evaluated once per query; a bare `auth.uid()`
-- is evaluated once per row. Same expressions otherwise.
alter policy "agency owner creates own agency" on public.agencies
  with check ((owner_user_id = (select auth.uid())));

alter policy "agency owner reads own agency" on public.agencies
  using ((owner_user_id = (select auth.uid())));

alter policy "agency owner updates own agency" on public.agencies
  using ((owner_user_id = (select auth.uid())))
  with check ((owner_user_id = (select auth.uid())));

alter policy "users read own chat state" on public.chat_reads
  using ((user_id = (select auth.uid())));

alter policy "guest claims own invite" on public.event_guests
  with check (((guest_user_id = (select auth.uid())) AND (NOT is_event_organizer(event_id))));

alter policy "organizer invites guests" on public.event_guests
  with check ((is_event_organizer(event_id) AND ((guest_user_id IS NULL) OR (guest_user_id <> (select auth.uid())))));

alter policy "update own rsvp or as organizer" on public.event_guests
  using (((guest_user_id = (select auth.uid())) OR is_event_organizer(event_id)))
  with check (((guest_user_id = (select auth.uid())) OR is_event_organizer(event_id)));

alter policy "view guest list of visible events" on public.event_guests
  using (((guest_user_id = (select auth.uid())) OR is_event_organizer(event_id)));

alter policy "organizers view members" on public.event_members
  using (((user_id = (select auth.uid())) OR is_event_organizer(event_id)));

alter policy "change own vote" on public.event_poll_votes
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "remove own vote" on public.event_poll_votes
  using ((user_id = (select auth.uid())));

alter policy "vote as yourself" on public.event_poll_votes
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM event_polls p
  WHERE ((p.id = event_poll_votes.poll_id) AND can_view_event(p.event_id))))));

alter policy "organizers add tasks" on public.event_tasks
  with check ((is_event_organizer(event_id) AND (created_by = (select auth.uid()))));

alter policy "create your own events" on public.events
  with check ((organizer_id = (select auth.uid())));

alter policy "organizer deletes own event" on public.events
  using ((organizer_id = (select auth.uid())));

alter policy "view events you organize or attend" on public.events
  using (((organizer_id = (select auth.uid())) OR is_event_co_organizer(id) OR is_event_guest(id) OR is_event_restaurant(id)));

alter policy "change own reaction" on public.message_reactions
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "react as yourself" on public.message_reactions
  with check (((user_id = (select auth.uid())) AND can_view_event(event_id) AND (EXISTS ( SELECT 1
   FROM messages m
  WHERE ((m.id = message_reactions.message_id) AND (m.event_id = message_reactions.event_id))))));

alter policy "remove own reaction" on public.message_reactions
  using ((user_id = (select auth.uid())));

alter policy "delete own message" on public.messages
  using (((sender_id = (select auth.uid())) OR is_event_organizer(event_id)));

alter policy "send messages as yourself" on public.messages
  with check (((sender_id = (select auth.uid())) AND can_view_event(event_id)));

alter policy "react as yourself" on public.moment_reactions
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM moments m
  WHERE ((m.id = moment_reactions.moment_id) AND can_view_event(m.event_id))))));

alter policy "remove own reaction" on public.moment_reactions
  using ((user_id = (select auth.uid())));

alter policy "organizer deletes moments" on public.moments
  using ((is_event_owner(event_id) OR ((organizer_id = (select auth.uid())) AND is_event_organizer(event_id))));

alter policy "organizer edits moments" on public.moments
  using ((is_event_owner(event_id) OR ((organizer_id = (select auth.uid())) AND is_event_organizer(event_id))))
  with check (is_event_organizer(event_id));

alter policy "organizer posts moments" on public.moments
  with check ((is_event_organizer(event_id) AND (organizer_id = (select auth.uid()))));

alter policy "users manage own notification preferences" on public.notification_preferences
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "delete own photo" on public.photos
  using (((uploaded_by = (select auth.uid())) OR is_event_organizer(event_id)));

alter policy "upload photos as yourself" on public.photos
  with check (((uploaded_by = (select auth.uid())) AND can_view_event(event_id)));

alter policy "change own rating" on public.plan_item_ratings
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "rate as yourself" on public.plan_item_ratings
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM plan_items i
  WHERE ((i.id = plan_item_ratings.item_id) AND can_view_event(i.event_id))))));

alter policy "remove own upvote" on public.plan_item_votes
  using ((user_id = (select auth.uid())));

alter policy "upvote as yourself" on public.plan_item_votes
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM plan_items i
  WHERE ((i.id = plan_item_votes.item_id) AND can_view_event(i.event_id))))));

alter policy "remove plan items" on public.plan_items
  using ((is_event_organizer(event_id) OR (added_by = (select auth.uid()))));

alter policy "users read own row" on public.users
  using ((id = (select auth.uid())));

alter policy "users update own row" on public.users
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

alter policy "follow as yourself" on public.venue_followers
  with check ((user_id = (select auth.uid())));

alter policy "follower or venue owner reads" on public.venue_followers
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM agencies a
  WHERE ((a.id = venue_followers.agency_id) AND (a.owner_user_id = (select auth.uid())))))));

alter policy "unfollow yourself" on public.venue_followers
  using ((user_id = (select auth.uid())));

-- 3. Foreign keys without a covering index (slow cascades and joins as tables grow).
create index if not exists chat_reads_event_id_idx on public.chat_reads (event_id);
create index if not exists event_guests_zone_id_idx on public.event_guests (zone_id);
create index if not exists event_poll_votes_user_id_idx on public.event_poll_votes (user_id);
create index if not exists event_tasks_created_by_idx on public.event_tasks (created_by);
create index if not exists message_reactions_user_id_idx on public.message_reactions (user_id);
create index if not exists moment_reactions_user_id_idx on public.moment_reactions (user_id);
create index if not exists moments_organizer_id_idx on public.moments (organizer_id);
create index if not exists notification_preferences_type_idx on public.notification_preferences (type);
create index if not exists photos_uploaded_by_idx on public.photos (uploaded_by);
create index if not exists plan_item_ratings_user_id_idx on public.plan_item_ratings (user_id);
create index if not exists plan_item_votes_user_id_idx on public.plan_item_votes (user_id);
create index if not exists plan_items_added_by_idx on public.plan_items (added_by);
create index if not exists plan_items_claimed_by_idx on public.plan_items (claimed_by);
create index if not exists venue_followers_user_id_idx on public.venue_followers (user_id);
