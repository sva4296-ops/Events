import Feather from "@expo/vector-icons/Feather";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { ScaleTouchable } from "@/components/ScaleTouchable";
import { useTourTarget } from "@/components/tour/Tour";

import { Skeleton } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";

type FeatherName = keyof typeof Feather.glyphMap;

interface DetaliiHubCardProps {
  icon: FeatherName;
  title: string;
  status: string;
  /** Whether this section has any data set yet. For the organizer an
   * incomplete section shows a "De completat" badge. */
  complete: boolean;
  /** True when this sub-feature isn't included in the event's current plan
   * (see hooks/usePlanGate.tsx) — shows a lock badge. `onPress` is the
   * caller's responsibility to point at the pricing screen when set. */
  locked?: boolean;
  /** False hides the set/not-set badge — it's an organizer checklist signal,
   * meaningless to a guest who only ever sees sections with content. */
  showStatusDot?: boolean;
  onPress: () => void;
  /** Lets the "Primii pași" tour spotlight this card. */
  tourKey?: string;
}

/**
 * Plan tile (two per row): a big faded icon cropped in the top-right corner,
 * optional badge top left, title and a one-line status at the bottom.
 * Tapping opens the sub-screen.
 */
export function DetaliiHubCard({
  icon,
  title,
  status,
  complete,
  locked = false,
  showStatusDot = true,
  onPress,
  tourKey,
}: DetaliiHubCardProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const tourRef = useTourTarget(tourKey);

  return (
    <ScaleTouchable
      ref={tourRef}
      scaleTo={0.97}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${status}`}
      style={[
        styles.tile,
        { backgroundColor: tokens.surface },
        tokens.surfaceElevatedShadow ?? DARK_SHADOW,
      ]}
    >
      {/* Crops the icon on its own layer: overflow on the tile would clip its shadow on iOS. */}
      <View style={styles.backdrop} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Feather name={icon} size={BACKDROP_ICON_SIZE} color={tokens.accentText} style={styles.backdropIcon} />
      </View>
      <View style={styles.top}>
        {locked ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: tokens.statusPendingSoft },
            ]}
          >
            <Feather name="lock" size={11} color={tokens.statusPending} />
            <Text style={[styles.badgeText, { color: tokens.statusPending }]}>
              {t("detalii.hub.locked")}
            </Text>
          </View>
        ) : showStatusDot && !complete ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: tokens.statusPendingSoft },
            ]}
          >
            <Text style={[styles.badgeText, { color: tokens.statusPending }]}>
              {t("detalii.hub.toComplete")}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text
          style={[styles.title, { color: tokens.textPrimary }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          style={[styles.status, { color: tokens.textSecondary }]}
          numberOfLines={2}
        >
          {status}
        </Text>
      </View>
    </ScaleTouchable>
  );
}

/** Same tile dimensions as the real card, so nothing shifts on load. */
export function DetaliiHubCardSkeleton() {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: tokens.surface },
      ]}
    >
      <View style={styles.top} />
      <View style={styles.info}>
        <Skeleton height={15} width="55%" radius={4} />
        <Skeleton height={13} width="75%" radius={4} />
      </View>
    </View>
  );
}

const BACKDROP_ICON_SIZE = 84;
// Dark themes have no card shadow token; a deeper one still lifts the tile off the page.
const DARK_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.35,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

const styles = StyleSheet.create({
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 112,
    padding: 14,
    borderRadius: 22,
    gap: 10,
    justifyContent: "space-between",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 22,
    overflow: "hidden",
  },
  // Decoration only: sits behind the text, partly outside the tile.
  backdropIcon: {
    position: "absolute",
    top: -4,
    right: -6,
    opacity: 0.24,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 23,
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 23,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexShrink: 1,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  info: {
    gap: 2,
    // Keeps the title clear of the icon's widest part.
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
  },
});
