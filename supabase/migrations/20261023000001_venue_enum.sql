-- Venue events ("Local"): a bar or restaurant announces a night, customers
-- book a spot. Own migration because a new enum value can't be used in the
-- transaction that adds it (20261023000002_venue_events.sql uses it).

alter type public.event_type add value if not exists 'venue';
