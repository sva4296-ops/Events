import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { EventCover } from "@/components/EventCover";
import { Button, buttonLabelColor } from "@/components/Button";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { useEventDraft } from "@/hooks/useEventDraft";
import { useEvents } from "@/hooks/useEvents";
import { useTheme } from "@/hooks/useTheme";
import { getCoverTheme } from "@/utils/coverThemes";
import { eventShortSubtitle } from "@/utils/format";
import { spacing } from "@/utils/theme";
import { themeRadius, typography } from "@/utils/themeTokens";

/** Last step of the create wizard (5 of 5): the event exists; send it out. */
export default function ShareScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent } = useEvents();
  const { resetDraft } = useEventDraft();
  const { tokens } = useTheme();
  const event = getEvent(id);

  if (event === undefined) {
    return (
      <Screen>
        <Header title={t("rsvp.notFoundTitle")} showBack />
      </Screen>
    );
  }

  // The WhatsApp queue only lists pending guests with a phone who haven't
  // been messaged yet. A brand-new event has none, so send the organizer to
  // add guests first instead of into an empty queue.
  const hasGuestsToMessage = event.guests.some(
    (guest) =>
      guest.status === "pending" &&
      guest.whatsappSentAt === null &&
      guest.phone !== null,
  );

  // Drop the whole wizard (type/details stay mounted under this screen), then
  // open the target on top of the event, so "back" from add-guest or
  // send-invites lands on the event and never on an empty create form.
  const leave = (
    path:
      | "/"
      | `/guest/${string}`
      | `/add-guest/${string}`
      | `/send-invites/${string}`
      | `/venue-send/${string}`,
  ) => {
    resetDraft();
    router.dismissTo("/");
    if (path === "/") return;
    router.push(`/guest/${event.id}`);
    if (path !== `/guest/${event.id}`) router.push(path);
  };

  // Text over the cover: dark on light themes (and on Classic in a light app theme).
  const coverInk = (getCoverTheme(event.coverTheme)?.light ?? tokens.mode === "light") ? "#2B2740" : "#FFFFFF";

  return (
    <Screen
      coverTheme={event.coverTheme}
      footer={
        // One way forward: invite (WhatsApp is offered right on that screen),
        // or a quiet "later" into the event.
        <>
          <Button
            label={event.type === "venue" ? t("createWizard.shareVenue") : t("createWizard.shareInvite")}
            icon={<Feather name="send" size={19} color={buttonLabelColor("primary", tokens)} />}
            onPress={() =>
              leave(
                // A venue sends its public booking link to its customers.
                event.type === "venue"
                  ? `/venue-send/${event.id}`
                  : hasGuestsToMessage
                    ? `/send-invites/${event.id}`
                    : `/add-guest/${event.id}`,
              )
            }
          />
          <Button label={t("createWizard.shareLater")} variant="ghost" onPress={() => leave(`/guest/${event.id}`)} />
        </>
      }
    >
      <View style={styles.top}>
        <TouchableOpacity
          style={[
            styles.close,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
          onPress={() => leave("/")}
          accessibilityRole="button"
          accessibilityLabel={t("common.done")}
          activeOpacity={0.7}
        >
          <Feather name="x" size={20} color={tokens.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        {/* The invitation as guests will get it: its cover theme, name and date. */}
        <EventCover
          type={event.type}
          coverTheme={event.coverTheme}
          style={[styles.invite, { borderColor: tokens.border }, tokens.surfaceElevatedShadow ?? undefined]}
        >
          <View style={styles.inviteText}>
            <Text style={[styles.inviteName, { color: coverInk, fontFamily: tokens.displayFont }]} numberOfLines={2}>
              {event.name}
            </Text>
            <Text style={[styles.inviteMeta, { color: coverInk }]} numberOfLines={1}>
              {eventShortSubtitle(event)}
            </Text>
          </View>
        </EventCover>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {t("createWizard.shareTitle")}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            {t("createWizard.shareSubtitle")}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: spacing.lg,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    gap: 22,
    paddingTop: spacing.md,
  },
  invite: {
    width: "88%",
    aspectRatio: 1.35,
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    justifyContent: "flex-end",
  },
  inviteText: {
    padding: spacing.lg,
    gap: 4,
  },
  inviteName: {
    fontSize: 28,
    lineHeight: 34,
  },
  inviteMeta: {
    fontSize: 14,
    opacity: 0.85,
  },
  copy: {
    gap: 10,
    alignItems: "center",
  },
  title: {
    ...typography.title1,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
