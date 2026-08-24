/**
 * The pricing screen's app-layer types — see app/pricing.tsx,
 * data/planFeaturesRepository.ts, hooks/usePlanFeatures.tsx, and
 * utils/revenueCat.ts. plan_features (Postgres) is the source of truth for
 * everything on a card except its price; PlanFeature is that table mapped
 * to camelCase. ResolvedPlan is a PlanFeature with a price merged in from
 * RevenueCat's offerings at read time — see utils/revenueCat.ts.
 */

/** Capability flags — one per real toggle on the pricing cards. The
 * screen's bullet list is derived from these (+ maxGuests) at render time,
 * never from stored free-text — see app/pricing.tsx's PLAN_FEATURE_LABEL_KEY. */
export interface PlanCapabilities {
  rsvpEnabled: boolean;
  progressFeedEnabled: boolean;
  photoAlbumEnabled: boolean;
  /** Null = unlimited. */
  maxGuests: number | null;
  contributionsEnabled: boolean;
  liveScreenEnabled: boolean;
  chatEnabled: boolean;
  lodgingTransportEnabled: boolean;
  vendorTaggingEnabled: boolean;
  prioritySupportEnabled: boolean;
}

export interface PlanFeature extends PlanCapabilities {
  id: string;
  planKey: string;
  displayName: string;
  isHighlighted: boolean;
  badgeText: string | null;
  buttonLabel: string;
  revenuecatPackageId: string | null;
  isNavigationOnly: boolean;
  navigateTo: string | null;
  priceText: string | null;
  sortOrder: number;
}

export type PlanPriceState =
  | { status: 'not-applicable' } // is_navigation_only — no RevenueCat lookup at all
  | { status: 'loading' }
  | { status: 'resolved'; priceString: string }
  | { status: 'unavailable' }; // revenuecat_package_id set, but no matching package found

export interface ResolvedPlan {
  plan: PlanFeature;
  price: PlanPriceState;
}
