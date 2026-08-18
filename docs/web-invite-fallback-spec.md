# Web invite fallback — spec for a separate Next.js repo

> **This document specifies a page that does not exist yet, in a repo that does not exist yet.**
> Nothing in this file is code that runs today. It exists so the Next.js project can be scaffolded
> later without re-deriving the contract from scratch. See CLAUDE.md §7 for the standing note
> pointing here, and the PovesteaNoastra plan that introduced phone auth + phone invites for the
> reasoning behind each decision below.

## Why this is a separate repo, not part of this Expo app

PovesteaNoastra has no web build and no domain (Expo Router here targets iOS/Android only via a
custom URL scheme, `povesteanoastra://`). An SMS invite link needs *something* to open when the
recipient doesn't have the app installed — that has to be an ordinary web page, which this repo
can't produce. Per the decision made when this was scoped: build it as its own Next.js project,
pointed at the same Supabase backend via public env vars, not folded into this Expo codebase.

## Required environment

- `NEXT_PUBLIC_SUPABASE_URL` — same value as this repo's `EXPO_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same value as this repo's `EXPO_PUBLIC_SUPABASE_KEY`. Never the
  service-role key — this page only ever needs anon-key + user-session access, the same as the app.

## Route

`/invite/[eventId]` — `eventId` is the same UUID the native deep link
(`povesteanoastra:///invite/<eventId>`) already carries. One route, no separate invite-id in the
URL: which specific pending invitation belongs to the visitor is resolved server-side from their
OTP-verified phone, once they have a session — never trusted from the URL itself.

## Flow

1. **App-installed handoff, attempted first.** On load, try `povesteanoastra:///invite/<eventId>` via
   a plain link/timeout pattern (redirect to the custom scheme, fall back to rendering this page's
   own UI if the tab is still visible after ~1–2s — the standard "deep link or fall through" trick,
   since there's no reliable synchronous way to detect whether the scheme resolved). If the app opens,
   nothing else on this page matters. If it doesn't, continue below.
2. **No session yet → phone entry.** Same phone-number + country-code input as this app's
   `app/auth/phone.tsx` (mirror `components/PhoneField.tsx`'s dial-code + local-number shape, or use a
   library — this repo isn't the source of UI for the new project, only the contract). Calls:
   ```js
   supabase.auth.signInWithOtp({ phone, options: { channel: 'sms' } })
   ```
   — identical to `hooks/useAuth.tsx`'s `signInWithPhoneOtp`, just through
   `@supabase/supabase-js`'s browser client instead of React Native's.
3. **Code entry.** Calls:
   ```js
   supabase.auth.verifyOtp({ phone, token, type: 'sms' })
   ```
   — identical to `verifyPhoneOtp`. On success, Supabase's browser client persists the session
   (localStorage by default) and the auto-link trigger
   (`supabase/migrations/20260818000002_guest_phone_invites.sql`) has already run server-side by this
   point, same timing as the native app.
4. **Once a session exists (fresh from step 3, or an existing one) → fetch the invite preview.**
   Call the same RPC the native app's fallback branch uses:
   ```js
   const { data } = await supabase.rpc('get_invite_preview', { p_event_id: eventId });
   ```
   `data[0]` (or empty) is `{ event_id, name, type, event_date, location, welcome_message, guest_id,
   rsvp_status }` — see `types/supabase.ts`'s `InvitePreviewRow` in this repo for the exact shape.
   The RPC derives the caller's own phone from their session server-side (`security definer`, reads
   `public.users` via `auth.uid()`) — it is not possible to pass an arbitrary phone number as a
   parameter and see someone else's invite. Empty result → render "invitation not found / already
   linked to a different account" (mirrors this app's `rsvp.notFoundTitle`/`rsvp.notFoundNote`).
5. **Render the preview + Accept/Decline**, same content this app's `InviteCard` shows (event name,
   date, location, welcome message) and the same two-button footer
   (`rsvp.confirmAttendance`/`rsvp.cantMakeIt`, or the "already answered" reconciliation view if
   `rsvp_status !== 'pending'`).
6. **Write path — no new RPC, reuse the same table operation `respondToInviteRow` performs**
   (`data/eventsRepository.ts` in this repo): once a session exists and `guest_id`/`guest_user_id` is
   linked, `event_guests`'s "update own rsvp or as organizer" RLS policy already permits a plain
   update from an authenticated client:
   ```js
   await supabase
     .from('event_guests')
     .update({ rsvp_status: status, responded_at: new Date().toISOString() })
     .eq('id', guestId);
   ```

## Explicitly out of scope for that future repo

- No offline mode, no local storage beyond the Supabase session token.
- No account linking, no email fallback — phone-only, matching this app's "fully separate
  identities" decision (see CLAUDE.md's Agency accounts section for the same precedent applied to a
  different account type).
- No attempt to replicate the native app's onboarding, theming system, or any screen beyond this one
  invite-response flow.
- No handling for "resend to WhatsApp" — SMS-only, same channel default as
  `hooks/useAuth.tsx`'s `signInWithPhoneOtp`.

## Verification status

Everything in this document is a specification, not a tested implementation — there is no Next.js
code to typecheck or run yet. When that repo is built, it should be verified against a real Supabase
project the same way this repo's own CLAUDE.md insists on: state exactly what was checked (a real
OTP round-trip, a real RPC call, a real RLS-permitted update), not assumed working because it matches
this document.
