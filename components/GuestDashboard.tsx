import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import { showDialog } from "@/components/ActionSheet";
import { PostMomentBar } from "@/components/guest/PostMomentBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { floatingTabBar, tabBarBottomInset } from "@/utils/guestTheme";
import { GuestScreen } from "@/components/guest/GuestScreen";
import { GuestRow, GuestRowSkeleton } from "@/components/GuestRow";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Skeleton } from "@/components/Skeleton";
import { Avatar } from "@/components/spontaneous/parts";
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
import type { Guest } from "@/types/event";
import { sendGuestWhatsAppInvite, waitForReturn } from "@/utils/whatsappInvite";
import { haptics } from "@/utils/haptics";

type GuestFilter = "all" | RsvpStatus;

/**
 * Warm Story 2.0 organizer dashboard for one event's guests: RSVP totals
 * with a stacked bar, add / WhatsApp actions, status filters, search and
 * the guest list. The Invitați tab shows it `embedded` (under the tabs' own
 * header bar); /event/<id> shows it as a full screen (RSVP pushes open that).
 */
export function GuestDashboard({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const { t } = useTranslation();
  const { getEvent, hydrated, removeGuest, isOwner, isPrimaryOwner, markWhatsAppSent } = useEvents();
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
  const insets = useSafeAreaInsets();
  const addGuestRef = useTourTarget(TOUR_TARGETS.guests);
  const whatsappRef = useTourTarget(TOUR_TARGETS.invites, 22); // the round menu button

  const event = getEvent(id);
  const owner = isOwner(event);

  // Before the initial fetch settles, `getEvent` can't tell "still loading"
  // from "no such event" — `hydrated` is what actually distinguishes them.
  if (!hydrated) {
    return (
      <Screen coverTheme={event?.coverTheme} contentStyle={styles.content}>
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
  const spontaneous = event.type === "spontaneous";
  // Spontaneous: +1s take a spot too, so the header counts people, not rows.
  const plusOnes = event.guests.filter((guest) => guest.status === "confirmed" && guest.plusOne).length;
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

  // WhatsApp can't report whether the message really left, so we ask on coming back.
  // No WhatsApp on the phone opens the share sheet instead: same question after it.
  const sendInvite = async (guest: Guest) => {
    if (guest.phone === null) return;
    const opened = await sendGuestWhatsAppInvite(guest.phone, {
      guestName: guest.name === guest.phone ? "" : guest.name,
      event,
      inviteToken: guest.inviteToken,
    });
    if (opened) await waitForReturn();
    if (guest.whatsappSentAt !== null) return;
    showDialog({
      title: t("sendInvitesQueue.confirmSentTitle"),
      message: t("event.confirmSentBody", { name: guest.name }),
      buttons: [
        { label: t("sendInvitesQueue.confirmSentNo"), style: "cancel" },
        {
          label: t("sendInvitesQueue.confirmSentYes"),
          onPress: () => {
            void markWhatsAppSent(event.id, guest.id);
            haptics.success();
          },
        },
      ],
    });
  };

  const stats: { key: GuestFilter; label: string; value: number; fg: string; bg: string }[] = [
    { key: "all", label: t("event.filterAll"), value: counts.total, fg: tokens.textPrimary, bg: tokens.surface },
    { key: "confirmed", label: t("event.filterConfirmed"), value: counts.confirmed, fg: tokens.statusConfirmed, bg: tokens.statusConfirmedSoft },
    { key: "pending", label: t("event.filterPending"), value: counts.pending, fg: tokens.statusPending, bg: tokens.statusPendingSoft },
    ...(spontaneous
      ? [{ key: "maybe" as const, label: t("event.filterMaybe"), value: counts.maybe, fg: tokens.accentText, bg: tokens.accentTint }]
      : []),
    { key: "declined", label: t("event.filterDeclined"), value: counts.declined, fg: tokens.statusDeclined, bg: tokens.statusDeclinedSoft },
  ];

  const addGuestButton = owner ? (
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
  ) : undefined;

  const statTiles = stats.map((stat) => {
    const active = filter === stat.key;
    return (
      <TouchableOpacity
        key={stat.key}
        style={[
          styles.stat,
          spontaneous && styles.statSliding,
          { backgroundColor: stat.bg, borderColor: active ? stat.fg : "transparent" },
        ]}
        onPress={() => setFilter(active ? "all" : stat.key)}
        disabled={event.guests.length === 0}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <AnimatedNumber value={stat.value} style={[styles.statValue, { color: stat.fg }]} />
        <Text style={[styles.statLabel, { color: stat.fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {stat.label}
        </Text>
      </TouchableOpacity>
    );
  });

  // Who helps organize: everyone who sees this screen sees them; only the
  // primary organizer can open the screen that adds and removes them.
  const canManageCoOrganizers = isPrimaryOwner(event);
  const coOrganizerName = (member: (typeof event.coOrganizers)[number]) =>
    member.name ?? (member.phone !== null ? `+${member.phone}` : t("home.coOrganizer"));
  const pendingCoOrganizers = event.coOrganizers.filter((member) => member.userId === null).length;
  const coOrganizersCard =
    owner && (event.coOrganizers.length > 0 || canManageCoOrganizers) ? (
      <TouchableOpacity
        style={[styles.coOrgCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        onPress={() => router.push(`/co-organizers/${event.id}`)}
        disabled={!canManageCoOrganizers}
        activeOpacity={0.75}
        accessibilityRole={canManageCoOrganizers ? "button" : undefined}
        accessibilityLabel={t("coOrganizers.title")}
      >
        {event.coOrganizers.length > 0 ? (
          <View style={styles.coOrgAvatars}>
            {event.coOrganizers.slice(0, 3).map((member, index) => (
              <View key={member.id} style={index > 0 ? styles.coOrgOverlap : undefined}>
                <Avatar name={coOrganizerName(member)} index={index} size={32} />
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.coOrgIcon, { backgroundColor: tokens.accentTint }]}>
            <Feather name="user-plus" size={17} color={tokens.accentText} />
          </View>
        )}
        <View style={styles.coOrgText}>
          <Text style={[styles.coOrgTitle, { color: tokens.textPrimary }]}>
            {event.coOrganizers.length > 0
              ? `${t("coOrganizers.title")} · ${event.coOrganizers.length}`
              : t("event.addCoOrganizer")}
          </Text>
          <Text style={[styles.coOrgMeta, { color: tokens.textSecondary }]} numberOfLines={1}>
            {event.coOrganizers.length > 0
              ? [
                  event.coOrganizers.map(coOrganizerName).join(", "),
                  pendingCoOrganizers > 0 ? t("event.coOrganizersPending", { count: pendingCoOrganizers }) : null,
                ]
                  .filter((part) => part !== null)
                  .join(" · ")
              : t("event.addCoOrganizerHint")}
          </Text>
        </View>
        {canManageCoOrganizers ? <Feather name="chevron-right" size={20} color={tokens.textSecondary} /> : null}
      </TouchableOpacity>
    ) : null;

  const body = (
    <>
      {/* Embedded, the tab already says "Invitați": the add button sits in the summary. */}
      {embedded ? null : (
        <Header
          title=""
          showBack
          flowTitle={event.name}
          stepLabel={
            planName !== null
              ? `${t("event.dashboardSubtitle")} · ${planName}`
              : t("event.dashboardSubtitle")
          }
          right={addGuestButton}
        />
      )}

      <View style={styles.toolbar}>
        {event.guests.length > 0 ? (
          <View style={[styles.search, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Feather name="search" size={18} color={tokens.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: tokens.textPrimary }]}
              value={query}
              onChangeText={setQuery}
              placeholder={t("event.searchShort")}
              placeholderTextColor={tokens.textMuted}
              accessibilityLabel={t("event.searchPlaceholder")}
              autoCorrect={false}
            />
          </View>
        ) : (
          <View style={styles.toolbarSpacer} />
        )}
        {owner && event.guests.length > 0 ? (
          <TouchableOpacity
            ref={pendingUnsentCount > 0 ? undefined : whatsappRef}
            style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            onPress={() => void handleExport()}
            disabled={exporting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("export.button")}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={tokens.textPrimary} />
            ) : (
              <Feather name="download" size={20} color={tokens.textPrimary} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* The totals are the filters. Spontaneous nights have one more, so that row slides. */}
      {spontaneous ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stats}>
          {statTiles}
        </ScrollView>
      ) : (
        <View style={styles.stats}>{statTiles}</View>
      )}

      {spontaneous && (plusOnes > 0 || event.spotLimit !== null) ? (
        <Text style={[styles.summaryMeta, { color: tokens.textSecondary }]}>
          {[
            plusOnes > 0 ? t("spontaneous.dashboard.plusOnes", { count: plusOnes }) : null,
            event.spotLimit !== null
              ? t("spontaneous.dashboard.spots", { taken: counts.confirmed + plusOnes, limit: event.spotLimit })
              : null,
          ]
            .filter((part) => part !== null)
            .join(" · ")}
        </Text>
      ) : null}

      {owner && pendingUnsentCount > 0 ? (
        <View ref={whatsappRef} collapsable={false}>
          <Button
            variant="whatsapp"
            label={`${t("event.sendWhatsApp")} (${pendingUnsentCount})`}
            icon={<Feather name="message-circle" size={19} color="#FFFFFF" />}
            onPress={() => router.push(`/send-invites/${event.id}`)}
          />
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

      {coOrganizersCard}

      {event.guests.length === 0 ? (
        <EmptyState
          message={t("event.noGuestsYet")}
          action={
            owner && !embedded ? (
              <Button
                label={t("event.inviteGuest")}
                onPress={() => router.push(`/add-guest/${event.id}`)}
              />
            ) : undefined
          }
        />
      ) : (
        <>
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
                      // Reminder, or a redo if the first message never went out.
                      ...(guest.status === "pending" && guest.phone !== null
                        ? [
                            {
                              label: t(guest.whatsappSentAt === null ? "event.sendInvite" : "event.resendInvite"),
                              icon: "message-circle",
                              tone: "edit" as const,
                              onPress: () => void sendInvite(guest),
                            },
                          ]
                        : []),
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
                    <GuestRow
                      guest={guest}
                      showDivider={index > 0}
                      coOrganizer={event.coOrganizers.some(
                        (member) =>
                          member.role === "co_organizer" &&
                          ((member.userId !== null && member.userId === guest.userId) ||
                            (member.phone !== null && member.phone === guest.phone)),
                      )}
                    />
                  </LongPressRow>
                </Animated.View>
              ))}
            </View>
          )}
        </>
      )}
    </>
  );

  return embedded ? (
    <View style={styles.embeddedRoot}>
    <GuestScreen
      transparent
      contentStyle={
        owner
          ? { ...styles.embedded, paddingBottom: tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height + 56 + spacing.xl }
          : styles.embedded
      }
    >
      {body}
    </GuestScreen>
    {owner ? (
      <PostMomentBar
        targetRef={addGuestRef}
        label={t("event.addGuest")}
        onPress={() => router.push(`/add-guest/${event.id}`)}
      />
    ) : null}
    </View>
  ) : (
    <Screen coverTheme={event?.coverTheme} contentStyle={styles.content}>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  embeddedRoot: {
    flex: 1,
  },
  embedded: {
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
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolbarSpacer: {
    flex: 1,
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
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  statSliding: {
    flex: 0,
    width: 92,
  },
  statValue: {
    ...typography.title2,
    fontSize: 20,
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
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
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  coOrgCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  coOrgAvatars: {
    flexDirection: "row",
  },
  coOrgOverlap: {
    marginLeft: -10,
  },
  coOrgIcon: {
    width: 36,
    height: 36,
    borderRadius: themeRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  coOrgText: {
    flex: 1,
    gap: 2,
  },
  coOrgTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  coOrgMeta: {
    fontSize: 13,
  },
  listCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
});
