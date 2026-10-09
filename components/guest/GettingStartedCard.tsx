import Feather from "@expo/vector-icons/Feather";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ScaleTouchable } from "@/components/ScaleTouchable";
import { openGettingStarted } from "@/components/tour/GettingStartedSheet";
import {
  useGettingStarted,
  useGettingStartedCardHidden,
} from "@/hooks/useGettingStarted";
import { useTheme } from "@/hooks/useTheme";
import { gSpace } from "@/utils/guestTheme";
import { themeRadius } from "@/utils/themeTokens";

/**
 * Organizer-only "Primii pași" card on Acasă: progress plus the next step;
 * tap opens the checklist. Gone once every step is done or the organizer
 * closes it (the "?" in the header still opens the checklist).
 */
export function GettingStartedCard({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { ready, steps, doneCount, total, allDone } =
    useGettingStarted(eventId);
  const { hidden, hide } = useGettingStartedCardHidden(eventId);

  if (!ready || allDone || hidden !== false) return null;

  const next = steps.find((step) => !step.done);

  return (
    <ScaleTouchable
      scaleTo={0.98}
      onPress={openGettingStarted}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${t("gettingStarted.title")}, ${t("gettingStarted.progress", { done: doneCount, total })}`}
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: tokens.accentTint }]}>
          <Feather name="compass" size={20} color={tokens.accentText} />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {t("gettingStarted.title")}
          </Text>
          <Text style={[styles.progressText, { color: tokens.textSecondary }]}>
            {t("gettingStarted.progress", { done: doneCount, total })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={hide}
          hitSlop={10}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t("gettingStarted.hide")}
        >
          <Feather name="x" size={18} color={tokens.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.track, { backgroundColor: tokens.surface2 }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: tokens.accentFill,
              width: `${(doneCount / total) * 100}%`,
            },
          ]}
        />
      </View>

      {next !== undefined ? (
        <View style={styles.nextRow}>
          <Text
            style={[styles.next, { color: tokens.textPrimary }]}
            numberOfLines={1}
          >
            {t("gettingStarted.next", {
              step: t(`gettingStarted.steps.${next.key}.title`),
            })}
          </Text>
          <Feather name="chevron-right" size={18} color={tokens.accentText} />
        </View>
      ) : null}
    </ScaleTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    padding: gSpace.lg,
    gap: gSpace.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: gSpace.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: themeRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  progressText: {
    fontSize: 13,
  },
  track: {
    height: 8,
    borderRadius: themeRadius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: themeRadius.pill,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: gSpace.sm,
  },
  next: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
});
