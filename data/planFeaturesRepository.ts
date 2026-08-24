import { supabase } from '@/data/supabaseClient';
import type { PlanFeature } from '@/types/pricing';
import type { PlanFeatureRow } from '@/types/supabase';

/**
 * Supabase-backed plan_features — the pricing screen's card content (title,
 * capability flags, badge, button label, styling hints). hooks/usePlanFeatures.tsx
 * is the only caller. Price is deliberately not part of this row — see
 * utils/revenueCat.ts.
 */

function mapPlanFeatureRow(row: PlanFeatureRow): PlanFeature {
  return {
    id: row.id,
    planKey: row.plan_key,
    displayName: row.display_name,
    isHighlighted: row.is_highlighted,
    badgeText: row.badge_text,
    buttonLabel: row.button_label,
    revenuecatPackageId: row.revenuecat_package_id,
    isNavigationOnly: row.is_navigation_only,
    navigateTo: row.navigate_to,
    priceText: row.price_text,
    sortOrder: row.sort_order,
    rsvpEnabled: row.rsvp_enabled,
    progressFeedEnabled: row.progress_feed_enabled,
    photoAlbumEnabled: row.photo_album_enabled,
    maxGuests: row.max_guests,
    contributionsEnabled: row.contributions_enabled,
    liveScreenEnabled: row.live_screen_enabled,
    chatEnabled: row.chat_enabled,
    lodgingTransportEnabled: row.lodging_transport_enabled,
    vendorTaggingEnabled: row.vendor_tagging_enabled,
    prioritySupportEnabled: row.priority_support_enabled,
  };
}

export async function fetchPlanFeatures(): Promise<PlanFeature[]> {
  const { data, error } = await supabase
    .from('plan_features')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as PlanFeatureRow[]).map(mapPlanFeatureRow);
}
