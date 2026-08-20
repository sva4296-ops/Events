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
| Contacts | `expo-contacts` 57.0.4 — bulk guest-invite import; no native multi-select picker in this SDK version, so `components/ContactPickerModal.tsx` builds one in-app instead, see §3 |
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
| `useAuth` | The Supabase session; `signOut`, `signInWithPhoneOtp`/`verifyPhoneOtp`, `updatePhone`/`verifyPhoneChange`, `hasCompletedOnboarding`/`markOnboardingComplete`. Phone-only — no `signIn`/`signUp`/password functions, no email-OTP functions, no `updateEmail` (email is a plain `useUserProfile` field now, not an auth concern at all), see §3's "Phone-only auth." No `mode` field — Supabase is the only path (see the top of this file). Still a Context provider — session state is push-driven via `supabase.auth.onAuthStateChange`, not a fit for query-style pull fetching, and it isn't a resource that exhibited the staleness bug the react-query pass fixed |
| `useEvents` | The events list, Postgres-backed, `['events', userId]` — `createEvent` (async), `updateEvent` (async), `respondToInvite`, `removeGuest`, `addGuest` (async), `isOwner` |
| `useEventContent` | Per-event content, three queries keyed by category (`social`/`details`/`contributions`, see the table above) merged into one `content: EventContent \| null`, plus all their mutations — Supabase write-then-invalidate (of the correct category key) |
| `useEventDraft` | The 4-step create-event wizard draft (in-memory, not persisted) — still a Context provider, this is genuinely ephemeral UI state, not a fetched resource |
| `useGuestEvent` | Provides `{ id, name, event }` to the guest tabs, derived from `useEvents().getEvent(id)` — **see the gotcha below** |
| `useTheme` | The Warm Story light/dark theme — `{ mode, override, tokens, setThemeMode }`. Still a Context provider, same reasoning as `useAuth`: `mode` is push-driven (system `useColorScheme()` unless the user overrides it in Profile), not a fetched resource. See §5 for the full token set and which screens actually consume it yet |
| `useAgency` | Whether the signed-in user owns an agency (`['agency', userId]`), plus `becomeAgency(info)` — a real insert mutation, not a signup-time flag. Plain react-query hook, no provider. See "Agency accounts" and "One auth screen; agency is a Profile upgrade" |
| `useUserProfile` | `first_name`/`last_name`/`display_name`/`email` (`['userProfile', userId]`) plus `saveName` (used by the one-time name step, `app/auth/complete-profile.tsx`, gated by `AuthGate`) and `saveEmail` (a plain, unverified column write — `app/edit-profile.tsx`'s optional email field, see §3's "Phone-only auth") — plain react-query hook, no provider, same shape as `useAgency`. See "Name collection" below |

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
  already current, which `AuthGate` then corrects, in order: no session → `/auth` (the landing screen,
  not a form — see §3's "Landing screen, phone-signup shortcuts everywhere, and name collection moved to
  signup"); onboarding not yet completed for this account → `/onboarding`; both satisfied → left alone
  (normally Home). **There is no longer a name-related redirect step** — that was removed this pass;
  first/last name is collected on the Create Account form itself now, not gated post-auth (see the §3
  section linked above). Onboarding is reached **after** authentication, exactly once per account (any
  device — see §3), not on first app launch. `app/onboarding.tsx`'s `finish()` (tapping the
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

**Superseded — password auth is gone entirely, this whole section describes deleted code.** A later
pass removed password sign-in/sign-up everywhere (email now goes through the same send-code/verify
shape phone already used) — there is no password to forget or change anymore, so
`app/forgot-password.tsx`, `app/reset-password.tsx`, `app/change-password.tsx`, `utils/passwordReset.ts`,
and `useAuth`'s `requestPasswordReset`/`setRecoverySession`/`updatePassword` are all deleted, not just
unused. See "Passwordless auth: email OTP, generalized verify screen" further up this section for the
replacement. Kept below for incident history per this file's own convention — none of it describes
current code.

**Forgot / change password — new this pass, built entirely on Supabase Auth's own reset flow, no new
tables or migrations.** Two flows:

- **Forgot password (unauthenticated).** `app/auth/index.tsx`'s sign-in mode has a "Forgot password?"
  link (hidden in sign-up mode) to `app/forgot-password.tsx` — email input, calls
  `useAuth().requestPasswordReset(email)` (`supabase.auth.resetPasswordForEmail`), then shows the same
  generic notice regardless of what Supabase actually returned — deliberately not branching on the
  response at all, so there's no way for the UI to leak whether an account exists for that email.
  `redirectTo` is `utils/passwordReset.ts`'s `buildResetPasswordRedirectUrl()` —
  `Linking.createURL('/reset-password')`, the exact same `Linking.createURL` pattern `utils/invite.ts`'s
  `buildInviteLink` already used for `povesteanoastra://invite/{id}`.

  **Correction to that shorthand — the real string has three slashes, not two.** Traced
  `node_modules/expo-linking/src/createURL.ts`'s actual logic for this app's config (bare/dev-client
  build → `hasCustomScheme()` true → `getHostUri()` null → empty host segment): `buildResetPasswordRedirectUrl()`
  produces `povesteanoastra:///reset-password`, and `buildInviteLink` has always produced
  `povesteanoastra:///invite/<id>` the same way — every `povesteanoastra://...` mention elsewhere in
  this file is prose shorthand, not the literal value. This isn't cosmetic: parsing both forms with the
  WHATWG `URL` class (what `expo-linking`/Expo Router use internally to extract the routable path) shows
  the two-slash form puts `reset-password`/`invite` in `hostname` with an *empty* `pathname` — Expo
  Router's file-based routing wouldn't match a route to that at all. The three-slash form correctly
  yields `pathname: '/reset-password'`. **Whatever gets registered in Supabase Dashboard → Authentication
  → URL Configuration → Redirect URLs must be the exact three-slash string** —
  `povesteanoastra:///reset-password` — since Supabase's allowlist match is presumably against the
  literal `redirectTo` value the app actually sends; registering the two-slash form would silently
  mismatch and fall back to the Site URL, which is the exact symptom that prompted this note (Supabase
  was falling back to `localhost:3000` before the correct value was registered).
- **Set new password, from the emailed link.** `app/reset-password.tsx` — opened only via that deep
  link, never navigated to from in-app UI. **There is no manual
  deep-link parser anywhere in this app to hook into** — a prompt for this pass assumed one existed
  alongside the `invite/{id}` route; checked, and there isn't one. Every route, including this new one,
  resolves automatically through Expo Router's file-based routing off `app.json`'s `scheme`. The one
  real wrinkle is that `data/supabaseClient.ts` sets `detectSessionInUrl: false` on purpose ("no browser
  redirect to parse in a native app"), so the recovery tokens Supabase appends to the redirect URL
  aren't picked up automatically. `app/reset-password.tsx` reads the incoming URL itself via
  `expo-linking`'s `useURL()`, extracts `access_token`/`refresh_token` with
  `utils/passwordReset.ts`'s `extractRecoveryTokens` (checks the URL fragment first, then the query
  string — supabase-js on this project is on the implicit flow, which puts them in the fragment, but
  which one a real redirect actually uses **has never been exercised from this environment**, see below),
  and feeds them into `useAuth().setRecoverySession` (`supabase.auth.setSession`) before rendering the
  new-password form. Only once that resolves does the screen show the two password fields; a failed or
  missing token shows an "This link isn't valid" state with a button back to `/forgot-password` instead.
  Submitting calls `useAuth().updatePassword` (`supabase.auth.updateUser({ password })`), same function
  the authenticated flow below uses, then routes to `/`.
- **Change password (authenticated).** `app/profile.tsx` gained a "Change password" row in the account
  card (Feather `lock` icon, chevron-right, same row shape as everything else on that card) to
  `app/change-password.tsx` — new password + confirm, same `common.saveChanges`/`Field`/`Screen`/
  `Header` shape every other owner composer already uses (`app/add-guest/[id].tsx` was the template).
  **No current-password re-entry** — `updatePassword` runs directly off the existing session, the same
  "an active session is sufficient authorization" reasoning every other Profile action already follows.
  This was an explicit product decision for this pass (the prompt asked to flag it rather than assume),
  not something to revisit without being asked.
- **Password minimum is 6 characters, reusing `auth.errors.passwordTooShort`** — not a new rule, the
  same one `app/auth/index.tsx`'s sign-up already enforces. "Passwords don't match" is a new key
  (`resetPassword.passwordsDontMatch`), shared by both the reset and change screens.
- **Edit profile (authenticated).** A second row on the Account card (Feather `edit-2`, same row shape
  as "Change password", placed above it) opens `app/edit-profile.tsx` — first name, last name (plain
  `Field`s, writing to `public.users` via `useUserProfile().saveName`, the same function the one-time
  name step uses), email (`Field`, `auth.emailLabel`/`emailPlaceholder`), and phone (`PhoneField`, the
  same shared component `app/auth/phone.tsx`/`add-guest/[id].tsx` already use — chosen over a plain
  `Field` specifically to avoid reintroducing the format-mismatch class of bug documented earlier in
  this section; `utils/countryCodes.ts` gained `splitStoredPhone()`, the reverse of `toStoredPhone()`,
  to pre-fill the dial code + local number from the stored `auth.users.phone` value). Names save
  directly. Email and phone **do not** — changing either only *requests* the change
  (`useAuth().updateEmail`/`updatePhone`, both new, both a thin `supabase.auth.updateUser({ email })`/
  `{ phone }` wrapper), and `auth.users.email`/`phone` don't actually change until Supabase's own
  re-verification completes: email via the confirmation link sent to the new address (same
  out-of-app, click-a-link shape as password reset — nothing to do in-app once requested), phone via an
  OTP Supabase sends to the new number, confirmed with a new `useAuth().verifyPhoneChange(phone, token)`
  (`supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })` — a different `type` than
  `signInWithPhoneOtp`/`verifyPhoneOtp`'s `'sms'`, since this is a change on an existing session, not an
  initial sign-in challenge). The screen shows an inline code field + "Confirm code" button only after
  a phone-change request succeeds, so the OTP step lives inside this one screen rather than reusing or
  duplicating `app/auth/phone-verify.tsx` (which is wired to the sign-in flow specifically). Neither
  re-verification path is bypassed or shortcut — this was an explicit constraint in the request that
  prompted this screen, not an incidental design choice.
- **`AuthGate`'s `PUBLIC_SEGMENTS`** gained `'forgot-password'` and `'reset-password'` — both are reached
  with no session (forgot-password always; reset-password until its recovery-session effect resolves),
  so both need to be exempt from the no-session → `/auth` redirect the same way `'invite'` already is.
- **Google auth does not exist in this app — flagged, not built around.** The prompt that requested this
  pass assumed Google auth existed alongside email/password and asked for Change Password to hide/adjust
  itself for Google-auth users. Checked `hooks/useAuth.tsx` first: it only ever implements
  `signUp`/`signIn` via `supabase.auth.signUp`/`signInWithPassword`, no OAuth provider call anywhere —
  matches this file's own §7 ("No Google/Apple/social auth (email + password only)"), another instance
  of a prompt describing something that was never actually built here. Confirmed with the user before
  writing anything: skip the Google-auth branch entirely rather than build conditional logic against a
  provider that doesn't exist yet. When Google auth is eventually added as its own pass, Change
  Password's hide/adjust behavior for those users needs to be revisited then, not assumed to already
  work.
- **Verification status — same caveat as everywhere else in this file.** Confirmed only by
  `npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing. Completely
  unverified from this environment: whether `resetPasswordForEmail`'s redirect actually reaches this
  app via the custom scheme at all (no email client, no device), whether the recovery tokens really
  arrive in the URL fragment rather than the query string (the `extractRecoveryTokens` fallback exists
  specifically because this wasn't confirmed either way), and whether `setSession`/`updateUser` succeed
  against a real recovery token. This needs a real device run with a real email round-trip to confirm,
  not just a bundle/typecheck pass.

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
- `20260812000002_album_status.sql` / `20260812000003_album_status_cron.sql` — present in the repo
  (album lifecycle tracking, `events.album_status`) but never documented in this file by whichever pass
  added them; left as-is here, not retroactively written up, since this pass didn't touch that feature.
- `20260813000001_agencies.sql` — **not yet applied, not yet confirmed.** Adds the `agencies` table
  (agency signup — see "Agency accounts" below) and a nullable `events.agency_id`, and redefines
  `handle_new_user()` to also create the agency row from signup metadata. Same "no verification path"
  caveat as the Storage migration above — this pass never had DB credentials either.
- `20260818000001_phone_auth.sql` — **not yet applied, not yet confirmed.** Adds `users.phone` and
  redefines `handle_new_user()` again to also populate it, plus fixes the `display_name` fallback for
  a phone-only signup (no email at all). See "Phone auth + phone guest invites" below. Same
  no-verification-path caveat as every migration since `20260810000003` — no DB credentials from this
  environment.
- `20260818000002_guest_phone_invites.sql` — **not yet applied, not yet confirmed.** Adds
  `event_guests.guest_phone`, a contact-method check constraint, a unique `(event_id, guest_phone)`
  index, extends both `link_guest_on_invite()`/`link_invites_on_signup()` to also match by phone, and
  adds the new `get_invite_preview(uuid)` RPC. See "Phone auth + phone guest invites" below.
- `20260819000001_backfill_users_phone.sql` — **not yet applied, not yet confirmed.** Fixes a real
  backfill gap found via a live-data bug report: `public.users.phone` (added by `20260818000001`) is
  only ever populated by `handle_new_user()`, an `AFTER INSERT ON auth.users` trigger — accounts that
  signed up before that migration ran have `auth.users.phone` set but `public.users.phone` still
  `null`, forever (no update trigger, no prior backfill). `link_guest_on_invite()`'s phone match
  (`20260818000002`) looks up `public.users.phone`, not `auth.users.phone`, so a phone invite for one
  of those pre-existing accounts silently failed to auto-link — `guest_user_id` stayed `null` even
  though the account genuinely existed. This migration backfills `public.users.phone` from
  `auth.users.phone`, then re-links any `event_guests` rows whose insert-time trigger missed the match
  because of it. Same shape as `20260810000004_backfill_guest_links.sql`, one column later.
- `20260820000001_user_names.sql` — **not yet applied, not yet confirmed.** Adds `users.first_name`/
  `last_name` and the server-side plumbing for "collect a real name once, use it everywhere" — see
  §3's "Name collection" below.
- `20260819000002_normalize_guest_phone.sql` — **not yet applied, not yet confirmed.** Fixes a second,
  compounding bug found in the same report: `app/add-guest/[id].tsx`'s phone-invite path used
  `toE164()` (`+`-prefixed E.164) to build `guest_phone`, but Supabase stores `auth.users.phone`
  without the `+` — so the auto-link trigger's exact-match comparison could never succeed for *any*
  phone invite, independent of the `20260819000001` backfill gap. `utils/countryCodes.ts` gained
  `toStoredPhone()` (same digits, no `+`) and `stripLeadingZero()` (now applied live in
  `components/PhoneField.tsx` as the user types, and defensively inside `toE164`/`toStoredPhone`
  themselves); `add-guest/[id].tsx` now uses `toStoredPhone` instead of `toE164` for everything that
  touches `event_guests.guest_phone` or compares against `user.phone`. `toE164` itself is unchanged in
  shape — still `+`-prefixed, still used by `app/auth/phone.tsx` for `signInWithOtp`/`verifyOtp`, which
  need the real E.164 format to route the SMS. This migration strips a stray leading `+` from any
  `guest_phone` values already written by the old buggy path, then re-runs the same re-link
  `20260819000001` does.
- `20260819000003_users_backfill_and_agency_fix.sql` — **not yet applied, not yet confirmed.** Fixes
  two things found investigating a report that a phone-signup user had no `public.users` row at all.
  First, a confirmed regression: `20260818000001_phone_auth.sql`'s `create or replace function
  handle_new_user()` fully replaced the function body, silently dropping the agency-row-creation block
  `20260813000001_agencies.sql` had added — `CREATE OR REPLACE` doesn't merge across migrations, so
  agency signups after `20260818000001` was applied would have stopped getting an `agencies` row
  without any error. This migration re-merges both (phone-safe `public.users` insert + agency-row
  creation) into one canonical `handle_new_user()`. Second, a direct backfill: every version of
  `handle_new_user()` in this repo's history is already null-safe for a missing email, so a completely
  *missing* `public.users` row for a real `auth.users` account couldn't be reproduced from the
  migration files alone — no DB access from this environment to inspect what function was actually
  live. Rather than guess further, this backfills any `auth.users` row with no `public.users`
  counterpart (same shape as `20260810000004_backfill_guest_links.sql`), then re-runs the
  phone-guest-link update once more, since a phone invite created before its invitee had a
  `public.users` row would miss the auto-link trigger for that reason alone, independent of the phone
  formatting fixed by `20260819000002`.

**The first three are applied.** The user ran them against the connected project (not this session —
no DB password/service-role key/CLI is available here, only the anon key). The first two were verified
from this session by an anonymous `select` against all 11 base tables: every one returns `200` with an
empty array (RLS correctly denies rows to a request with no `auth.uid()`), where `events` previously
returned `PGRST205`. **This only confirms the schema exists** — it does not confirm a real signed-in
write round-trips, since there's no way to authenticate as a real user from this environment. Treat
writes as typecheck/bundle-verified only until exercised from the running app. Every migration from 3
onward (3, 5, 6, 7, 8, 9, and now the two phone-auth/phone-invite migrations) can't be confirmed the
same way — PostgREST's schema endpoint doesn't expose triggers, functions, or (without an
authenticated request) new tables/columns — so those are taken on the user's word (migration 3) or not
yet confirmed at all (everything after), not independently re-checked.

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

**Narrowed, not closed, by the phone-invites pass (`get_invite_preview`, §3's "Phone auth + phone
guest invites").** That RPC gives a real pre-existing invitee (a genuine `event_guests` row, created
by the organizer via email or phone) a way to see their own event preview even before the auto-link
trigger's write has propagated into this device's cached events list — it checks `guest_user_id =
auth.uid()` as well as `guest_phone`, so the benefit isn't phone-only. What it does **not** fix is the
scenario this note is actually about: someone with **no** `event_guests` row at all (a shared generic
link, not an organizer-issued invite) still can't preview the event — the RPC only ever matches an
existing row for the caller, same chicken-and-egg problem, just for a narrower population than before.

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

### Moment cards without a photo (Acasă)

**Fixed — a photo-less moment left a blank white block instead of showing a placeholder.**
`app/post-moment/[id].tsx` has always let an organizer post a moment with no photo attached
(`photoUri ?? ''`; `remoteEventContentRepository.ts`'s `createMoment` stores `null`, `loadSocial` maps
it back to `''`), but `components/guest/MomentCard.tsx` rendered `<Image source={{ uri:
moment.photo_url }} .../>` unconditionally — an empty `uri` just renders nothing, leaving the photo
slot's `230`-tall block filled with the card's own background color, indistinguishable from the card
itself. Fixed by branching on `moment.photo_url.length > 0`: unchanged `<Image>` when a photo exists;
otherwise a placeholder `View` of the exact same `styles.photo` dimensions, filled with
`tokens.surfaceMuted` (the same "muted inner-panel/slot surface" token Live's empty-photo-slot panel
already uses — chosen over `surface`/`surfaceElevated` for the same reason it was chosen there: those
two *are* the card color, so using either here would recreate the same invisible-blank-block bug with
extra steps), a centered Feather `image` icon, and a `t('acasa.noPhoto')` label — both
`tokens.textSecondary`. New locale key, both languages (`acasa.noPhoto`: "No photo" / "Fără
fotografie"). No layout/padding change — the placeholder fills the same slot the `Image` used to,
nothing else in the card moved. `MomentCardSkeleton`'s loading-state photo block is untouched; this
only affects the loaded, no-photo case.

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

### Agency accounts

A second account type, for businesses that manage events on behalf of clients, distinct from an
individual organizing their own event. The `agencies` table and `events.agency_id` are described in
the schema table below — this section is the app-layer half.

**Signup branching.** `app/auth/index.tsx`'s sign-in → sign-up toggle no longer flips the mode in place
directly; it now routes to `app/auth/choose-type.tsx` first (a new unauthenticated screen, two option
cards). Sign-up → sign-in still flips in place, unchanged. "I'm creating an event for myself" pushes
`/auth?mode=sign-up`, which `AuthScreen` reads via `useLocalSearchParams` to land directly on the
existing sign-up fields — the individual flow itself has zero behavioral changes. "I'm an agency /
professional organizer" pushes `app/auth/agency-signup.tsx`, a new screen collecting `company_name`,
`cui` (required, validated against a simple `/^RO?\d{2,10}$/i` pattern — Romanian tax ID, optionally
RO-prefixed), `registration_number`/`address` (optional), plus the same email/password fields as
individual sign-up.

**Why the agency row is created by a trigger, not a client insert.** The connected project has email
confirmation ON (see Auth flow above), so `supabase.auth.signUp()` never yields a session — there is no
`auth.uid()` available to insert into `agencies` as at the moment of signup. Same shape as the
guest-autolink problem this file already documents: `useAuth().signUp(email, password, agency?)` now
accepts an optional `AgencySignupInfo` object and, when present, passes it through as
`options.data` (`account_type: 'agency'`, `company_name`, `cui`, `registration_number`, `address`) — the
same `raw_user_meta_data` channel `handle_new_user()` already reads `display_name` from.
`20260813000001_agencies.sql` extends that trigger to also insert the `agencies` row when
`account_type = 'agency'`, `on conflict (owner_user_id) do nothing`. This runs at `auth.users` insert
time — immediately, before email confirmation — so by the time the account is confirmed and signed in
for the first time, the agency row already exists; no extra post-confirmation step was needed.
Individual signup passes no `agency` argument at all, so `options` is `undefined` and `account_type`
defaults to `'individual'` in the trigger — zero behavioral change to that path.

**`agency_id` is a tag, not a new access-control boundary, and not read by any screen today.** In this
pass an agency has exactly one user, its owner, and every event that owner creates already has
`organizer_id` equal to their own id — so the existing `organizer_id`-based RLS on `events` already
covers agency-created events end to end. No new `events` policy was added. `hooks/useEvents.tsx`'s
`createEvent` calls `useAgency()` internally and passes `agency?.id ?? null` through to `insertEvent` —
an agency owner's events get tagged automatically, with no new screen or step in the create-event
wizard, and an individual user (no `agencies` row) is completely unaffected (`agency` is `null`, so
`agency_id` is `null`). If agency staff/multi-user accounts are ever added, that's the point a real
agency-membership RLS policy is needed — not assumed here.

**There is no separate agency dashboard — built, then removed the same pass.** An `app/agency/index.tsx`
route existed briefly (a plain event list filtered by `agency_id`, reached via a briefcase icon on
Home), with Home's own "Your events" filtered to `agency_id === null` so the two screens wouldn't show
the same events twice. Real usage feedback reversed this: seeing your own events required a second
screen, and the filter made "Your events" look empty (with its create-event empty-state CTA) for an
account whose events were all agency-tagged. Removed entirely rather than patched — `app/agency/`, the
briefcase icon, `useAgencyEvents`/`fetchAgencyEvents`, `AgencyEventSummary`, and the `agency.*`/
`home.agencyDashboard` locale keys are all gone. **Home now shows every event the user organizes,
agency-tagged or not, exactly like an individual account** — `ownedEvents = events.filter(isOwner)`,
no `agency_id` check. `agency_id` itself, the `agencies` table, and the auto-tagging on create (above)
are all still real and unchanged — the column is populated, just not consumed by any screen right now.
If a future pass wants an agency-specific view again, don't reintroduce a second full-list screen
without also solving the "where do MY events live" confusion this one caused — a filter/badge on the
existing list is more likely right than a second destination.

**"My invitations" is still hidden outright for agency accounts** — this part of the pass wasn't
reversed. There's no legitimate agency-owner invitation to ever display, so `app/index.tsx` skips
rendering the whole "My invitations" `View` when `useAgency().isAgencyOwner` is true; an explicit
product decision, confirmed with the user. **This does not stop anyone from actually inviting an agency
account's email as a guest** — `insertGuestInvite` and the `20260810000003` auto-link trigger are
untouched, so a resulting `event_guests` row would still be created and linked, just not surfaced
anywhere in this app's UI for that account. Blocking the invite itself was considered and explicitly
deferred — it would mean teaching the guest-invite path or the auto-link trigger about agency accounts,
a real behavior change to already-shipped infrastructure, not a screen-level filter.

**`hooks/useAgency.tsx`** — one plain react-query-backed hook now (`useAgencyEvents` was removed with
the dashboard above), same shape as `useEvents`/`useEventContent`, no Context/Provider. Answers "does
the signed-in user own an agency" by whether a row exists in `agencies` for them (`['agency', userId]`,
`staleTime: 180s` — details-category, since nothing edits an agency's own info this pass) —
deliberately not a separate `account_type` column on `users`, to avoid the two ever drifting out of
sync. Both remaining consumers (`app/index.tsx`'s invitations-hiding, `hooks/useEvents.tsx`'s
`agency_id` auto-tagging) only need `agency`/`isAgencyOwner`, not a full event list.

**`utils/authErrors.ts` — new, not agency-specific.** `mapAuthError` (Supabase error → field) moved out
of `app/auth/index.tsx` into its own file so `app/auth/agency-signup.tsx` could reuse the exact same
classification instead of duplicating it. No behavior change to the individual flow — same function,
same call site, just relocated.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing, after every
edit across this pass (agency signup, the dashboard that was added then removed, and the invitations
hide). `20260813000001_agencies.sql` is written but not applied (see the Reality check entry above) —
whether `handle_new_user()`'s extended metadata read actually fires correctly, whether
`raw_user_meta_data` really carries the fields through Supabase's signup flow as expected, and how any
of the new screens actually look/feel are all unverified from this environment, same as everything else
marked unconfirmed in this file.

### Phone auth + phone guest invites

A second auth method (phone number + OTP) and a second guest-invite method (by phone number),
additive to the existing email/password auth and email-only invites — neither existing path was
restructured. Phone and email accounts are **fully separate identities**, no linking, same
"one identity per signup" precedent as agency accounts above.

**Auth (`hooks/useAuth.tsx`).** `signInWithPhoneOtp(phone, channel = 'sms')` calls
`supabase.auth.signInWithOtp({ phone, options: { channel } })` — Supabase creates the account on
first use (`shouldCreateUser` defaults true), so there is no separate phone "sign up": every phone
login is the same call, and every login is a fresh OTP challenge, never a stored phone-password.
`verifyPhoneOtp(phone, token)` calls `supabase.auth.verifyOtp({ phone, token, type: 'sms' })` — the
verify `type` is `'sms'` regardless of which channel actually delivered the code, per Supabase's own
API shape; **unverified from this environment**, no way to send or receive a real SMS here. On
success, `onAuthStateChange` fires exactly like an email sign-in — no phone-specific session handling
exists anywhere, and `AuthGate`'s existing onboarding check already routes a brand-new phone account
through `/onboarding` the same as a brand-new email account, with no changes to `AuthGate` itself
(`app/auth/phone.tsx`/`phone-verify.tsx` fall under the `'auth'` `PUBLIC_SEGMENTS` entry the same way
`choose-type`/`agency-signup` already do). `AppUser` gained `phone: string | null`; `label` falls back
to `email ?? phone ?? 'Tu'`. The channel parameter (`'sms' | 'whatsapp'`, default `'sms'`) exists from
the start specifically so a WhatsApp toggle can be added later as a UI change, not a refactor — only
SMS is actually wired into any screen this pass. **Individual accounts only** — there is no
phone-based agency signup; flagged as deferred scope, not built.

New screens: `app/auth/phone.tsx` (country-code picker via the new `components/PhoneField.tsx` +
`utils/countryCodes.ts`, local-number field, "Send code") and `app/auth/phone-verify.tsx` (code field,
30s local resend cooldown). Reached from a new "Continue with phone number" link on `app/auth/index.tsx`,
visible in both sign-in and sign-up mode (there's only one phone flow, not two). `PhoneField` combines
a dial code + local number into E.164 via `toE164()`, stripping non-digit characters from pasted
input first.

**`public.users.phone`** (added by `20260818000001_phone_auth.sql`) mirrors `auth.users.phone`, same
denormalization reasoning already used for `email`. `handle_new_user()` was redefined again to
populate it and to fix a real gap: the old `display_name` fallback
(`split_part(email, '@', 1)`) produced `null` for a phone-only signup with no email and no
`display_name` metadata. It now falls back through `display_name` metadata → the email-derived name →
the phone number itself → the literal string `'Guest'`. **No RLS policy needed a change** — checked
every policy in `20260810000002_rls_policies.sql`, none reference the email column, all key off
`auth.uid()` alone.

**Phone guest invites** mirror the email-invite shape exactly. `event_guests.guest_phone` (added by
`20260818000002_guest_phone_invites.sql`) is a parallel nullable column to `guest_email`, with a new
`event_guests_contact_check` constraint requiring at least one of `guest_email`/`guest_phone`/
`guest_user_id` to be set (safe against existing data — every current insert path already sets one),
and a unique `(event_id, guest_phone)` index mirroring `event_guests_unique_email`. Both directions of
the auto-link trigger from `20260810000003_guest_autolink.sql` were extended, not replaced:
`link_guest_on_invite()` tries an email match first, then a phone match, if `guest_user_id` is still
unset after either; `link_invites_on_signup()`'s single `update` statement gained an `or` arm matching
`guest_phone` against the newly-signed-up account's `phone`. `data/eventsRepository.ts` gained
`checkGuestPhoneInvited`/`insertGuestInvitePhone` as siblings to the email functions (not a
restructure of them), and `mapGuestRow`'s name fallback chain gained `guest_phone` as a third
fallback after `guest_name`/`guest_email`. `hooks/useEvents.tsx` gained `addGuestByPhone`, an exact
mirror of `addGuest`'s refetch-single-event-after-insert shape. `app/add-guest/[id].tsx` gained an
email/phone toggle (one method per submission, not both at once) instead of becoming two screens.

**`get_invite_preview(p_event_id uuid)` — new RPC, and why it exists despite the auto-link trigger
already running before a session exists.** Tracing the trigger timing: `link_invites_on_signup()`
fires on `public.users` insert, which happens at `verifyPhoneOtp`/`signUp` time — before a session is
even established. So for an *already-invited* guest, by the time they have a real session their
`guest_user_id` is typically already linked, and the existing `can_view_event`/`is_event_guest` RLS
already lets the normal `fetchEvents()` see the event with no RPC involved. The RPC earns its place
for two other reasons instead: (1) the planned standalone Next.js web-fallback page (see
`docs/web-invite-fallback-spec.md`, not built this pass) has no `useEvents`/`eventsRepository.ts` at
all — it needs its own minimal, purpose-built read for "show me my one pending invite," and a narrow
`security definer` function is a much smaller security surface than teaching a second codebase broad
`events`/`event_guests` access; (2) defense-in-depth in this app itself for the case CLAUDE.md's
existing "invite preview under RLS" note already flags as unverified — whether the auto-link-before-
session-exists timing actually holds on a real device has never been confirmed, since this app has
never run on one. The RPC derives the caller's own phone from `public.users` via `auth.uid()` **only**
— never from a client parameter — so a URL can't be used to see someone else's invite; it returns zero
rows for anyone without a matching invite. `execute` is granted to `authenticated` only (not `anon`),
mirroring `reset_test_data()`'s grant-narrowing pattern. `app/invite/[id].tsx` calls it (via
`data/eventsRepository.ts`'s `fetchInvitePreview`) only as a fallback, after the normal
`useEvents`-backed lookup comes up empty for a signed-in session — the already-linked path (today's
behavior, unchanged) never reaches this code. The fallback renders `InviteCard` fed by the RPC's
narrower `InvitePreview` shape (`types/event.ts`) instead of a full `AppEvent`, with the same
Confirm/Decline buttons calling the same `respondToInvite`.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing. Both
migrations are written but not applied (no service-role/CLI access from this environment, same as
every migration since `20260810000003`) — real Twilio SMS delivery (dashboard-side provider
configuration is the user's own step, not verifiable from here), a real OTP verify round-trip, the
auto-link trigger's actual timing, and the RPC's behavior against real data are all unverified.

### Bulk guest invites — manual rows + contacts import, then a WhatsApp send queue

**New capability, built on the existing single-invite flow (`app/add-guest/[id].tsx`, wa.me-based —
see "Phone-only auth" further down) rather than duplicating it.** `utils/whatsappInvite.ts`'s message
template and URL builder are unchanged and reused as-is; the only change there is
`sendGuestWhatsAppInvite`'s return type, `Promise<void>` → `Promise<boolean>` (did it actually open
WhatsApp, as opposed to falling back to the share sheet or erroring) — the single-invite screen still
ignores the return value, unaffected.

**Two requested pieces already existed under different names/shapes — corrected rather than
duplicated, see `20260822000001_bulk_guest_invites.sql`'s own header comment for the full reasoning:**
`event_guests.invited_at` already exists (`20260810000001_initial_schema.sql`), `not null default
now()`, meaning "when this row was created" — not available to repurpose as "when the organizer tapped
Send," so that's a new column, `whatsapp_sent_at`, nullable, no default. And a unique index on
`(event_id, guest_phone)` already exists (`20260818000002_guest_phone_invites.sql`), but as a *partial*
index (`where guest_phone is not null`) — Postgres can't use a partial index as an `ON CONFLICT` arbiter
for a plain `supabase-js` `.upsert()` call, so the migration adds a real, non-partial `unique
(event_id, guest_phone)` constraint alongside it (safe to add unconditionally — NULLs are mutually
distinct under standard SQL, and the existing partial index already guarantees no non-null duplicates
exist to violate it).

**The batch save goes through a new RPC, `upsert_event_guests_batch(p_event_id, p_guests jsonb)`, not a
plain client-side upsert.** A naive `.upsert()` overwrites every column in the payload on conflict,
which would silently reset `rsvp_status` back to `'pending'` for a guest who'd already responded, and
null out an existing `guest_name` whenever the organizer resubmitted the same phone without retyping a
name. The RPC only ever does `set guest_name = coalesce(excluded.guest_name, event_guests.guest_name)`
— `rsvp_status` is never touched by it at all, so an existing response is never clobbered.
`security invoker` (not `definer`) — runs as the calling session, so the existing "organizer manages own
event's guest list" RLS policies apply unchanged; no new access is granted beyond what an organizer's
session already has via a plain `.insert()`/`.update()`.

**`app/bulk-add-guests/[id].tsx`** — repeatable Name + `PhoneField` rows (add/remove), reached from
`app/event/[id].tsx`'s new second "+" button (Feather `users`, next to the existing single-invite one).
Submitting calls `useEvents().addGuestsBatch` (the RPC above, same refetch-single-event shape every
other guest mutation already uses) and hands off to the send queue below — it doesn't send any WhatsApp
messages itself.

**Contacts import — `components/ContactPickerModal.tsx` — is a custom in-app multi-select, not a native
picker, because the installed `expo-contacts` (57.0.4, added this pass) genuinely doesn't expose a
multi-select system picker in its default export.** Checked the package's own type definitions rather
than assuming: `Contact.presentPicker()` returns a single `Contact | null`; the only multi-contact
return is `Contact.presentAccessPicker()`, which is iOS 18+ only and is Apple's *limited-access
grant* picker (choosing which contacts to share with the app at the OS permission level), not a "pick
guests to invite" UI — using it for that would be both platform-limited and semantically wrong. This
modal instead uses `Contact.getAllDetails([GIVEN_NAME, FAMILY_NAME, PHONES], ...)` (the bulk, no-N+1
detail fetch) rendered as a checkbox `FlatList` inside a `Modal`, styled the same bottom-sheet way
`components/PhoneField.tsx`'s own country picker already is — not a new modal pattern. A picked
contact's phone is normalized via the new `utils/countryCodes.ts` function below, then immediately run
through `splitStoredPhone` (already existed, previously only used to pre-fill `edit-profile.tsx`) to
convert it back into a dialCode/localNumber pair — so an imported row renders through the exact same
`PhoneField` a manual row does, not a separate read-only display, and stays editable.

**`utils/countryCodes.ts` gained `normalizeToStoredPhone(raw)`** — for a contacts-picker string, which
can arrive in almost any format, unlike `toStoredPhone`'s dial-code + local-number pair from a picker
UI. A `+` or a leading `00` is trusted as already carrying a country code; otherwise the number is
treated as Romanian (this app's existing `DEFAULT_COUNTRY_CODE`), same leading-zero handling as
`toE164`. A heuristic, not a real parser, same limitation any phone input without an explicit
country-code picker has — documented as such in the function's own comment.

**Permission denial has no Sentry breadcrumb — there's no Sentry in this codebase (checked again for
this feature specifically).** `ContactPickerModal` shows a visible inline message instead when
`Contacts.requestPermissionsAsync()` comes back denied, which is strictly more useful to the organizer
than a breadcrumb they'd never see. Same substitution for the requested `Sentry.captureException` on
the batch-save failure path — `app/bulk-add-guests/[id].tsx` uses `reportSupabaseError`, this app's one
real generic-failure surface, same as every other write in the app.

**`app/send-invites/[id].tsx`** — the pending queue, derived client-side from `useEvents()`'s existing
per-event `guests` array (`status === 'pending' && whatsappSentAt === null && phone !== null`) — no
separate fetch. "X of Y sent": Y is captured once via a lazy `useState` initializer on mount (the queue
shrinking afterward shouldn't shrink the denominator too); X only increments on a *confirmed* WhatsApp
open (`sendGuestWhatsAppInvite`'s new boolean return), not on the share-sheet fallback or on Skip — Skip
is session-local only (a `Set` in component state), never writes `whatsapp_sent_at`, so a skipped guest
is back in the queue the next time this screen opens, exactly as asked. A guest whose only stored name
is their own phone number (the `mapGuestRow` fallback when no real name/email exists) gets an empty
greeting instead of "Bună 40790586600," — checked for `guest.name === guest.phone` rather than adding a
new column just to distinguish "real name" from "fallback," since the existing `Guest.name` already
collapses that distinction and this is the only place it mattered.

**`components/GuestRow.tsx` gained a second, small badge — distinct from `RsvpBadge`, only shown
alongside a still-`pending` phone-based guest.** A filled check pill ("Invited," `whatsapp_sent_at` set)
or a clock pill ("Not sent," still null) — once a guest actually responds (confirmed/declined), the
existing `RsvpBadge` already says everything that matters and this second badge stops rendering; an
email-only pending guest has no WhatsApp concept to show a status for, so it's skipped for them too.
`app/event/[id].tsx` also gained a "Send pending invites (N)" button (only rendered when N > 0) next to
the guest list, alongside the new "+ Add multiple" entry point.

**Requires a native rebuild — not achievable from this session, same as every other native dependency
addition in this file.** `expo-contacts` (`57.0.4`) is a new native module, added to `app.json`'s
`plugins` with a real `contactsPermission` string (not the library's generic default) rather than left
unconfigured. See §1's Tech stack table convention and the top of this file's dev-build note.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing, against the
`expo-contacts` types actually installed (not assumed from memory — the package's real `.d.ts` files
were read directly before writing any code against them, specifically because this SDK version's API
shape turned out to differ from what's commonly documented). The migration is written but not applied
(no service-role/CLI access from this environment, same as every migration since `20260810000003`) — the
RPC's actual behavior, the real unique constraint coexisting with the pre-existing partial index, and
how any of the three new/changed screens look or feel are all unverified until a real device run.

### Editing business info; the business/individual identifier, made explicit

**`useAgency().isAgencyOwner` was already the "is this a business account" check — this pass just
gave it a real second consumer and an edit path.** No new state was added: `isAgencyOwner` is (and
always was) derived purely from whether a row exists in `public.agencies` for the signed-in user
(`['agency', userId]`, react-query), not a signup-time flag — exactly the design this section's earlier
passes already committed to. It already updated without a restart or re-login, because `becomeAgency`'s
`onSuccess` already invalidated that query key; this pass didn't need to add that behavior, only rely on
it for a second mutation.

**New: `useAgency().updateAgency(info)`**, alongside the existing `becomeAgency`. Same shape
(`data/agenciesRepository.ts`'s new `updateAgency` — `update ... where owner_user_id = <uid>`, allowed
by the `agencies` table's existing "agency owner updates own agency" policy, unchanged since
`20260813000001_agencies.sql`), same `onSuccess` invalidation. No new migration needed — the UPDATE
policy has been live in every migration file since the table was created; nothing about it was ever
insert-only.

**`components/AgencyFields.tsx` — new, extracted so `app/agency-signup.tsx` (create) and
`app/edit-profile.tsx` (update) can't drift apart.** Company name / CUI / registration number / address
as four controlled `Field`s (paired value/onChange props per field, the same shape
`components/PhoneField.tsx` already established) plus `validateAgencyFields` and the `CUI_PATTERN`
regex, both previously duplicated inline in `agency-signup.tsx` alone, now the one place either screen
reads them from. `app/agency-signup.tsx` was rewritten to consume this component instead of drawing its
own fields — no behavior change there, just de-duplication.

**`app/edit-profile.tsx` gained a conditional "Business details" section** — rendered only once
`useAgency()` has hydrated and `isAgencyOwner` is true (mirrors `app/profile.tsx`'s existing
`agencyHydrated && !isAgencyOwner` guard for its own "Add business account" row, just inverted).
Pre-filled from `agency` via a `useEffect` keyed on the `agency` object (not relied on being warm at
mount — `useUserProfile`'s data can assume AuthGate already forced a fetch; `useAgency`'s can't, since
nothing gates on it centrally, so this screen can't assume the query is warm just because Profile
usually visits first). Folded into the screen's single existing "Save changes" button/handler rather
than getting its own submit action — validated with the same `validateAgencyFields` right alongside the
email-format check, before any writes start, matching how this screen already validates before saving.
Individual accounts render nothing extra here at all; the section simply doesn't mount.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing. Unverified: the
actual update round-trip against a real `agencies` row, and how the new section looks/feels inline with
the rest of the edit-profile form — no simulator run has happened in any session so far.

### Phone-only auth — email is no longer an identifier at all

**Auth is phone-only now, end to end.** Email-based sign-in/sign-up is removed completely — not
deprioritized, not kept as a fallback. `app/auth/index.tsx` (the one auth screen, see "One auth screen…"
below) lost its Email/Phone tab toggle entirely; it's just a `PhoneField` + "Send code" now, the same
shape it already had for the phone tab, minus the tab. `app/auth/verify.tsx` lost its `channel` param
and email branches the same way — it was already generic over "phone or email," and since there's only
one channel left, it's just phone again, but the screen itself wasn't duplicated back apart (still one
file, still reused for what it already did). `hooks/useAuth.tsx` lost `signInWithEmailOtp`,
`verifyEmailOtp`, and `updateEmail` outright — nothing in the auth layer touches email anymore.

**Email survives as exactly one thing: an optional, unverified profile field.** `public.users.email`
already existed (it used to mirror `auth.users.email` for whichever account created itself via email —
see the superseded sections below) and was already nullable, so no migration was needed to repurpose it.
What changed is *how* it's written: `app/edit-profile.tsx`'s email field used to go through
`useAuth().updateEmail()` → `supabase.auth.updateUser({ email })`, Supabase's real auth-email-change flow
(new address, confirmation link, `auth.users.email` doesn't change until it's clicked). That's gone.
`hooks/useUserProfile.tsx` gained a `saveEmail` mutation (`data/usersRepository.ts`'s new
`saveContactEmail`) that's a plain `update users set email = ...` — no Supabase Auth call, no
verification, exactly the same shape `saveName` already used for first/last name. Basic format
validation still runs client-side (still using `auth.errors.invalidEmail`) since that's just data
hygiene, not identity verification — the distinction the whole redesign is about is *verification*, not
*validation*. `useAuth().updatePhone`/`verifyPhoneChange` are untouched — phone really is the account's
auth identifier, so a phone change still genuinely needs Supabase's OTP re-verification; that's not the
same category of thing as email anymore.

**Guest invites are phone-only too — this was explicitly requested alongside the auth change, not
inferred.** `app/add-guest/[id].tsx` had its own, separate Email/Phone method toggle (inviting a guest
by email, independent of how *that guest* would eventually sign in) — removed, along with its
`submitEmail` branch, `checkGuestEmailInvited` call, and `EMAIL_PATTERN`/email `Field`. The screen is now
exactly the phone half it already had (`checkGuestPhoneInvited` → `addGuestByPhone`), unconditionally.
**Checked first, not assumed: there was no SMTP/email-sending integration anywhere in this repo to remove
either** (no nodemailer, no SendGrid/Resend/Mailgun, no Supabase Edge Function doing it) — grepped the
whole tree, nothing. The email-invite path was always just an `event_guests` row with `guest_email` set,
the same "no actual delivery, ever" gap §7 already documents for phone invites (no Twilio send either) —
there was never a working auto-send feature to remove, only a UI path to it.

**Deliberately left alone: the email side of the guest-invite *backend*.** `data/eventsRepository.ts`'s
`checkGuestEmailInvited`/`insertGuestInvite`, `hooks/useEvents.tsx`'s `addGuest` (email), the
`event_guests.guest_email` column, and `20260810000003_guest_autolink.sql`'s email-matching direction
are all untouched — inert now that no screen calls them, not reverted. Same reasoning as leaving
`handle_new_user()`'s dormant agency-metadata branch alone in the previous pass: ripping out working
schema/trigger logic that simply isn't exercised anymore is churn, not a fix, and wasn't asked for. If a
future pass wants those columns/triggers actually gone, that's a deliberate schema decision to make on
its own, not a side effect of an auth-flow change.

**Nothing here touched the invite-*preview* flow (`app/invite/[id].tsx`, `get_invite_preview`) —
checked, not assumed.** The request specifically asked to remove any "was this person invited by phone
or email, pre-fill accordingly" branching from the invited-user sign-in flow. Traced it: no such
branching ever existed. The auth screens have never taken an invite-related identifier as a param or
pre-filled anything from a deep link — `app/invite/[id].tsx`'s own email/phone matching (in
`get_invite_preview` and the auto-link triggers) is about recognizing an *already-invited* row against
the *currently signed-in* session, which is a separate concern from the sign-in screen itself. There was
nothing to remove here; noting that explicitly rather than silently doing nothing and leaving the request
unaddressed.

**Flag, not a code change: the Supabase Dashboard's Auth Providers panel.** Nothing in this repo
configures which providers are enabled server-side (no `supabase/config.toml`, checked — this project
has never had one) — that's Dashboard-only, Authentication → Providers, same category as the Twilio SMS
and email-template gaps already flagged elsewhere in this file. The app code no longer calls
`signInWithOtp({ email })` anywhere, so leaving the Email provider enabled there is inert from this app's
own perspective — but if the connected Supabase project should stop accepting email-based auth
altogether (e.g. a stray direct API call, or another client hitting the same project), disabling it
Dashboard-side is the only way to actually close that off; app code can't do it.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing, plus a repo-wide
grep confirming no remaining `signInWithEmailOtp`/`verifyEmailOtp`/`updateEmail` call, no email/phone
method toggle left in either auth or guest-invite screens, and no SMTP-style email-sending code anywhere
in the tree. Unverified: the real end-to-end phone OTP round-trip (signup, login, invite) on a device —
no simulator run has happened in any session so far — and whatever the Supabase Dashboard's Auth
Providers panel is actually set to today, which this environment has no credentials to check.

### One auth screen; agency is a Profile upgrade, not a signup branch

**Partially superseded by "Phone-only auth" above — the email/phone tab toggle this section describes
is gone; everything else below (one screen, no account-type question, agency as a Profile upgrade) is
still accurate.** Read this section for the screen-count/agency-location history, and "Phone-only auth"
above for what actually happens on the identifier field today.

**Supersedes both sections below — the multi-screen entry (Welcome → Mobile/Email choice →
individual/agency choice → identifier) was overbuilt. Corrected back down to what was actually asked
for: one screen, email or phone, OTP, done. Agency signup was never supposed to be part of account
creation at all — it's now a Profile action on an already-existing account.** Everything in "Passwordless
auth" and "Two-screen auth entry" further down accurately describes what those passes built, but none of
it is current — kept for incident history per this file's own convention.

**`app/auth/index.tsx` is one screen again — no Screen 2, no `choose-type.tsx`, no account-type
question.** A two-tab toggle (`auth.emailTab`/`phoneTab`, styled like Profile's existing
Language/Theme pill toggles — the one place in the app that pattern already existed) switches between a
plain email `Field` and a `PhoneField`; one "Send code" button calls `signInWithEmailOtp(email)` or
`signInWithPhoneOtp(phone)` depending on the active tab and pushes to `app/auth/verify.tsx`
(`?channel=email|phone&identifier=...`). No `mode` param anywhere in this flow — there was never a real
sign-in/sign-up distinction to carry (Supabase's OTP call already creates the account on first use), so
threading `mode` through four screens to compute a `needsName` flag was solving a problem that only
existed because the flow had been split into four screens in the first place. `app/auth/method.tsx`,
`app/auth/choose-type.tsx`, `app/auth/email.tsx`, and the auth-flow `app/auth/agency-signup.tsx` are all
deleted.

**`app/auth/verify.tsx` is simpler too — no `needsName`, no routing decision of its own.** On a
successful `verifyEmailOtp`/`verifyPhoneOtp` it just does `router.replace('/')`, full stop.
`AuthGate` — not this screen — decides what actually happens next.

**Name collection moved back to a global `AuthGate` check, exactly like the original pre-passwordless
design.** `app/auth/complete-profile.tsx` (renamed from `app/name.tsx` two passes ago, then briefly
routed to via a query-param flag) is reached the same way onboarding already is: `AuthGate` reads
`useUserProfile().firstName`, and if it's `null` for a signed-in user, redirects there — re-evaluated on
every effect run (not a one-shot ref, unlike the onboarding check below it), so it naturally stops
redirecting the instant `firstName` flips to non-null, with no screen needing to own its own "next."
This applies uniformly to every account — new or old, email or phone, agency or individual — there's no
special-casing left to maintain. `complete-profile.tsx` itself no longer calls `router.replace('/')`
after saving; it just calls `saveName()` and lets `AuthGate`'s effect notice.

**`useAuth.tsx` is back to pure identifier-and-code — no `name`/`agency` parameters on
`signInWithEmailOtp`/`signInWithPhoneOtp` at all anymore.** `buildSignupMetadata`, `AgencySignupInfo`,
and `SignUpNameInfo` are deleted from this file entirely — nothing in the auth layer needs to know about
either concept now that both are handled elsewhere (name via `complete-profile.tsx`, agency via the new
flow below). `signInWithEmailOtp(email)` / `signInWithPhoneOtp(phone, channel?)` are the whole surface.

**Agency accounts: created after signup, on Profile, by upgrading the existing account in place — not a
different signup path.** `app/profile.tsx` gained an "Add business account" row (Feather `briefcase`,
same row shape as "Edit profile"), rendered only while `useAgency().isAgencyOwner` is false, opening the
new top-level `app/agency-signup.tsx` — company name, CUI, registration number (optional), address
(optional). No name/email/password fields; the signed-in account already has all of that. Submitting
calls a new `useAgency().becomeAgency(info)` mutation, which is a real client-side
`insert into public.agencies` (`data/agenciesRepository.ts`'s new `insertAgency`), invalidating
`['agency', userId]` on success so the Profile row disappears immediately once the insert lands.

**This needed a real RLS policy change, not just app code — `agencies` previously had no insert policy
on purpose.** `20260813000001_agencies.sql`'s own comment is explicit about why: at the time, the only
way an agency row was ever created was `handle_new_user()` (security definer, fires at `auth.users`
insert time, before email-confirmation signups even have a session) — a client-side insert was never
needed and was deliberately not allowed. That reasoning no longer holds once agency creation is a
Profile action taken from an established session. New migration
`20260821000001_agency_self_signup.sql` adds exactly one policy: `for insert with check (owner_user_id =
auth.uid())` — a session can only ever insert a row naming itself as owner, and the table's existing
unique constraint on `owner_user_id` still caps it at one agency per account, same as before.
`handle_new_user()`'s own agency-creation branch (reading `account_type`/`company_name`/etc. from signup
metadata) is untouched and still there — inert now, since nothing sends that metadata anymore (the auth
screen never collects it), but harmless to leave rather than churn a working trigger definition for a
path that simply won't be exercised going forward.

**`supabase/migrations/20260820000002_signup_name_metadata.sql`** (from the "Passwordless auth" pass,
reading `first_name`/`last_name` out of signup metadata) is inert the same way — nothing calls
`signInWithEmailOtp`/`signInWithPhoneOtp` with a name anymore, so those `raw_user_meta_data` keys are
just never present. Every account's name now comes exclusively from `complete-profile.tsx`, post-signup.
Not reverted, for the same "harmless, not worth churning" reasoning as above.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing, plus a repo-wide
grep confirming no remaining reference to any deleted route (`/auth/method`, `/auth/choose-type`,
`/auth/email`, `phone-verify`, `phone-name`) or dead locale namespace (`landing.*`, `method.*`,
`emailAuth.*`, `accountType.*`). The new RLS insert policy, and the whole flow end-to-end on a real
device, are unverified — no DB credentials and no simulator run from this environment, same as
everything else in this file.

### Passwordless auth: email OTP, generalized verify screen

**Superseded — see "One auth screen; agency is a Profile upgrade, not a signup branch" above.**

**The entire auth flow is passwordless now — email and phone both work the same way: enter the
identifier, get a code, enter the code.** No password anywhere — no password field on any form, no
"forgot password" flow, no "change password" screen. This builds directly on the two-screen entry
redesign below (§3's "Two-screen auth entry"), which is otherwise unchanged by this pass — Screen 1,
Screen 2, and `choose-type.tsx`'s routing are all the same; what changed is what "Email" actually means
once you get there.

**Deleted outright, not just unused:** `app/auth/login.tsx` (the password sign-in/sign-up form),
`app/forgot-password.tsx`, `app/reset-password.tsx`, `app/change-password.tsx` (and its "Change
password" row on `app/profile.tsx`), `utils/passwordReset.ts`, `utils/authErrors.ts` (`mapAuthError` was
password-error-classification specific — the OTP screens all show the raw Supabase error string
directly, same pattern `phone.tsx` already used). `useAuth`'s `signIn`, `signUp`,
`requestPasswordReset`, `setRecoverySession`, `updatePassword` are all gone from the hook entirely — see
"Forgot / change password" below for what they used to do, now superseded.

**New: `app/auth/email.tsx`, structurally a twin of `app/auth/phone.tsx`.** Plain email `Field` instead
of `PhoneField` + country code, calling the new `useAuth().signInWithEmailOtp(email, name?, agency?)`
(`supabase.auth.signInWithOtp({ email, options: { data } })`) instead of `signInWithPhoneOtp`. Same
`mode`/name/agency query-param contract as `phone.tsx` (forwarded by `method.tsx`, `choose-type.tsx`, or
`agency-signup.tsx`), same `needsName` computation (`mode === 'sign-up' && name === undefined`), same
push to the shared verify screen on success. `method.tsx`'s Email option and `choose-type.tsx`'s
Individual card now both target `/auth/email` instead of the deleted `/auth/login`.

**`app/auth/phone-verify.tsx` is deleted; `app/auth/verify.tsx` replaces it, generalized over both
channels — this is the reuse the redesign asked for, not a new screen built alongside the old one.**
Takes `channel` (`'phone' | 'email'`), `identifier` (the phone number or email string — same param name
either way, since the UI only ever displays it, "we sent a code to {{identifier}}"), and `needsName`.
Branches on `channel` for exactly two things: which pair of `useAuth` functions to call
(`verifyPhoneOtp`/`signInWithPhoneOtp` vs the new `verifyEmailOtp`/`signInWithEmailOtp`, the latter for
the resend button) — everything else (layout, the code `Field`, the resend cooldown, error copy) is
identical for both, which is exactly why one screen could serve both instead of two near-duplicates.
`phoneAuth.verifyHeadline`/`verifySubtitle`/`codeLabel`/`codePlaceholder`/`verifyButton`/
`verifyingButton`/`resendCode`/`resendCooldown`/`errors.emptyCode`/`errors.invalidCode` moved out of the
phone-specific `phoneAuth.*` namespace into a new shared `verify.*` namespace (`phoneAuth.*` keeps only
what's genuinely phone-entry-specific: `headline`/`subtitle`/`phoneLabel`/`phonePlaceholder`/
`selectCountry`/`sendCode`/`sendingCode`/`errors.invalidPhone`). New `emailAuth.*` namespace holds only
`email.tsx`'s two unique strings (`headline`/`subtitle`); everything else it needs (`sendCode`/
`sendingCode`, `auth.emailLabel`/`emailPlaceholder`, `auth.errors.invalidEmail`) is reused from existing
keys rather than duplicated.

**`app/auth/phone-name.tsx` is deleted; `app/auth/complete-profile.tsx` replaces it, renamed for the
same reason `verify.tsx` was generalized.** Byte-for-byte the same "complete your profile" UI (still
reads `nameStep.*`), but the old name and its doc comment specifically claimed this was "the one place
an individual **phone** sign-up collects a name" — no longer true once email also has no password form
to put name fields on. Same trigger as before: `verify.tsx`'s `needsName === '1'` redirect, for a plain
individual signup on either channel. Agency signup still never reaches this screen — its own
company-info form always collects name upfront, on both its phone and email paths (see below).

**`app/auth/agency-signup.tsx` is substantially simpler now — it no longer creates the account itself.**
Before this pass, it had two real branches: `method === 'phone'` (company + name fields, then a
"Continue" that navigated to `/auth/phone` with those fields as params) and `method !== 'phone'`
(the same fields plus email + password inline, with its own `signUp()` call and post-signup notice/
"go to sign in" state). The email branch's inline password form and its `signUp()` call, `notice`/`busy`
state, and the "Account created…" / "Go to sign in" UI are all gone. Both branches are now identical in
shape: collect company + name, then one `continueToIdentifier()` that validates those fields and
navigates to `/auth/phone` **or** `/auth/email` (whichever `method` says) with them as query params —
the same shape `phone.tsx`'s agency handoff already used, just now shared by both channels instead of
being phone-only. This screen no longer imports `useAuth` at all; account creation happens on whichever
identifier screen comes next.

**Session persistence is unaffected — investigated, not just assumed.** `data/supabaseClient.ts`'s
`auth` config (`storage: AsyncStorage`, `persistSession: true`, `autoRefreshToken: true`,
`detectSessionInUrl: false`) is untouched by this pass and doesn't need to change: a Supabase session
(access + refresh JWT pair) is identical in shape and lifecycle regardless of which method created it —
password, phone OTP, or email OTP all end at the same `onAuthStateChange` event `useAuth.tsx` already
listens for. There was never a password-specific code path in the session-persistence layer to remove.

**The one thing this pass could not verify or configure: whether the connected Supabase project's email
template actually sends a typeable code, or a clickable magic-link instead — this needs the user's own
check in the Supabase Dashboard, no DB/dashboard access from this environment (same class of external
gap as Twilio's SMS configuration, §7).** `supabase.auth.signInWithOtp({ email })` and
`verifyOtp({ email, token, type: 'email' })` are both real, correct Supabase Auth API calls (confirmed
against the installed `@supabase/auth-js` type definitions, not guessed) — the provider already exists,
nothing new to add there. But whether the *email* Supabase actually sends contains a `{{ .Token }}` (a
short code the user can type into `verify.tsx`) or the default `{{ .ConfirmationURL }}` (a tappable
link with nothing to type) is controlled entirely by the "Magic Link" / "Confirm signup" template under
Authentication → Email Templates in the Supabase Dashboard — a project-level setting this environment
has no credentials to read or change. If the template still uses `{{ .ConfirmationURL }}`, the code
field on `verify.tsx` will have nothing valid to accept for an email-channel signup, even though every
line of app code here is correct. **This needs to be checked before considering email OTP delivery
"working," independent of anything else in this pass.**

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing, plus a targeted
grep across `app/`, `components/`, `hooks/`, `data/`, `utils/` confirming no remaining `password`-named
field, function, or call outside of explanatory comments. Unverified: the email-template question just
above, whether `verifyOtp`'s `type: 'email'` is in fact the correct type for this project's specific
OTP-vs-magic-link template configuration, and how the whole flow feels on a real device — no simulator
run has happened in any session so far.

### Two-screen auth entry: Welcome, then Mobile/Email method choice

**Superseded — see "One auth screen; agency is a Profile upgrade, not a signup branch" above.**

**Supersedes this section's own landing-screen design, one pass later.** The single landing screen
described just below (two buttons, each with an inline "…with phone number" text link) is now split
into two screens: a bare Welcome screen, and a dedicated method-choice screen one tap later. Everything
else in the section below — the login/agency-signup split, `buildSignupMetadata`, the migration — is
still accurate and unchanged by this pass; only the landing screen's own shape, and where the
Mobile/Email decision happens, changed.

**`app/auth/index.tsx` (Screen 1, "Welcome") is now bare.** No `BrandHeader` (no logo — an explicit
ask), content vertically *and* horizontally centered (`flex: 1, justifyContent: 'center', alignItems:
'center'`, replacing the old top-anchored layout), `landing.headline` unchanged ("Welcome to
PovesteaNoastra"), but `landing.subtitle` is new warmer copy replacing the reused `home.tagline`
("Plan weddings, birthdays, and every celebration in between — all in one beautiful place."). Exactly
two `Button`s, both default `variant="primary"` now (the previous pass had Sign Up as `variant=
"secondary"` to rank it under Log In — dropped since the brief called both "primary buttons," an equal
pair, not a ranked one) — no other auth method on this screen at all; the inline phone links are gone
from here entirely, moved one screen in.

**`app/auth/method.tsx` — new, Screen 2.** Reached from either landing button, carrying `mode`
(`sign-in`/`sign-up`) as a query param so one screen serves both directions without a third button.
`BackButton` top-left (back to Screen 1 — `router.back()`, same control every other auth screen already
uses), content centered below it. Exactly two options, "Mobile" and "Email" — plain `Button`s again, not
`choose-type.tsx`'s icon-card style, since the brief asked for buttons specifically and the two screens
serve different jobs (this one is a bare fork, `choose-type.tsx` explains two account *kinds*). No
"Sign Up" label anywhere on this screen — it's purely method, not account type. Routing:
sign-in + Email → `/auth/login?mode=sign-in`; sign-in + Mobile → `/auth/phone?mode=sign-in`; sign-up +
Email → `/auth/choose-type?method=email`; sign-up + Mobile → `/auth/choose-type?method=phone`. The
sign-in side never touches `choose-type.tsx` at all — there's no "account kind" question when logging
into an account that already has one.

**`choose-type.tsx` now forwards `method` instead of deciding it.** Both cards read the incoming
`method` param and route accordingly: Individual → `/auth/login?mode=sign-up` (email) or
`/auth/phone?mode=sign-up` (mobile, no name/agency params — see below); Agency → `/auth/agency-signup
?method=email` or `?method=phone`. This is also what closes the "agency must go through the same
Mobile/Email screen, not a separate one" requirement — agency's route into Screen 2 is identical to
individual's, just diverging one screen further in, at `choose-type.tsx`, rather than agency getting its
own copy of the method choice.

**`agency-signup.tsx` now branches on `method` instead of always showing the full form plus an inline
phone link.** The previous pass's "Continue with phone number" `TouchableOpacity` (reusing
`auth.usePhoneInstead`) is gone — that link existed specifically because method wasn't decided yet by
the time you reached this screen; now it always is, before this screen is ever pushed. `method ===
'phone'`: company + contact-name fields only, single `Button` (`agencySignup.continueButton`, "Continue")
running the same `continueWithPhone()` validation-and-navigate logic as before (now also passing
`mode: 'sign-up'` in the query params it hands to `/auth/phone`). `method !== 'phone'` (the default,
covers `'email'` and any missing param): unchanged full form — company + contact-name + email/password,
`submit()` calling `signUp()` exactly as before. `login.tsx`'s own matching inline phone link
(`auth.usePhoneInstead`) is removed the same way, same reasoning — `auth.usePhoneInstead` is now unused
and trimmed from both locale files.

**Individual phone sign-up gets a post-verification "complete your profile" step — new
`app/auth/phone-name.tsx`.** This is the one gap the two-screen redesign opened up: email sign-up still
asks for a name on the form itself (`login.tsx`, unchanged), and agency sign-up still asks on its own
company-info form (unchanged) — but a plain individual signing up by phone has no upfront form left to
ask on at all, once the phone shortcut no longer lives inline on `login.tsx`. Rather than resurrect the
old global name gate (deleted last pass, see "Name collection" below), the fix is scoped to exactly the
flow that needs it: `app/auth/phone.tsx` now also reads `mode` (forwarded by `method.tsx`/
`choose-type.tsx`/`agency-signup.tsx`, defaulting to `sign-in` if absent) and computes `needsName = mode
=== 'sign-up' && name === undefined` — true only for a plain individual sign-up, since agency's `name`
is always present by the time it reaches this screen. That flag rides along as a query param to
`app/auth/phone-verify.tsx`, which on a successful `verifyPhoneOtp` now does
`router.replace(needsName === '1' ? '/auth/phone-name' : '/')` instead of always `'/'`. `phone-name.tsx`
itself is a near-verbatim revival of the deleted `app/name.tsx`'s UI (same `Header`/`Field`/`Screen`/
`Button` shape, same `nameStep.*` keys — restored to both locale files, since the prior pass had trimmed
`title`/`subtitle`/`continue`/`saving`/`errorSaving` as unused once `app/name.tsx` was deleted) — but
architecturally different: it's reached by one specific screen's explicit redirect, not a global
`AuthGate` gate re-checked on every navigation, so it only ever appears once, exactly where it's needed,
and it owns its own "next" (`router.replace('/')` after `saveName()` succeeds) rather than relying on
`AuthGate` to notice and move on.

**A known, pre-existing race, not introduced by this pass.** The moment `verifyPhoneOtp` succeeds,
`useAuth`'s `user` flips from `null` to real, which independently re-runs `AuthGate`'s own
onboarding-check effect — for a brand-new account (`has_completed_onboarding` still `false`), that effect
calls `router.replace('/onboarding')` around the same time `phone-verify.tsx`'s own `submit()` calls
`router.replace('/auth/phone-name')` (or `'/'`). Whichever `replace()` lands last wins; there's no
coordination between the two. This exact race already existed for every brand-new phone sign-up before
this pass too (`phone-verify.tsx` unconditionally replacing to `'/'`, racing the same onboarding
redirect) — this pass didn't introduce it, just gave the individual-signup case a second possible
destination to race against. Not fixed here; flagging it since it's now slightly more visible with two
possible screen-owned redirects instead of one.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing. Unverified: how
the two-screen entry actually looks/feels (centering, spacing), whether the `AuthGate`/`phone-verify`
race above actually resolves the way reasoned above on a real device, and whether `needsName` correctly
threads through a real multi-hop navigation (method → choose-type → phone → phone-verify → phone-name) —
no simulator run has happened in any session so far.

### Landing screen, phone-signup shortcuts everywhere, and name collection moved to signup

**Superseded this pass — see "Two-screen auth entry: Welcome, then Mobile/Email method choice" above,
which replaces this section's landing-screen design one pass later.** Everything below this line was
accurate when written and mostly still is (the login/agency-signup split, `buildSignupMetadata`, the
migration) — only the landing screen itself (§ "`app/auth/index.tsx` is now the entry/landing screen…"
just below) and the phone-signup shortcuts' exact routing changed. Kept for incident history per this
file's own convention, not re-verified line by line against current code.

Three changes, same pass, all in service of one goal: no forced post-auth step for a name anymore, and
a phone-based path into every signup flow, not just the individual one.

**`app/auth/index.tsx` is now the entry/landing screen, not the sign-in/sign-up form.** It's what
`AuthGate` redirects to whenever there's no session (the target, `'/auth'`, didn't change — only what
lives there did). Two primary `Button`s — "Log In" and "Sign Up" — each with a secondary text link
underneath for the phone path: "Log in with phone number" and "Sign up with phone number", both going
to `app/auth/phone.tsx`. `Button`'s two calls here are the first time `variant="secondary"` is used
outside its outlined-card original purpose — chosen for Sign Up specifically to visually rank it under
Log In without needing a third variant. New `landing.*` locale namespace; the subtitle reuses
`home.tagline` rather than duplicating it.

**The old combined sign-in/sign-up form moved to `app/auth/login.tsx` verbatim, plus name fields.**
Same in-place `mode` toggle as before (sign-up → sign-in flips in place; sign-in → sign-up still goes
through `/auth/choose-type` first, unchanged), same raw `TextInput`-based fields (not the shared `Field`
component — this screen never used it, staying consistent with itself rather than converging with
`agency-signup.tsx`'s styling). What's new: two more fields, First name and Last name, rendered only in
sign-up mode, required (submit-time validation, same pattern as email/password on this screen — new
`auth.errors.firstNameRequired`/`lastNameRequired` keys), reusing `nameStep.firstNameLabel`/
`firstNamePlaceholder`/`lastNameLabel`/`lastNamePlaceholder` — the same four keys `app/edit-profile.tsx`
already reused from the now-deleted name screen. `choose-type.tsx`'s "Individual" card now pushes
`/auth/login?mode=sign-up` (was `/auth?mode=sign-up`); `agency-signup.tsx`'s post-signup "go to sign in"
link now pushes `/auth/login` (was `/auth`).

**Agency signup also gained name fields and its own phone-signup shortcut.** `app/auth/agency-signup.tsx`
gained First/last name `Field`s in its Contact section (same two reused `nameStep.*` keys), and a
"Continue with phone number" link (reusing `auth.usePhoneInstead`'s existing label — no new key) below
the password field. That link validates only the fields a phone path actually needs — name + company
name + CUI, via a shared `validateAgencyFields` helper the email submit path also calls — then navigates
to `/auth/phone` carrying all of it as query params (`router.push({ pathname, params })`), skipping
email/password entirely. **This is what closes the gap the phone-auth pass explicitly flagged as
deferred** ("there is no phone-based agency signup" — §7 and the old "Phone auth" section both said
this): `app/auth/phone.tsx` now reads those optional query params (`firstName`/`lastName`/`companyName`/
`cui`/`registrationNumber`/`address` — extracted with a small `asStringParam` guard rather than a typed
generic on `useLocalSearchParams`, since a multi-optional-field object type doesn't reliably resolve to
that hook's `TParams extends UnknownOutputParams` overload over its `TRoute extends RoutePath` one; the
untyped-then-narrowed approach sidesteps that instead of fighting it) and, when present, passes them
through to the now-three-argument `signInWithPhoneOtp(phone, channel, name?, agency?)`.

**`useAuth.tsx`'s `signUp`/`signInWithPhoneOtp` both build `raw_user_meta_data` through one new shared
helper, `buildSignupMetadata(name?, agency?)`.** Previously only `signUp` ever sent `options.data`, and
only for agency info. Now both functions can send `first_name`/`last_name` (from a new `SignUpNameInfo`
param), agency fields, both, or neither — `buildSignupMetadata` returns `undefined` when neither is
given, so a plain sign-in-mode call or an OTP resend still sends no `data` option at all, unchanged from
before. `signInWithPhoneOtp`'s `name`/`agency` params only matter on the call that actually creates the
Supabase user (the first OTP send for that phone number) — a resend after that is a no-op for metadata,
since the account and its `raw_user_meta_data` already exist.

**`supabase/migrations/20260820000002_signup_name_metadata.sql` — not yet applied, not yet confirmed,
same caveat as every migration since `20260810000003`.** Re-merges `handle_new_user()` (canonical form
from `20260819000003`) with two more `raw_user_meta_data` reads, `first_name`/`last_name`, inserted into
the columns `20260820000001` added and preferred over the old email/phone-derived fallback when deriving
`display_name`. This is the same "re-merge the whole function rather than let `CREATE OR REPLACE` drop
an earlier migration's block" discipline `20260819000003` itself was written to restore after
`20260818000001` broke it once already — worth remembering for the *next* migration that touches this
function too.

**What this means for `AuthGate` and existing accounts.** `AuthGate` no longer has any name-related
redirect — see the "Superseded" note at the top of the old "Name collection" section below. A **new**
signup (email or phone, individual or agency) has `first_name`/`last_name` set at `handle_new_user()`
time now, before it ever reaches the app. An **existing** account created before this pass, with no
name, simply stays nameless until the account holder visits `app/edit-profile.tsx` — there is no
retroactive prompt anymore, which is a deliberate behavior change from the old gate's "redirect until
set" approach, not an oversight.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing. The migration is
written but not applied (no DB access from this environment) — whether the re-merged `handle_new_user()`
fires as reasoned, whether `signInWithOtp`'s `options.data` actually attaches metadata the same way
`signUp`'s does for a real phone number, and how the new landing screen and the two phone-shortcut links
actually look/feel are all unverified until a real device run.

### Name collection — first/last name once, after first verification

**Superseded this pass — the dedicated post-auth name screen described below is gone.** `app/name.tsx`
and `AuthGate`'s redirect to it are deleted; first/last name is now collected directly on the Create
Account form instead (both the individual form, `app/auth/login.tsx`, and the agency form,
`app/auth/agency-signup.tsx` — including its phone-signup shortcut), via `raw_user_meta_data` at signup
time, the same channel agency signup already used for `company_name`/`cui`. See "Landing screen, and
name collection moved to signup" below §3's "Phone auth + phone guest invites" for the current
architecture. Everything in this section from here down describes the code **as it existed before this
pass** — kept for incident history per this file's own convention (see the top of this file), not
current behavior. In particular: `app/name.tsx` no longer exists, `AuthGate` no longer has a
`firstName === null` redirect branch, and `'name'` is no longer in `PUBLIC_SEGMENTS`.

Neither sign-up path (email/password or phone OTP) ever collected a real name — `public.users.display_name`
was always auto-derived (email local-part, then phone, then `'Guest'`, via `handle_new_user()`), and
every screen that showed "who is this" fell back to raw email/phone. This pass adds a one-time name
step, gated the same way onboarding already is, and reuses `display_name` as the single field every
existing attribution path already reads — rather than teaching each of those paths a new column.

**Storage — `first_name`/`last_name` added alongside `display_name`, not instead of it**
(`20260820000001_user_names.sql`). `display_name` stays the field every existing consumer already
reads (`messages.sender_label`, `photos.uploaded_by_label`, `moments`, the RSVP `guest_name` written by
`respondToInviteRow` — see §3's "Photo grids and attribution" for why those are self-selected
denormalizations rather than live joins in the first place); `first_name`/`last_name` are the
structured columns the name step actually writes to, with `display_name` derived from them
(`` `${firstName} ${lastName}`.trim() ``) in the same write. This means fixing `display_name` once, at
the name step, is enough to fix every one of those existing attribution paths with no changes to any
of them.

**`handle_new_user()`'s existing auto-fill was deliberately left alone.** It only ever runs once, at
`auth.users` INSERT time — before the name step exists in the app's flow (AuthGate blocks every
protected route until it's done, same as onboarding) — so it already behaves as "a fallback before the
user sets a real name," never overwriting anything set later; there's no separate UPDATE path that
could re-run it. No trigger change was needed to satisfy that constraint.

**Gate: `AuthGate.tsx`**, extended with a second post-auth check ahead of the existing onboarding one
— order is now Auth → Name → Onboarding. Unlike the onboarding check (a ref-gated one-shot promise,
checked once per signed-in session), the name check reads `useUserProfile().firstName` reactively and
redirects to `/name` on every effect run for as long as it's `null` — the same "just keep redirecting"
shape the `user === null` → `/auth` branch above it already uses — so it naturally stops the moment
`firstName` flips to non-null after the name step's write invalidates the query, with no extra
"just finished" signal needed. `'name'` was added to `PUBLIC_SEGMENTS`, mirroring `'onboarding'`'s
presence there even though (like onboarding) it's only ever reached with a session.

**This applies to existing accounts too, by construction, not as a special case.** The gate keys
purely on `first_name is null` — an old test account with no name gets routed to `/name` on its next
sign-in exactly like a brand-new one, so the existing 3–4 test users get prompted retroactively rather
than staying permanently blank. There is no "leave old accounts alone" branch to maintain.

**`app/name.tsx`** — new screen, no back button (nowhere legitimate to return to, and skipping would
defeat the point). First/last name `Field`s, a `Continue` button disabled until both are non-empty,
calls `useUserProfile().saveName()` and otherwise does nothing else — it doesn't navigate itself;
`AuthGate` reacts to `firstName` changing and moves on to onboarding or `/` on its own, same "screen
doesn't own its own next destination" shape already established for the auth flow.

**`hooks/useUserProfile.tsx`** — new, plain react-query hook, same shape as `useAgency` (no
Context/Provider): reads `first_name`/`last_name`/`display_name` (`['userProfile', userId]`, `staleTime:
180s`, details-category — this rarely changes once set) and owns the one `saveName` mutation that ever
writes those columns after the initial trigger-populated placeholder. `data/usersRepository.ts` is its
repository counterpart, same split as `agenciesRepository.ts`/`useAgency.tsx`.

**Guest-list identity — two trigger extensions, not a client-side join** (same `public.users`
`id = auth.uid()`-only RLS wall §3 already documents for message/photo attribution applies here too).
`link_guest_on_invite()` now also copies the matched account's `display_name` into a new invite's
`guest_name`, but only when the organizer didn't type one — covers "already has a name, gets invited
later." A new `AFTER UPDATE ON public.users` trigger, `on_user_display_name_set`, backfills any of that
user's still-nameless `event_guests` rows when `display_name` changes — covers "already invited, sets
their name later," which is the actual order the flow being built produces (verify → name step, not the
other way round). Both only ever fill a `null` `guest_name`, never overwrite an organizer-typed one.

**UI fallbacks updated to prefer the real name, `user.email`/`user.phone` only as last resort:**
`app/profile.tsx`'s Account card (previously just showed the raw email, or the generic
`t('profile.title')` if no email — now shows `displayName ?? email ?? phone ?? t('profile.title')`,
with the contact method moved to the secondary line instead of the static "Signed in with Supabase"
string); `hooks/useEvents.tsx`'s `respondToInvite` (the `guest_name` written on a guest's own first
RSVP — was `user.label`, i.e. email/phone, unconditionally); `hooks/useEventContent.tsx`'s `Actor.label`
(was `user?.email ?? 'Tu'` — didn't even fall back to phone before this pass, fixed as part of the same
change, though this only matters as the fallback-of-a-fallback since attribution already self-selects
`display_name` fresh at write time regardless — see §3's "Photo grids and attribution").
`data/eventsRepository.ts`'s `mapGuestRow` fallback chain (`guest_name ?? guest_email ?? guest_phone ??
'Guest'`) was **not** changed — the two trigger extensions above mean `guest_name` is already correct
by the time this ever reads it, so there was nothing left for the client to prefer.

**i18n:** new `nameStep.*` namespace, both `locales/en.json`/`ro.json` — title, subtitle, both field
labels/placeholders, the continue/saving button states, and a generic save-error string.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing.
`20260820000001_user_names.sql` is written but not applied (no DB access from this environment) —
whether the two trigger extensions actually fire as reasoned, whether `AuthGate`'s reactive redirect
loop behaves correctly against a real query lifecycle (not just typechecks), and how the new screen
actually looks are all unverified until a real device run.

### Schema as written in the migrations

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `id` (FK `auth.users`), `email`, `phone`, `first_name`, `last_name`, `display_name`, `has_completed_onboarding` | Populated by an `on_auth_user_created` trigger; `has_completed_onboarding` added by `20260810000006`; `phone` added by `20260818000001`; `first_name`/`last_name` added by `20260820000001` — see §3's "Name collection" |
| `events` | `id`, `organizer_id`, `agency_id` (nullable), `type` (enum), `name`, `event_date`, `location`, `welcome_message` | `event_type` enum: wedding, baptism, birthday, cause, corporate, memorial, other. `agency_id` added by `20260813000001` — populated automatically for agency owners, but not currently read by any screen (no agency-specific view exists), see "Agency accounts" below |
| `agencies` | `id`, `owner_user_id` (unique FK `users`), `company_name`, `cui`, `registration_number` (nullable), `address` (nullable) | Added by `20260813000001`. One agency per owner this pass — no staff/multi-user agencies yet. Row is created by `handle_new_user()` from signup metadata, never inserted client-side (email confirmation is ON, so `signUp()` never yields a session at insert time) |
| `event_guests` | `id`, `event_id`, `guest_user_id` (nullable), `guest_email`, `guest_phone`, `guest_name`, `rsvp_status`, `invited_at`, `whatsapp_sent_at`, `responded_at`, `dietary_preferences text[]` | Partial unique index on `(event_id, guest_user_id)`; `rsvp_status` enum: pending, confirmed, declined; `dietary_preferences` added by `20260810000008`; `guest_phone` added by `20260818000002`, with a partial unique `(event_id, guest_phone)` index and a check requiring at least one of `guest_email`/`guest_phone`/`guest_user_id`; `whatsapp_sent_at` (nullable, when the organizer tapped Send — distinct from `invited_at`, which is row-creation time) and a second, *non-partial* unique `(event_id, guest_phone)` constraint (needed as an upsert arbiter) both added by `20260822000001`, see §3's "Bulk guest invites" |
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
- **Agencies:** owner reads and updates their own row. **No insert policy on purpose** — rows are only
  ever created by `handle_new_user()` (security definer, bypasses RLS), never inserted directly by a
  client session, same reasoning as contributions above.
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
| `app/auth/index.tsx` | The one auth screen — phone number + "Send code", full stop. No password, no email option, no account-type question, no sign-in/sign-up distinction. What `AuthGate` redirects to when there's no session. See §3's "Phone-only auth" |
| `app/auth/verify.tsx` | Unauthenticated: OTP code entry + resend, shared by both the email and phone channels (`channel` param). Establishes the session on success, then just `router.replace('/')` — `AuthGate` decides what happens next (name step, onboarding, or straight through). See §3's "One auth screen; agency is a Profile upgrade" |
| `app/auth/complete-profile.tsx` | "Complete your profile" — first/last name, reached via `AuthGate`'s redirect for any signed-in account with no `first_name` yet (old or new, email or phone) — a global gate, not owned by any particular auth screen. See §3's "One auth screen; agency is a Profile upgrade" |
| `app/edit-profile.tsx` | Authenticated: edit first/last name and email (all three save directly, no verification — email is optional profile info, not an auth identifier), plus phone (requests a change — Supabase's own re-verification applies, since phone *is* the auth identifier; see §2 Auth flow's "Edit profile" note and §3's "Phone-only auth"). Business accounts additionally see a "Business details" section (company name/CUI/registration number/address, `useAgency().updateAgency`) — hidden entirely for individual accounts. Reached from Profile. See §3's "Editing business info" |
| `app/agency-signup.tsx` | Authenticated: "Add business account" — company name, CUI, registration number, address (via the shared `components/AgencyFields.tsx`). Upgrades the signed-in account to an agency owner in place; only reachable from Profile, only while not already an agency owner. See §3's "Agency accounts", "One auth screen; agency is a Profile upgrade", and "Editing business info" |
| `app/index.tsx` | Home — Your events + My invitations, floating "+" |
| `app/profile.tsx` | Account details, "Change password" row, and sign out |
| `app/create/type\|details\|preview\|share.tsx` | 4-step create-event wizard |
| `app/event/[id].tsx` | Organizer dashboard — RSVP counts and guest list. No footer, no header edit action — see §4's "Guest list dashboard: no more footer buttons or edit pencil" |
| `app/guest/[id]/` | The 6-tab guest event page |
| `app/invite/[id].tsx` | RSVP screen — opened from an invite link by a real guest, *and* reused as the organizer's "Preview as guest" view (RSVP buttons render disabled for the organizer; see §3). **No longer a forced stop between Home and the guest tabs for an owner — see §4's routing note** |
| `app/edit-event/[id].tsx` | Owner: basic info only — name, date, location, welcome message. Reached from the owner-only edit pencil on the Detalii tab (`app/guest/[id]/detalii.tsx`) — **not** from the organizer dashboard anymore, see §4's "Guest list dashboard: no more footer buttons or edit pencil" |
| `app/schedule/[id].tsx` | Owner: add or edit one schedule item (`?itemId=` for edit) |
| `app/venue/[id].tsx` | Owner: create or edit the venue |
| `app/menu/[id].tsx` | Owner: create or edit the menu (starter/main/dessert, one save) |
| `app/table/[id].tsx` | Owner: add or edit one seating table (`?itemId=` for edit) |
| `app/accommodation/[id].tsx` | Owner: add or edit one accommodation option (`?itemId=` for edit) |
| `app/vendor/[id].tsx` | Owner: add or edit one tagged vendor (`?itemId=` for edit) |
| `app/fund/[id].tsx` | Owner: create or edit the fund |
| `app/add-guest/[id].tsx` | Owner: invite a guest by phone — the app's auth is phone-only, so a phone invite is the only kind a recipient could ever actually claim. See §3's "Phone-only auth" |
| `app/bulk-add-guests/[id].tsx` | Owner: invite several guests at once — manual Name/Phone rows and/or contacts import. Saves via the `upsert_event_guests_batch` RPC, then hands off to `send-invites`. See §3's "Bulk guest invites" |
| `app/send-invites/[id].tsx` | Owner: the pending-guests WhatsApp send queue — one tap per guest opens WhatsApp with their personalized message; Skip is session-local. Reached after a bulk save or from `event/[id].tsx`'s "Send pending invites" button. See §3's "Bulk guest invites" |
| `app/post-moment/[id].tsx` | Owner: moment composer |
| `app/detalii-schedule/[id].tsx` | The full schedule list (moved out of the Detalii hub) — swipe-left a row for Edit/Delete, owner-only "+" in the header, empty state with "Adaugă programul". See §4's "Detalii tab is now a card hub" |
| `app/detalii-location/[id].tsx` | The venue display (moved out of the Detalii hub) — map/address/notes card or empty state; owner-only edit pencil on the card itself, unchanged from before. See §4's "Detalii tab is now a card hub" |
| `app/detalii-menu/[id].tsx` | The menu display + guest dietary pills (moved out of the Detalii hub) — owner-only edit icon in the header when a menu exists. See §4's "Detalii tab is now a card hub" |
| `app/detalii-seating/[id].tsx` | The seating table list (moved out of the Detalii hub) — same swipe/empty-state/header-"+" shape as schedule. See §4's "Detalii tab is now a card hub" |
| `app/detalii-accommodation/[id].tsx` | The accommodation list (moved out of the Detalii hub). See §4's "Detalii tab is now a card hub" |
| `app/detalii-vendors/[id].tsx` | The tagged-vendor list + caption (moved out of the Detalii hub). See §4's "Detalii tab is now a card hub" |
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
tabs — gained a second icon button, owner-only, top-right: a `users` glyph that pushes `/event/${id}`.
**Superseded by a later pass — see §4's "Header actions are now per-tab, in one shared row" for the
current `EventHeaderBar` API (`actions: HeaderAction[]`, not `id`/`showManage`) and for which tab this
icon shows on now.** A non-owner viewing the tabs still sees exactly what they saw before this whole
section — just the back button and the event name, nothing added to their side.

**The preview screen (`/invite/[id]`) itself is unchanged, but it now has only one legitimate path in
— see below.** `Header.tsx`'s `right?: ReactNode` prop (same "single custom slot, top-right" shape
`BrandHeader`'s `right` prop already established elsewhere) is still there and still used elsewhere
(`app/edit-event/[id].tsx` doesn't use it, but nothing else needed to change) — only `app/event/[id].tsx`
stopped passing anything into it, per the section just below.

### Guest list dashboard: no more footer buttons or edit pencil

**Changed in a later pass than the one above — superseding what that section said about the
dashboard's footer/header.** Guest invites are now sent individually through the wa.me flow (the
"Invite a guest"/"Add multiple" icons already in this screen's guest-list section header, and the
`send-invites/[id]` queue) rather than via a generically-shared invite link, so the dashboard's own
"share the invite" and "preview as guest" actions no longer have a reason to exist here.

**`app/event/[id].tsx` lost its `Screen` `footer` entirely** — the "Distribuie invitația"
(`shareInvite()`, `utils/invite.ts`) and "Previzualizează ca invitat" (`router.push('/invite/[id]')`)
buttons are both gone, not hidden. `shareInvite` and the `event.shareInvitation`/`event.previewAsGuest`
locale keys are **not** dead — `app/create/share.tsx` (the create-event wizard's own share step) still
uses all three; only this screen's usage was removed. **The preview screen (`/invite/[id]`) now has
exactly one legitimate path in**: the create-event flow's share step. The dashboard's own path into it
is gone along with the footer button.

**The header's owner-only edit pencil moved too — off this screen, onto the Detalii tab.**
`app/event/[id].tsx`'s `Header` no longer passes anything into `right` at all (the prop itself is
untouched on `Header.tsx`, just unused here now). The same "edit event" action —
`router.push('/edit-event/${id}')`, `t('event.editEvent')` — moved to the Detalii tab.
**Superseded by a later pass — it briefly lived as its own standalone row on the Detalii hub screen,
then moved again into the shared `EventHeaderBar`'s top-right actions; see §4's "Header actions are now
per-tab, in one shared row" for where it actually lives now.** `app/edit-event/[id].tsx` itself has
never changed through any of this — same form, same fields (name, date, location, welcome message),
same `updateEvent` call; only which screen (and now which exact button) triggers it moved.

**Deliberately not touched:** the guest list's own functionality (add guest, bulk invite, stats, guest
rows, swipe-to-remove), the Acasă tab's "+" FAB (still `router.push('/post-moment/${id}')`, unchanged —
it creates a moment, not related to this dashboard at all), and every other screen. This was a scoped
two-screen change: remove from the dashboard, add to Detalii.

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

A persistent `EventHeaderBar` (event name, plus a conditional back chevron and a conditional top-right
action slot) sits above the tabs. **The back chevron shows only on Acasă** — `router.navigate('/')`,
the one exit point back to Home/the main events list; Detalii/Fond/Chat/Live/Album show no back arrow
at all, since they're already one tap away via the bottom tab bar within the same event, and a back
arrow there previously read as "go back a tab" while actually exiting the event. **Owners additionally
see one top-right action slot whose contents change per active tab** — not a fixed third icon. See §4's
"Header actions are now per-tab, in one shared row" for both of these (the action-slot design and the
back-arrow fix landed as two passes in that same section).

| Tab | File | Guest sees | Owner additionally sees |
| --- | --- | --- | --- |
| Acasă | `index.tsx` | Moment feed, reaction pills, fund promo card | "+" FAB → moment composer; swipe-left a moment to delete. **Header:** guest-list/stats icon (`users` → `/event/[id]`) — the *only* tab that shows it |
| Detalii | `detalii.tsx` | A compact card hub — one row per sub-feature (schedule/location/menu/seating/accommodation/vendors), icon + title + a one-line status, tap to push into that sub-feature's own screen | Same hub, no owner-only row of its own. **Header:** edit-event pencil (`edit-2` → `/edit-event/[id]`). Every "+"/edit action for the six sub-features lives inside its own sub-screen, not here |
| Fond | `fond.tsx` | Fund card, progress bar, "Contribuie acum", Stripe disclaimer | Same card, no icons on it. **Header:** edit pencil + delete (trash) icon, shown only once a fund exists — delete confirms via `confirmDelete`, warning about existing contributions when any exist; empty state with "Deschide un fond"; contribute button hidden |
| Chat | `chat.tsx` | Group chat; organizer messages render as purple bubbles | (same; delete is per-message, not per-role). **Header:** no action icon |
| Live | `live.tsx` | Navy card, LIVE dot, hero + a bounded/scrollable filmstrip of small thumbs (not capped at 4 anymore), scannable QR, add-photo button | — . **Header:** no action icon |
| Album | `album.tsx` | Recap headline, 2 stat cards, 3-col photo grid, download/back buttons | — . **Header:** no action icon |

Chat swipe-to-delete is gated on `sender_id === user.id`, not on ownership. Photo deletion (Live and
Album) is long-press → confirm, allowed for the uploader or the owner.

### Header actions are now per-tab, in one shared row

**Changed this pass — consolidates several icons that used to live in different, inconsistent places
(a fixed guests icon on every tab's header, a stacked second circle under it on Detalii, a
floating pair of icons on Fond's card) into one single-row, per-tab action slot on the shared header.**
Before this pass: the guests/stats icon showed on *every* tab's header (Acasă through Album, plus the
guest list screen's own header, unrelated and unaffected); Detalii additionally rendered its own
owner-only "edit event" row as a second circle stacked directly under it; Fond rendered its edit+delete
icons on the fund card itself, not in the header at all. None of these three things coordinated with
each other.

**`components/guest/EventHeaderBar.tsx`'s props changed shape entirely** — `id`/`showManage: boolean`
(one fixed icon, on or off) is gone, replaced by `actions: HeaderAction[]` (0 to N icons, generic):

```ts
interface HeaderAction {
  key: string;
  icon: FeatherName;
  accessibilityLabel: string;
  onPress: () => void;
  tone?: 'default' | 'destructive'; // recolors the icon only; same circular button
}
```

The bar renders the back button, the event name (`flex: 1`, pushing whatever follows to the far edge),
then every action in `actions` as same-sized 38×38 `surfaceElevated` pill buttons in a row
(`styles.actions`, `gap: gSpace.sm`) — one row, never stacked, regardless of whether there are zero,
one, or two actions. A `tone: 'destructive'` action keeps the same neutral circular background as every
other header icon (consistent with the back/guests/edit buttons) but colors the glyph
`tokens.destructive` instead of `tokens.textPrimary` — the one visual cue that survived the move from
Fond's old card-level delete button (which used a `destructiveSoft`-tinted circle); everything else
about the button (size, background, position) is now identical to every other header icon rather than
its own smaller, differently-tinted style.

**Who decides which actions show is `app/guest/[id]/_layout.tsx`, not `EventHeaderBar` itself** — the
component stays a dumb renderer of whatever `actions` array it's given. The layout computes an
`activeTab` from `usePathname()` (`'/detalii'`/`'/fond'`/`'/chat'`/`'/live'`/`'/album'` suffixes, else
`'acasa'` — `EventHeaderBar` is mounted once above `<Tabs>`, so it has no other way to know which tab is
currently showing) and builds the action list per tab, owner-only in every case:

- **Acasă** — the `users` guest-list/stats icon → `/event/${id}`. This is now the *only* tab that shows
  it, closing the "why does every tab have a guests icon" duplication this pass was asked to fix.
- **Detalii** — the `edit-2` "edit event" icon → `/edit-event/${id}` (`t('event.editEvent')`). This is
  the same action that used to live on the organizer dashboard's own header (see "Guest list dashboard:
  no more footer buttons or edit pencil" above), then briefly as its own standalone row on the Detalii
  hub screen — now it's here instead, one inline icon in the shared top row rather than a second
  stacked circle.
- **Fond** — `edit-2` (→ `/fund/${id}`) *and* `trash-2` (`tone: 'destructive'`, opens the same
  `confirmDelete` flow as before — contributor-count-aware message, `deleteFund` mutation — unchanged
  logic, just relocated), both gated on `content.fund !== null` in addition to `owner`: an empty Fond
  tab has nothing to edit or delete, so no icons show until a fund actually exists. `_layout.tsx` calls
  `useEventContent(id ?? '')` itself for this — a second call site against the same `['eventContent',
  ...]` query keys `fond.tsx` already reads, deduped by the shared `QueryClient` cache (see §2's State
  layer), not a second network fetch.
- **Chat, Live, Album** — no action at all, `actions: []`, same as a non-owner on any tab.

**A later pass in the same series made the back arrow itself conditional, for the same
"one coherent row per tab" reason.** Before that pass, `EventHeaderBar`'s back arrow (→
`router.navigate('/')`, back to Home) rendered unconditionally on all 6 tabs — confusing on Detalii/
Fond/Chat/Live/Album specifically, since those five are already reachable from Acasă via the bottom tab
bar within the same event; tapping "back" there read as "go back a tab" but actually exited the event
entirely. Fixed with a new `showBack?: boolean` prop (default `false`) on `EventHeaderBar`, rendered
conditionally the same way `actions` already is; `_layout.tsx` passes `showBack={activeTab === 'acasa'}`
— reusing the same `activeTab` value the actions logic above already computes, no new state. Acasă is
now the one and only exit point back to the main events list; the other five tabs show just the event
name (and whatever `actions` apply), with tab-to-tab movement left entirely to the bottom tab bar, which
was never touched.

**`app/index.tsx`'s profile icon changed in the same pass, for a related but separate reason.** Home's
top-right button (→ `/profile`, inside `BrandHeader`'s `right` slot) used Feather `user` — a single-
person silhouette easily confused at a glance with the two-person `users` glyph used for the guest-list/
stats action elsewhere in the app (see the bullet list above, and `event/[id].tsx`'s "Invite a guest"/
"Add multiple" icons). Swapped to Feather `settings` (a gear) — visually unambiguous from `users`, and
not previously used anywhere else in the app (checked before picking it). Nothing else about that button
changed — same circle, same `${accentPrimary}22` tint, same `router.push('/profile')`, same
accessibility label. `app/profile.tsx`'s own avatar-circle `user` icon (the screen's own header, not
this button) was intentionally left alone — out of scope, and not the icon that was actually causing
confusion.

**`app/guest/[id]/detalii.tsx` and `app/guest/[id]/fond.tsx` both got smaller, not more complex, from
this.** Detalii no longer imports `useEvents`/`useTheme` or renders anything but its six cards — the
owner-only edit row it briefly had is gone from this file entirely. Fond no longer imports `Feather`/
`TouchableOpacity`, no longer has an `ownerActions` block or `removeFund` function on the card — `owner`
is still read (still gates the CTA-button-vs-disclaimer footer choice, unrelated to the header) but no
longer drives any icon this screen renders itself.

**Deliberately unaffected:** `app/event/[id].tsx` (the guest list screen) and its own header/pencil —
already addressed by the earlier "Guest list dashboard" pass, not touched again here. The Acasă tab's
"+" FAB (moment composer), every sub-screen under `app/detalii-*/[id].tsx`, the bottom tab bar itself,
`app/profile.tsx`'s own content, and all underlying edit/delete mutations (`updateEvent`,
`saveFund`/`deleteFund`, etc.) are all unchanged — this whole series was scoped purely to header/
navigation-bar icon composition, plus the one Home icon swap.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing. How the
single-row action set actually looks per tab (icon spacing, the destructive tint, the moment an owner's
Fond header icons appear once `content` resolves) is unverified — no device or simulator run has
happened in any session so far.

### Detalii tab is now a card hub, not a long inline scroll

**Changed this pass.** `app/guest/[id]/detalii.tsx` used to render all six of its sub-features
(schedule, venue, menu, seating, accommodation, vendors — §3's "Detalii — menu, seating,
accommodation, vendors" for the last four) fully inline: each with its own heading, an
owner-only "+"/edit icon in a `sectionHead` row, an `EmptyState` block when nothing was set yet, and
the section's own cards/list rows when it wasn't. That made the tab a very long scroll, and made the
per-section "+" icons easy to misattribute at a glance.

**It's now a compact list of six tappable rows, one per sub-feature**, each showing an icon, the
section's title, and a single-line status (`t('detalii.hub.*')`, new locale keys, both languages) —
"Nesetat"-style copy when nothing exists yet (`detalii.hub.scheduleUnset` etc.), otherwise a short
summary derived from the same `useEventContent(id).content` the hub always read, no new query added:
item counts for schedule/accommodation/vendors, a seated-persons total (`seatingTables.reduce(...,
seat_count)`) for seating, "Meniul e setat" for menu, and the venue's own address/name (user content,
so it's shown as-is, never translated — same convention as everywhere else in this file) for location.
`components/guest/DetaliiHubCard.tsx` is the one new component this introduced — a themed row
(icon circle, title, status, chevron) plus a matching `DetaliiHubCardSkeleton`; the hub's own loading
state is now six of those skeletons instead of six shaped section skeletons.

**A later pass briefly added a seventh, non-card row above the six — an owner-only "edit event" button
rendered by this screen itself — then a pass after that removed it again.** That row was the organizer
dashboard's old header-pencil action, relocated here (see §4's "Guest list dashboard: no more footer
buttons or edit pencil" for why it left the dashboard). **Superseded — it doesn't live on this screen
at all anymore.** It moved once more, into the shared `EventHeaderBar`'s top-right actions (same row as
the back button, swapping in per active tab) — see §4's "Header actions are now per-tab, in one shared
row." `app/guest/[id]/detalii.tsx` today renders nothing but the six cards; it has no owner-only row of
its own, and no longer imports `useEvents`/`useTheme` for that reason.

**Tapping a card pushes a dedicated screen** — the six new routes added to §4's routes table just
above this section (`app/detalii-schedule/[id].tsx` through `app/detalii-vendors/[id].tsx`). Each one
is a relocation, not a rewrite: the exact JSX, styles, and logic that used to render inline on the hub
(the `EmptyState`/`GuestButton` empty case, the `SwipeableRow` list with its Edit/Delete actions, the
menu screen's dietary pills and `updateMyDietaryPreferences` call, the vendor screen's `vendorIcon()`
heuristic and caption) now live in these six files instead, largely unchanged. **The owner-only
per-section "+"/edit icon moved from an inline `sectionHead` row into each sub-screen's own `Header`
`right` slot** — the same "single action, top-right, opposite the back button" placement
`app/event/[id].tsx`'s edit-pencil already established — except for location and menu, where the edit
pencil already lived a different way before this pass (an absolutely-positioned button on the venue
card itself, and a header icon shown only once a menu exists) and still does, unchanged. **There is no
floating per-section "+" on the hub screen anymore, anywhere** — every add action now lives one tap
deeper, inside the sub-screen it belongs to, closing the "which section does this + belong to"
ambiguity the long inline layout had.

**Routing/back:** plain stack push/pop, no new navigator. Every sub-screen is a normal
`app/<name>/[id].tsx` route reached via `router.push` from a hub card and left via the sub-screen's own
`Header`'s `showBack` (`BackButton`, `router.back()`) — identical to how `/event/[id]` is already
reached from `EventHeaderBar`'s people icon and returned from. None of the sub-screens are nested
under `app/guest/[id]/`, so — like the existing composer routes (`schedule/[id]`, `venue/[id]`, etc.)
they read `id` via `useLocalSearchParams` and `useEvents().getEvent(id)` directly, **not**
`useGuestEvent()`, which would throw outside the tabs' `GuestEventProvider` (see this file's own
"Critical gotcha" note in §2). Unlike the composer routes, though, these six are **not** owner-gated at
the top level — a non-owner guest can open any of them to see the same schedule/venue/menu/seating/
accommodation/vendor content they'd have seen inline before; only the add/edit/delete affordances
inside each one stay behind `isOwner(event)`, same as before this pass.

**Each sub-screen wraps its content in `GuestScreen` (not `Screen`)**, with `topInset` (there's no
`EventHeaderBar` above these routes to own the top safe-area inset the way it does inside the tabs) —
chosen over the organizer-style `Screen`/gradient wrapper specifically so a card tapped on the
guest-themed hub doesn't land on a jarringly different background one tap later. `GuestScreen`'s bottom
padding still reserves space for the floating tab bar even though these routes render outside the tabs
navigator entirely — a harmless overshoot, the same one already accepted for `checkout/[id].tsx`, the
one pre-existing `GuestScreen` consumer outside the tabs (§5's Tab bar section documents this).

**Scope: six cards, not four.** The task that prompted this pass initially named only four sub-features
(schedule, location, menu, seating) as the target card set, and even used "Furnizori" (vendors) as an
example of a *future* addition — but accommodation and vendors already existed as full inline sections
before this pass (§3's "Detalii — menu, seating, accommodation, vendors"). Confirmed with the user
before starting: all six became cards/sub-screens, not just the four named ones, so the hub doesn't end
up half-migrated with two long sections still rendering inline.

**Verification status — same caveat as the rest of this file.** Confirmed only by
`npx tsc --noEmit --noUnusedLocals` and `npx expo export --platform ios`, both passing. How the hub's
card list and the six new sub-screens actually look/feel (spacing, the `GuestScreen`-inside-a-pushed-
route background, the header-slot "+" icon's placement) is unverified — no device or simulator run has
happened in any session so far, per the top of this file.

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
  card text, the placeholder card) — `invite/[id].tsx`'s own gradient stayed the per-event-type override
  it always was, unaffected by `Screen`'s new default, **at this point in the migration — no longer true
  either, see the sixth pass below, same trajectory as Live's hero card next to it in this sentence.**
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

**Sixth pass — `app/invite/[id].tsx` had two separate bugs, same "still hardcoded" class as the fifth
pass, plus an unrelated layout overlap. Fixed together since both are on the same screen:**

- **Background.** `Screen`'s `gradient` prop was unconditionally `type.gradient` (the event type's own
  fixed, light-only palette from `utils/eventTypes.ts` — e.g. Corporate's `['#D3DDF0', '#C3CFE8']`),
  regardless of theme — exactly the "still hardcoded to one mode" bug the fifth pass fixed on the tab
  bar and Live's hero card, just not caught here at the time (§5's own second-pass note said this
  screen's fixed gradient was "unaffected by `Screen`'s new default," which was accurate then but is no
  longer the goal). Fixed the same way as Live: light mode is unchanged (`type.gradient`, "keep as
  reference" per the request that prompted this), dark mode falls back to `tokens.background` — `Screen`'s
  own default when no `gradient` prop is passed at all, so this is really "stop overriding the default
  in dark mode" rather than a new token. `components/InviteCard.tsx` (the card rendered on top) needed
  **no change** — it already reads `tokens.surfaceElevated`/`textPrimary`/`textSecondary` throughout;
  only its small icon-header strip keeps `type.gradient` unconditionally, which is fine since that's a
  small colored strip behind an emoji, not a body-text-bearing surface.
- **Back button overlap.** `BackButton` here is absolutely positioned (deliberately — see §5's Component
  Patterns note on why this screen uses the standalone `BackButton` instead of `Header`: a hero card,
  not a title row), which means nothing in the wrapping `View`'s normal flow reserves space for its own
  40×40 footprint. The `spacer` sibling meant to leave room for it was only `spacing.lg` (16) tall, while
  the button itself — positioned at `top: spacing.md` (12) — extends to `12 + 40 = 52`px. `InviteCard`
  therefore started rendering 36px into the button's own footprint. Fixed by growing the spacer to
  `spacing.xxl * 2` (64) — clears the button with a small margin, composed from the existing spacing
  scale rather than a new constant, per the usual convention.

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
  "loading" with the animation tooling already in the project). **Theme-aware as of this pass** — it
  now reads `useTheme()` directly, same as the tab bar / Live card fixes: dark mode keeps the original
  lavender-gray `#E7E1F5` unchanged (kept as a literal constant since no existing dark token matches
  it exactly and the ask was zero visual change there); light mode reads `tokens.textSecondary`
  (`#8A8496`) instead of that same lavender-gray, which read too close to white/cream to be legible on
  light cards. No new token added — `textSecondary` already existed and fit. Every screen-specific
  skeleton composes from this one primitive, so this single change covers all of them (Home, the
  organizer dashboard, and all 6 guest tabs) with no per-screen edits. No default `height` — several
  skeletons (the Album grid tile) need `aspectRatio` from a passed
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
- **Real invites — partially built, now by phone too.** Server-side invite records exist for both
  email (`app/add-guest/[id].tsx`, auto-linked via `20260810000003_guest_autolink.sql`) and phone
  (same screen's phone mode, auto-linked via `20260818000002_guest_phone_invites.sql`) — see §3's
  "Phone auth + phone guest invites." What's still missing: **no SMS/WhatsApp message is actually
  sent to a phone invitee either** — `insertGuestInvitePhone` only writes the `event_guests` row,
  nothing calls Twilio (or any provider) to notify them. That send step, plus the standalone Next.js
  web-fallback page for someone who taps a link without the app installed, are both specified but not
  built — see `docs/web-invite-fallback-spec.md` and CLAUDE.md's own note pointing to it. The
  `povesteanoastra://invite/<id>` deep link itself still only resolves on a device with the app
  installed; there is still no real SMS delivery integration in this repo at all, phone auth's OTP
  send included (Twilio is presumed configured in the Supabase dashboard, never verified from here).
  The invite-preview-under-RLS gap is narrower now, not gone — see §3's "Narrowed, not closed" note.
- **Guest identity is real now, but only the phone half is reachable from any current screen.**
  `event_guests` still carries both `guest_email`/`guest_phone`/`guest_user_id` columns and the
  auto-link trigger still matches either, but `app/add-guest/[id].tsx` only ever writes `guest_phone`
  now — the email invite path is inert schema, not a live feature (§3's "Phone-only auth").
- No push notifications. No Google/Apple/social auth, and no password auth either — phone OTP is the
  only auth method, full stop, not "email OTP and phone OTP" (§3's "Phone-only auth" — email auth was
  built, then removed one pass later). No video streaming — the Live tab is a photo feed. No
  venue/restaurant marketplace. No seating plans.
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
