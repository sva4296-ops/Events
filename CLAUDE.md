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
> dependency list — this is now also true of `@react-native-community/datetimepicker` and, added this
> pass, `expo-image-manipulator` (see §3's "Photo uploads — real Supabase Storage, dual-resolution");
> `pod-install`/rebuild is required before running, and the user runs that step themselves (see §6
> conventions on dev builds).
>
> **Local/offline mode was removed this pass — Supabase is now a hard requirement.** `data/supabaseClient.ts`
> throws at module load if `EXPO_PUBLIC_SUPABASE_URL`/`KEY` aren't set, rather than degrading to an
> in-memory/AsyncStorage fallback. This raises the stakes of the "never run on a device" caveat above:
> a misconfigured `.env.local` now means the app fails to start at all, not a degraded-but-working local
> mode — this specific failure path (the thrown error, and every real sign-in/RSVP/mutation flow it
> gates) is **unverified from this environment** the same as everything else marked unconfirmed below.

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
| Persistence | None client-side — Supabase Postgres is the store of record, plus Supabase Storage for event photo files (see Backend below); AsyncStorage remains only for the Supabase auth session token and small local caches (onboarding-seen flag) |
| Backend | Supabase — **a hard requirement, unverified from this environment**; see §3. Postgres for all data; Supabase Storage for event photos only (a private `event-photos` bucket, signed-URL reads) — see §3's "Photo uploads" |
| Fonts | Playfair Display via `@expo-google-fonts/playfair-display` |
| Icons | `@expo/vector-icons` (Feather set) |
| Gestures | `react-native-gesture-handler` 2.32 + `react-native-reanimated` 4.5 |
| Date/time input | `@react-native-community/datetimepicker` 9.1 — native picker, wrapped by `components/DateTimeField.tsx` |
| Photo processing | `expo-image-manipulator` ~57.0.9 — client-side dual-resize (thumbnail + full) before every Live/Album photo upload, see §3 |
| Localization | `i18next` + `react-i18next`, English default, no device-locale detection — see §2 Localization |

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
exist.** The equivalent seam is two files:

- **`data/remoteEventContentRepository.ts`** — `remoteRepository`. Real async Postgres queries via the
  `supabase` client, covering every mutation `useEventContent` exposes (see §3 for what's deliberately
  not wired — Realtime, `contribute`). Also exports the `Actor` type (who's acting — id + label) that
  both this file and `useEventContent.tsx` use.
- **`data/eventsRepository.ts`** — the counterpart for events + guests: `fetchEvents`, `fetchEventById`,
  `insertEvent`, `updateEventRow`, `respondToInviteRow`, `removeGuestRow`, `insertGuestInvite`,
  `checkGuestEmailInvited`, `updateDietaryPreferencesRow`.
- **`hooks/*.tsx`** — the hooks screens call for data + actions. `useEvents` and `useEventContent` are
  **plain hooks backed by `@tanstack/react-query`, not Context providers** — see §2 State layer for why
  the old `EventsProvider`/`EventContentProvider` wrappers were removed. Screens never import `supabase`
  directly — keep it that way, route new backend calls through a repository or a hook.

**There is no local/mock mode anymore, and no `mode` branch to route around.** Earlier passes had a
`localRepository` (`data/eventContentRepository.ts`, deleted), an AsyncStorage events store
(`utils/storage.ts`, deleted), a local single-device guest sentinel (`utils/guests.ts`'s
`SELF_GUEST_ID`/`SELF_GUEST_NAME`, deleted), and `useAuth().mode: 'supabase' | 'local'` gating which path
every hook action took when Supabase env vars were absent. All of it is gone — `useAuth` has no `mode`
field, every hook action unconditionally calls the Supabase repository, and `data/supabaseClient.ts`
throws at load if it isn't configured rather than falling back to a local identity. Historical
"Fixed —" write-ups later in this file that mention `SELF_GUEST_ID` or "local mode" describe code as it
existed *at the time of that fix* — kept for incident history per this file's own convention, not
current architecture. If you're looking for local/offline support to build a similar fallback: it doesn't
exist here anymore, by deliberate choice — see the top of this file for the removal note.

`types/supabase.ts` holds the Postgres row shapes (snake_case, matching the migrations exactly) that
`eventsRepository.ts`/`remoteEventContentRepository.ts` map onto the camelCase-ish app types in
`types/event.ts`/`types/guest.ts`. `utils/reportError.ts` is the shared `Alert.alert` surface for
Supabase-mode failures — mutations there are fire-and-forget from the screen's perspective (no loading
state), so a failed write needs to announce itself rather than fail silently.

### State layer (`hooks/`)

Provider nesting in `app/_layout.tsx`, outermost first:

```
GestureHandlerRootView → SafeAreaProvider → ThemeProvider → QueryClientProvider → AuthProvider
  → EventDraftProvider → AuthGate → Stack
```

`ThemeProvider` sits outside `QueryClientProvider` because `AppShell` (the component that actually
renders `Stack`, inside `app/_layout.tsx`) reads `useTheme()` to drive `StatusBar` style and the
`Stack`'s `contentStyle` background — it has to be a descendant of the provider, not a sibling.

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

**Query keys:** `['events', userId]` (one list per signed-in user) and, per event, three separate keys
instead of one — `['eventContent', 'social', eventId]`, `['eventContent', 'details', eventId]`,
`['eventContent', 'contributions', eventId]`. These three used to be a single combined
`['eventContent', eventId]` query (`remoteRepository.load`, ten parallel Supabase calls merged
into one `EventContent` object); they were split so each could get its own `staleTime` — see the table
below. `data/remoteEventContentRepository.ts` now exposes `loadSocial`/`loadDetails`/`loadContributions`
instead of `load`, and `types/guest.ts` has `SocialContent`/`DetailsContent`/`ContributionsContent` as
the three slices; `EventContent` is now `SocialContent & DetailsContent & ContributionsContent`, and
`useEventContent`'s `content` is still that merged shape (`null` until all three queries have data at
least once) — **no screen changed**, only what feeds `content` underneath it. `loadContributions` looks
up the fund's id itself (a small extra `select`) rather than depending on `loadDetails`'s result, so
the three stay independent queries rather than a waterfall. There is no separate `['event', eventId]`
key: nothing fetches a single event independently of the list today, so `getEvent` still just derives
from the cached `events` array, same as before.

**`staleTime`/`gcTime` are explicit per query, not left on the global default** — the global
`QueryClient` config (`app/_layout.tsx`: `staleTime: 60s`, `gcTime: 5min`, `refetchOnReconnect: true`,
`refetchOnWindowFocus: false` — meaningless on RN, off rather than silently inert, `retry: 2`) is a
baseline every query below overrides:

| Query | staleTime | Why |
| --- | --- | --- |
| `events` | 30s | Bundles rarely-changing event fields (name/date/location) with the guest list + `rsvp_status`/dietary preferences, which change on guest action. One row, not two queries, so it takes the shorter of the two — every mutation touching it (`createEvent`, `updateEvent`, `removeGuest`, `addGuest`, `respondToInvite`, `updateMyDietaryPreferences`) already calls `invalidateQueries` in `onSuccess` too, so this is a drift safety net, not the primary update path |
| `eventContent` / `social` (moments, reactions, messages, photos) | 30s | Would be `Infinity` if Realtime subscriptions pushed updates into this cache directly — they don't (§7) — so `Infinity` would mean another guest's message/photo/moment never appears on this device until *this* device's own next mutation happens to invalidate the key. Using the same 30s treatment as a user-action list instead, until Realtime is actually built |
| `eventContent` / `details` (schedule, venue, menu, seating, accommodations, vendors, fund settings) | 3min | Owner-edited, rarely changing. Every mutation already invalidates this key explicitly, so the longer `staleTime` only affects how soon *other* devices/sessions notice an edit — switching between Detalii/Fond/other tabs within that window never triggers a background refetch |
| `eventContent` / `contributions` | 30s | Same "safety net, not primary path" reasoning as `events` — moot today since nothing writes contributions client-side (§7), but set correctly for when a Stripe webhook does |

**Not a query, so not in the table above:** session/identity data (current user, `has_completed_onboarding`).
A pass that categorized query-caching behavior assumed these were `useQuery`-backed too (`staleTime:
Infinity`, refetch only on explicit login/logout/signup/profile-update) — they're not; `useAuth` is
still a plain Context provider, deliberately (see the hook table below). That target behavior is what
it already does without any query involved: `onAuthStateChange` pushes session changes, nothing polls
on a timer, and `hasCompletedOnboarding()` runs exactly once per signed-in session via the `AuthGate`
ref. Converting session state to a query to formally match the category would be a bigger structural
change than this config pass, for no behavioral gain.

**Mutations replace the old manual "refetch after insert" convention with `invalidateQueries`.** Every
write in `useEvents`/`useEventContent` runs through a `useMutation`, and its `onSuccess` calls
`queryClient.invalidateQueries({ queryKey })` instead of a hand-rolled `refetch()`/`refreshContent()`
call — this is the actual fix for the repeated "list doesn't reflect a recent change until app
restart" class of bug (hit before on the guest list, see §3's "Add guest by email" incident). A few
mutations (`removeGuest`, `updateMyDietaryPreferences`) also patch the cache optimistically in
`onMutate` for instant UI feedback, then invalidate on `onError` to reconcile with the server. The one
exception is `contribute` (`useEventContent`) — a permanent stub with no Supabase counterpart by design
(the `contributions` table has no client insert policy; see §3), so it patches the cache directly via
`queryClient.setQueryData` rather than going through a mutation. It's never called by any screen today
(`checkout/[id].tsx` is still a placeholder). **No `services/` file and no direct `@/data/*` import was
added to any screen by this pass** — the repository seam described just above this section is
unchanged; only what's *inside* `useEvents.tsx`/`useEventContent.tsx` changed. See the `staleTime` table
above for per-query config; **mutation `retry: 0`** globally (retrying a failed insert/update against
Supabase risks a duplicate write, unlike a read).

**Not done this pass, on purpose:** Supabase Realtime. The prompt that requested this migration assumed
`messages`/`photos`/`moments`/`reactions` already had `supabase.channel()` subscriptions to wire into
the query cache via `setQueryData` — they don't; see §7, this has never been built here. Adding Realtime
was out of scope for an infra-only pass and would have been new functionality, not a refactor.

| Hook | Owns |
| --- | --- |
| `useAuth` | The Supabase session; `signIn/signUp/signOut`, `hasCompletedOnboarding`/`markOnboardingComplete`. No `mode` field — Supabase is the only path (see the top of this file). Still a Context provider — session state is push-driven via `supabase.auth.onAuthStateChange`, not a fit for query-style pull fetching, and it isn't a resource that exhibited the staleness bug the react-query pass fixed |
| `useEvents` | The events list, Postgres-backed, `['events', userId]` — `createEvent` (async), `updateEvent` (async), `respondToInvite`, `removeGuest`, `addGuest` (async), `isOwner` |
| `useEventContent` | Per-event content, three queries keyed by category (`social`/`details`/`contributions`, see the table above) merged into one `content: EventContent \| null`, plus all their mutations — Supabase write-then-invalidate (of the correct category key) |
| `useEventDraft` | The 4-step create-event wizard draft (in-memory, not persisted) — still a Context provider, this is genuinely ephemeral UI state, not a fetched resource |
| `useGuestEvent` | Provides `{ id, name, event }` to the guest tabs, derived from `useEvents().getEvent(id)` — **see the gotcha below** |
| `useTheme` | The Warm Story light/dark theme — `{ mode, override, tokens, setThemeMode }`. Still a Context provider, same reasoning as `useAuth`: `mode` is push-driven (system `useColorScheme()` unless the user overrides it in Profile), not a fetched resource. See §5 for the full token set and which screens actually consume it yet |

**Critical gotcha — do not regress this.** `useLocalSearchParams` inside a tab child (`guest/[id]/detalii`)
does **not** see the `[id]` param, which belongs to the parent layout route. Reading it there returns
`undefined`, which silently blanked every tab for several passes. The layout reads the param once and
passes it down via `GuestEventProvider`; `useGuestEvent` throws if used outside that provider rather
than returning empty strings. Any new nested route must follow the same pattern.

Owner screens outside the tab navigator (edit-event, schedule, venue, fund, post-moment) mutate the
same content as the guest tabs for free, with no provider needed above either — see the state-layer
note above. There's no manual "cache self-heals after session change" logic to maintain either: the
`events` query key includes `userId`, so signing out/in as a different account addresses a different
cache entry outright rather than needing an effect to notice the session changed and drop stale data.

### Auth flow

- Email/password via Supabase Auth. `data/supabaseClient.ts` reads `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_KEY` (the `_ANON_KEY` spelling is also accepted) from `.env.local`, which is
  gitignored. `.env.example` documents them.
- **If the env vars are absent, the app throws at module load rather than starting.** There is no
  local/offline fallback identity anymore (removed this pass — see the top of this file); Supabase
  configuration is a hard requirement, not an optional path with a degraded mode behind it.
- `components/AuthGate.tsx` wraps the router and does two independent jobs, both re-running on every
  auth change so a sign-out, expiry, or fresh sign-in is caught immediately:
  1. Redirects to `/auth` when there is no session and the current route isn't public (`auth`,
     `onboarding`, `invite`).
  2. Once a session exists, checks `useAuth().hasCompletedOnboarding()` **once per signed-in session**
     (a ref keyed on user id guards against re-checking on every navigation) and redirects to
     `/onboarding` if it's false.
- **Routing, current:** splash → (nothing splash-specific to decide anymore) → whatever route was
  already current, which `AuthGate` then corrects: no session → `/auth`; session but onboarding not
  yet completed for this account → `/onboarding`; session and onboarding done → left alone (normally
  Home). Onboarding is reached **after** authentication now, exactly once per account (any device —
  see §3), not on first app launch. `app/onboarding.tsx`'s `finish()` (tapping the
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

### Localization (i18n)

`i18next` + `react-i18next` (no `expo-localization` — see below). `utils/i18n.ts` calls
`i18n.use(initReactI18next).init(...)` at module scope and is imported once, for its side effect only,
at the very top of `app/_layout.tsx` — before anything else, so every screen's first render already has
an initialized instance to read from. There's no `I18nextProvider` in the component tree; `initReactI18next`
attaches to the module-singleton `i18next` instance, which is what `useTranslation()` reads from by
default, so none is needed.

- **English is the default for every user, regardless of device locale.** `lng: 'en'` at init time —
  deliberately no device-locale detection this pass (no `expo-localization`, no `getLocales()` call
  anywhere). If a user previously chose Romanian in Profile, that choice is restored from AsyncStorage
  (`povesteanoastra:language:v1`) asynchronously right after init — that's restoring a **saved
  preference**, not detecting the device's language, and it only ever matters for a user who already
  changed the setting once.
- **`setLanguage()`** (`utils/i18n.ts`) is the only way app code should change languages: it calls
  `i18n.changeLanguage()` (every mounted `useTranslation()` consumer re-renders immediately, no restart)
  and persists the choice to AsyncStorage, in that order. `app/profile.tsx`'s Language card is the only
  caller today — two pill buttons (English / Română), active state driven by `i18n.language`.
- **Locale files** live at `locales/en.json`/`locales/ro.json`, nested by screen/feature
  (`home.*`, `auth.*`, `acasa.*`, `rsvp.*`, `detalii.*`, `fond.*`, `profile.*`, plus a `common.*` for
  words reused across screens — RSVP status words, delete/cancel, the "date to be announced" fallback).
  Interpolation (`{{count}}`, `{{eventName}}`, etc.) and i18next's `_one`/`_few`/`_other` plural-suffix
  convention are used where the source text already had a count or a name baked in.
- **Only app chrome is translated — never user-generated content.** Event names, moment titles, welcome
  messages, chat messages, guest names, anything a user typed, is rendered as-is, untouched by `t()`.
  Two call sites translate *outside* a component (`utils/format.ts`'s `formatEventDate`,
  `app/auth/index.tsx`'s `mapAuthError`) — neither can call the `useTranslation()` hook since neither is
  a component, so both import the `i18n` singleton directly and call `i18n.t(...)`; this stays correct
  under a language change because their callers are themselves components that re-render on
  `changeLanguage()` (they call `useTranslation()` for their own other text), which re-invokes the
  utility function fresh.
- **Screens migrated to `t()` so far:** Home (`app/index.tsx`), Auth (`app/auth/index.tsx`), Profile
  (`app/profile.tsx`, migrated incidentally while adding the Language card), the RSVP screen
  (`app/invite/[id].tsx` → `rsvp.*`), **all 6 guest tabs** — Acasă (`app/guest/[id]/index.tsx` →
  `acasa.*`), Detalii (`app/guest/[id]/detalii.tsx` → `detalii.*`, including its `DetaliiSkeleton`),
  Fond (`app/guest/[id]/fond.tsx` → `fond.*`, including its skeleton), Chat (`app/guest/[id]/chat.tsx` →
  `chat.*`), Live (`app/guest/[id]/live.tsx` → `live.*`), and Album (`app/guest/[id]/album.tsx` →
  `album.*`) — and the organizer dashboard (`app/event/[id].tsx` → `event.*`, including its
  hydrated/loading skeleton). The dashboard's three `StatCard` labels reuse `common.confirmed`/
  `pending`/`declined` instead of new keys — the same words `RsvpBadge` already renders, now shared
  between the two instead of `RsvpBadge`'s translation being a one-off. Plus the shared pieces these
  screens render through: `EventListItem`, `RsvpBadge` (now genuinely shared — both the organizer
  dashboard's `GuestRow` and Home's `InvitationListItem` render through it), `MomentCard`, and
  `RSVP_LABEL`'s removal from `utils/format.ts` (dead after `RsvpBadge` moved to `t()`). Fond's
  `fond.targetAmount` key ("of {{amount}}" / "din {{amount}}") was missing from the locale files when
  they were first authored — added while wiring, not before; every other key matched the screens'
  actual strings exactly. `components/guest/MessageBubble.tsx` needed no changes for Chat —
  `sender_label`/`content` are user content, and its relative-time stamp already routes through
  `utils/relativeTime.ts`, a separate still-hardcoded item (see below). `live.liveTag` ("LIVE") is
  deliberately identical in both languages — already the word used in Romanian too — kept as a real key
  rather than hardcoded so a future rebrand only needs a locale-file edit, not a code change.
- **All 7 owner composer forms are migrated too:** `app/schedule/[id].tsx` (`scheduleForm.*`),
  `app/venue/[id].tsx` (`venueForm.*`), `app/menu/[id].tsx` (`menuForm.*`), `app/table/[id].tsx`
  (`tableForm.*`), `app/accommodation/[id].tsx` (`accommodationForm.*`), `app/vendor/[id].tsx`
  (`vendorForm.*`), and `app/fund/[id].tsx` (`fundForm.*`) — plus `components/DateTimeField.tsx`'s
  "Done" button (→ `common.done`; `create/details.tsx` will get this for free once it's migrated, since
  it uses the same component). These seven forms repeat the same three strings almost verbatim ("Not
  available" + "Only the organizer can edit X.", "Guests will see this on the Detalii tab.", "Save
  changes"), so those became `common.notAvailable`/`common.guestsSeeOnDetalii`/`common.saveChanges`
  instead of per-namespace duplicates. `app/menu/[id].tsx`'s course-name field labels reuse
  `detalii.courseStarter`/`courseMain`/`courseDessert` rather than new keys — same words the
  guest-facing Detalii screen already renders. **Every placeholder example was translated too**
  ("Ceremony", "Castle Hotel", "Lumière Studio", etc.) — these are organizer-facing English screens that
  had Romanian-only example text in every field before this pass, which is exactly the language-mixing
  problem the whole i18n effort exists to fix, not just visible labels/buttons.
- **Edit Event and Add Guest are migrated too:** `app/edit-event/[id].tsx` (`editEventForm.*`, reusing
  `common.notAvailable`/`common.saveChanges` and `DateTimeField`'s now-translated "Done" button) and
  `app/add-guest/[id].tsx` (`addGuestForm.*`). Add Guest reuses three keys from other namespaces rather
  than duplicating them: `auth.errors.invalidEmail`, `auth.emailLabel`, and `auth.emailPlaceholder`
  (identical email-validation copy to the Auth screen), and `event.inviteGuest` for its own header title
  — the same "Invite a guest" text the organizer dashboard's button already uses to reach this screen.
  Its inline field-validation error text (`colors.danger`) is unchanged — still the one deliberately
  untouched non-delete red usage flagged earlier in this file (§5 Colors).
- **Post a Moment and Onboarding are migrated too:** `app/post-moment/[id].tsx` (`postMomentForm.*`)
  and `app/onboarding.tsx` (`onboarding.*`, its 4-step tutorial). Onboarding's `STEPS` array used to
  hold literal Romanian title/body strings, with `item.title` doing double duty as the React `.map()`
  `key` — translating the text directly would have made that `key` change on every language switch,
  causing React to unmount/remount each slide. Fixed by storing locale-key *names* in `STEPS`
  (`titleKey`/`bodyKey`) instead of literal text, so the `key` stays stable across a language change
  and `t()` is only called at render time. Worth reusing this shape for any other array whose items
  double as both list content and a React key.
- **The 4-step create-event wizard is migrated too** (`app/create/type|details|preview|share.tsx` →
  `createWizard.*`) — **every real screen in the app is now migrated**, leaving only the `checkout`
  stub and one small fallback string (see below). The wizard leans on reuse more than any other screen
  migrated so far: `create/details.tsx`'s field labels are the exact same set as Edit Event's
  (`editEventForm.nameLabel`/`dateLabel`/`selectDate`/`locationLabel`/`welcomeMessageLabel`), and
  `create/share.tsx` reuses `rsvp.notFoundTitle`, `event.shareInvitation`, `event.previewAsGuest`, and
  `common.done` rather than duplicating any of them under `createWizard`.
- **Detalii's dietary-preference pills are the one place translation and stored data almost collided.**
  `DIETARY_OPTIONS` (`'Vegetarian' | 'Vegan' | 'Fără gluten' | 'Fără lactoză'`) are the literal values
  written into and compared against `event_guests.dietary_preferences` — translating that array itself
  would have meant a guest's saved preference silently stopped matching `myDietary.includes(option)`
  the moment they (or anyone viewing the same event) switched languages, since the array driving the
  comparison would no longer contain the value that was actually stored. Fixed by keeping
  `DIETARY_OPTIONS` fixed and untranslated (the stored/compared identity) and translating only the
  rendered label through a separate `DIETARY_LABEL_KEY` lookup. Any future `t()`-migration of a screen
  that stores free-standing option/category strings server-side should check for the same trap.
- **Every other screen is still fully hardcoded** — this was always meant to be screen-by-screen, not
  all-at-once. `utils/i18n.ts` carries the up-to-date todo list in a code comment (which screens are
  untouched and which shared utils — `utils/confirm.ts`, `utils/relativeTime.ts`, `utils/eventTypes.ts`
  — are worth doing
  once for every screen that uses them rather than piecemeal). Keep that comment in sync as future
  passes migrate more screens, the same way this file is kept in sync with the rest of the app.

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
- `20260812000001_event_photos_storage.sql` — **not yet applied, not yet confirmed.** Creates a
  private `event-photos` Storage bucket, three `storage.objects` RLS policies (view/insert/delete)
  mirroring the `photos` table's own RLS, and makes `photos.url` nullable. See "Photo uploads — real
  Supabase Storage, dual-resolution" below. Unlike migrations 3–8, no service-role/CLI access was ever
  available for this one either, and additionally PostgREST's anonymous schema check (used to confirm
  1–2 below) can't see `storage.objects` policies or bucket existence at all — this migration's applied
  status has **no verification path from this environment**, confirmed or not, until the user runs it
  and the app is exercised on a device.

**The first three are applied.** The user ran them against the connected project (not this session —
no DB password/service-role key/CLI is available here, only the anon key). The first two were verified
from this session by an anonymous `select` against all 11 base tables: every one returns `200` with an
empty array (RLS correctly denies rows to a request with no `auth.uid()`), where `events` previously
returned `PGRST205`. **This only confirms the schema exists** — it does not confirm a real signed-in
write round-trips, since there's no way to authenticate as a real user from this environment. Treat
writes as typecheck/bundle-verified only until exercised from the running app. Migrations 3, 5, 6, 7,
8, and 9's applied status can't be confirmed the same way — PostgREST's schema endpoint doesn't expose
triggers, functions, or (without an authenticated request) new tables/columns — so those are taken on
the user's word (migration 3) or not yet confirmed at all (5, 6, 7, 8, 9), not independently re-checked.

**Post-auth onboarding.** The 4-step tutorial (`app/onboarding.tsx` — content, design, and swipe
mechanics all unchanged) moved from "before Auth, once per device" to "after Auth, once per account."
`useAuth()` gained `hasCompletedOnboarding()` and `markOnboardingComplete()`: local `AsyncStorage`
cache first (`utils/onboarding.ts`, keyed per account id so a second account on the same device can't
inherit or clobber the first one's state), `public.users.has_completed_onboarding` as the source of
truth when the cache is empty. `components/AuthGate.tsx` now does two jobs instead of one — see §2 Auth
flow for the routing mechanics — checking onboarding status exactly once per signed-in session via a
ref keyed on user id, not on every navigation. `markOnboardingComplete()`'s Supabase write is
fire-and-forget/best-effort: a failed background sync means the tutorial shows again on another
device, not data loss. `utils/firstLaunch.ts` (the old AsyncStorage-only, per-device, pre-auth flag)
is deleted, not deprecated — nothing referenced it after that pass.

**Client code can never look up another user by email — don't reintroduce this.** `public.users`'
only `select` policy is `id = auth.uid()`; a signed-in session can read its own row and nothing else.
Any "look up this email, then set guest_user_id" step has to happen in a `security definer` trigger
(bypasses RLS by design), never in application code — a client-side version wouldn't error, it would
just silently find zero rows every time and look exactly like "no account exists." This is why
`data/eventsRepository.ts`'s `insertGuestInvite` doesn't attempt this lookup itself: `Direction 1` in
`20260810000003_guest_autolink.sql` already does it, and it's the only place it can correctly happen.

**Where data lives.** Everything — events, guests, and all per-event content — reads and writes Postgres
for real, through `data/eventsRepository.ts` and `data/remoteEventContentRepository.ts`. There used to
be a `mode: 'local' | 'supabase'` split here, with every hook action branching on it and a parallel
AsyncStorage/in-memory path for when Supabase wasn't configured; **that's gone**, removed in the pass
that made Supabase a hard requirement (see the top of this file). `useEvents.tsx`/`useEventContent.tsx`
now call the Supabase repository unconditionally — there's no other path to assume you might be on.

**Two things this pass deliberately didn't do:**

- **Realtime is still unused.** The RLS migration adds `messages`/`photos`/`moments`/`moment_reactions`
  to the `supabase_realtime` publication, and that's still all that happened — no `supabase.channel()`
  subscriptions exist anywhere. Every screen is request/response: write, then re-`load()` that event's
  content. Multi-device live updates (e.g. Chat) need an explicit subscription pass.
- **`contribute()` stays local-only and unused.** The `contributions` table has no client insert policy
  on purpose (`supabase/migrations/20260810000002_rls_policies.sql`: written by a Stripe webhook using
  the service role, never the client), so `remoteEventContentRepository.ts` has no `contribute`
  function at all — adding one would either violate that policy or silently fail. `checkout/[id].tsx`
  is still a stub and never calls it.

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

**Fixed — a genuinely `pending` invite rendered as if already declined.** A guest invited by email
(`app/add-guest/[id].tsx`, §3 above) has a real `event_guests` row from the moment they're invited —
`rsvp_status: 'pending'` — not just from the moment they respond. `showChoices` and the confirmation
card were gated on `myRsvp !== undefined`, which conflates "a row exists" with "they answered": opening
a never-responded invite made `myRsvp` defined immediately, skipped the Confirm/Decline buttons
entirely, and fell into the confirmation card's `myRsvp.status === 'confirmed' ? … : …` ternary — since
`'pending' !== 'confirmed'`, that unconditionally rendered the *declined* copy ("Thanks for letting us
know" / "You'll be missed") for an invite nobody had touched yet, effectively auto-declining every
guest who'd never opened the invite. A second bug rode along in the same branch: the post-response
footer rendered "Deschide pagina evenimentului" unconditionally, so even a genuinely *declined* guest
saw an event-access button — visibly contradictory alongside "You'll be missed," and wrong regardless,
since declined guests aren't supposed to get event access at all. Both are fixed by a new `responded`
flag (`myRsvp !== undefined && myRsvp.status !== 'pending'`) that actually means "answered," gating both
the choices-vs-confirmation footer and the confirmation card; the access button is now additionally
gated on `myRsvp?.status === 'confirmed'` specifically, so a declined guest's footer is just
acknowledgment text + "Change my answer," nothing else. Local mode was never affected — its
`SELF_GUEST_ID` row is only ever created at the moment of a real response (see `respondToInvite` in
`hooks/useEvents.tsx`), so `myRsvp` genuinely was undefined there until an answer existed; this bug was
Supabase-mode-only, specifically for invites created via "Add guest by email" rather than an in-app
first response.

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
inserting, falling back to `actor.label` (email) if that returns nothing — still true after the Storage
pass below, just now happening after both files are already uploaded rather than being the whole
function.

### Photo uploads — real Supabase Storage, dual-resolution

**Corrects a documented gap, for photos specifically — not moments.** Every previous pass through this
file described `addPhoto`/`createMoment` identically: both wrote whatever local `file://`/`ph://` URI
`expo-image-picker` handed back straight into a `url`/`photo_url` column, resolving on no device but
the one that picked it (see §7). That's no longer true for `addPhoto` — Live/Album's guest-uploaded
event photos now go through real Storage uploads with two resized versions each. **`createMoment`
(Acasă's moment composer, `app/post-moment/[id].tsx`) is untouched and still has the original gap** —
don't assume "Storage uploads are done" covers moments too; only event photos do.

`app/guest/[id]/live.tsx`'s `pickPhoto` → `useEventContent().addPhoto` now resizes the picked image
into two JPEGs (`utils/imageProcessing.ts`, built on `expo-image-manipulator`'s new context API —
`manipulateAsync` is deprecated in the installed `~57.0.9`, so this uses
`ImageManipulator.manipulate(uri).resize(...).renderAsync()` → `.saveAsync(...)` instead) and uploads
both to a private `event-photos` Storage bucket before the `photos` row is ever inserted:

- **thumbnail** — longest edge 400px, JPEG quality 0.65. The only version grid tiles ever load (Live's
  hero/filmstrip, Album's 3-col grid) — the entire point of having a thumbnail at all.
- **full** — longest edge 2800px, JPEG quality 0.9, **never upscaled** (a source already smaller than
  the target edge is left at its own size, just re-encoded to JPEG at the target quality — this
  never-upscale guard is applied to the thumbnail too, a deliberate generalization beyond what was
  literally asked, since upscaling a small source for a *smaller* target thumbnail would be pure waste
  either way). Used for `PhotoTile`'s existing tap-to-open full-screen lightbox — the one component
  Live and Album already both rendered through, so **Album gets full-resolution viewing for free,
  without its own file changing at all.**

**Path convention, deliberately no new columns.** `{eventId}/{photoId}/thumb.jpg` and
`{eventId}/{photoId}/full.jpg` — both fully derivable from columns that already existed (`event_id`,
`id`), so `supabase/migrations/20260812000001_event_photos_storage.sql` adds nothing to `photos` except
making `url` nullable (kept only as a last-resort fallback for pre-migration rows, see below). The
photo `id` is generated client-side (`utils/uuid.ts` — prefers `crypto.randomUUID`, falls back to a
`Math.random`-based v4, which is fine here since it only ever backs a Postgres primary key, never a
security token) rather than left to Postgres's `gen_random_uuid()` default, because the Storage paths
have to be known *before* the row exists to hand out its own id — both files upload first, and only
then is the row inserted pointing at a path that's already real.

**Bucket is private — every read is a signed URL, never a public one.**
`remoteEventContentRepository.ts`'s `loadSocial` batches a single `createSignedUrls` call (1 hour TTL)
covering both paths for every photo in the event, right after fetching the `photos` rows themselves —
an unavoidable sequential dependency (the ids have to be known first), not parallelized with
`loadSocial`'s other two queries the way moments/messages are. `types/guest.ts`'s `Photo` gained
`thumb_url`/`full_url` (both nullable — a legacy row or an individual signing failure comes back
`signedUrl: null` for that one path without failing the whole batch); `url` itself is now nullable too,
kept only as a last-resort fallback. `components/guest/PhotoTile.tsx` reads `thumb_url ?? url` for the
grid image and `full_url ?? url` for the lightbox — the only component that needed changing for both
Live and Album to pick up the new behavior, since both already rendered every photo through it.

**Deletion now cleans up Storage too, best-effort.** `deletePhoto` (repository) removes both storage
objects before deleting the `photos` row. Before this pass there was nothing to orphan — the row's
`url` was never actually stored anywhere, just a device-local path — so this is new cleanup, not a fix.
Storage removal failures don't block the row delete (same fire-and-forget-cleanup philosophy as
`markOnboardingComplete`, above) — `.remove()` doesn't throw; its per-path errors just aren't surfaced.

**Storage RLS mirrors the `photos` table's own RLS exactly, on purpose.** The three `storage.objects`
policies (view/insert/delete) key off `(storage.foldername(name))[1]::uuid` — the `{eventId}` path
prefix — checked against the same `public.can_view_event`/`is_event_organizer` helpers the `photos`
table already uses (`20260810000002_rls_policies.sql`), so "can see the photos row" and "can
fetch/upload the underlying file" can't drift apart. **Deliberately gates on "is an invited guest," not
literally `rsvp_status = 'confirmed'`** — matching the existing `photos` table policy exactly, which
never filtered on RSVP status either. A stricter confirmed-only gate on Storage alone would let a
still-`pending` guest create the `photos` row (already allowed today) but fail to actually upload the
file, which would just look like a broken upload button — if a genuinely confirmed-only gate is wanted,
both layers need to change together, not just this one. Also checks both `owner` and `owner_id` on
`storage.objects` (Supabase Storage has used both column names across project versions, set
server-side from the uploader's auth token) — unverified which one this project's `storage.objects`
actually populates, since neither is visible from an anonymous schema check (see the Reality check
entry above).

**No `expo-file-system` dependency added**, though it was pre-approved alongside
`expo-image-manipulator` when this was scoped. Turned out unnecessary — `fetch(localUri).arrayBuffer()`
reads the already-resized local file directly (the standard Expo+Supabase-storage pattern), so the
dependency list only grew by the one package this pass actually needed.

**Requires a native rebuild — not achievable from this session, same as every other native dependency
addition in this file.** `expo-image-manipulator` (`~57.0.9`) is a new native module; see the top of
this file and §1's Tech stack table. Verified only by `npx tsc --noEmit --noUnusedLocals` and
`npx expo export --platform ios`, both passing — actual resize output quality/file size, whether
`createSignedUrls` round-trips correctly against a real project, and whether the RLS policies as
written actually permit/deny what they're supposed to are all unverified from this environment (no DB
credentials, no device/simulator run — see the top of this file). The migration itself
(`20260812000001_event_photos_storage.sql`) is written but not applied — see the Reality check entry
above.

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
  `useEvents().updateMyDietaryPreferences(eventId, preferences)` is new — optimistic (same convention as
  `myRsvp`/`myInvitations`: RLS already limits a non-organizer's `event.guests` to index `0`, so that's
  "my" row to patch). No new RLS policy needed — "update own rsvp or as organizer" already covers any
  column, including this new one, on a guest's own row.
- **Așezarea la mese / Cazare recomandată / Cei care fac totul posibil** — all three are plain
  per-event lists, same shape as `schedule_items`: `SwipeableRow` Edit/Delete, a composer at
  `app/table|accommodation|vendor/[id].tsx` (add with no `itemId`, edit with `?itemId=`), `EmptyState`
  with an owner-only CTA. Vendors additionally render a small category-derived emoji (keyword-matched
  in `detalii.tsx`'s local `vendorIcon()` — free-text category, not an enum, so this is a heuristic
  with a `🏷️` fallback, not a lookup table) and a "Vezi" button that calls `Linking.openURL` when
  `external_url` is set. The italic caption below the vendor list only renders once there's at least
  one vendor — showing "furnizorii tag-uiți își promovează serviciile" above an empty list read as
  premature.
- All four sections' repository/hook wiring is the exact same write-then-invalidate shape as
  `saveScheduleItem`/`updateVenue` (§3's "Where data lives") — nothing new architecturally, just more
  instances of it.
- **Guest-to-table assignment is out of scope, as specified** — the seating list is just a list; no
  guest is linked to a table yet. `seating_tables` has no guest-facing column for this at all.

### Add guest by email (owner only)

`app/add-guest/[id].tsx` — email (required, regex-validated) + optional name, "Send invite" button,
same composer shape as the moment/fund/schedule composers. Owner-only. Entry point: a small "+" (`user-plus`)
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
| `photos` | `id`, `event_id`, `uploaded_by`, `uploaded_by_label`, `url` (nullable as of `20260812000001`) | Shared by Live and Album. Thumb/full Storage paths are derived by convention (`{event_id}/{id}/thumb\|full.jpg`), not stored as columns — see §3's "Photo uploads" |
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
  organizer can delete any. As of `20260812000001_event_photos_storage.sql`, `storage.objects` for the
  private `event-photos` bucket has the identical shape (view/insert/delete, same
  `can_view_event`/`is_event_organizer` helpers, keyed off the `{eventId}` path prefix instead of a
  `event_id` column) — see §3's "Photo uploads — real Supabase Storage, dual-resolution" for why the
  two are kept deliberately in lockstep.

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
| `app/invite/[id].tsx` | RSVP screen — opened from an invite link by a real guest, *and* reused as the organizer's "Preview as guest" view (RSVP buttons render disabled for the organizer; see §3). **No longer a forced stop between Home and the guest tabs for an owner — see §4's routing note** |
| `app/edit-event/[id].tsx` | Owner: basic info only — name, date, location, welcome message. Reached from the "Edit event" button on `event/[id].tsx`, the organizer dashboard |
| `app/schedule/[id].tsx` | Owner: add or edit one schedule item (`?itemId=` for edit) |
| `app/venue/[id].tsx` | Owner: create or edit the venue |
| `app/menu/[id].tsx` | Owner: create or edit the menu (starter/main/dessert, one save) |
| `app/table/[id].tsx` | Owner: add or edit one seating table (`?itemId=` for edit) |
| `app/accommodation/[id].tsx` | Owner: add or edit one accommodation option (`?itemId=` for edit) |
| `app/vendor/[id].tsx` | Owner: add or edit one tagged vendor (`?itemId=` for edit) |
| `app/fund/[id].tsx` | Owner: create or edit the fund |
| `app/add-guest/[id].tsx` | Owner: invite a guest by email |
| `app/post-moment/[id].tsx` | Owner: moment composer |
| `app/checkout/[id].tsx` | Stubbed Stripe placeholder |

### Owner routing — Home opens straight into Acasă, not the dashboard

**Changed this pass.** Tapping an owned event on Home (`app/index.tsx`, "Your events") used to push
`/event/[id]` (the guest-count/guest-list dashboard) — the only way from there into the actual 6-tab
guest experience was tapping "Previzualizează ca invitat" into `/invite/[id]`, then "Mergi la
evenimentul tău" into `/guest/[id]`. That's two forced intermediate screens just to open your own
event. Home now pushes `/guest/${event.id}` directly — an owner tapping their event lands on Acasă,
tab bar and all, in one tap.

**This meant `/event/[id]` needed a new entry point, since Home was its only one before this change**
(checked — grepped the whole app for any other `router.push`/`href` targeting it; there wasn't one).
`components/guest/EventHeaderBar.tsx` — the persistent back-chevron-and-name bar above all 6 guest
tabs — now takes `id`/`showManage` props and renders a second icon button, owner-only, top-right: a
`users` glyph that pushes `/event/${id}`. `app/guest/[id]/_layout.tsx` computes `showManage` from
`isOwner(event)` and passes it down. A non-owner viewing the tabs sees exactly what they saw before —
just the back button and the event name, nothing added to their side.

**The preview screen (`/invite/[id]`) itself is unchanged and still has two legitimate paths in:** the
create-event flow's own share step (`create/share.tsx`, "Preview as guest" — unchanged, this is the
one case the screen was always meant for), and the dashboard's own "Previzualizează ca invitat" button
(unchanged, still a manual, explicit action once you're on the dashboard, not something Home forces on
you anymore).

**The dashboard's Edit action moved into its own header, off the footer.** `Header.tsx` gained a
`right?: ReactNode` prop (same "single custom slot, top-right" shape `BrandHeader`'s `right` prop
already established elsewhere) — a wrapping `rightGroup` groups it with the existing `onClose` X button
so both can coexist, though no screen currently passes both. `app/event/[id].tsx`'s footer no longer has
the "Editează evenimentul" ghost-variant text button; it's now a 40×40 pencil-icon button in the
`Header`'s `right` slot, owner-only, same tap-target size as the back button. Share and "Preview as
guest" stay in the footer, untouched.

### Splash and onboarding

`components/BrandSplash.tsx` animates the brand mark's stroke via `strokeDashoffset` on an
`Animated.Value` (~2s total), then fades the wordmark in below it, then fades the whole overlay out.
It calls `onReveal` *before* fading so the destination screen is already mounted underneath — a
cross-dissolve, not a cut. `onReveal` is a no-op now (`app/_layout.tsx`) — splash no longer makes any
routing decision itself; `AuthGate` handles Auth vs Onboarding vs letting the current route stand once
it's mounted underneath (see §2, §3). Onboarding itself is unchanged: 4 paging-ScrollView steps with a
segmented progress bar; only *when* it's shown changed, via `useAuth()`'s
`hasCompletedOnboarding`/`markOnboardingComplete` (§3) rather than `utils/firstLaunch.ts`, which is
deleted.

**Made theme-aware this pass, plus a native/JS splash handoff added for the first time —
`expo-splash-screen` is a new dependency, and this needs a native rebuild to actually take effect.**
`BrandSplash` now calls `useTheme()` like every other themed component: its background is a real
`LinearGradient` reading `tokens.background` (previously a flat `brand.cream` fill, light-mode-only),
and the wordmark ("Povestea" + accent "Noastra", fading in below the mark once the line-draw finishes,
matching `BrandHeader`'s treatment) reads `tokens.textPrimary`/`tokens.accentPrimary` instead of the
static `brand.navy`/`brand.purple`. The mark's own gold→pink→purple stroke gradient (`MARK_STOPS`)
stays fixed regardless of theme — that's brand identity, not UI chrome, same reasoning `BrandMark.tsx`
already uses. Centering was also tightened: the overlay is a plain absolute-fill `alignItems`/
`justifyContent: 'center'`, with nothing else in its layout path that could push the mark+wordmark
group off-center — if it still doesn't look centered once actually run, that's a real device-run bug to
report, not a resolvable theory from here (this app has never run on a device or simulator, per the top
of this file).

**The native splash (before any JS runs) previously had no coordination with the JS one at all** — no
`expo-splash-screen` package existed, so the OS auto-hid the native splash (a static light-only
`#FDF3EC` image per the old `app.json` `splash` key) whenever it judged the first JS frame ready,
independent of whether `BrandSplash` had actually mounted and rendered yet. Added `expo-splash-screen`
(`npx expo install`, now `~57.0.6`) and wired the standard prevent/hide handoff: `SplashScreen.
preventAutoHideAsync()` at module scope in `app/_layout.tsx` (runs before first render), `SplashScreen.
hideAsync()` in a `useEffect` gated on `fontsLoaded` — the same point the app was already gating first
render on, so no new waiting condition was introduced, just an explicit native-splash release at the
moment the JS one is ready to be seen in its place. `app.json`'s legacy top-level `splash` key is gone,
replaced by the `expo-splash-screen` config-plugin entry with a `dark` sub-config
(`backgroundColor: '#1E1A30'`, matching `darkTheme.background[0]`) alongside the light one
(`'#FFF8F1'`, matching `lightTheme.background[0]` — previously `#FDF3EC`, a very close but not exact
match to any real token). `userInterfaceStyle` changed from `"light"` to `"automatic"` — required for
the OS to ever pick the dark splash variant at all; also affects other native chrome (e.g. `Alert.alert`
styling on iOS) that this pass didn't otherwise touch.

**Known, real remaining gap: the native splash can only follow the *device's* system dark/light
setting, never this app's own in-app theme override.** Native code runs before any JS (or persisted
AsyncStorage state) is reachable, so `userInterfaceStyle: "automatic"` — and therefore which native
splash variant the OS shows — is driven entirely by the device's own OS-level appearance setting. A
user whose device is in light mode but who has explicitly overridden the app to dark mode (via the
Profile toggle, §2) will see the native splash in light, then a hard cut to `BrandSplash` in dark the
instant `hideAsync()` fires — not a gradual flash, but not seamless either. Closing this gap fully would
need native code reading the persisted override *before* the splash is even configured (a synchronous
storage engine like MMKV instead of AsyncStorage, plus custom native code beyond what
`expo-splash-screen`'s standard JS API exposes) — out of scope for this pass, and flagged rather than
silently left unmentioned. The common case (no override, or override matches system) is unaffected.

**Requires a native rebuild to take effect — not achievable from this session.** A new native
dependency (`expo-splash-screen`) plus an `app.json` plugin-config and `userInterfaceStyle` change both
need `npx expo prebuild` (or an EAS/local native build) before they do anything real on a device — same
"the user runs this themselves" convention as every other native change in this file (see §1's
dev-build note, and the `@react-native-community/datetimepicker` entry above). Everything here is
typecheck/bundle-verified only, same caveat as the rest of this file, until that rebuild happens and the
app actually runs once.

### The 6 guest tabs (`app/guest/[id]/`)

A persistent `EventHeaderBar` (back chevron + event name) sits above the tabs; back always returns to
Home regardless of active tab, via `router.navigate('/')`. Owners additionally see a third icon,
top-right — a guest-list/stats shortcut into `/event/[id]` (see the routing note above this table's
section for why that link needed to exist here now).

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
`create/details.tsx` (date), and `schedule/[id].tsx` (time) — this is the *only* place in the app that
imports `DateTimePicker` directly (checked), so it was a single-component fix. Display formatting
elsewhere is untouched (`utils/format.ts` → `formatEventDate`).

**iOS picker theming — fixed; Android picker theming — a real library limitation, not fixed.** The
picker used to render with no `themeVariant`, so it fell back to the device's system light/dark
setting rather than this app's own theme state — normally harmless, but this app's dark mode is an
explicit in-app override (see §2's `useTheme`) that can disagree with the system setting entirely, and
when it did, the iOS spinner rendered dark text on a dark background. Fixed by passing
`themeVariant={tokens.mode}` on iOS. **Android has no equivalent prop** —
`@react-native-community/datetimepicker`'s `AndroidNativeProps` type has nothing theme-related; the
Android dialog is themed by the app's native Android theme resource, resolved at the activity level,
not switchable from a JS-side runtime toggle without native code changes (an Android `styles.xml`/
`values-night` change plus an activity recreation, or a native module) that this project hasn't made.
Not attempted blind — this is a genuine platform/library constraint, checked against the library's own
type definitions rather than guessed at. On a device where the OS is already in dark mode, Android's
dialog will likely still read fine (it follows the *device* setting, just not this app's independent
override); the failure case is specifically Android + app dark mode + device still in light mode, which
remains unfixed.

---

## 5. Design system

### Colors — three coexisting palettes (a known inconsistency)

| Source | Used by | Key values |
| --- | --- | --- |
| `utils/guestTheme.ts` → `brand` | Splash, Auth, onboarding, `BrandHeader`, `ScreenBackground` | cream `#FDF3EC`, gold `#F5C36B`, pink `#E8779E`, purple `#7F77DD`, navy `#2B2740`, lavender `#EAE4F0` |
| `utils/guestTheme.ts` → `guest` | The 6 guest event tabs | cream `#FDF3EC`, purple `#6C4CE0`, gold `#E8B54B`, navy `#1B2237`, blush `#FBE3DD`, live red `#E8524F` |
| `utils/theme.ts` → `colors` | Organizer screens (Home, create flow, edit forms, Profile) | primary `#6C4CE0`, success `#2E9E6B`, danger `#D9534F`, declined `#786FA0` |

The purple differs between `brand` (`#7F77DD`) and `guest`/`colors` (`#6C4CE0`), as does the gold.
Consolidating these is worthwhile but has not been done.

**`colors.danger` is reserved for destructive delete actions only — a declined RSVP is not one.**
`colors.declined`/`declinedSoft` (a muted lavender-gray, not a red) is the color for a declined-but-not-
destructive outcome: `RsvpBadge`'s `declined` tone (used by both `InvitationListItem` on Home and
`GuestRow` on the organizer dashboard — one badge, both call sites fixed together), the "Declined"
`StatCard` on `event/[id].tsx`, and `Button`'s `neutral` variant (same outline shape as `danger`,
recolored — used by `invite/[id].tsx`'s "Can't make it"). Before this pass all four borrowed
`colors.danger`/`dangerSoft`, which read as a warning/error rather than a recorded, neutral choice.
**One red usage was found and deliberately left alone**, since it's neither a delete action nor a
declined-RSVP indicator: `app/add-guest/[id].tsx`'s inline field-validation error text
(`colors.danger`) for "Enter a valid email address" / "This person is already invited." Conventional
red-for-form-errors is a separate concern from this pass's declined-status scope — flagging it here
rather than silently changing it.

### Warm Story theme system (light/dark) — new this pass

**Correcting the record first: no theme infrastructure existed before this pass, despite a prompt
describing it as an extension.** A prompt asked to "extend/replace the tokens started in the earlier
theming pass" and said Home, Auth, and Acasă were "already migrated" to a `ThemeProvider`/Profile
toggle. Checked before writing anything: no `ThemeProvider`, `useTheme`, or `colorScheme` reference
existed anywhere in the repo, `utils/theme.ts`/`utils/guestTheme.ts` were both single flat
light-mode-only objects with no light/dark split to extend, and the `theme` branch itself had zero
commits and zero diff against `main` — it was freshly cut, not sitting on prior theme work. Same
"a prompt describes a pass that was never actually built here" pattern already documented for the
guest-autolink trigger and v2/v4 above; flagged to the user before starting, who confirmed building
the real thing from zero rather than treating the claimed prior work as real.

**Architecture.** `hooks/useTheme.tsx` (`ThemeProvider`/`useTheme`) resolves `mode: 'light' | 'dark'`
from `useColorScheme()` (system default) unless the user has explicitly picked one in Profile, in
which case that choice — persisted to AsyncStorage as `povesteanoastra:theme:v1`, same
read-cache-once-at-startup shape as `utils/i18n.ts`'s language restore — wins. `utils/themeTokens.ts`
holds the actual palette: `lightTheme`/`darkTheme`, both implementing a shared `ThemeTokens` interface
(`background` gradient, `surface`, `surfaceElevated` + either a shadow style or a border color —
light mode shadows, dark mode gets a 1px `surfaceBorder` instead per the spec, never both —
`textPrimary`/`textSecondary`, `accentPrimary`/`accentGold`/`accentPink`, `statusConfirmed`/
`statusPending`/`statusDeclined` each with a soft variant, `destructive` + soft, and a `tabBar`
sub-object). This is deliberately a **third, additive** token source, not a replacement for
`utils/theme.ts` (organizer screens) or `utils/guestTheme.ts` (guest tabs) — same "separate palette per
surface" precedent those two already set, extended rather than resolved. Screens read `themeTokens.ts`
only once actually migrated to `useTheme()`; unmigrated screens are untouched and keep reading the
static `colors`/`guest` objects exactly as before.

**Exact values** (light / dark): background gradient `#FFF8F1→#FBEAE0` / `#1E1A30→#171325` — the light
value is intentionally identical to the pre-existing `ScreenBackground`/`screenGradient` wash, so this
pass didn't change light mode's look, only added dark mode alongside it; surface `#FFFFFF` / `#2A2440`;
surfaceMuted `#FBEAE0` / `#1E1A30` (added in the fifth pass below — reuses each mode's own `background`
gradient stop rather than a new hex); textPrimary `#2B2740` / `#F3F1F8`; textSecondary `#8A8496` /
`#9B93B8`; accentPrimary `#7F77DD` / `#9B93F0`; accentGold `#F5C36B` / `#F0C97D`; accentPink `#E8779E`
/ `#EE93B4`; destructive `#D9534F` / `#E8726E`; tabBar background `#FFFFFF` / `#0F0C1C` (light value
fixed in the fifth pass below — originally shipped as the dark navy `#251F38` in both modes), active
`#F5C36B` / `#F0C97D` (gold, not purple — see the tab bar note below), inactive `#8A8496` / `#5E5678`
(light value likewise fixed in the fifth pass — originally `#6E6684`, the dark-mode value, in both
modes). `statusConfirmed`/`statusPending`/`statusDeclined` and their soft backgrounds follow the same
light/dark pairing; see the file itself for the full set rather than duplicating every value here.

**Card radius, app-wide, not just migrated screens.** `radius.lg` (`utils/theme.ts`) 22→18 and
`gRadius.lg` (`utils/guestTheme.ts`) 26→18 — a pure numeric bump, so every existing consumer of either
token (including screens nowhere near theme-migrated yet) now rounds in the 16-18px window the spec
asked for, at effectively zero regression risk. `themeRadius` in `utils/themeTokens.ts`
(`sm: 12, md: 16, lg: 18, pill: 999`) is the canonical scale migrated components read going forward.

**`components/BrandFlourish.tsx`** — the gold→pink→purple wavy line from the splash/logo, extracted
for reuse as a small decorative accent. Reuses `MARK_PATH`/`MARK_STOPS`/`MARK_VIEWBOX` from
`utils/brandMark.ts` (same source `BrandMark` and `BrandSplash` already draw from, so all three can
never drift apart), stretched to a flatter ~60×26 rather than the logo's own aspect ratio, default
opacity 0.55. Placed in exactly two spots this pass, deliberately not on every card per the prompt's
own "don't overuse it" instruction: Home's header row (top-right, next to the profile button) and the
top-right corner of Acasă's fund promo card (`app/guest/[id]/index.tsx`) — a "prominent card header,"
per the brief, not a generic list-row decoration.

**Buttons are fully pill-shaped now, app-wide.** `components/Button.tsx`'s base `borderRadius` changed
from `radius.md` to `themeRadius.pill` — every variant, every screen, not just Warm-Story-migrated
ones. The RSVP screen's Confirm/Decline pair (`app/invite/[id].tsx`, the only two call sites of
`variant="success"`/`variant="neutral"`) got the spec's color treatment too: `success` (Confirm) is now
`colors.primary` (purple solid) instead of green — a deliberate repurposing of that variant's color,
safe because it has no other call site; `neutral` (Decline) already had no red per an earlier fix (see
§3), now additionally uses `colors.declinedSoft` as a filled soft background instead of an outlined
card, matching "soft muted background, textSecondary-toned text."

**Tab bar — colors updated, shape was NOT changed to floating.** The prompt described the tab bar as
"floating/suspended" and asked to keep that shape while changing colors. This file already corrects
that exact claim elsewhere (§5 Tab bar: "It is not floating, suspended or rounded — earlier
descriptions of it that way were aspirational") — checked `app/guest/[id]/_layout.tsx` again to be
sure, and it's still the same full-width bar it always was. Applied only the color change: `tabBar`
tokens drive the bar background and active/inactive tint (`tabBarActiveTintColor`/
`tabBarInactiveTintColor`), and the active pill behind the icon stays `accentPrimary`-colored with the
icon itself now gold (`tabBar.active`) instead of white — "active icon color changes from purple to
gold" from the brief, applied literally as an icon-color change, not a pill-recolor.

**Event card accent block — judgment call, flagging per the brief's own request.** The spec asked for
a 34×34, 10px-radius gold→pink gradient block "positioned above the event name," replacing or sitting
alongside the per-type emoji, with the choice explicitly left to judgment. Shipped: the emoji is kept
(it reads clearly and carries real information — which of the 7 event types this is — that a fixed
gold→pink fill can't convey on its own), layered on top of the new 34×34/10px gold→pink block instead
of that block being empty; but the **row layout was kept** (badge left, info right, chevron) rather
than switching to a vertical stacked card with the block above the name — better scanability in a
list at this density, and it was already the row's visual anchor before this pass. `EventListItem`
(Home's "Your events") got this treatment; `InvitationListItem` ("My invitations") did not — its badge
keeps each event type's own gradient, since the accent-block instruction named "event cards"
specifically, not the invitations list, and per-type color there still carries information this pass
had no reason to remove.

**Screens migrated to `useTheme()`, first pass:** Home (`app/index.tsx`), Auth (`app/auth/index.tsx`),
Acasă (`app/guest/[id]/index.tsx`) — the three named in that first brief — plus every shared component
those three screens render directly, since leaving them on static light-only colors would have made
dark mode look broken (white cards on a dark wash) rather than simply incomplete: `BrandHeader`,
`ScreenBackground`, `EventListItem`, `InvitationListItem`, `HomeEmptyState`, `GuestScreen`,
`EmptyState`, `SectionLabel`, `GuestButton`, `MomentCard`. The guest tab bar
(`app/guest/[id]/_layout.tsx`) was themed app-wide in that same pass, ahead of the rest of the guest
tabs individually migrating.

**Second pass, same day — the rest of the app's `[id]` routes, the organizer dashboard, and Profile.**
Requested as "profile screens, events, and all of `[id]`," scoped by the user to mean literally every
dynamic-route screen, not just the guest tabs. Two different strategies were used depending on the
screen:

- **Shared-component-first, for the organizer/composer side.** `Header`, `Card`, `Field`, `StatCard`,
  `GuestRow`, `RsvpBadge`, `BackButton`, `InviteCard`, `Screen` (default `gradient` now resolves to
  `tokens.background` instead of the old static `screenGradient` — an explicit `gradient` prop, as
  `invite/[id].tsx` passes for its per-event-type color, still overrides it), and `DateTimeField` were
  all converted to read `useTheme()` internally. This turned out to make **7 of the 10 owner composer
  forms require zero screen-level changes** — `schedule`, `venue`, `menu`, `table`, `accommodation`,
  `vendor`, and `fund` under `app/[name]/[id].tsx` are built entirely from those shared pieces with no
  local color styling of their own, so theming the components theming the screens for free was strictly
  faster and lower-risk than editing 7 near-identical files by hand. `edit-event/[id].tsx` also needed
  no changes for the same reason. Only `add-guest/[id].tsx` (one inline validation-error `Text`) and
  `post-moment/[id].tsx` (the emoji-chip row and photo picker, styled outside `Field`/`Button`) needed
  their own small edits. `app/event/[id].tsx` (the organizer dashboard) is built the same way — Header/
  Card/StatCard/GuestRow/EmptyState/SwipeableRow — plus its own stat-tint values, which now read
  `tokens.statusConfirmed`/`statusPending`/`statusDeclined` instead of the old static `colors.success`/
  `warning`/`declined`.
- **Per-screen, for the remaining guest tabs.** Detalii, Fond, Chat, Live, and Album each have
  significant local styling (card shapes, section-specific colors) that doesn't route through a shared
  component, so each was migrated directly — plus `MessageBubble`, `PhotoTile`'s caller sites, and
  `ProgressBar` (Fond's fund progress bar, now `accentGold→accentPrimary` instead of the old fixed
  `fundGradient`). `app/invite/[id].tsx` and the `checkout/[id].tsx` stub were themed too (confirmation
  card text, the placeholder card) — `invite/[id].tsx`'s own gradient stays the per-event-type override
  it always was, unaffected by `Screen`'s new default. **Live's hero card was a deliberate fixed-dark
  exception at this point in the migration — no longer true, see the tab-bar/Live-card pass below.**
- **Profile** (`app/profile.tsx`) got the same treatment as everything else — avatar circle, account
  text, and both pill-toggle cards (Language and the Theme toggle itself) now read `useTheme()` instead
  of the static `colors` object they'd been using since the Theme card was first added.
- **Home's header flourish was removed, not just left as-is.** The first pass placed a `BrandFlourish`
  to the right of `BrandHeader` inside a new wrapping row; that wrapper broke `BrandHeader`'s own
  internal `right` slot (the profile-button push-to-edge relied on `BrandHeader` stretching to the full
  row width, which stopped happening once it was no longer the sole/direct child of a stretched flex
  column). Rather than re-engineer the layout to fit both, removed the flourish from Home outright per
  the user's explicit request and reverted to `<BrandHeader right={...} />` directly — the flourish
  still appears on Acasă's fund promo card, per the original two-placement plan.

**Third pass, same day — the create-event wizard and Onboarding, closing out the todo list.** The
4-step wizard (`app/create/type|details|preview|share.tsx`) and `app/onboarding.tsx` were the last two
things not reading `useTheme()`. Same shared-component-first approach as the second pass paid off again
here: `create/type.tsx` and `create/details.tsx` needed **zero screen-level changes** once `TypeTile`
(the event-type grid tile) was migrated — both screens are built entirely from `Header`/`Field`/
`DateTimeField`/`Button`/`Screen`/`TypeTile`, all already themed. `create/preview.tsx` and
`create/share.tsx` each had one or two small local styles (`note`, `cardLabel`/`linkBox`/`link`/`hint`)
that needed direct edits. `app/onboarding.tsx` doesn't use `Screen` at all — it's a standalone
full-bleed paging layout — so it and `SegmentedProgress` (its step-dot component) were migrated
directly: page background, the icon-circle background, title/body text, and the Skip/Next footer all
now read `tokens.*` instead of the static `brand.*` object. **Every screen and shared component in the
app now reads `useTheme()`; there is no longer a "still on the todo list" screen set** — the light-only
`utils/theme.ts` `colors` and `utils/guestTheme.ts` `brand`/`guest` objects remain exported (spacing,
fonts, and a few fixed-by-design surfaces like Live's dark hero card and `SwipeableRow`'s edit/delete
action colors still read them intentionally), but no screen's own background/text/card color reads them
as its *only* source of color anymore.

**Verification status, same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing, after every
edit across all three passes. `useColorScheme()` actually reflecting the device's system setting, the
AsyncStorage override round-tripping through a real app restart, and how any of this genuinely looks on
a screen (gradient wash rendering, dark-mode contrast, the flourish's opacity and position at real
size) are all unverified from this environment — no device or simulator run has happened in any session
so far, per the top of this file.

**Fourth pass — `EventHeaderBar` was missed by the second pass's "themed the tab bar, app-wide" claim,
and its decorative mark is now gone.** `components/guest/EventHeaderBar.tsx` — the back-chevron +
event-name bar that sits *above* the `Tabs` navigator in `app/guest/[id]/_layout.tsx` — is a different
component from the `Tabs` bar itself (which the second pass did theme) and from `components/Header.tsx`
(which the first pass themed). It was never touched, so it kept rendering a solid white back-button
circle and dark `guest.ink` title text on every one of the 6 guest tabs regardless of the active theme
— exactly the "white circle + low-contrast title" bug reported against a real dark-mode run. Fixed the
same way as every other shared component: `useTheme()` for the back button's background/icon
(`surfaceElevated`/`textPrimary`) and the title (`textPrimary`).

**The `✦` mark is deleted, not restyled.** `EventHeaderBar` had a second element — a small purple-soft
circle in the top-right corner rendering a hardcoded `'✦'` character via a `mark` prop (default `'✦'`,
never overridden by its one call site) — with no `onPress`, no navigation, no visible purpose beyond
decoration. Reported as looking like a stray AI/sparkle affordance; removed entirely (the prop, the
`View`, and its styles), not just re-themed, per explicit instruction not to leave a dead tap target
behind. **This was flagged, not reintroduced elsewhere** — if there was a planned feature behind it,
it wasn't findable in this codebase (no `AI`/`assist`-named code, no unused handler referencing it), so
nothing was guessed at or rebuilt in its place.

**Discrepancy worth recording:** the same bug report described this mark also appearing on the
Cont/Account screen (`app/profile.tsx`). Checked that file specifically — it renders through
`components/Header.tsx` (already themed in the first pass), has no `mark`-like element anywhere in its
JSX, and `EventHeaderBar` is never imported there (only `app/guest/[id]/_layout.tsx` imports it). The
mark's only real location in the source is the 6 guest tabs. Whatever appeared on Profile in that
screenshot isn't explained by anything in this file as it exists now — possibly a stale bundle from
before this fix, or a different screen than the one it was attributed to. Not silently assumed to be
fixed by this pass; flagged instead of claiming a verification that didn't happen.

**Fifth pass — the floating tab bar's own colors, and Live's hero card, were both still hardcoded to
the dark palette regardless of theme.** Two separate, later fixes:

- **Tab bar.** `app/guest/[id]/_layout.tsx` already read `tokens.tabBar.*` correctly — the bug was in
  the token data, not the component. `lightTheme.tabBar` in `utils/themeTokens.ts` held the dark-mode
  values (`background: '#251F38'`, `inactive: '#6E6684'`), so the bar rendered as a dark navy-purple
  pill even in light mode. Fixed by giving `lightTheme.tabBar` its own values: `background: '#FFFFFF'`
  (same value as `lightTheme.surfaceElevated`, the token `EmptyState` already uses for its white card)
  and `inactive: '#8A8496'` (same value as `lightTheme.textSecondary`). `active` stays gold
  (`'#F5C36B'`) in both modes — the active tab's contrast comes from the opaque purple `accentPrimary`
  pill behind the icon, not from the bar's own background, so it reads fine against either white or
  navy. `darkTheme.tabBar` untouched.
- **Live's hero card.** Previously a deliberate, fixed dark "night broadcast" surface regardless of
  theme (see the second-pass note above) — the user later asked for it to follow the theme like every
  other card. `app/guest/[id]/live.tsx` now branches on `tokens.mode === 'dark'`: dark mode keeps the
  exact original hardcoded values (`guest.navy`/`guest.white`/`guest.navySoft`/`guest.faint`)
  unchanged; light mode reads `tokens.surfaceElevated` (card), `tokens.textPrimary` (LIVE badge text,
  event title, QR heading), `tokens.textSecondary` (invite-link text), and a new `tokens.surfaceMuted`
  (the empty-photo-slot panel and the QR block's inner panel — see below). The QR code box itself
  (`guest.white` fill, `guest.navy` modules) and the red record dot (`guest.live`) are unchanged in
  both modes, as neither needed to change for legibility.
- **New token: `surfaceMuted`** (`ThemeTokens` in `utils/themeTokens.ts`). Nothing existing fit "a
  muted inner-panel/slot surface, one level deeper than a card" — `surface`/`surfaceElevated` are the
  *card* color itself, so using either for a nested panel inside a white card would make the panel
  invisible. Added `surfaceMuted`, and rather than invent a new hex, both modes reuse an existing
  gradient stop: light is `'#FBEAE0'` (== `background[1]`, the light theme's own warm-peach gradient
  stop), dark is `'#1E1A30'` (== `background[0]`). Only Live's light-mode branch consumes it today;
  dark mode still uses the original literal `guest.navySoft`, unchanged, so `surfaceMuted`'s dark value
  is present for interface completeness/future use, not yet exercised by any screen.

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

**Now genuinely a floating pill — took three passes to get right.** This file used to say "it is not
floating, suspended or rounded — earlier descriptions of it that way were aspirational," because every
prior prompt asking for that shape was checked against git history and found to never have actually
landed. It's built for real now: `borderRadius: 20` on all four corners, `height: 74` (down from the
old edge-to-edge 96), `position: 'absolute'`, `left`/`right: gSpace.xl` for the horizontal margin —
**`gSpace.xl`, not an arbitrary constant**, matching `GuestScreen`'s and `EventHeaderBar`'s own
`paddingHorizontal` exactly (both already used it) so the bar's edges line up with card/section edges
above it. An earlier version of this used a flat `18` here, close to `gSpace.xl`'s `20` but not equal
to it — close enough to not typecheck-fail, wrong enough to visibly not line up with content edges once
actually looked at.

**The first attempt used a non-absolute bar with `marginHorizontal`/`marginBottom`, relying on React
Navigation's automatic content-inset behavior instead of manual positioning — it looked floating in
principle but shipped with two real bugs:** a stray white hairline above the bar, and an oversized,
unbalanced gap below it down to the screen edge. Root cause of both: React Navigation's `BottomTabBar`
applies its own default border-top and its own automatic safe-area-bottom handling to the tab bar
container *underneath* whatever custom `tabBarStyle` you pass, in non-absolute mode. My added
`marginBottom: insets.bottom + 14` didn't replace that automatic safe-area handling, it stacked on top
of it — double-counting the inset. And omitting `borderTopWidth`/`borderTopColor` from my style object
doesn't cancel the library's own default border; a key absent from a later object in a merged style
array doesn't override a value an earlier one set.

**The fix is the standard React Navigation recipe for a floating tab bar: `position: 'absolute'`,
plus `borderTopWidth: 0` set explicitly (not omitted) to actually cancel the default border.**
Absolute positioning takes the bar out of react-navigation's automatic safe-area/height computation
entirely, so there's no longer anything to double-count or fight — `bottom: insets.bottom +
floatingTabBar.gap` (10px) is the *only* source of the bottom offset now, computed inline via
`useSafeAreaInsets()` since it has to react to the actual device inset (large on a notch/Dynamic Island
device, ~0 on an older home-button one) rather than a flat constant. Shadow
(`shadowColor`/`-Radius`/`-Offset`/`elevation`) is static; only `shadowOpacity` is mode-dependent (0.18
light / 0.4 dark) since a plain dark shadow reads very differently against a light versus dark page.

**Taking the bar out of layout flow this way means every guest screen now has to clear it manually —
`floatingTabBar` (`utils/guestTheme.ts`, `{ height: 74, gap: 10 }`) is the shared source both
`app/guest/[id]/_layout.tsx` and every consumer below read, so the two can't drift out of sync.**
`GuestScreen`'s default `paddingBottom` is now `insets.bottom + floatingTabBar.gap +
floatingTabBar.height + gSpace.lg` instead of the old flat `gSpace.xxl` — applies to all 6 tabs, plus
`checkout/[id].tsx` (the one `GuestScreen` consumer outside the tabs navigator, where the extra padding
is a harmless overshoot on a stub screen, not a bug). Acasă's owner-only FAB (`bottom`) and its
FAB-clearing `contentStyle` (`paddingBottom`) are both computed from the same `floatingTabBar` constant
via a local `tabBarClearance` value, replacing the old flat `92`/`gSpace.xl` numbers — the only other
bottom-anchored absolute element across the 6 tabs (checked; nothing else in Detalii/Fond/Chat/Live/
Album is screen-bottom-anchored).

**Tab touch targets are unaffected by any of this — reasoned, not device-verified.** Individual tab
buttons are laid out by React Navigation inside the bar container as a normal internal row, a layer this
pass never touched (no changes to `tabBarItemStyle`, `iconWrap`, icon sizes, or label styles). The bar
has no `overflow: 'hidden'`, so the rounded corners clip rendering only at the exact corner pixels,
never the touch region, and every tab's icon+label already sits well inside the rounded box via
existing padding. This is source-level reasoning, not a tap-tested result — same caveat as the rest of
this file, no device or simulator run has happened in any session so far.

Fill color and active/inactive styling are unchanged across both passes — `tokens.tabBar.background`/
`active`/`inactive` (see §5's Warm Story section), solid `accentPrimary` pill behind the active icon,
gold icon on top.

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
- **`BackButton`** (`components/BackButton.tsx`) — the white-circle, dark-chevron back control, extracted
  from `Header` (which still renders it via `showBack`) so a screen with a hero card instead of a title
  — `app/invite/[id].tsx` — can use the identical control standalone, absolutely positioned top-left over
  the hero rather than inside a `Header`. Both call sites gate it on `router.canGoBack()` rather than
  always rendering it: a screen reached by a cold-open deep link (no session, nothing under it in the
  stack) has nothing to go back to, and a back button that does nothing on tap is worse than no button.
- **Photos use long-press**, never swipe — grid tiles are too small for horizontal gestures. Tap opens
  a full-screen viewer instead (`PhotoTile`, used by Live and Album — see §4 Photo grids).
- `Screen` / `GuestScreen` are the two page wrappers; `GuestScreen` deliberately omits the top safe-area
  inset because `EventHeaderBar` owns it (pass `topInset` for screens without that bar).
- **`Skeleton`** (`components/Skeleton.tsx`) — the one loading-placeholder primitive: a shimmering
  rounded rect (opacity pulse via reanimated, not a gradient sweep — simplest thing that reads as
  "loading" with the animation tooling already in the project). Lavender-gray tone (`#E7E1F5`),
  between `colors.border`/`primarySoft` and `guest.purpleSoft` so it reads on cream, white, and navy
  alike. No default `height` — several skeletons (the Album grid tile) need `aspectRatio` from a passed
  `style` to derive height instead, and a default would win over that. Every screen-specific skeleton
  composes from it rather than drawing its own shapes. Two flavors of where they live: **colocated**
  with the real component when one already exists as its own file — `EventListItemSkeleton`,
  `InvitationListItemSkeleton`, `GuestRowSkeleton`, `MomentCardSkeleton`, `MessageBubbleSkeleton` are
  exported alongside `EventListItem`/`InvitationListItem`/`GuestRow`/`MomentCard`/`MessageBubble` in
  the same file, reusing that file's own `StyleSheet` objects so dimensions can't drift from the real
  layout; **inline** in the screen itself when the real layout is drawn directly in the screen with no
  separate component — Detalii's `DetaliiSkeleton`, Fond's inline card skeleton, and Live/Album's grid
  skeletons all reuse that screen's own `styles.*` objects the same way. **No new loading-state
  plumbing was added** — `useEvents().hydrated` and `useEventContent(id).content === null` already had
  exactly the right semantics (true only during the *first* fetch with no cached data yet; both stay
  "loaded"/non-null through a background refetch, since TanStack Query keeps previous data visible
  during those) before skeletons existed, so every skeleton gate below is one of those two existing
  flags, unchanged — this pass is presentational only. One deliberate deviation from a generic
  "guest-list-row" skeleton shape: `GuestRowSkeleton` has no avatar circle, because the real `GuestRow`
  doesn't either (just a name line + status pill) — matching the actual row's height took priority over
  a generic prescription, to guarantee no layout shift when real rows replace it. `event/[id].tsx`
  additionally now checks `hydrated` *before* its `event === undefined` bail-out (was previously
  checked nowhere on that screen), since without it every event flashed "Event not found" during the
  initial fetch — necessary to reach the guest-list skeleton at all, not a data-fetching change.

---

## 6. Conventions

- **`TouchableOpacity` for every pressable.** Not `Pressable`.
- **Feather icons for UI chrome** (navigation, back, close, edit, delete, add, chevrons). **Emoji only
  for content**: event-type icons (💍 🍼 🎂 💚 🏢 🕊️ ➕), user-authored moment titles, and the
  composer's preset emoji row.
- **Ownership** is always `useEvents().isOwner(event)` — never assume a global role. It's strictly
  `user !== null && event.owner_id === user.id`; there's no other case to handle now that local mode
  (which used to treat an event with no `owner_id` as owned) is gone — `owner_id` is a real, non-null
  Postgres column on every row `fetchEvents`/`fetchEventById` return.
- **Deletes:** structural or costly → `confirmDelete()` from `utils/confirm.ts` (schedule items,
  moments, guests, photos). Low-stakes → immediate (chat messages).
- **No mock or seeded data.** A new event starts genuinely empty — no sample guests, no placeholder
  moments, no fake fund amounts, no invented contributor counts. Every screen must handle the empty
  case with `EmptyState`. This was a repeated source of confusion; do not reintroduce fixtures.
- **Identity in content actions** comes from the real session via the `Actor` type
  (`{ id, label }`), never a hardcoded constant.
- Styling is `StyleSheet.create` with tokens from the theme files — no inline magic numbers for
  colors, spacing or radii.
- **Never hardcode new app-chrome text — wire it through i18n in the same change, not as a follow-up.**
  Any new screen, component, or copy change adds its strings to *both* `locales/en.json` and
  `locales/ro.json` (same nested-by-screen/feature structure as what's there — add a new namespace if
  the screen doesn't have one yet) and reads them via `useTranslation()`'s `t('namespace.key')`, exactly
  like every screen listed in §2 Localization. This covers labels, buttons, headers, empty states,
  error/validation messages, and **placeholder examples** — a Romanian placeholder in an English-labeled
  field is the single most common way this codebase's language-mixing bug has been reintroduced, so
  don't let a new field skip it just because the placeholder disappears once someone types. The one
  exception is user-generated content (event names, moment titles, chat messages, guest names, anything
  a person typed) — that's never translated, see §2. If a string is a plain function outside a component
  (can't call `useTranslation()`), import the `i18n` singleton from `utils/i18n.ts` and call `i18n.t(...)`
  directly instead — `utils/format.ts`'s `formatEventDate` and `app/auth/index.tsx`'s `mapAuthError` are
  the existing examples. When you're done, update the todo comment at the bottom of `utils/i18n.ts` (and
  §2 Localization here) to move the screen out of the "not started" list — that comment is only useful
  if it stays accurate.

---

## 7. Not built / deliberately deferred

- **Supabase Storage uploads — now built for event photos, still not for moments.** As of
  `20260812000001_event_photos_storage.sql` (§3, "Photo uploads — real Supabase Storage,
  dual-resolution"), `addPhoto` (Live/Album) really resizes and uploads two JPEGs to a private
  `event-photos` bucket, reading back via signed URLs — not a local `file://`/`ph://` URI anymore. **The
  identical gap this bullet used to describe for `addPhoto` still applies to `createMoment`
  unchanged**: `app/post-moment/[id].tsx`'s moment composer still stores whatever URI
  `expo-image-picker` hands back straight into `moments.photo_url`, so a moment row written on one
  device still has a photo that resolves to nothing on any other device or guest's screen. Fixing
  moments the same way is a smaller version of the same work (no dual-resolution requirement was ever
  specified for moments, so a single-version upload would likely suffice) — not done, not started.
- **Realtime.** Publication is configured (`supabase/migrations/...rls_policies.sql`) but nothing
  subscribes; every screen is request/response (see §3).
- **Stripe.** The fund UI is complete but `checkout/[id].tsx` is a placeholder screen — no payment,
  no Stripe Connect onboarding, no `contributions` writes (and none should be added client-side — see
  §3's note on why `contribute()` has no real backing implementation).
- **Real invites — partially built.** Server-side invite records now exist —
  `app/add-guest/[id].tsx` writes a real `event_guests` row by email, auto-linked to an account via
  `20260810000003_guest_autolink.sql` — see §3). What's still missing: no email/SMS actually sent to
  the invitee telling them they were invited — they only find out by opening the app themselves and
  seeing it under "My invitations," which requires them to already know to check. The share sheet's
  `povesteanoastra://invite/<id>` deep link still only resolves on the device that created the event,
  and a genuinely new guest account still can't preview the event before RSVPing (§3's invite-preview
  limitation) — inviting by email doesn't fix that, since the not-yet-a-guest problem is about the
  `events` select policy, not about how the `event_guests` row was created.
- **Guest identity is real now.** `event_guests` rows carry a real `guest_email`/`guest_user_id`,
  auto-linked in either direction (§3).
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
