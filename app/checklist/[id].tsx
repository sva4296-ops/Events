import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  LinearTransition,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { EmptyState } from "@/components/EmptyState";
import { GuestButton } from "@/components/guest/GuestButton";
import { GuestScreen } from "@/components/guest/GuestScreen";
import { Header } from "@/components/Header";
import { IconCircleButton } from "@/components/IconCircleButton";
import { Screen } from "@/components/Screen";
import type { EventTask } from "@/data/tasksRepository";
import { useEvents } from "@/hooks/useEvents";
import { useEventTasks } from "@/hooks/useEventTasks";
import { useTheme } from "@/hooks/useTheme";
import { gSpace } from "@/utils/guestTheme";
import { haptics } from "@/utils/haptics";
import { formatTaskWhen } from "@/utils/taskTime";
import { toTimeString } from "@/utils/dateInput";
import { themeRadius } from "@/utils/themeTokens";

/** The round checkbox: pops when ticked, the check zooms in. */
function CheckCircle({
  done,
  label,
  onToggle,
}: {
  done: boolean;
  label: string;
  onToggle: () => void;
}) {
  const { tokens } = useTheme();
  const scale = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const press = () => {
    if (!done) {
      scale.set(
        withSequence(
          withTiming(1.2, { duration: 110 }),
          withSpring(1, { damping: 8, stiffness: 220 }),
        ),
      );
      haptics.tap();
    }
    onToggle();
  };

  return (
    <TouchableOpacity
      onPress={press}
      hitSlop={10}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.check,
          done
            ? {
                backgroundColor: tokens.accentFill,
                borderColor: tokens.accentFill,
              }
            : { borderColor: tokens.border },
          popStyle,
        ]}
      >
        {done ? (
          <Animated.View entering={ZoomIn.springify().damping(12)}>
            <Feather name="check" size={16} color={tokens.onAccent} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

/** Open tasks first (soonest due first, undated last), done ones at the bottom. */
function sortTasks(tasks: EventTask[]): EventTask[] {
  const dueValue = (task: EventTask) =>
    task.dueAt === null
      ? Number.MAX_SAFE_INTEGER
      : new Date(task.dueAt).getTime();
  return [...tasks].sort(
    (a, b) => Number(a.done) - Number(b.done) || dueValue(a) - dueValue(b),
  );
}

export default function ChecklistScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent } = useEvents();
  const event = getEvent(id);
  const { tasks, hydrated, organizer, toggleTask } = useEventTasks(id ?? "", {
    syncReminders: true,
  });
  const { tokens } = useTheme();
  // Fixed per visit: enough to mark what's overdue, and keeps render pure.
  const [now] = useState(() => Date.now());

  if (!organizer) {
    return (
      <Screen coverTheme={event?.coverTheme}>
        <Header
          title={t("common.notAvailable")}
          subtitle={t("checklist.notAvailable")}
          showBack
        />
      </Screen>
    );
  }

  const doneCount = tasks.filter((task) => task.done).length;

  return (
    <GuestScreen coverTheme={event?.coverTheme} topInset>
      <Header
        title={t("checklist.title")}
        subtitle={
          tasks.length > 0
            ? t("checklist.progress", { done: doneCount, total: tasks.length })
            : t("checklist.subtitle")
        }
        showBack
        right={
          <IconCircleButton
            icon="plus"
            accessibilityLabel={t("checklist.add")}
            onPress={() => router.push(`/task/${id}`)}
          />
        }
      />

      {!hydrated ? null : tasks.length === 0 ? (
        <EmptyState
          icon="check-square"
          message={t("checklist.empty")}
          action={
            <GuestButton
              label={t("checklist.add")}
              onPress={() => router.push(`/task/${id}`)}
            />
          }
        />
      ) : (
        <View style={styles.stack}>
          {sortTasks(tasks).map((task) => {
            const overdue =
              !task.done &&
              task.dueAt !== null &&
              new Date(task.dueAt).getTime() < now;
            return (
              // layout: when a task is ticked and re-sorted, rows slide to their new place.
              <Animated.View
                key={task.id}
                layout={LinearTransition.springify().damping(18)}
              >
                <TouchableOpacity
                  style={[
                    styles.row,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: tokens.border,
                    },
                    tokens.surfaceElevatedShadow ?? undefined,
                  ]}
                  onPress={() => router.push(`/task/${id}?itemId=${task.id}`)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <CheckCircle
                    done={task.done}
                    label={task.title}
                    onToggle={() => toggleTask(task.id, !task.done)}
                  />

                  <View style={styles.body}>
                    <Text
                      style={[
                        styles.title,
                        {
                          color: task.done
                            ? tokens.textMuted
                            : tokens.textPrimary,
                        },
                        task.done && styles.titleDone,
                      ]}
                    >
                      {task.title}
                    </Text>
                    {task.dueAt !== null ? (
                      <View style={styles.metaRow}>
                        <Feather
                          name="clock"
                          size={12}
                          color={
                            overdue ? tokens.destructive : tokens.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.meta,
                            {
                              color: overdue
                                ? tokens.destructive
                                : tokens.textSecondary,
                            },
                          ]}
                        >
                          {formatTaskWhen(task.dueAt, t, i18n.language)}
                        </Text>
                        {task.remindAt !== null && !task.done ? (
                          <>
                            <Feather
                              name="bell"
                              size={12}
                              color={tokens.textSecondary}
                            />
                            <Text
                              style={[
                                styles.meta,
                                { color: tokens.textSecondary },
                              ]}
                            >
                              {toTimeString(new Date(task.remindAt))}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={tokens.textMuted}
                  />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: gSpace.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: gSpace.md,
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    paddingVertical: gSpace.lg,
    paddingHorizontal: gSpace.lg,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  titleDone: {
    textDecorationLine: "line-through",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  meta: {
    fontSize: 13,
  },
});
