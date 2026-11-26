-- Spontaneous events (karaoke / party / wine tasting, 1-2 weeks away).
--
-- Enum values live in their own migration: a value added with
-- `alter type ... add value` can't be used in the same transaction, and
-- 20261022000002_spontaneous_events.sql references both.
--
--   event_type 'spontaneous': the new event kind. Which template it uses
--     (karaoke/party/tasting) is events.template, not more enum values.
--   rsvp_status 'maybe': the third answer ("Poate"). The app only offers it
--     on spontaneous events; every other type keeps confirmed/declined.
--     Existing code that only checks 'confirmed' (push recipients, access to
--     the event tabs, menu reminders) treats 'maybe' like 'pending', on purpose.

alter type public.event_type add value if not exists 'spontaneous';
alter type public.rsvp_status add value if not exists 'maybe';
