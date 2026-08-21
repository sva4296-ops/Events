# Seating chart guest assignment

How an organizer assigns confirmed guests to a seating table, and how a guest sees their own table
and tablemates. Covers the DB schema, the repository/hook functions, and the two screens involved.

## 1. Overview

Before this flow, `seating_tables` was just a manually-typed list (name, label, seat count) — there
was no link between a table and the actual guests sitting at it. This flow adds that link:
`event_guests.table_id` (nullable FK → `seating_tables.id`). The organizer's Add/Edit Table screen
(`app/table/[id].tsx`) gained an "Assign guests" multi-select, capped at the table's seat count. On
the guest-facing seating list (`app/detalii-seating/[id].tsx`), a guest sees their own table
highlighted with a "You're here" badge and the names of their confirmed tablemates, fetched through a
dedicated RPC since RLS otherwise blocks a guest from reading any `event_guests` row but their own.

A guest can only sit at **one** table per event, so this is a plain nullable FK on `event_guests`, not
a `table_assignments` join table — there's no scenario in this product where a guest needs to belong
to more than one table at once.

## 2. Database layer

### 2.1 `table_id` column — `supabase/migrations/20260822000002_seating_table_guest_assignment.sql`

```sql
alter table public.event_guests
  add column if not exists table_id uuid references public.seating_tables(id) on delete set null;

create index if not exists event_guests_table_id_idx on public.event_guests (table_id);
```

- **`on delete set null`** — deleting a table (the seating chart's existing swipe-to-delete) frees its
  guests instead of cascading into their rows or blocking the delete.
- **Index on `table_id`** — backs the "who's assigned to this table" lookups the save/delete flow does
  (clear-then-reassign, see §3.1) and the per-table `assignedCount` computation on the list screen.
- **No new RLS policy was added.** `event_guests`' existing update policy already covers any column on
  a guest row:

  ```sql
  create policy "update own rsvp or as organizer" on public.event_guests
    for update using (guest_user_id = auth.uid() or public.is_event_organizer(event_id))
    -- ...
  ```

  In plain English: a signed-in user can update their own guest row, and an event's organizer can
  update any guest row on their own event. `table_id` is just another column on that row, so this
  policy — unchanged since it was first written for `rsvp_status` — already governs it. The organizer
  writing `table_id` on someone else's row (assigning them to a table) is covered by the
  `is_event_organizer(event_id)` half; a guest never writes their own `table_id` from the client at
  all (only the organizer's save flow does), but the policy would allow it either way.

### 2.2 `get_table_companions` RPC — `supabase/migrations/20260822000003_table_companions_rpc.sql`

```sql
create or replace function public.get_table_companions(p_event_id uuid)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select table_id
    from public.event_guests
    where event_id = p_event_id
      and guest_user_id = auth.uid()
      and table_id is not null
    limit 1
  )
  select eg.id, coalesce(eg.guest_name, eg.guest_email, eg.guest_phone, 'Guest') as name
  from public.event_guests eg, me
  where eg.event_id = p_event_id
    and eg.table_id = me.table_id
    and eg.rsvp_status = 'confirmed'
    and eg.guest_user_id is distinct from auth.uid();
$$;

grant execute on function public.get_table_companions(uuid) to authenticated;
```

**Why this needs a function at all.** `event_guests`' only `select` policy is:

```sql
create policy "view guest list of visible events" on public.event_guests
  for select using (guest_user_id = auth.uid() or public.is_event_organizer(event_id));
```

A guest can `select` their own row and nothing else — there is no way for a guest to read a
table-mate's row directly. `get_table_companions` is `security definer` (bypasses RLS internally),
same shape as the pre-existing `get_invite_preview()`.

**Why it's safe despite bypassing RLS:**
- The caller's own table (`me.table_id`) is derived **server-side** from `auth.uid()` against their
  own `event_guests` row — never taken as a client-supplied parameter. A caller can't pass an
  arbitrary `table_id` to peek at a table they're not on.
- Only `rsvp_status = 'confirmed'` rows are returned — a pending/declined guest at the same table
  isn't leaked.
- The caller's own row is excluded (`guest_user_id is distinct from auth.uid()`) — this is a
  "who else is here" list, not a full roster including yourself.
- Returns zero rows if the caller has no confirmed row on the event, or isn't assigned to a table yet
  (`table_id is not null` in the `me` CTE).
- `execute` is granted to `authenticated` only, not `anon`.

## 3. Data fetching / mutation functions

### 3.1 Save a table + its guest assignments — `data/remoteEventContentRepository.ts`

```ts
interface SeatingTableDraft {
  id: string | null;
  name: string;
  label: string;
  seat_count: number;
  /** Confirmed guests' ids to assign to this table — see
   * app/table/[id].tsx's "Assign guests" section. Replaces whatever this
   * table's assignment set was before the save, in one call. */
  guestIds: string[];
}

async function saveSeatingTable(
  eventId: string,
  item: SeatingTableDraft,
  sortOrder: number,
): Promise<void> {
  const client = supabase;
  let tableId = item.id;

  if (tableId === null) {
    const { data, error } = await client
      .from('seating_tables')
      .insert({
        event_id: eventId,
        name: item.name,
        label: item.label,
        seat_count: item.seat_count,
        sort_order: sortOrder,
      })
      .select('id')
      .single();
    if (error) throw error;
    tableId = (data as { id: string }).id;
  } else {
    const { error } = await client
      .from('seating_tables')
      .update({ name: item.name, label: item.label, seat_count: item.seat_count })
      .eq('id', tableId);
    if (error) throw error;
  }

  const { error: clearError } = await client
    .from('event_guests')
    .update({ table_id: null })
    .eq('table_id', tableId);
  if (clearError) throw clearError;

  if (item.guestIds.length > 0) {
    const { error: assignError } = await client
      .from('event_guests')
      .update({ table_id: tableId })
      .in('id', item.guestIds);
    if (assignError) throw assignError;
  }
}

async function deleteSeatingTable(tableId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('seating_tables').delete().eq('id', tableId);
  if (error) throw error;
}
```

**What it does:** one function covers both the table row *and* its guest assignments — the composer
screen never has to sequence "save the table, then use its id to assign guests" as two calls. Insert
returns the new id via `.select('id').single()` when there wasn't one yet (add mode); update mode just
updates the existing row.

The assignment step is **"clear everyone currently on this table, then set the new selection"** — a
full replace, not a diff. This is simpler than diffing and exactly as correct, since a guest belongs to
at most one table anyway (clearing by `table_id` first means any guest removed from the selection is
automatically freed, with no separate "who got removed" computation needed).

**Why this had to be one function, not two hook actions sequenced by the screen:** `useEventContent`'s
mutations are fire-and-forget (`useMutation.mutate`, not `mutateAsync`). If the screen tried to call
"save table" then "assign guests" as two separate mutations, there'd be no clean way to wait for a
*new* table's generated id before writing assignments against it. Bundling both into one repository
function sidesteps that ordering problem entirely.

### 3.2 The hook layer — `hooks/useEventContent.tsx`

```ts
// Both of these touch event_guests.table_id (a save reassigns it, a
// delete frees it via `on delete set null`) — that column lives in the
// `events` query's guest list, a different cache from this hook's own
// 'details' key, so it needs its own explicit invalidation too or the
// seating chart's assigned-guest names would only refresh on next
// `events` staleTime tick (30s) instead of immediately.
saveSeatingTable: (item: SeatingTableInput) => {
  runRemote(
    () => remoteRepository.saveSeatingTable(eventId, item, content?.seatingTables.length ?? 0),
    'details',
    () => void queryClient.invalidateQueries({ queryKey: ['events', user?.id ?? null] }),
  );
},

deleteSeatingTable: (tableId: string) => {
  runRemote(
    () => remoteRepository.deleteSeatingTable(tableId),
    'details',
    () => void queryClient.invalidateQueries({ queryKey: ['events', user?.id ?? null] }),
  );
},
```

`runRemote(write, category, onSuccessExtra?)` wraps a `useMutation` whose `onSuccess` normally
invalidates just one of the three `eventContent` query keys (`social`/`details`/`contributions`, per
`category`). `event_guests.table_id` doesn't live in any of those three — it lives in the `['events',
userId]` query (the guest list, fetched by `useEvents`), a completely different cache. `runRemote`'s
third parameter, `onSuccessExtra`, is passed through to `useMutation`'s per-call
`mutate(variables, { onSuccess })` — TanStack Query fires per-call callbacks in addition to (after) the
mutation-level one, so both the `'details'` key (the `seatingTables` list itself) and the `events` key
(each guest's `tableId`) refresh immediately after a save or delete, with no waterfall/waiting needed.

### 3.3 Fetch confirmed guests for the picker

No separate fetch — the Add/Edit Table screen already has `event.guests` from `useEvents().getEvent(id)`
(the organizer sees the full guest list under RLS), and filters it client-side:

```ts
// app/table/[id].tsx
const tableNameById = new Map(content.seatingTables.map((table) => [table.id, table.name]));
const assignableGuests: AssignableGuestRow[] = event.guests
  .filter((guest) => guest.status === 'confirmed')
  .map((guest) => ({
    id: guest.id,
    name: guest.name,
    disabledReason:
      guest.tableId !== null && guest.tableId !== existing?.id
        ? t('tableForm.guestAlreadyAssigned', { table: tableNameById.get(guest.tableId) ?? '' })
        : null,
  }));
```

Only `status === 'confirmed'` guests are listable at all. A guest already seated at a *different*
table (`guest.tableId !== null && guest.tableId !== existing?.id`) is included but marked
`disabledReason` rather than filtered out — so it's visible *why* they can't be picked here, instead of
silently missing from the list.

### 3.4 Fetch a guest's own table + tablemates

`data/eventsRepository.ts`:

```ts
export async function fetchTableCompanions(eventId: string): Promise<string[]> {
  const client = supabase;
  const { data, error } = await client.rpc('get_table_companions', { p_event_id: eventId });
  if (error) throw error;
  return ((data as TableCompanionRow[] | null) ?? []).map((row) => row.name);
}
```

A thin wrapper around the RPC from §2.2 — maps the `{id, name}[]` rows down to just `string[]` names,
which is all the rendering side needs.

"My own table" needs **no query at all** — it's derived from data the guest already has. RLS scopes a
non-organizer's `event.guests` to exactly their own row, so `event.guests[0]` *is* the caller's own
guest row (the same pattern already used for the menu tab's dietary-preference pills and for
`myRsvp` elsewhere in the app):

```ts
// app/detalii-seating/[id].tsx
const myGuest = owner || event === undefined ? undefined : event.guests[0];
const myTableId = myGuest?.tableId ?? null;
```

The tablemates query is then only enabled once `myTableId` is actually known:

```ts
const companionsQuery = useQuery({
  queryKey: ['tableCompanions', id, user?.id ?? null],
  queryFn: () => fetchTableCompanions(id as string),
  enabled: !owner && myTableId !== null && id !== undefined,
  staleTime: 30_000,
});
const companions = companionsQuery.data ?? [];
```

This is a plain `useQuery` in the screen itself, not a dedicated hook — the same "screen calls a
repository RPC wrapper directly through `useQuery`" shape `app/invite/[id].tsx`'s own preview query
already uses. `staleTime: 30_000` matches other user-facing-list treatments in the app (e.g. the
`events` query itself).

## 4. UI flow

### 4.1 Add/Edit Table screen — `app/table/[id].tsx`

**State.** `selectedGuestIds: Set<string>` is pre-seeded in edit mode from whoever is already assigned:

```ts
const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(
  () =>
    new Set(
      (event?.guests ?? [])
        .filter((guest) => existing !== null && guest.tableId === existing.id)
        .map((guest) => guest.id),
    ),
);
```

**Cap enforcement is real, not just a hint — enforced in two places:**

1. Inside the picker modal (`TableGuestPickerModal`, §4.1.1) — every unchecked row is disabled once
   the cap is hit.
2. As a defensive backstop in the toggle handler itself:

```ts
const toggleGuest = (guestId: string) => {
  setSelectedGuestIds((current) => {
    const next = new Set(current);
    if (next.has(guestId)) {
      next.delete(guestId);
    } else {
      if (hasSeatCap && next.size >= seatCap) return current;
      next.add(guestId);
    }
    return next;
  });
};
```

**The "Assign guests" row is disabled until Seats holds a valid positive number**
(`hasSeatCap = Number.isFinite(seatCap) && seatCap > 0`) — there's no cap to enforce against
otherwise, so `tableForm.seatsRequiredHint` shows in place of the assigned-count hint until then.

**Shrinking Seats below the current assignment count trims the selection immediately**, keeping the
earliest-picked names and dropping the most recently added ones past the new cap:

```ts
const handleSeatCountChange = (value: string) => {
  setSeatCount(value);
  const parsed = Number.parseInt(value, 10);
  const cap = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  if (cap > 0 && cap < selectedGuestIds.size) {
    setSelectedGuestIds((current) => new Set(Array.from(current).slice(0, cap)));
  }
};
```

Without this, editing Seats down after guests were already assigned would leave the table silently
over-assigned relative to its own cap until the picker was reopened.

**On save**, the whole draft — including `guestIds: Array.from(selectedGuestIds)` — goes through the
single `saveSeatingTable` call from §3.1/§3.2, then `router.back()`:

```ts
const save = () => {
  const parsed = Number.parseInt(seatCount, 10);
  saveSeatingTable({
    id: existing?.id ?? null,
    name: name.trim(),
    label,
    seat_count: Number.isFinite(parsed) ? parsed : 0,
    guestIds: Array.from(selectedGuestIds),
  });
  router.back();
};
```

#### 4.1.1 The picker sheet — `components/TableGuestPickerModal.tsx`

A `Modal`-based bottom sheet, the same shape as the app's one pre-existing multi-select pattern
(`components/ContactPickerModal.tsx`) — backdrop, sheet, checkbox `FlatList`. Unlike that modal,
**selection is controlled by the parent**, not owned internally, so the "X / Y seats assigned" counter
stays visible on the composer screen itself, not just inside the sheet.

Key prop: `seatCap: number`. Each row computes:

```ts
const capReached = seatCap > 0 && selected.size >= seatCap;
// ...
const disabled = item.disabledReason !== null || (!isSelected && capReached);
```

So a row is disabled either because the guest is already seated elsewhere (`disabledReason`) or
because the cap is reached and this particular guest isn't already one of the selected ones. A
`tableForm.seatsCapReached` notice renders above the list once the cap is hit.

### 4.2 Seating chart list screen — `app/detalii-seating/[id].tsx`

**Not owner-gated at the top level** — like the other Detalii sub-screens, any guest on the event can
open this screen; only the add/edit/delete affordances inside it are gated behind `isOwner(event)`.

**Organizer view vs. guest view — same list, different per-card details:**

```tsx
{content.seatingTables.map((table) => {
  const assignedCount = event?.guests.filter((guest) => guest.tableId === table.id).length ?? 0;
  const isMine = !owner && myTableId !== null && table.id === myTableId;
  return (
    <SwipeableRow key={table.id} enabled={owner} actions={[/* Edit, Delete */]}>
      <View style={[styles.rowCard, card, isMine ? { borderColor: tokens.accentPrimary, borderWidth: 2, backgroundColor: `${tokens.accentPrimary}14` } : null]}>
        {/* name, "You're here" badge if isMine, label, seat count */}
        {owner && assignedCount > 0 ? (
          <Text style={{ color: tokens.accentPrimary }}>
            {t('tableForm.seatsAssignedCount', { assigned: assignedCount, total: table.seat_count })}
          </Text>
        ) : null}
        {isMine && companions.length > 0 ? (
          <Text style={{ color: tokens.textPrimary }}>
            {t('detalii.seatingWithYou', { names: companions.join(', ') })}
          </Text>
        ) : null}
      </View>
    </SwipeableRow>
  );
})}
```

- **`assignedCount` — owner-only** (`owner && assignedCount > 0`). It's computed from
  `event?.guests.filter(...)`, but for a non-organizer viewer, RLS scopes `event.guests` to just their
  own single row — so this count would be silently wrong (0 or 1, never the real number) on every
  table that isn't theirs. Gating it on `owner` avoids showing a guest a bogus number; the organizer,
  who genuinely has the full guest list, sees the real count.
- **`isMine`** — `!owner && myTableId !== null && table.id === myTableId` (from §3.4). Only computed
  for non-organizer viewers; an organizer never gets a highlighted "their" table since they have no
  `event_guests` row of their own on their own event.
- **The highlight** — a 2px `tokens.accentPrimary` border plus a `${tokens.accentPrimary}14` tinted
  background on the matching card, and a small filled "You're here" pill (`detalii.seatingYoureHere`)
  next to the table name.
- **`companions.join(', ')`** — only rendered on the guest's own card, and only if the RPC actually
  returned any names. A guest never sees another table's guest list, and never sees a seat-count
  number for any table but potentially their own (which itself only ever shows names, not a count).
- **Not yet assigned** (`myTableId === null`) — no highlight, and the tablemates query never even
  fires (`enabled` is false in §3.4), so the screen renders exactly as it did before this whole
  feature existed.

**Owner-only header "+"** pushes `/table/${id}` (add mode); each row's `SwipeableRow` Edit action
pushes `/table/${id}?itemId=${table.id}` (edit mode); Delete calls `confirmDelete(...)` →
`deleteSeatingTable(table.id)` (§3.2), which frees the table's guests via the FK's
`on delete set null` — no explicit "unassign" step needed on delete.

## 5. How to extend this flow

- **Adding a new field to a table** (e.g. a table shape/type): add the column via a new migration on
  `seating_tables`, extend `SeatingTableRow`/`SeatingTable` (`types/supabase.ts`/`types/guest.ts`),
  `mapSeatingTable` in `data/remoteEventContentRepository.ts`, `SeatingTableInput`/`SeatingTableDraft`,
  and the composer form in `app/table/[id].tsx`. None of the guest-assignment plumbing needs to change
  for this — it's orthogonal to `table_id`.

- **Changing capacity rules** (e.g. allowing over-assignment, or a soft cap with a warning instead of a
  hard block): the enforcement lives in exactly two places — `TableGuestPickerModal`'s `capReached`
  check (disables rows) and `app/table/[id].tsx`'s `toggleGuest` backstop. Both read the same
  `hasSeatCap`/`seatCap` values computed from the `seatCount` field; there's no server-side cap
  enforcement today (the RLS policy and `saveSeatingTable` don't check `seat_count` against
  `guestIds.length` at all), so a determined client could still write an over-assigned table directly
  against Supabase. If server-side enforcement is ever wanted, it'd need a check constraint or trigger
  on `event_guests`/`seating_tables`, not just a UI change.

- **If a guest's table isn't showing correctly:**
  - Confirm `event.guests[0]` really is that guest's own row — this only holds because RLS limits a
    non-organizer's `event.guests` to one row. If that assumption is ever loosened (e.g. a future
    feature exposes more of the guest list to non-organizers), `myGuest`/`myTableId` in
    `app/detalii-seating/[id].tsx` need to change to something that actually matches by
    `guest_user_id === user.id` instead of blindly indexing `[0]`.
  - Confirm the guest's `rsvp_status` is `'confirmed'` — `get_table_companions` only returns
    *confirmed* co-assigned guests, and the guest's own highlight/badge logic doesn't check status, but
    a `pending`/`declined` guest with a `table_id` set would still see their own highlight while never
    appearing in anyone else's companions list.
  - Check `queryKey: ['tableCompanions', id, user?.id ?? null]` is actually enabled — it's gated on
    `!owner && myTableId !== null && id !== undefined`; a stale/undefined `id` param (e.g. hitting the
    "Critical gotcha" pattern documented in CLAUDE.md §2 for nested routes) would silently keep the
    query disabled.

- **Common pitfalls:**
  - **Forgetting to filter by `event_id`.** `get_table_companions` filters on `eg.event_id = p_event_id`
    for both the `me` CTE and the final select — a table's `id` alone isn't guaranteed unique across
    events in a way the RPC's own logic relies on, but always pass the right `p_event_id` if extending
    this RPC or writing a similar one; omitting it would let the function match guests on a
    *different* event that happens to reuse the same `table_id` value (not currently possible since
    `table_id` values are real UUIDs scoped to one table row, but still the correct discipline for any
    new query touching `event_guests`).
  - **RLS blocking a query.** Any new client-side `select` against `event_guests` for anyone other
    than the caller's own row will silently return zero rows, not an error — this looks exactly like
    "no data" and is easy to misdiagnose as a bug elsewhere. If a future feature needs a guest to see
    more than their own row or their own table's companions, it needs another narrow
    `security definer` RPC (same shape as `get_table_companions`/`get_invite_preview`), not a looser
    `event_guests` select policy.
  - **The clear-then-assign replace in `saveSeatingTable` is not diffed** — every save clears *all*
    current assignments for that `table_id` and re-writes the new selection from scratch. This is
    intentional (simpler, and always correct since one guest ⇒ at most one table), but means a
    concurrent edit from two organizer sessions on the same table would have the later save silently
    overwrite the earlier one's assignment set, not merge them — no optimistic-locking/conflict
    detection exists here.
  - **Cross-cache invalidation.** Anything that writes `event_guests.table_id` needs to invalidate both
    the `'details'` `eventContent` key (for `seatingTables` itself) *and* `['events', userId]` (for
    each guest's `tableId`) — see §3.2's `onSuccessExtra`. Forgetting the second one is exactly the bug
    that pattern was added to prevent: the assigned-count/highlight would only refresh on the `events`
    query's own 30s `staleTime` tick instead of immediately after a save.
