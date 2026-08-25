import { useEvents } from "@/hooks/useEvents";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import type { PlanCapabilities } from "@/types/pricing";

/**
 * Capabilities used for `planTier === null` (no plan chosen yet — true for
 * every event created before plan-tier gating existed, and for any new
 * event until its organizer visits the pricing screen). Matches the
 * Esențial row in plan_features exactly, kept as a static fallback rather
 * than looked up so it still resolves before that table has hydrated —
 * this is a product decision (confirmed, not assumed): an unset plan
 * behaves like the entry tier, not like every capability being free, which
 * matches the "Choose a plan" upsell already on Home's event cards
 * (components/PlanTierBadge.tsx). Mirror supabase/migrations/
 * 20260828000001_plan_feature_gating.sql's event_plan_capabilities() SQL
 * function if this ever needs to change — the two must stay in lockstep,
 * since that migration is the real (server-side) enforcement and this hook
 * is only the client-side UI reflection of the same rule.
 */
const UNSET_PLAN_CAPABILITIES: PlanCapabilities = {
  rsvpEnabled: true,
  progressFeedEnabled: true,
  photoAlbumEnabled: true,
  maxGuests: 50,
  contributionsEnabled: false,
  liveScreenEnabled: false,
  chatEnabled: false,
  lodgingTransportEnabled: false,
  vendorTaggingEnabled: false,
  prioritySupportEnabled: false,
};

export interface PlanGate {
  /** False until both the event and plan_features have loaded at least
   * once — callers should treat this the same way they already treat
   * `useEventContent`'s `content === null` (avoid flashing a locked state
   * before the real capabilities are known). */
  hydrated: boolean;
  /** Raw `events.plan_tier` passthrough — null means no plan chosen yet. */
  planTier: string | null;
  /** Resolved plan_features.display_name — null only when planTier is null,
   * matching PlanTierBadge's existing `planLabel === null` contract so a
   * caller could reuse this value for that badge if it ever needed to. */
  planLabel: string | null;
  /** Capability flags for this specific event's effective plan (falls back
   * to UNSET_PLAN_CAPABILITIES when no plan is chosen). */
  capabilities: PlanCapabilities;
  /**
   * Guest count and cap. `event.guests` is RLS-scoped to the caller's own
   * single row for a non-owner (see CLAUDE.md's "Critical gotcha" /
   * dietary-preferences precedent) — these two fields are only meaningful
   * when read from the organizer's own session. Every current caller of
   * this hook for guest-cap purposes is already owner-gated
   * (app/event/[id].tsx, app/add-guest/[id].tsx, app/bulk-add-guests/[id].tsx);
   * don't read guestCount/canAddGuests from a non-owner screen.
   */
  guestCount: number;
  /** null = unlimited. */
  guestsRemaining: number | null;
  canAddGuests: boolean;
}

/**
 * Centralized plan-tier feature gate for one event — the single place every
 * screen should read "does this event's plan allow X" from, rather than
 * scattering `if (event.planTier === 'premium')` checks. Built on top of the
 * two hooks that already exist (usePlanFeatures for the plan_features
 * catalog, useEvents for the event's own plan_tier/guest list) instead of
 * fetching anything new.
 */
export function usePlanGate(eventId: string): PlanGate {
  const { getEvent } = useEvents();
  const { plans, hydrated: plansHydrated } = usePlanFeatures();

  const event = getEvent(eventId);

  const planTier = event?.planTier ?? null;

  const matchedPlan = plans.find(
    (plan) => plan.planKey === (planTier ?? "esential"),
  );
  const capabilities: PlanCapabilities = matchedPlan ?? UNSET_PLAN_CAPABILITIES;

  const guestCount = event?.guests.length ?? 0;
  const guestsRemaining =
    capabilities.maxGuests === null
      ? null
      : Math.max(0, capabilities.maxGuests - guestCount);

  return {
    hydrated: plansHydrated && event !== undefined,
    planTier,
    planLabel: planTier === null ? null : (matchedPlan?.displayName ?? null),
    capabilities,
    guestCount,
    guestsRemaining,
    canAddGuests: guestsRemaining === null || guestsRemaining > 0,
  };
}
