import Feather from "@expo/vector-icons/Feather";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Skeleton } from "@/components/Skeleton";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useEvents } from "@/hooks/useEvents";
import { useTheme } from "@/hooks/useTheme";
import type {
  PlanFeature,
  PlanPriceState,
  ResolvedPlan,
} from "@/types/pricing";
import { spacing } from "@/utils/theme";
import { EVENT_TYPE_COLORS } from "@/utils/eventCovers";

import { brandGradient, themeRadius, typography } from "@/utils/themeTokens";
import { reportSupabaseError } from "@/utils/reportError";
import { fetchOfferingPackages } from "@/utils/revenueCat";
import { FUND_ENABLED } from "@/utils/features";

/**
 * Per-event pricing screen — reached two ways, both event-scoped: right
 * after create-event finishes (app/create/preview.tsx, `?context=create`)
 * and from a "no plan yet" badge on that event's own Home card
 * (components/EventListItem.tsx). There is no standalone, event-less
 * pricing route anymore, and no entry point from Profile — see CLAUDE.md's
 * "Pricing screen" for why.
 *
 * Card content (title, capability flags, badge, button label, is_highlighted/
 * is_navigation_only styling) comes entirely from Supabase's plan_features
 * table (usePlanFeatures) — the single source of truth for everything on a
 * card except price. The bullet list itself is derived from named boolean
 * columns (buildFeatureBullets below), not a stored free-text list, so it
 * can't drift from what a plan actually unlocks. Price is still resolved
 * from RevenueCat's getOfferings() exactly as before — that part isn't
 * changed here — but tapping "Alege" no longer calls purchasePackage at
 * all: it's a placeholder that writes events.plan_tier/plan_purchased_at
 * directly via useEvents().setPlanTier, so the whole flow is testable
 * without RevenueCat actually configured. See CLAUDE.md for what still
 * replaces this placeholder later (a real purchase call, recording,
 * webhook verification, entitlement gating — none of that is built here).
 */

type OfferingsQuery = UseQueryResult<Map<string, PurchasesPackage>>;
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Derives a card's bullet list from its capability flags (+ maxGuests) at
 * render time — never from stored free-text, so the list can't drift from
 * what a plan actually unlocks. Order matches the real pricing cards:
 * baseline three, guest cap, then each additive capability in the same
 * order it's introduced going up the tiers. The four Agenție-only bullets
 * (branding/centralized panel/volume billing/managing many events at once)
 * aren't capability flags on this row at all — three live on `agencies`
 * instead (account-level, not per-event; see
 * 20260824000002_agency_plan_capabilities.sql), and "Volum multiplu" isn't
 * a toggle anywhere, so all four are fixed copy appended only for the
 * is_navigation_only card. */
function buildFeatureBullets(plan: PlanFeature, t: Translate): string[] {
  const bullets: string[] = [];
  if (plan.rsvpEnabled) bullets.push(t("pricing.featureRsvp"));
  if (plan.progressFeedEnabled) bullets.push(t("pricing.featureProgressFeed"));
  if (plan.photoAlbumEnabled) bullets.push(t("pricing.featurePhotoAlbum"));
  bullets.push(
    plan.maxGuests !== null
      ? t("pricing.featureMaxGuests", { count: plan.maxGuests })
      : t("pricing.featureUnlimitedGuests"),
  );
  if (FUND_ENABLED && plan.contributionsEnabled)
    bullets.push(t("pricing.featureContributions"));
  if (plan.liveScreenEnabled) bullets.push(t("pricing.featureLiveScreen"));
  if (plan.chatEnabled) bullets.push(t("pricing.featureChat"));
  if (plan.lodgingTransportEnabled)
    bullets.push(t("pricing.featureLodgingTransport"));
  if (plan.vendorTaggingEnabled)
    bullets.push(t("pricing.featureVendorTagging"));
  if (plan.prioritySupportEnabled)
    bullets.push(t("pricing.featurePrioritySupport"));
  if (plan.isNavigationOnly) {
    bullets.push(
      t("pricing.featureMultipleEvents"),
      t("pricing.featureBranding"),
      t("pricing.featureCentralizedPanel"),
      t("pricing.featureVolumeBilling"),
    );
  }
  return bullets;
}

function resolvePrice(
  plan: PlanFeature,
  offerings: OfferingsQuery,
): PlanPriceState {
  if (plan.isNavigationOnly) return { status: "not-applicable" };
  if (plan.revenuecatPackageId === null) return { status: "unavailable" };
  if (offerings.isLoading) return { status: "loading" };
  if (offerings.isError) return { status: "unavailable" };

  const pkg = offerings.data?.get(plan.revenuecatPackageId);
  if (pkg === undefined) return { status: "unavailable" };
  return { status: "resolved", priceString: pkg.product.priceString };
}

export default function PricingScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { id, context } = useLocalSearchParams<{
    id: string;
    context?: string;
  }>();
  const { getEvent, setPlanTier, isPrimaryOwner } = useEvents();
  const { plans, hydrated: plansHydrated } = usePlanFeatures();
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

  const event = getEvent(id);

  const offeringsQuery = useQuery({
    queryKey: ["revenueCatOfferings"],
    queryFn: fetchOfferingPackages,
    staleTime: 300_000,
  });

  const resolvedPlans: ResolvedPlan[] = useMemo(
    () =>
      plans.map((plan) => ({
        plan,
        price: resolvePrice(plan, offeringsQuery),
      })),
    // offeringsQuery itself is a new object every render; keying off its
    // data/status fields instead keeps this memo from recomputing every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      plans,
      offeringsQuery.data,
      offeringsQuery.isLoading,
      offeringsQuery.isError,
    ],
  );

  // Misconfiguration signal: a plan_features row names a
  // revenuecat_package_id but the fetched offerings have no matching
  // package once the fetch has actually settled — logged, not surfaced as
  // an error to the organizer, who just sees that one card without a
  // price. No Sentry in this codebase (checked again for this screen
  // specifically, same as CLAUDE.md's "Bulk guest invites" precedent) — this
  // console.warn is the substitute, not a silent no-op.
  useEffect(() => {
    if (offeringsQuery.isLoading) return;
    for (const plan of plans) {
      if (plan.isNavigationOnly || plan.revenuecatPackageId === null) continue;
      const found = offeringsQuery.data?.has(plan.revenuecatPackageId) ?? false;
      if (!found) {
        console.warn(
          `[pricing] plan_features row "${plan.planKey}" points at RevenueCat package ` +
            `"${plan.revenuecatPackageId}", which wasn't found in the fetched offerings.`,
        );
      }
    }
  }, [plans, offeringsQuery.data, offeringsQuery.isLoading]);

  // Continuing the create-event wizard (the screen that pushed here already
  // replaced itself, so this always moves forward, never back into a
  // "create the event" submit button that could fire a second time) vs.
  // returning to wherever a "no plan yet" badge tap came from.
  const continueAfterPricing = () => {
    if (context === "create") {
      router.replace({ pathname: "/create/share", params: { id } });
    } else {
      router.back();
    }
  };

  const handlePress = async (plan: PlanFeature) => {
    if (plan.isNavigationOnly) {
      if (plan.navigateTo !== null) router.push(plan.navigateTo);
      return;
    }

    setPurchasingPlanId(plan.id);
    try {
      // Placeholder purchase — no RevenueCat call. See this file's own
      // top comment and CLAUDE.md's "Pricing screen" for what replaces
      // this once real purchasing is wired up.
      await setPlanTier(id, plan.planKey);
      continueAfterPricing();
    } catch (err) {
      reportSupabaseError(err);
    } finally {
      setPurchasingPlanId(null);
    }
  };

  if (event === undefined) {
    return (
      <Screen>
        <Header title={t("rsvp.notFoundTitle")} showBack />
      </Screen>
    );
  }

  // Co-organizers reach this from locked features too; the plan is the
  // owner's call (guard_event_owner_columns enforces it server-side).
  if (!isPrimaryOwner(event)) {
    return (
      <Screen coverType={event?.type}>
        <Header
          title={t("pricing.title")}
          subtitle={t("pricing.ownerOnly")}
          showBack
        />
      </Screen>
    );
  }

  return (
    <Screen
      coverType={event?.type}
      footer={
        context === "create" ? (
          <Button
            label={t("pricing.skipForNow")}
            variant="ghost"
            onPress={continueAfterPricing}
          />
        ) : undefined
      }
    >
      {context === "create" ? (
        <Header
          title={t("pricing.title")}
          subtitle={t("pricing.subtitle", { eventName: event.name })}
          flowTitle={t("createWizard.flowTitle")}
          stepLabel={t("createWizard.stepLabel", {
            step: 4,
            total: 5,
            name: t("createWizard.stepPlan"),
          })}
          step={4}
          totalSteps={5}
          progressColors={EVENT_TYPE_COLORS[event.type].gradient}
        />
      ) : (
        <Header
          title={t("pricing.headline")}
          subtitle={t("pricing.subtitle", { eventName: event.name })}
          flowTitle={t("pricing.flowTitle")}
          showBack
        />
      )}

      {!plansHydrated ? (
        <View style={styles.list}>
          <PlanCardSkeleton />
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </View>
      ) : resolvedPlans.length === 0 ? (
        <EmptyState message={t("pricing.empty")} />
      ) : (
        <View style={styles.list}>
          {resolvedPlans.map(({ plan, price }) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              price={price}
              busy={purchasingPlanId === plan.id}
              onPress={() => void handlePress(plan)}
            />
          ))}
        </View>
      )}

      <Text style={[styles.disclaimer, { color: tokens.textSecondary }]}>
        {t("pricing.disclaimer")}
      </Text>
    </Screen>
  );
}

function PlanCard({
  plan,
  price,
  busy,
  onPress,
}: {
  plan: PlanFeature;
  price: PlanPriceState;
  busy: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const card = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surface,
          borderColor: plan.isHighlighted
            ? tokens.accentPrimary
            : tokens.border,
        },
        plan.isHighlighted ? styles.cardHighlighted : null,
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.planTitle, { color: tokens.textPrimary }]}>
          {plan.displayName}
        </Text>
        {plan.badgeText !== null ? (
          plan.isHighlighted ? (
            <LinearGradient
              colors={brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badge}
            >
              <Text style={[styles.badgeText, { color: "#2B2740" }]}>
                {plan.badgeText}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[styles.badge, { backgroundColor: tokens.surface2 }]}>
              <Text style={[styles.badgeText, { color: tokens.textSecondary }]}>
                {plan.badgeText}
              </Text>
            </View>
          )
        ) : null}
      </View>

      <PriceLine plan={plan} price={price} />

      <View style={styles.features}>
        {buildFeatureBullets(plan, t).map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <View
              style={[
                styles.check,
                { backgroundColor: tokens.statusConfirmedSoft },
              ]}
            >
              <Feather name="check" size={13} color={tokens.statusConfirmed} />
            </View>
            <Text style={[styles.featureText, { color: tokens.textPrimary }]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <Button
        label={busy ? t("pricing.processingButton") : plan.buttonLabel}
        variant={plan.isHighlighted ? "primary" : "secondary"}
        disabled={busy}
        onPress={onPress}
      />
    </View>
  );

  // Highlighted plan: 5px accentTint halo around the 2px accent border.
  return plan.isHighlighted ? (
    <View style={[styles.halo, { backgroundColor: tokens.accentTint }]}>
      {card}
    </View>
  ) : (
    card
  );
}

function PriceLine({
  plan,
  price,
}: {
  plan: PlanFeature;
  price: PlanPriceState;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  if (price.status === "not-applicable") {
    return (
      <Text style={[styles.price, { color: tokens.textPrimary }]}>
        {plan.priceText ?? ""}
      </Text>
    );
  }
  if (price.status === "loading") {
    return (
      <Skeleton
        width={100}
        height={28}
        radius={6}
        style={styles.priceSkeleton}
      />
    );
  }
  if (price.status === "unavailable") {
    return (
      <Text style={[styles.priceUnavailable, { color: tokens.textSecondary }]}>
        {t("pricing.priceUnavailable")}
      </Text>
    );
  }
  return (
    <Text style={[styles.price, { color: tokens.textPrimary }]}>
      {price.priceString}
    </Text>
  );
}

function PlanCardSkeleton() {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      <Skeleton width={90} height={20} radius={6} />
      <Skeleton
        width={120}
        height={28}
        radius={6}
        style={styles.priceSkeleton}
      />
      <View style={styles.features}>
        <Skeleton width="80%" height={14} radius={4} />
        <Skeleton width="65%" height={14} radius={4} />
        <Skeleton width="70%" height={14} radius={4} />
      </View>
      <Skeleton width="100%" height={54} radius={themeRadius.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.lg,
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  cardHighlighted: {
    borderWidth: 2,
  },
  halo: {
    borderRadius: 31,
    padding: 5,
    margin: -5,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badge: {
    minHeight: 26,
    borderRadius: themeRadius.pill,
    paddingHorizontal: 11,
    justifyContent: "center",
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "700",
    flexShrink: 1,
  },
  price: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  priceUnavailable: {
    fontSize: 14,
    fontStyle: "italic",
  },
  priceSkeleton: {
    marginVertical: 2,
  },
  features: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
