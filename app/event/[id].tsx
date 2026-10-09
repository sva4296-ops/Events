import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GrowFromLeft } from "@/components/GrowFromLeft";
import { GuestRow, GuestRowSkeleton } from "@/components/GuestRow";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Skeleton } from "@/components/Skeleton";
import { LongPressRow } from "@/components/LongPressRow";
import { useTourTarget } from "@/components/tour/Tour";
import { remoteRepository } from "@/data/remoteEventContentRepository";
import { confirmDelete } from "@/utils/confirm";
import { useEvents } from "@/hooks/useEvents";
import { TOUR_TARGETS } from "@/hooks/useGettingStarted";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { usePlanGate } from "@/hooks/usePlanGate";
import { useTheme } from "@/hooks/useTheme";
import type { RsvpStatus } from "@/types/event";
import { countRsvps } from "@/utils/format";
import { shareGuestWorkbook } from "@/utils/guestExport";
import { staggerIn } from "@/utils/motion";
import { reportSupabaseError } from "@/utils/reportError";
import { spacing } from "@/utils/theme";
import { themeRadius, typography } from "@/utils/themeTokens";

type GuestFilter = "all" | RsvpStatus;

/**
 * Warm Story 2.0 organizer dashboard for one event's guests: RSVP totals
 * with a stacked bar, add / WhatsApp actions, status filters, search and
 * the guest list.
 */
export default function EventDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, hydrated, removeGuest, isOwner } = useEvents();
  const { tokens } = useTheme();
  const { plans } = usePlanFeatures();
  const {
    hydrated: planHydrated,
    canAddGuests,
    capabilities,
  } = usePlanGate(id);
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();
  const addGuestRef = useTourTarget(TOUR_TARGETS.guests);
  const whatsappRef = useTourTarget(TOUR_TARGETS.invites);

  const event = getEvent(id);
  const owner = isOwner(event);

  // Before the initial fetch settles, `getEvent` can't tell "still loading"
  // from "no such event" — `hydrated` is what actually distinguishes them.
  if (!hydrated) {
    return (
      <Screen coverType={event?.type} contentStyle={styles.content}>
        <View style={styles.headerSkeleton}>
          <Skeleton width={44} height={44} radius={themeRadius.pill} />
          <Skeleton height={17} width="55%" radius={4} />
        </View>
        <Skeleton height={170} radius={24} />
        <View style={[styles.listCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <GuestRowSkeleton />
          <GuestRowSkeleton showDivider />
          <GuestRowSkeleton showDivider />
        </View>
      </Screen>
    );
  }

  if (event === undefined) {
    return (
      <Screen>
        <Header title={t("event.notFound")} showBack />
      </Screen>
    );
  }

  const counts = countRsvps(event.guests);
  const planName =
    event.planTier !== null
      ? plans.find((plan) => plan.planKey === event.planTier)?.displayName ?? event.planTier
      : null;
  const pendingUnsentCount = event.guests.filter(
    (guest) =>
      guest.status === "pending" &&
      guest.whatsappSentAt === null &&
      guest.phone !== null,
  ).length;
  const locked = planHydrated && !canAddGuests;

  const needle = query.trim().toLowerCase();
  const visibleGuests = event.guests.filter(
    (guest) =>
      (filter === "all" || guest.status === filter) &&
      (needle.length === 0 ||
        guest.name.toLowerCase().includes(needle) ||
        (guest.phone ?? "").includes(needle.replace(/\D/g, "") || "\u0000")),
  );

  // Tables and menus come from the same cached details query the Detalii
  // screens use (fetched here on demand so the dashboard stays light).
  const handleExport = async () => {
    setExporting(true);
    try {
      const details = await queryClient.fetchQuery({
        queryKey: ["eventContent", "details", event.id],
        queryFn: () => remoteRepository.loadDetails(event.id),
        staleTime: 3 * 60_000,
      });
      await shareGuestWorkbook(event, details, t);
    } catch (error) {
      reportSupabaseError(error);
    } finally {
      setExporting(false);
    }
  };

  const share = (value: number) => (counts.total > 0 ? (value / counts.total) * 100 : 0);

  const filters: { key: GuestFilter; label: string; count: number }[] = [
    { key: "all", label: t("event.filterAll"), count: counts.total },
    { key: "confirmed", label: t("event.filterConfirmed"), count: counts.confirmed },
    { key: "pending", label: t("event.filterPending"), count: counts.pending },
    { key: "declined", label: t("event.filterDeclined"), count: counts.declined },
  ];

  const stats: { key: RsvpStatus; label: string; value: number; fg: string; bg: string }[] = [
    { key: "confirmed", label: t("event.filterConfirmed"), value: counts.confirmed, fg: tokens.statusConfirmed, bg: tokens.statusConfirmedSoft },
    { key: "pending", label: t("event.filterPending"), value: counts.pending, fg: tokens.statusPending, bg: tokens.statusPendingSoft },
    { key: "declined", label: t("event.filterDeclined"), value: counts.declined, fg: tokens.statusDeclined, bg: tokens.statusDeclinedSoft },
  ];

  return (
    <Screen coverType={event?.type} contentStyle={styles.content}>
      <Header
        title=""
        showBack
        flowTitle={event.name}
        stepLabel={
          planName !== null
            ? `${t("event.dashboardSubtitle")} · ${planName}`
            : t("event.dashboardSubtitle")
        }
        right={
          owner ? (
            <TouchableOpacity
              ref={addGuestRef}
              style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
              onPress={() => router.push(`/add-guest/${event.id}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("event.addGuest")}
            >
              <Feather name={locked ? "lock" : "user-plus"} size={20} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <View
        style={[
          styles.summary,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
          tokens.surfaceElevatedShadow ?? undefined,
        ]}
      >
        <View style={styles.summaryHead}>
          <Text style={[styles.summaryTitle, { color: tokens.textPrimary }]}>
            {t("event.confirmationsTitle")}
          </Text>
          <Text style={[styles.summaryMeta, { color: tokens.textSecondary }]}>
            {t("event.guestsTotal", { count: counts.total })}
          </Text>
        </View>
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.key} style={[styles.stat, { backgroundColor: stat.bg }]}>
              <AnimatedNumber value={stat.value} style={[styles.statValue, { color: stat.fg }]} />
              <Text style={[styles.statLabel, { color: stat.fg }]} numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
        {counts.total > 0 ? (
          <View style={styles.bar} accessibilityRole="image">
            <GrowFromLeft style={styles.barFill}>
              {counts.confirmed > 0 ? (
                <View style={{ width: `${share(counts.confirmed)}%`, backgroundColor: tokens.statusConfirmed }} />
              ) : null}
              {counts.pending > 0 ? (
                <View style={{ width: `${share(counts.pending)}%`, backgroundColor: tokens.accentGold }} />
              ) : null}
              {counts.declined > 0 ? (
                <View style={{ width: `${share(counts.declined)}%`, backgroundColor: tokens.accentPink }} />
              ) : null}
            </GrowFromLeft>
          </View>
        ) : null}
      </View>

      {owner && event.guests.length > 0 ? (
        <View style={styles.actions}>
          {[
            {
              key: "whatsapp",
              icon: "message-circle" as const,
              label: t("event.sendWhatsApp"),
              onPress: () => router.push(`/send-invites/${event.id}`),
              disabled: pendingUnsentCount === 0,
            },
            {
              key: "export",
              icon: "download" as const,
              label: exporting ? t("export.exporting") : t("export.button"),
              onPress: () => void handleExport(),
              disabled: exporting,
            },
          ].map((action) => (
            <TouchableOpacity
              key={action.key}
              ref={action.key === "whatsapp" ? whatsappRef : undefined}
              style={[
                styles.action,
                { backgroundColor: tokens.surface, borderColor: tokens.border },
                action.disabled && styles.actionDisabled,
              ]}
              onPress={action.onPress}
              disabled={action.disabled}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ disabled: action.disabled }}
            >
              <View style={[styles.actionIcon, { backgroundColor: tokens.accentTint }]}>
                <Feather name={action.icon} size={20} color={tokens.accentText} />
              </View>
              <Text style={[styles.actionLabel, { color: tokens.textPrimary }]} numberOfLines={2}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {owner && locked ? (
        <TouchableOpacity
          style={[styles.notice, { backgroundColor: tokens.statusPendingSoft }]}
          onPress={() => router.push(`/pricing/${event.id}`)}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Feather name="lock" size={16} color={tokens.statusPending} />
          <Text style={[styles.noticeText, { color: tokens.statusPending }]}>
            {t("planGate.guestLimitReachedBody", {
              count: capabilities.maxGuests ?? 0,
            })}
          </Text>
        </TouchableOpacity>
      ) : null}

      {event.guests.length === 0 ? (
        <EmptyState
          message={t("event.noGuestsYet")}
          action={
            owner ? (
              <Button
                label={t("event.inviteGuest")}
                onPress={() => router.push(`/add-guest/${event.id}`)}
              />
            ) : undefined
          }
        />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            accessibilityRole="tablist"
          >
            {filters.map((item) => {
              const active = filter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: tokens.textPrimary }
                      : { backgroundColor: tokens.surface, borderWidth: 1.5, borderColor: tokens.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? tokens.surface : tokens.textPrimary }]}>
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.chipCount,
                      { color: active ? tokens.surface : tokens.textPrimary },
                    ]}
                  >
                    {item.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.search, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Feather name="search" size={19} color={tokens.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: tokens.textPrimary }]}
              value={query}
              onChangeText={setQuery}
              placeholder={t("event.searchPlaceholder")}
              placeholderTextColor={tokens.textMuted}
              accessibilityLabel={t("event.searchPlaceholder")}
              autoCorrect={false}
            />
          </View>

          {visibleGuests.length === 0 ? (
            <EmptyState message={t("event.noMatches")} />
          ) : (
            <View style={[styles.listCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              {visibleGuests.map((guest, index) => (
                <Animated.View key={guest.id} entering={staggerIn(index)}>
                  <LongPressRow
                title={guest.name}
                    enabled={owner}
                    actions={[
                      {
                        label: t("event.removeGuestAction"),
                        icon: "user-x",
                        tone: "delete",
                        onPress: () =>
                          confirmDelete(
                            t("event.removeGuestTitle"),
                            t("event.removeGuestBody", { name: guest.name }),
                            () => removeGuest(event.id, guest.id),
                          ),
                      },
                    ]}
                  >
                    <GuestRow guest={guest} showDivider={index > 0} />
                  </LongPressRow>
                </Animated.View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  headerSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  summaryHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  summaryMeta: {
    fontSize: 13,
  },
  stats: {
    flexDirection: "row",
    gap: 8,
  },
  stat: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    gap: 2,
  },
  statValue: {
    ...typography.title1,
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  bar: {
    flexDirection: "row",
    gap: 3,
    height: 10,
    borderRadius: 99,
    overflow: "hidden",
  },
  barFill: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
  },
  // Adding guests lives in the header; these two share one row as tiles
  // (labels wrap to two lines, which a half-width pill couldn't do).
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: themeRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: 14,
    borderRadius: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  filters: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  chipCount: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.7,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  listCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
});
