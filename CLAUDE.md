# PovesteaNoastra

> **Maintenance:** This file should be updated whenever a pass changes the data model, navigation
> structure, design system, or core conventions — keep it in sync with the actual codebase, not with
> what was merely planned.

> **Verification status (read this first):** The app has **never been run on a device or simulator**
> in any session so far. Everything below is verified only by `npx tsc --noEmit --noUnusedLocals` and
> `npx expo export --platform ios`, both of which pass, plus — for the Supabase data layer specifically
> — an anonymous REST check confirming all 11 tables exist and RLS is active (§3). Anything visual or
> runtime — layout, gesture feel, animation timing, Supabase auth actually completing, **or a real
> signed-in write actually landing in a table** — is **unconfirmed**; there's no way to authenticate as
> a real user from this environment. Sections below mark uncertain items explicitly. The `ios/` and
> `android/` native folders exist from `expo prebuild`, but pods are stale relative to the current
> dependency list — this is now also true of `@react-native-community/datetimepicker`, added this pass;
> `pod-install`/rebuild is required before running, and the user runs that step themselves (see §6
> conventions on dev builds).

---

## 1. Project overview

An event platform for weddings, baptisms, birthdays, causes, corporate events and memorials. An
organizer creates an event page, shares an invite link, and guests RSVP. Each event then has its own
guest-facing space: a story feed of "moments", event details and schedule, a contribution fund, a
group chat, a live photo feed, and a post-event album.

**Tech stack**

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 57, React Native 0.86, React 19.2 |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Navigation | Expo Router (file-based) |
| State | `@tanstack/react-query` for the events + per-event content resources (see §2 State layer); a few small React Context providers remain for session/draft/UI state — no Redux |
| Persistence | AsyncStorage (local) |
| Backend | Supabase — **auth only, and unverified**; see §3 |
| Fonts | Playfair Display via `@expo-google-fonts/playfair-display` |
| Icons | `@expo/vector-icons` (Feather set) |
| Gestures | `react-native-gesture-handler` 2.32 + `react-native-reanimated` 4.5 |
| Date/time input | `@react-native-community/datetimepicker` 9.1 — native picker, wrapped by `components/DateTimeField.tsx` |

**Core mental model: role is per-event, not per-user.** There is no global "organizer" or "guest"
account type. The same user owns some events and is a guest on others. Ownership is decided per
event by comparing `event.owner_id` against the current session user (`useEvents().isOwner(event)`).
Owning an event and being a guest of it are mutually exclusive — an organizer is never seeded as a
guest of their own event, and `myInvitations()` excludes owned events so nothing can appear in both
Home sections.

**UI language is mixed and unresolved.** Guest-facing event tabs and most newer copy are Romanian;
the organizer flows (Home, create-event, edit forms, Profile, Auth) are English. This is a known
inconsistency, not a deliberate scheme.

---

## 2. Architecture

### Folder structure

```
app/                  Expo Router routes (see §4)
components/           Shared UI; components/guest/ = guest event-page specific
hooks/                Context providers + their consumer hooks (the state layer)
data/                 Supabase client + the content repository seam
types/                Shared TS types (event.ts, guest.ts)
utils/                Theme tokens, formatters, storage, pure helpers
supabase/migrations/  SQL migrations (written, NOT applied — see §3)
assets/               Icons and splash images
ios/ android/         Native projects from expo prebuild
```

### There is no `services/` layer

Earlier plans described `services/auth.ts`, `services/events.ts`, `services/rsvp.ts`. **These do not
exist.** The equivalent seam is now four files, two per mode:

- **`data/eventContentRepository.ts`** — `localRepository`, used only when `mode === 'local'`. Pure
  synchronous object builders (`createMoment`, `sendMessage`, etc.); `load` always returns blank
  content because local mode's real state lives in the `useEventContent` query cache, not here.
- **`data/remoteEventContentRepository.ts`** — `remoteRepository`, used only when `mode === 'supabase'`.
  Real async Postgres queries via the `supabase` client, covering every mutation `useEventContent`
  exposes (see §3 for what's deliberately not wired — Realtime, `contribute`).
- **`data/eventsRepository.ts`** — the Supabase-mode counterpart for events + guests: `fetchEvents`,
  `fetchEventById`, `insertEvent`, `updateEventRow`, `respondToInviteRow`, `removeGuestRow`. Local
  mode's equivalent is still `utils/storage.ts` (`loadEvents`/`saveEvents`, AsyncStorage).
- **`hooks/*.tsx`** — the hooks screens call for data + actions. `useEvents` and `useEventContent` are
  now **plain hooks backed by `@tanstack/react-query`, not Context providers** — see §2 State layer for
  why the old `EventsProvider`/`EventContentProvider` wrappers were removed. Every action in
  `useEvents`/`useEventContent` still branches on `useAuth().mode` internally and calls the matching
  repository; screens never see the branch, and never import `supabase` directly — keep it that way,
  route new backend calls through a repository or a hook.

`types/supabase.ts` holds the Postgres row shapes (snake_case, matching the migrations exactly) that
`eventsRepository.ts`/`remoteEventContentRepository.ts` map onto the camelCase-ish app types in
`types/event.ts`/`types/guest.ts`. `utils/reportError.ts` is the shared `Alert.alert` surface for
Supabase-mode failures — mutations there are fire-and-forget from the screen's perspective (no loading
state), so a failed write needs to announce itself rather than fail silently.

### State layer (`hooks/`)

Provider nesting in `app/_layout.tsx`, outermost first:

```
GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → AuthProvider
  → EventDraftProvider → AuthGate → Stack
```

**`useEvents` and `useEventContent` are plain hooks, not Context providers — this changed this pass.**
Before, `EventsProvider`/`EventContentProvider` held the events list and per-event content in React
`useState`, mounted once at the root so every screen shared the same instance. Both are now backed by
`@tanstack/react-query`'s `QueryClient` cache instead: `useEvents()`/`useEventContent(eventId)` call
`useQuery`/`useMutation` directly, wherever they're called from. This works because the `QueryClient`
itself — not a component's position in the tree — is what's shared: every call site addressing the
same query key reads/writes the same cache entry, so removing the providers changed nothing about
which screens see which data. `EventContentProvider` used to have to live at the app root specifically
"because owner screens outside the tab navigator mutate the same content state" (edit-event, schedule,
venue, fund, post-moment); that constraint is gone now for the same reason.

**Query keys:** `['events', mode, userId]` (one list per auth mode + signed-in user; local mode's
"user" is the per-device identity — see §2 Auth flow) and `['eventContent', mode, eventId]` (the whole
`EventContent` blob per event — moments, reactions, messages, photos, fund, contributions, schedule,
venue, menu, seating tables, accommodations, vendors — still fetched as ten parallel queries by
`remoteRepository.load` and cached as one object, unchanged from before). There is no separate
`['event', eventId]` key: nothing fetches a single event independently of the list today, so `getEvent`
still just derives from the cached `events` array, same as before.

**Mutations replace the old manual "refetch after insert" convention with `invalidateQueries`.** Every
Supabase-mode write in `useEvents`/`useEventContent` runs through a `useMutation`, and its `onSuccess`
calls `queryClient.invalidateQueries({ queryKey })` instead of a hand-rolled `refetch()`/`refreshContent()`
call — this is the actual fix for the repeated "list doesn't reflect a recent change until app
restart" class of bug (hit before on the guest list, see §3's "Add guest by email" incident). A few
mutations (`removeGuest`, `updateMyDietaryPreferences` in Supabase mode) also patch the cache
optimistically in `onMutate` for instant UI feedback, then invalidate on `onError` to reconcile with
the server — same shape as their pre-migration optimistic-update + catch-and-refetch code. Local mode's
mutations (`mode === 'local'`) don't need any of this — they patch the query cache directly via
`queryClient.setQueryData` (and, for events, persist to AsyncStorage in the same call) since there's no
server round trip to wait on. **No `services/` file and no direct `@/data/*` import was added to any
screen by this pass** — the repository seam described just above this section is unchanged; only what's
*inside* `useEvents.tsx`/`useEventContent.tsx` changed. `QueryClient` defaults (`app/_layout.tsx`):
`staleTime: 30s`, `gcTime: 5min`, query `retry: 2`, **mutation `retry: 0`** (retrying a failed
insert/update against Supabase risks a duplicate write, unlike a read).

**Not done this pass, on purpose:** Supabase Realtime. The prompt that requested this migration assumed
`messages`/`photos`/`moments`/`reactions` already had `supabase.channel()` subscriptions to wire into
the query cache via `setQueryData` — they don't; see §7, this has never been built here. Adding Realtime
was out of scope for an infra-only pass and would have been new functionality, not a refactor.

| Hook | Owns |
| --- | --- |
| `useAuth` | Supabase session or a local fallback identity; `signIn/signUp/signOut`, `mode: 'supabase' \| 'local'`, `hasCompletedOnboarding`/`markOnboardingComplete`. Still a Context provider — session state is push-driven via `supabase.auth.onAuthStateChange`, not a fit for query-style pull fetching, and it isn't a resource that exhibited the staleness bug this pass fixes |
| `useEvents` | The events list — AsyncStorage in local mode, Postgres in Supabase mode, `['events', mode, userId]` — `createEvent` (async), `updateEvent` (async), `respondToInvite`, `removeGuest`, `addGuest` (async, Supabase-only), `isOwner` |
| `useEventContent` | Per-event content keyed by `['eventContent', mode, eventId]`: moments, reactions, messages, photos, fund, contributions, schedule, venue, plus all their mutations — local `setQueryData` or Supabase write-then-invalidate, per mode |
| `useEventDraft` | The 4-step create-event wizard draft (in-memory, not persisted) — still a Context provider, this is genuinely ephemeral UI state, not a fetched resource |
| `useGuestEvent` | Provides `{ id, name, event }` to the guest tabs, derived from `useEvents().getEvent(id)` — **see the gotcha below** |

**Critical gotcha — do not regress this.** `useLocalSearchParams` inside a tab child (`guest/[id]/detalii`)
does **not** see the `[id]` param, which belongs to the parent layout route. Reading it there returns
`undefined`, which silently blanked every tab for several passes. The layout reads the param once and
passes it down via `GuestEventProvider`; `useGuestEvent` throws if used outside that provider rather
than returning empty strings. Any new nested route must follow the same pattern.

Owner screens outside the tab navigator (edit-event, schedule, venue, fund, post-moment) mutate the
same content as the guest tabs for free, with no provider needed above either — see the state-layer
note above. There's no manual "cache self-heals after session change" logic to maintain either: the
query key includes `mode`, so signing out/in (or switching modes) addresses a different cache entry
outright rather than needing an effect to notice the session changed and drop stale data.

### Auth flow

- Email/password via Supabase Auth. `data/supabaseClient.ts` reads `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_KEY` (the `_ANON_KEY` spelling is also accepted) from `.env.local`, which is
  gitignored. `.env.example` documents them.
- **If the env vars are absent the app falls back to a local device identity** (`mode: 'local'`) so it
  still runs without a backend. The redirect-to-`/auth` half of the gate is disabled in that mode (see
  below) — the onboarding half still applies, using the local device identity as the "account."
- `components/AuthGate.tsx` wraps the router and does two independent jobs, both re-running on every
  auth change so a sign-out, expiry, or fresh sign-in is caught immediately:
  1. Redirects to `/auth` when there is no session and the current route isn't public (`auth`,
     `onboarding`, `invite`) — Supabase mode only, per the local-mode exception above.
  2. Once a session exists, checks `useAuth().hasCompletedOnboarding()` **once per signed-in session**
     (a ref keyed on user id guards against re-checking on every navigation) and redirects to
     `/onboarding` if it's false.
- **Routing, current:** splash → (nothing splash-specific to decide anymore) → whatever route was
  already current, which `AuthGate` then corrects: no session → `/auth`; session but onboarding not
  yet completed for this account → `/onboarding`; session and onboarding done → left alone (normally
  Home). Onboarding is reached **after** authentication now, exactly once per account (any device, in
  Supabase mode — see §3), not on first app launch. `app/onboarding.tsx`'s `finish()` (tapping the
  last step's "Începe," or "Sari peste" to skip) calls `markOnboardingComplete()` and routes to `/`,
  not `/auth` — see §3 and §4 for what changed and why.
- **The connected project has email confirmation ON** (`mailer_autoconfirm: false`, checked against
  the live settings endpoint). Sign-up therefore returns *no session* — the Auth screen shows
  "Account created. Confirm your email, then sign in." and switches to sign-in mode. Turn off
  "Confirm email" in Authentication → Providers → Email for a straight-through test flow. Practical
  effect on onboarding: since sign-up alone never establishes a session, "first time completing auth"
  in practice means the first successful *sign-in* after confirming — `AuthGate` only ever sees a
  transition from `user: null` to a real session, so this needs no special-casing.
- **Auto-linking pre-existing invitations on signup — built, not a gap anymore.** An earlier version of
  this file said this didn't exist; it does now (`supabase/migrations/20260810000003_guest_autolink.sql`,
  documented under §3's "Add guest by email"). Leaving this note here since it was wrong here
  specifically for a while.

---

## 3. Data model

### Reality check

Eight migration files exist under `supabase/migrations/`:

- `20260810000001_initial_schema.sql`
- `20260810000002_rls_policies.sql`
- `20260810000003_guest_autolink.sql` — **applied, confirmed by the user.** Two triggers
  (`link_guest_on_invite` on `event_guests` insert, `link_invites_on_signup` on `public.users` insert)
  that connect a `guest_email` invite to a real `guest_user_id` in whichever direction happens first,
  plus a unique index on `(event_id, lower(guest_email))` so the same email can't be invited twice to
  one event. See "Add guest by email" below for why this had to be built rather than assumed to exist.
- `20260810000004_backfill_guest_links.sql` — **one-time data fix, applied status not yet confirmed.**
  `link_guest_on_invite` only runs on `INSERT`, so `event_guests` rows created before
  `20260810000003` was applied never got linked even though a matching `public.users` row exists —
  this updates those rows in place. Idempotent (only touches rows still missing a link), so re-running
  it is harmless. See "Add guest by email" below for the incident that surfaced this.
- `20260810000005_reset_test_data_fn.sql` — **applied status not yet confirmed.** Adds
  `public.reset_test_data()`, a `security definer` function (`execute` granted only to `service_role`)
  that `truncate`s `events cascade` — everything except `users`. Backs `npm run reset-test-data`; see
  "Working on this project" below.
- `20260810000006_onboarding_flag.sql` — **applied status not yet confirmed.** Adds
  `has_completed_onboarding boolean not null default false` to `public.users`. No RLS change — the
  existing "users update own row" policy already covers it. See "Post-auth onboarding" below.
- `20260810000007_photo_attribution.sql` — **applied status not yet confirmed.** Adds
  `photos.uploaded_by_label text` plus a one-time backfill joining existing rows to
  `users.display_name`. Same denormalization reasoning as `messages.sender_label` — see "Photo grids
  and attribution" below.
- `20260810000008_detalii_sections.sql` — **applied status not yet confirmed.** Four new tables
  (`menu`, `seating_tables`, `accommodations`, `vendors`) with the same RLS shape as
  `schedule_items`/`venue_info` (organizer manages, anyone on the event reads), plus
  `event_guests.dietary_preferences text[]` — no new policy needed there, "update own rsvp or as
  organizer" already covers any column on a guest's own row. See "Detalii — menu, seating,
  accommodation, vendors" below.

**The first three are applied.** The user ran them against the connected project (not this session —
no DB password/service-role key/CLI is available here, only the anon key). The first two were verified
from this session by an anonymous `select` against all 11 base tables: every one returns `200` with an
empty array (RLS correctly denies rows to a request with no `auth.uid()`), where `events` previously
returned `PGRST205`. **This only confirms the schema exists** — it does not confirm a real signed-in
write round-trips, since there's no way to authenticate as a real user from this environment. Treat
writes as typecheck/bundle-verified only until exercised from the running app. Migrations 3, 5, 6, 7,
and 8's applied status can't be confirmed the same way — PostgREST's schema endpoint doesn't expose
triggers, functions, or (without an authenticated request) new tables/columns — so those are taken on
the user's word (migration 3) or not yet confirmed at all (5, 6, 7, 8), not independently re-checked.

**Post-auth onboarding.** The 4-step tutorial (`app/onboarding.tsx` — content, design, and swipe
mechanics all unchanged) moved from "before Auth, once per device" to "after Auth, once per account."
`useAuth()` gained `hasCompletedOnboarding()` and `markOnboardingComplete()`: local `AsyncStorage`
cache first (`utils/onboarding.ts`, keyed per account id so a second account on the same device can't
inherit or clobber the first one's state), `public.users.has_completed_onboarding` as the source of
truth in Supabase mode when the cache is empty. `components/AuthGate.tsx` now does two jobs instead of
one — see §2 Auth flow for the routing mechanics — checking onboarding status exactly once per
signed-in session via a ref keyed on user id, not on every navigation. In local mode there's no
`public.users` row to check, so the cache alone decides — the closest available equivalent to "per
account," since local mode's "account" is just a per-device generated identity to begin with.
`markOnboardingComplete()`'s Supabase write is fire-and-forget/best-effort, same reasoning as
`utils/storage.ts`'s `saveEvents`: a failed background sync means the tutorial shows again on another
device, not data loss. `utils/firstLaunch.ts` (the old AsyncStorage-only, per-device, pre-auth flag)
is deleted, not deprecated — nothing referenced it after this pass.

**Client code can never look up another user by email — don't reintroduce this.** `public.users`'
only `select` policy is `id = auth.uid()`; a signed-in session can read its own row and nothing else.
Any "look up this email, then set guest_user_id" step has to happen in a `security definer` trigger
(bypasses RLS by design), never in application code — a client-side version wouldn't error, it would
just silently find zero rows every time and look exactly like "no account exists." This is why
`data/eventsRepository.ts`'s `insertGuestInvite` doesn't attempt this lookup itself: `Direction 1` in
`20260810000003_guest_autolink.sql` already does it, and it's the only place it can correctly happen.

**Where data lives, by auth mode** (`useAuth().mode`, derived once from whether
`EXPO_PUBLIC_SUPABASE_URL`/`KEY` are set — see §2 Auth flow):

- **`mode: 'local'`** (no Supabase env vars) — unchanged: events + guests in AsyncStorage
  (`povesteanoastra:events:v1`), all per-event content in-memory only via the `useEventContent` query
  cache, lost on restart. This path still exists and still works so the app runs without a backend.
- **`mode: 'supabase'`** — events, guests, and all per-event content now read and write Postgres for
  real, through `data/eventsRepository.ts` and `data/remoteEventContentRepository.ts`. Every hook
  action in `useEvents.tsx`/`useEventContent.tsx` branches on `mode`; there is no shared code path
  between the two, by design — the local reducer logic couldn't be reused since `localRepository.load`
  is a stateless stub (returns blank content every call; local mode's real state lives only in React),
  whereas the Supabase path re-reads from Postgres after every mutation. **Don't assume a write reaches
  Supabase without checking which mode the app is in.**

**Two things this pass deliberately didn't do:**

- **Realtime is still unused.** The RLS migration adds `messages`/`photos`/`moments`/`moment_reactions`
  to the `supabase_realtime` publication, and that's still all that happened — no `supabase.channel()`
  subscriptions exist anywhere. Every screen is request/response: write, then re-`load()` that event's
  content. Multi-device live updates (e.g. Chat) need an explicit subscription pass.
- **`contribute()` stays local-only and unused.** The `contributions` table has no client insert policy
  on purpose (`supabase/migrations/20260810000002_rls_policies.sql`: written by a Stripe webhook using
  the service role, never the client), so `remoteEventContentRepository.ts` has no `contribute`
  function at all — adding one would either violate that policy or silently fail. `checkout/[id].tsx`
  is still a stub and never calls it, in either mode.

**Known limitation carried over, not fixed by this pass — invite preview under RLS.** The `events`
select policy is `organizer_id = auth.uid() or is_event_guest(id)`. A person who is neither yet — i.e.
anyone opening a *fresh* invite link before they've RSVP'd — cannot `select` the event to preview it,
because becoming a guest (via `event_guests` insert) and being allowed to view the event are
chicken-and-egg under the schema as written. This was never really exercised before either: invite
links are local deep links that only resolve on the device that created the event (§7), so a genuine
second-account, cold-open test was never possible. `app/invite/[id].tsx`'s `getEvent(id)` now reads
from the Supabase-backed events list in `useEvents`, which only contains events you already organize
or are already a guest of — so this screen still works for an organizer previewing their own event
(`is_event_organizer` is true), but a truly new guest account hits "Invitation not found." Fixing this
for real needs either an organizer-driven "invite specific guest by email" flow (matching what the
schema's `event_guests` insert policies actually assume) or a deliberately looser `events` select
policy — a security-relevant schema change, not something to bundle in silently.

**Fixed — organizer's own "Preview as guest" no longer attempts a real RSVP write.**
`app/invite/[id].tsx` is a single screen serving two purposes: the real guest-facing invite/RSVP page,
*and* the "Preview as guest" view the organizer reaches from their own dashboard (`event/[id].tsx`)
and from the create-event flow's share step (`create/share.tsx`). Both routes land on the same
component. Tapping "Confirm attendance"/"Can't make it" as the organizer used to call
`respondToInvite`, which tried to insert an `event_guests` row with `guest_user_id = auth.uid()` for
their own event — rejected by RLS 42501, since "guest claims own invite" requires `not
is_event_organizer(event_id)`. `respond()` short-circuits on `owner` as defense in depth, but the real
fix is in what renders: when `owner` is true and `showChoices` would otherwise be true, the RSVP
buttons don't render at all — the organizer's footer is just a single primary "Go to your event"
button, navigating to `/guest/${event.id}` (same route the non-organizer's "already responded" branch
uses), landing on Acasă. Went through one intermediate design (disabled buttons + a "Preview only"
caption below them) before landing here on hiding them outright — simpler, and the disclaimer had
nothing left to explain once the buttons were gone. A real, non-organizer guest is completely
unaffected by any of this — same buttons, same call, unchanged. Fixed the same visit: `myRsvp` used to
look up `SELF_GUEST_ID`, a local-mode-only sentinel that never matches a real Supabase `event_guests`
row id, so a genuine Supabase-mode guest who'd already RSVP'd would never see their confirmed/declined
state — only ever the raw choice buttons again. In `mode: 'supabase'`, `myRsvp` is now
`event.guests[0]`, which is correct because RLS already limits a non-organizer's `event.guests` to
just their own row.

This is what actually completes the create-event flow: create → preview (`create/preview.tsx`) →
share (`create/share.tsx`) → "Preview as guest" → this screen → into the real event dashboard.

**Fixed — Home's "My invitations" card ignored RSVP status entirely.** Tapping any invitation card
navigated straight to `/guest/${event.id}` (the 6-tab event detail view) regardless of whether the
guest had responded yet — including a `pending` invite, which should open this screen
(`app/invite/[id].tsx`) instead. Traced before touching anything: `invitation.guest.status` was
correct and current at tap time (`myInvitations()` builds it from live `events` state, and
`data/eventsRepository.ts`'s `mapGuestRow` passes `rsvp_status` through unchanged — no stale read, no
enum-casing mismatch). The bug was structural, not a data bug: `app/index.tsx`'s `onPress` for
`InvitationListItem` had no conditional on status at all, just one hardcoded `router.push`. Fixed by
branching there — `pending` → `/invite/${id}`, `confirmed`/`declined` → `/guest/${id}` (matching where
this screen's own "already responded" branch already sends you). The pending → RSVP-screen →
"Confirm attendance" → `/guest/${id}` path was already correct and untouched by this fix — verified by
re-reading `respond()`/`showChoices` above, not assumed.

### Photo grids and attribution (Live, Album)

`components/guest/PhotoTile.tsx` now owns three things per tile, self-contained so both screens get
all three for free: a bottom gradient scrim + small white uploader-name caption (`photo.uploaded_by_label
?? 'Invitat'`), a tap-to-open full-screen lightbox (`Modal`, tap-anywhere or the × to dismiss, no
swipe-between-photos — wasn't asked for), and the existing long-press-to-delete, still gated on
`canDelete` but no longer disabling the whole tile the way it used to (viewing must always work, even
for a photo you can't delete — only `onLongPress` is conditional now). The `style` prop's contract
changed: it now sizes a wrapping `View` (needs `overflow: 'hidden'` for the scrim/image to respect
rounded corners — already set inside `PhotoTile`'s own base style, callers don't need to add it), not
an `Image` directly as before.

- **Album** — grid went from 2 columns (`47.5%` tiles) to 3 (`31%`), tighter gap. No structural
  scroll change needed: the grid already lives inside `GuestScreen`'s own page-level `ScrollView`.
- **Live** — hero shrunk (180 → 140 tall); the old `rest.slice(0, 4)` hard cap on the small-tile row
  is gone. Tiles are now small, fixed 56×56 squares that wrap in a `ScrollView` bounded to
  `maxHeight: 190` (`nestedScrollEnabled`, standard/safe nested-vertical-scroll pattern) inside the
  dark card, so the card stays visually bounded while every photo past the hero is still reachable by
  scrolling, not silently dropped past the 5th.

**Attribution can't be a live join — same RLS wall hit twice before in this project.**
`public.users`' only `select` policy is `id = auth.uid()`, so a client-side embed like `.select('*,
users(display_name)')` on `photos` would silently return `null` for every uploader except the current
session's own row. `20260810000007_photo_attribution.sql` denormalizes instead — adds
`photos.uploaded_by_label`, following the exact pattern `messages.sender_label` already established
for the identical reason. `remoteEventContentRepository.ts`'s `addPhoto` does a self-select
(`users` where `id = auth.uid()` — allowed, it's your own row) for `display_name` right before
inserting, falling back to `actor.label` (email) if that returns nothing. Local mode's `addPhoto` has
no `public.users` to query, so it just uses `actor.label` directly.

### Detalii — menu, seating, accommodation, vendors

Four sections added after Locație, in this order: Meniul serii, Așezarea la mese, Cazare recomandată,
Cei care fac totul posibil. Each follows the section shape already established by Programul/Locație
(`SectionLabel` + owner-only edit/add icon in a `sectionHead` row), plus a one-line `sectionDescription`
underneath — new for these four; **Programul zilei and Locație deliberately don't have one**, so don't
add it there to "match" — that was explicitly out of scope for this pass, only the position of those
two sections in the scroll order changed.

- **Meniul serii** — single record like `venue`/`fund` (`content.menu: Menu | null`, `app/menu/[id].tsx`
  composer edits `starter`/`main`/`dessert` as one save). Below the three courses, non-organizer guests
  see four dietary-preference pills (`Vegetarian`, `Vegan`, `Fără gluten`, `Fără lactoză`) that toggle
  their own `event_guests.dietary_preferences`. Owners never see the pills — an organizer has no
  `event_guests` row for their own event to store a preference against, so there's nothing to toggle.
  `useEvents().updateMyDietaryPreferences(eventId, preferences)` is new — optimistic in Supabase mode
  (same convention as `myRsvp`/`myInvitations`: RLS already limits a non-organizer's `event.guests` to
  index `0`, so that's "my" row to patch), a plain in-memory patch on the `SELF_GUEST_ID` row in local
  mode. No new RLS policy needed — "update own rsvp or as organizer" already covers any column,
  including this new one, on a guest's own row.
- **Așezarea la mese / Cazare recomandată / Cei care fac totul posibil** — all three are plain
  per-event lists, same shape as `schedule_items`: `SwipeableRow` Edit/Delete, a composer at
  `app/table|accommodation|vendor/[id].tsx` (add with no `itemId`, edit with `?itemId=`), `EmptyState`
  with an owner-only CTA. Vendors additionally render a small category-derived emoji (keyword-matched
  in `detalii.tsx`'s local `vendorIcon()` — free-text category, not an enum, so this is a heuristic
  with a `🏷️` fallback, not a lookup table) and a "Vezi" button that calls `Linking.openURL` when
  `external_url` is set. The italic caption below the vendor list only renders once there's at least
  one vendor — showing "furnizorii tag-uiți își promovează serviciile" above an empty list read as
  premature.
- All four sections' repository/hook wiring is the exact same branch-on-mode, write-then-refetch
  shape as `saveScheduleItem`/`updateVenue` (§3's "Where data lives, by auth mode") — nothing new
  architecturally, just more instances of it. `data/remoteEventContentRepository.ts`'s `load()` grew
  from 6 to 10 parallel queries.
- **Guest-to-table assignment is out of scope, as specified** — the seating list is just a list; no
  guest is linked to a table yet. `seating_tables` has no guest-facing column for this at all.

### Add guest by email (owner only)

`app/add-guest/[id].tsx` — email (required, regex-validated) + optional name, "Send invite" button,
same composer shape as the moment/fund/schedule composers. Owner-only and Supabase-mode-only (local
mode has no `auth.users` to link against, so the screen shows a plain "not available" message rather
than a parallel local-only invite concept nobody asked for). Entry point: a small "+" (`user-plus`)
button in the "Guest list" section header on `app/event/[id].tsx`, plus an "Invite a guest" action on
that section's `EmptyState` when the list is empty — that screen already had the RSVP-count stats and
the swipe-to-remove guest list from earlier passes; this pass only added the missing way *into* it.

Submit flow: client-side checks first (valid email format; not the organizer's own email, compared
case-insensitively against `useAuth().user.email`) for a friendly inline error, then
`checkGuestEmailInvited` (a `select` against `event_guests`, called directly — read-only, no state to
keep in sync) for "This person is already invited" before ever attempting the insert, then
`useEvents().addGuest(eventId, email, name)`. Genuinely unexpected failures (network, anything past
those two checks) fall back to `reportSupabaseError`'s `Alert.alert`, not an inline message — the
inline slot is reserved for the two conditions the user can actually fix by editing the field.

**Fixed — the guest list and RSVP counts didn't update until app restart.** `addGuest` didn't
originally exist on `useEvents`; the composer called `data/eventsRepository.ts`'s `insertGuestInvite`
directly. That insert genuinely succeeded (the row was really in `event_guests`), but nothing told
`EventsProvider`'s `events` state about it — `app/event/[id].tsx`'s guest list and RSVP stats read
`event.guests` from that state, which stayed stale until the next full `fetchEvents()` on app launch.
This was the *only* screen in the app with this shape of bug: every other composer (schedule, venue,
fund, moments) was already routed through `useEventContent`'s actions, which have had a
write-then-refetch step since the data layer was built (confirmed by grepping `app/` and `components/`
for direct `@/data/*` imports — add-guest was the sole hit). `useEvents` now has an `addGuest` action
that calls `insertGuestInvite` then `fetchEventById` and patches the result into `events` state —
refetching the single event rather than patching optimistically, because `on_event_guest_insert` may
have auto-linked `guest_user_id` server-side and the client has no way to know that outcome ahead of
the round trip. The composer calls this instead of the repository function directly now.

**A prompt claimed "this relies on the existing auto-link trigger from v4" — that trigger did not
exist.** Checked directly: `20260810000001_initial_schema.sql`'s only trigger is `handle_new_user`,
which mirrors `auth.users` into `public.users` and never touches `event_guests`; grepping the whole
app for any client-side linking logic turned up nothing either. This matches what this file already
said in §7 ("Auto-linking pre-existing invitations on signup does not exist... never built") — another
case of a prompt describing a pass that was never actually built here (see the project's own memory
note on this pattern). Without it, `insertGuestInvite`'s row would sit with `guest_user_id = null`
forever, and the invited person's account would never see the event under "My invitations." Added it
for real as `20260810000003_guest_autolink.sql` (see the Reality check above) — it was necessary
infrastructure for this feature to do what it claims, not scope creep.

**Also fixed in the same pass, for the same reason:** `utils/invitations.ts`'s `myInvitations()` had
the identical `SELF_GUEST_ID`-lookup bug already fixed once in `app/invite/[id].tsx`'s `myRsvp` — it
never matches a real Supabase `event_guests` row id, so a genuine Supabase-mode invited guest would
never show up under Home's "My invitations" section at all, regardless of whether auto-link worked.
`myInvitations` now takes a `mode` parameter and, in `'supabase'` mode, reads `event.guests[0]` instead
(same reasoning as `myRsvp`: RLS already limits a non-organizer's `event.guests` to their own row).
Without this fix, the feature's own stated verification step — "confirm the event appears in that
account's My Invitations" — could not have passed even with auto-link working correctly.

**Follow-up incident, same day:** a live-data check found an `event_guests` row invited by email to an
already-registered account, sitting with `guest_user_id` still null. The request that followed asked
for a client-side "look up the email, then set guest_user_id" step on the insert path — that can't
work (see the Reality check above: `public.users` RLS only allows reading your own row) and would have
been redundant besides, since `link_guest_on_invite` (direction 1 of `20260810000003`) already does
exactly this, server-side, at insert time. The real explanation: that specific row predated the
trigger — it was applied later than some of the early test invites. `20260810000004_backfill_guest_links.sql`
fixes existing rows like it in place; nothing about the ongoing insert path needed to change.

### Schema as written in the migrations

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `id` (FK `auth.users`), `email`, `display_name`, `has_completed_onboarding` | Populated by an `on_auth_user_created` trigger; `has_completed_onboarding` added by `20260810000006` |
| `events` | `id`, `organizer_id`, `type` (enum), `name`, `event_date`, `location`, `welcome_message` | `event_type` enum: wedding, baptism, birthday, cause, corporate, memorial, other |
| `event_guests` | `id`, `event_id`, `guest_user_id` (nullable), `guest_email`, `guest_name`, `rsvp_status`, `invited_at`, `responded_at`, `dietary_preferences text[]` | Partial unique index on `(event_id, guest_user_id)`; `rsvp_status` enum: pending, confirmed, declined; `dietary_preferences` added by `20260810000008` |
| `schedule_items` | `id`, `event_id`, `time`, `title`, `location`, `sort_order` | Detalii tab |
| `venue_info` | `id`, `event_id` (unique), `name`, `address`, `notes text[]` | Separate table, not folded into `events` — optional and separately edited |
| `moments` | `id`, `event_id`, `organizer_id`, `title`, `photo_url` | Acasă feed |
| `moment_reactions` | `id`, `moment_id`, `user_id`, `reaction_type` | Enum: love, celebrate; unique per user per type |
| `messages` | `id`, `event_id`, `sender_id`, `sender_label`, `content` | Chat |
| `fund` | `id`, `event_id` (unique), `title`, `description`, `target_amount`, `current_amount`, `currency` | One fund per event |
| `contributions` | `id`, `fund_id`, `contributor_name`, `amount`, `stripe_payment_id` | |
| `photos` | `id`, `event_id`, `uploaded_by`, `uploaded_by_label`, `url` | Shared by Live and Album |
| `menu` | `id`, `event_id` (unique), `starter`, `main`, `dessert` | Added by `20260810000008`; one per event, like `venue_info`/`fund` |
| `seating_tables` | `id`, `event_id`, `name`, `label`, `seat_count`, `sort_order` | Added by `20260810000008`; Detalii tab |
| `accommodations` | `id`, `event_id`, `name`, `detail_line`, `price_line`, `sort_order` | Added by `20260810000008`; Detalii tab |
| `vendors` | `id`, `event_id`, `name`, `category`, `handle`, `external_url`, `sort_order` | Added by `20260810000008`; Detalii tab |

### RLS logic in plain English

Three `SECURITY DEFINER` helpers back the policies (`is_event_organizer`, `is_event_guest`,
`can_view_event`) — they exist to avoid recursive policy evaluation between `events` and
`event_guests`.

- **Events:** you see events you organize or are a guest of. Only the organizer updates or deletes.
- **Guest list:** organizers see and manage the whole list; a guest sees only their own row and can
  update only their own RSVP **or their own `dietary_preferences`** (`20260810000008`) — same policy,
  no column-level restriction, so it already covered this before the column existed. The insert policy
  blocks an organizer from adding themselves as a guest.
- **Schedule, venue, menu, seating, accommodations, vendors:** anyone on the event reads; only the
  organizer writes. All six now share this identical shape.
- **Moments:** anyone on the event reads; only the organizer writes.
- **Reactions:** anyone on the event may react, but only as themselves, and may only delete their own.
- **Messages:** anyone on the event reads and posts as themselves; you can delete your own message,
  and the organizer can delete any.
- **Fund:** anyone on the event reads; only the organizer manages.
- **Contributions:** readable by anyone on the event. **No insert policy on purpose** — these are meant
  to be written by a Stripe webhook using the service role, never from the client.
- **Photos:** anyone on the event reads and uploads as themselves; you can delete your own, and the
  organizer can delete any.

The RLS file also adds `messages`, `photos`, `moments` and `moment_reactions` to the
`supabase_realtime` publication, ready for when subscriptions are wired.

---

## 4. Screens and navigation

All routes live in a single flat root `Stack` (`headerShown: false` throughout — every screen draws
its own header). The only nested navigator is the guest event tabs.

| Route | Purpose |
| --- | --- |
| `app/_layout.tsx` | Providers, splash overlay, auth gate |
| `app/onboarding.tsx` | Once per account, after a session exists, 4 swipeable steps, exits to `/` |
| `app/auth/index.tsx` | Single screen, sign-in/sign-up modes toggled in place |
| `app/index.tsx` | Home — Your events + My invitations, floating "+" |
| `app/profile.tsx` | Account details and sign out |
| `app/create/type\|details\|preview\|share.tsx` | 4-step create-event wizard |
| `app/event/[id].tsx` | Organizer dashboard — RSVP counts and guest list |
| `app/guest/[id]/` | The 6-tab guest event page |
| `app/invite/[id].tsx` | RSVP screen — opened from an invite link by a real guest, *and* reused as the organizer's "Preview as guest" view (RSVP buttons render disabled for the organizer; see §3) |
| `app/edit-event/[id].tsx` | Owner: basic info only — name, date, location, welcome message. Reached from the "Edit event" button on `event/[id].tsx`, the organizer dashboard |
| `app/schedule/[id].tsx` | Owner: add or edit one schedule item (`?itemId=` for edit) |
| `app/venue/[id].tsx` | Owner: create or edit the venue |
| `app/menu/[id].tsx` | Owner: create or edit the menu (starter/main/dessert, one save) |
| `app/table/[id].tsx` | Owner: add or edit one seating table (`?itemId=` for edit) |
| `app/accommodation/[id].tsx` | Owner: add or edit one accommodation option (`?itemId=` for edit) |
| `app/vendor/[id].tsx` | Owner: add or edit one tagged vendor (`?itemId=` for edit) |
| `app/fund/[id].tsx` | Owner: create or edit the fund |
| `app/add-guest/[id].tsx` | Owner, Supabase mode only: invite a guest by email |
| `app/post-moment/[id].tsx` | Owner: moment composer |
| `app/checkout/[id].tsx` | Stubbed Stripe placeholder |

### Splash and onboarding

`components/BrandSplash.tsx` animates the brand mark's stroke via `strokeDashoffset` on an
`Animated.Value` (~2s total), then fades out. It calls `onReveal` *before* fading so the destination
screen is already mounted underneath — a cross-dissolve, not a cut. `onReveal` is a no-op now
(`app/_layout.tsx`) — splash no longer makes any routing decision itself; `AuthGate` handles Auth vs
Onboarding vs letting the current route stand once it's mounted underneath (see §2, §3). Onboarding
itself is unchanged: 4 paging-ScrollView steps with a segmented progress bar; only *when* it's shown
changed, via `useAuth()`'s `hasCompletedOnboarding`/`markOnboardingComplete` (§3) rather than
`utils/firstLaunch.ts`, which is deleted.

### The 6 guest tabs (`app/guest/[id]/`)

A persistent `EventHeaderBar` (back chevron + event name) sits above the tabs; back always returns to
Home regardless of active tab, via `router.navigate('/')`.

| Tab | File | Guest sees | Owner additionally sees |
| --- | --- | --- | --- |
| Acasă | `index.tsx` | Moment feed, reaction pills, fund promo card | "+" FAB → moment composer; swipe-left a moment to delete |
| Detalii | `detalii.tsx` | Schedule cards, venue + map + notes, menu + dietary pills, seating tables, accommodation options, tagged vendors | "+"/edit icon per section opens that section's composer; swipe-left a list row for Edit/Delete; empty-state CTAs open the matching composer. See §3 "Detalii — menu, seating, accommodation, vendors" for the four sections added this pass |
| Fond | `fond.tsx` | Fund card, progress bar, "Contribuie acum", Stripe disclaimer | Edit pencil + delete (trash) icon, top-right of the card; delete confirms via `confirmDelete`, warning about existing contributions when any exist; empty state with "Deschide un fond"; contribute button hidden |
| Chat | `chat.tsx` | Group chat; organizer messages render as purple bubbles | (same; delete is per-message, not per-role) |
| Live | `live.tsx` | Navy card, LIVE dot, hero + a bounded/scrollable filmstrip of small thumbs (not capped at 4 anymore), scannable QR, add-photo button | — |
| Album | `album.tsx` | Recap headline, 2 stat cards, 3-col photo grid, download/back buttons | — |

Chat swipe-to-delete is gated on `sender_id === user.id`, not on ownership. Photo deletion (Live and
Album) is long-press → confirm, allowed for the uploader or the owner.

### Editing model — three independent forms, each per-item where it applies

Basic info, schedule, and venue are three fully separate forms; none shows or requires fields from
the others.

- **`app/edit-event/[id].tsx`** — name, date, welcome message, and the top-level `location` string
  (the Home-card summary line, e.g. "aaaa · aaa"). Nothing else. Reached only from the "Edit event"
  button on the organizer dashboard (`app/event/[id].tsx`) — there is no entry point from the guest
  tabs, by design, since Detalii's pencils now point at the schedule/venue composers instead.
- **`app/schedule/[id].tsx`** — one schedule item (time, title, where) per visit. No `itemId` param =
  add mode, appending to `content.schedule`; `?itemId=<id>` = edit mode, prefilled, replacing that
  entry in place. Delete stays where it already worked: the swipe "Șterge" action on a Detalii
  schedule row, calling `deleteScheduleItem` directly — the composer itself has no delete control.
- **`app/venue/[id].tsx`** — venue name, address, practical notes (one per line). Always a full
  create-or-edit of the single `content.venue` record; there's one venue per event, so no `itemId`.

The moment composer (`post-moment/[id].tsx`) and fund composer (`fund/[id].tsx`) were already their
own screens and are the template this pass followed for schedule/venue.

### Date and time input

`components/DateTimeField.tsx` wraps `@react-native-community/datetimepicker` behind the same
label/box visual language as `Field`. Tapping opens the native picker — `spinner` display inline on
iOS with a "Done" button to collapse it, the native imperative dialog on Android (auto-dismisses on
select). Values are still plain strings in the data model (`AppEvent.date` as `YYYY-MM-DD`,
`ScheduleItem.time` as `HH:MM`) — only the *input method* changed; `utils/dateInput.ts` converts
between those strings and the `Date` object the picker needs. Used in `edit-event/[id].tsx` (date),
`create/details.tsx` (date), and `schedule/[id].tsx` (time). Display formatting elsewhere is
untouched (`utils/format.ts` → `formatEventDate`).

---

## 5. Design system

### Colors — three coexisting palettes (a known inconsistency)

| Source | Used by | Key values |
| --- | --- | --- |
| `utils/guestTheme.ts` → `brand` | Splash, Auth, onboarding, `BrandHeader`, `ScreenBackground` | cream `#FDF3EC`, gold `#F5C36B`, pink `#E8779E`, purple `#7F77DD`, navy `#2B2740`, lavender `#EAE4F0` |
| `utils/guestTheme.ts` → `guest` | The 6 guest event tabs | cream `#FDF3EC`, purple `#6C4CE0`, gold `#E8B54B`, navy `#1B2237`, blush `#FBE3DD`, live red `#E8524F` |
| `utils/theme.ts` → `colors` | Organizer screens (Home, create flow, edit forms, Profile) | primary `#6C4CE0`, success `#2E9E6B`, danger `#D9534F` |

The purple differs between `brand` (`#7F77DD`) and `guest`/`colors` (`#6C4CE0`), as does the gold.
Consolidating these is worthwhile but has not been done.

### Typography

Playfair Display (serif) for display text — wordmark, event names, headlines, large fund amounts,
the album headline. Loaded in the root layout, which returns `null` until fonts resolve. Body text is
the platform sans-serif. `fonts.displayBold` / `displayItalic` / `displayRegular` in `guestTheme.ts`.

### Brand mark and background

- `utils/brandMark.ts` holds the shared path geometry and gradient stops (gold → pink → purple) so the
  static and animated versions can never drift.
- `components/BrandMark.tsx` renders it statically; `BrandSplash` animates its own copy of the path.
- `components/BrandHeader.tsx` = mark + "Povestea" in navy + "Noastra" in purple. Used on **Home, Auth,
  onboarding**. This is the only wordmark treatment — do not restyle it per screen.
- `components/ScreenBackground.tsx` — cream wash `#FFF8F1 → #FBEAE0`, three soft circles (opacity
  0.10–0.11) and two edge-to-edge gradient lines (0.30 / 0.22), sized from `useWindowDimensions`,
  `pointerEvents="none"`. Applied to **Auth, Home, and all 6 guest event tabs** — the same component,
  unmodified; on the guest tabs it's mounted once in `app/guest/[id]/_layout.tsx`, behind
  `EventHeaderBar` and the `Tabs` navigator, so it stays fixed while each tab's content scrolls over
  it. `Screen` (organizer screens) and `GuestScreen` (guest tabs) both accept a `transparent` prop so
  their own solid fill doesn't cover it — every one of the 6 tab files now passes it, as does
  `EventHeaderBar` (its bar background is `transparent`) and the `Tabs` `sceneStyle`.
  **`checkout/[id].tsx` was deliberately left off** — it's not one of the 6 tabs and wasn't in scope.
  *Contrast over this background is unverified on device* — checked only by typecheck/bundle; all
  cards on these screens are opaque `guest.white`/`guest.navy` with a shadow, the same treatment
  already proven readable on Home's `EventListItem`/`InvitationListItem`, but re-verify by eye once
  the app runs.

### Tab bar

Full-width dark navy (`#1B2237`), 96px tall, hairline top border and an upward shadow. Active tab =
solid purple pill behind a white Feather icon; inactive = muted white outline icons. **It is not
floating, suspended or rounded** — earlier descriptions of it that way were aspirational.

### Component patterns

- **`EmptyState`** — the one empty-state treatment: white card, rounded, centered muted text, optional
  action slot. Used in the guest tabs (Acasă, Detalii, Fond, Chat, Album) and the organizer dashboard's
  guest list (`event/[id].tsx`). Use it for every new empty state **except** Home's two top-level
  sections — see `HomeEmptyState` below.
- **`HomeEmptyState`** — a richer, Home-only treatment for "Your events" / "My invitations" when
  either is fully empty: icon in a soft-purple circle (Feather, not emoji — these are UI chrome, not
  user content, so this follows the same convention as everywhere else), serif headline
  (`fonts.displayBold` from `guestTheme.ts`, same borrowed-font pattern the Auth screen already uses),
  one supporting line, and an optional pill-shaped CTA (`radius.pill`, `colors.primary` — deliberately
  not the standard `Button` component, which is rounded-rect at `radius.md`, not a pill). `ctaLabel`/
  `onPressCta` are both optional and only rendered together — "My invitations" has nothing actionable
  to offer, so it passes neither and stays purely informational. Kept as a separate component from
  `EmptyState` on purpose, so this redesign couldn't touch any of that component's other five call
  sites.
- **`SwipeableRow`** — swipe-left to reveal actions on full-width list rows, built on
  `ReanimatedSwipeable`. Edit = purple, Delete = red, white icon + label. One row open at a time via a
  module-scoped ref; scrolling closes open rows. Renders children plainly when `enabled` is false so
  guests' rows carry no gesture at all. **Tapping empty background does not close an open row** — only
  scrolling, swiping back, or opening another row.
- **Permanent icons stay** on singular, non-list items: the fund card's edit pencil and delete trash,
  the venue card's edit pencil, and the Detalii schedule section-header "+" (add, not edit — per-item
  edit/delete on existing schedule rows lives on `SwipeableRow` instead).
- **Photos use long-press**, never swipe — grid tiles are too small for horizontal gestures. Tap opens
  a full-screen viewer instead (`PhotoTile`, used by Live and Album — see §4 Photo grids).
- `Screen` / `GuestScreen` are the two page wrappers; `GuestScreen` deliberately omits the top safe-area
  inset because `EventHeaderBar` owns it (pass `topInset` for screens without that bar).

---

## 6. Conventions

- **`TouchableOpacity` for every pressable.** Not `Pressable`.
- **Feather icons for UI chrome** (navigation, back, close, edit, delete, add, chevrons). **Emoji only
  for content**: event-type icons (💍 🍼 🎂 💚 🏢 🕊️ ➕), user-authored moment titles, and the
  composer's preset emoji row.
- **Ownership** is always `useEvents().isOwner(event)` — never assume a global role. When a session
  exists it is strictly `event.owner_id === user.id`; in local fallback mode an event with no
  `owner_id` counts as owned. Home additionally hides events with no `owner_id` when signed in, so a
  new account never inherits leftovers from a previous build.
- **Deletes:** structural or costly → `confirmDelete()` from `utils/confirm.ts` (schedule items,
  moments, guests, photos). Low-stakes → immediate (chat messages).
- **No mock or seeded data.** A new event starts genuinely empty — no sample guests, no placeholder
  moments, no fake fund amounts, no invented contributor counts. Every screen must handle the empty
  case with `EmptyState`. This was a repeated source of confusion; do not reintroduce fixtures.
- **Identity in content actions** comes from the real session via the `Actor` type
  (`{ id, label }`), never a hardcoded constant.
- Styling is `StyleSheet.create` with tokens from the theme files — no inline magic numbers for
  colors, spacing or radii.

---

## 7. Not built / deliberately deferred

- **Supabase Storage uploads.** The data layer itself is built (see §3) — `mode: 'supabase'` really
  reads and writes Postgres for events, guests, schedule, venue, moments, reactions, messages, fund,
  and photos. But `addPhoto`/`createMoment` still store whatever URI `expo-image-picker` hands back
  (a local `file://`/`ph://` path on the device that picked it), not an uploaded file — so a photo/
  moment row written on one device has a `url`/`photo_url` that resolves to nothing on any other
  device or guest's screen. Fixing this needs an actual Storage bucket + upload step before the insert,
  swapping the local URI for the returned public URL.
- **Realtime.** Publication is configured (`supabase/migrations/...rls_policies.sql`) but nothing
  subscribes; every screen is request/response (see §3).
- **Stripe.** The fund UI is complete but `checkout/[id].tsx` is a placeholder screen — no payment,
  no Stripe Connect onboarding, no `contributions` writes (and none should be added client-side — see
  §3's note on why `contribute()` has no Supabase-mode implementation).
- **Real invites — partially built.** Server-side invite records now exist (Supabase mode:
  `app/add-guest/[id].tsx` writes a real `event_guests` row by email, auto-linked to an account via
  `20260810000003_guest_autolink.sql` — see §3). What's still missing: no email/SMS actually sent to
  the invitee telling them they were invited — they only find out by opening the app themselves and
  seeing it under "My invitations," which requires them to already know to check. The share sheet's
  `povesteanoastra://invite/<id>` deep link still only resolves on the device that created the event,
  and a genuinely new guest account still can't preview the event before RSVPing (§3's invite-preview
  limitation) — inviting by email doesn't fix that, since the not-yet-a-guest problem is about the
  `events` select policy, not about how the `event_guests` row was created.
- **Guest identity — mostly real now in Supabase mode.** `event_guests` rows carry a real
  `guest_email`/`guest_user_id`, auto-linked in either direction (§3). Local mode still uses the single
  local `SELF_GUEST_ID` row — no email concept there at all, since there's no `auth.users` to link
  against.
- No push notifications. No Google/Apple/social auth (email + password only). No video streaming —
  the Live tab is a photo feed. No venue/restaurant marketplace. No seating plans.
- **Album's "Descarcă toate pozele" button has no handler** — it is a dead control.
- **Moment comments.** The "Comentarii" link on a moment card navigates to the Chat tab; there is no
  comments table or thread UI.

---

## Working on this project

```bash
npx tsc --noEmit --noUnusedLocals   # types + dead imports
npx expo export --platform ios      # confirms the bundle builds
npx pod-install && npx expo run:ios # required after any native dep change
npm run reset-test-data             # wipes all event data in Supabase mode — see below
```

The owner of this repo builds and runs the app themselves. Do not claim a UI change is verified —
state exactly what was checked (typecheck, bundle) and what was not.

### `npm run reset-test-data` — full data wipe, dev/test only

`scripts/reset-test-data.js` calls `public.reset_test_data()` (a Postgres function added by
`supabase/migrations/20260810000005_reset_test_data_fn.sql`), which `truncate`s `events` — cascading
through FKs to `event_guests`, `schedule_items`, `venue_info`, `moments`, `moment_reactions`,
`messages`, `fund`, `contributions`, and `photos`. `public.users`/`auth.users` are untouched, so
accounts and sessions survive a reset.

**This is genuinely destructive and has no undo.** It also is **not** scoped to "your" test data —
there's no `is_test` flag or separate staging project anywhere in this setup, so it truncates
`events` for whoever is connected in `.env.local`. The script prints the target project URL and the
row count about to be deleted, then requires typing `RESET` to proceed (or `--yes`/`-y` to skip that
for scripted use) — don't remove that prompt.

Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (not the anon key — the whole point is bypassing
RLS to delete everything at once). **This key must never carry the `EXPO_PUBLIC_` prefix** — that
prefix is what makes Expo bundle a value into the client JS, and this key would let anyone who
extracted it wipe the whole project. Get it from Supabase → Settings → API → service_role (secret).
The reset function itself also only grants `execute` to the `service_role` Postgres role — even if
the RPC name leaked, the app's own anon-key session could never call it.
