import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGettingStarted } from "@/hooks/useGettingStarted";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/utils/theme";
import { themeRadius, typography } from "@/utils/themeTokens";

let open: (() => void) | null = null;

/** Opens the "Primii pași" sheet of the event currently on screen. */
export function openGettingStarted(): void {
  open?.();
}

/** Lets the sheet close before the next screen and the spotlight come in. */
const CLOSE_MS = 280;

/**
 * The organizer's checklist: each step ticks itself from the event's data;
 * "Arată-mi" closes the sheet, opens the right screen and spotlights the
 * button to press. Mounted once in the event tabs layout.
 */
export function GettingStartedSheet({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const { steps, doneCount, total, allDone } = useGettingStarted(eventId);

  useEffect(() => {
    open = () => setVisible(true);
    return () => {
      open = null;
    };
  }, []);

  const close = () => setVisible(false);
  const showMe = (action: () => void) => {
    setVisible(false);
    setTimeout(action, CLOSE_MS);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        {/* Behind the sheet: a tap outside closes it. A sibling, not a parent,
            so it never competes with the list's scroll gesture. */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={[styles.title, { color: tokens.textPrimary }]}>
                {t("gettingStarted.title")}
              </Text>
              <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
                {allDone
                  ? t("gettingStarted.allDone")
                  : t("gettingStarted.subtitle")}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.close, { backgroundColor: tokens.surface2 }]}
              onPress={close}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Feather name="x" size={18} color={tokens.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.progressRow}>
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
            <Text
              style={[styles.progressText, { color: tokens.textSecondary }]}
            >
              {t("gettingStarted.progress", { done: doneCount, total })}
            </Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {steps.map((step, index) => (
              <View
                key={step.key}
                style={[
                  styles.row,
                  {
                    borderColor: tokens.border,
                    backgroundColor: step.done ? "transparent" : tokens.surface,
                  },
                ]}
              >
                <View
                  style={[
                    styles.mark,
                    step.done
                      ? {
                          backgroundColor: tokens.accentFill,
                          borderColor: tokens.accentFill,
                        }
                      : { borderColor: tokens.border },
                  ]}
                >
                  {step.done ? (
                    <Feather name="check" size={14} color={tokens.onAccent} />
                  ) : (
                    <Text
                      style={[styles.markText, { color: tokens.textSecondary }]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text
                    style={[
                      styles.rowTitle,
                      {
                        color: step.done
                          ? tokens.textSecondary
                          : tokens.textPrimary,
                      },
                      step.done && styles.rowTitleDone,
                    ]}
                  >
                    {t(`gettingStarted.steps.${step.key}.title`)}
                  </Text>
                  {!step.done ? (
                    <Text
                      style={[styles.rowHint, { color: tokens.textSecondary }]}
                    >
                      {t(`gettingStarted.steps.${step.key}.hint`)}
                    </Text>
                  ) : null}
                </View>
                {!step.done && step.showMe !== null ? (
                  <TouchableOpacity
                    style={[
                      styles.showMe,
                      { backgroundColor: tokens.accentTint },
                    ]}
                    onPress={() => {
                      const action = step.showMe;
                      if (action !== null) showMe(action);
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${t("gettingStarted.showMe")}: ${t(`gettingStarted.steps.${step.key}.title`)}`}
                  >
                    <Text
                      style={[styles.showMeText, { color: tokens.accentText }]}
                    >
                      {t("gettingStarted.showMe")}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={14}
                      color={tokens.accentText}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: themeRadius.sheet,
    borderTopRightRadius: themeRadius.sheet,
    borderWidth: 1,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    maxHeight: "85%",
    gap: spacing.lg,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.title2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: themeRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: themeRadius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: themeRadius.pill,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Lets the list shrink inside the sheet's maxHeight, so it scrolls instead of overflowing.
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: themeRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowTitleDone: {
    textDecorationLine: "line-through",
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  showMe: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: themeRadius.pill,
  },
  showMeText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
