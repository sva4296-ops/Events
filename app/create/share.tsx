import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { Button, buttonLabelColor } from "@/components/Button";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { useEventDraft } from "@/hooks/useEventDraft";
import { useEvents } from "@/hooks/useEvents";
import { useTheme } from "@/hooks/useTheme";
import { EVENT_TYPE_COLORS } from "@/utils/eventCovers";
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
      | `/send-invites/${string}`,
  ) => {
    resetDraft();
    router.dismissTo("/");
    if (path === "/") return;
    router.push(`/guest/${event.id}`);
    if (path !== `/guest/${event.id}`) router.push(path);
  };

  return (
    <Screen
      coverType={event.type}
      footer={
        <>
          <Button
            label={t("createWizard.shareWhatsApp")}
            variant="whatsapp"
            icon={
              <Feather
                name="message-circle"
                size={20}
                color={buttonLabelColor("whatsapp", tokens)}
              />
            }
            onPress={() =>
              leave(
                hasGuestsToMessage
                  ? `/send-invites/${event.id}`
                  : `/add-guest/${event.id}`,
              )
            }
          />
          <Button
            label={t("createWizard.shareAddGuests")}
            variant="secondary"
            icon={
              <Feather
                name="users"
                size={20}
                color={buttonLabelColor("secondary", tokens)}
              />
            }
            onPress={() => leave(`/add-guest/${event.id}`)}
          />
          <Button
            label={t("createWizard.shareGoToEvent")}
            variant="ghost"
            onPress={() => leave(`/guest/${event.id}`)}
          />
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
        {/* The logo in this event type's colors: its gradient on the heart,
            its tint as a halo, and the type's icon in a corner badge. */}
        <View style={[styles.halo, { backgroundColor: EVENT_TYPE_COLORS[event.type].tint }]}>
          <View
            style={[
              styles.markCircle,
              { backgroundColor: tokens.surface, borderColor: EVENT_TYPE_COLORS[event.type].fill },
              tokens.surfaceElevatedShadow ?? undefined,
            ]}
          >
            <BrandMark width={76} colors={EVENT_TYPE_COLORS[event.type].gradient} />
          </View>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: EVENT_TYPE_COLORS[event.type].fill, borderColor: tokens.surface },
            ]}
          >
            <EventTypeIcon type={event.type} size={20} color={EVENT_TYPE_COLORS[event.type].onFill} />
          </View>
        </View>

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
  halo: {
    width: 164,
    height: 164,
    borderRadius: 82,
    alignItems: "center",
    justifyContent: "center",
  },
  markCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
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
