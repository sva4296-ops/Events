import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AiWriteButton } from "@/components/AiWriteButton";
import { Button } from "@/components/Button";
import { CoverArt } from "@/components/CoverArt";
import { DateTimeField } from "@/components/DateTimeField";
import { defaultCover } from "@/components/EventCover";
import { Field } from "@/components/Field";
import { Header } from "@/components/Header";
import { LocationField } from "@/components/LocationField";
import { type PickedLocation } from "@/components/MapPickerModal";
import { Screen } from "@/components/Screen";
import { useCancelCreate } from "@/hooks/useCancelCreate";
import { useEventDraft } from "@/hooks/useEventDraft";
import { useTheme } from "@/hooks/useTheme";
import { COVER_THEMES, getCoverTheme, suggestedCoverTheme } from "@/utils/coverThemes";
import { parseIsoDate, parseTimeString, toIsoDate, toTimeString } from "@/utils/dateInput";
import { formatEventDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { wizardStep } from "@/utils/spontaneous";
import { spacing } from "@/utils/theme";
import { themeRadius, typeface } from "@/utils/themeTokens";

/** Soft cap for the invitation quote — keeps it readable on the invitation card. */
const WELCOME_MAX = 280;
/** What the AI writes: one or two short sentences. */
const AI_MESSAGE_MAX = 160;
const ON_COVER = "#FFFFFF";
const ON_COVER_MUTED = "rgba(255,255,255,0.75)";
const ON_LIGHT_COVER = "#2B2740";
const ON_LIGHT_COVER_MUTED = "rgba(43,39,64,0.6)";

/** Local midnight: a same-day event must still count as valid whatever the time. */
function todayAtLocalMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * The create wizard's main screen, Partiful/Luma style: the invitation itself,
 * edited in place (name on the cover, message on the card), the cover themes
 * right under it, then the few details that don't fit on the card.
 * Replaces the old Details → Theme → Preview steps.
 */
export default function ComposeInviteScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const [error, setError] = useState<string | null>(null);
  const spontaneous = draft.type === "spontaneous";
  const venue = draft.type === "venue";
  const step = wizardStep(draft.type, "invite");
  const canContinue = draft.name.trim().length > 0 && draft.date.trim().length > 0;

  const classic = defaultCover(draft.type ?? "other", tokens);
  const cover = getCoverTheme(draft.coverTheme) ?? classic;
  const suggested = suggestedCoverTheme(draft.type, draft.template);
  const themes = [...COVER_THEMES].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested));
  const ink = cover.light ? ON_LIGHT_COVER : ON_COVER;
  const inkMuted = cover.light ? ON_LIGHT_COVER_MUTED : ON_COVER_MUTED;

  // Spontaneous: the activity ("Karaoke"), else the kind of outing, else the type.
  const chipLabel = spontaneous
    ? draft.activity !== null && draft.activity !== "other"
      ? t(`spontaneous.activities.${draft.activity}.name`)
      : draft.outing !== null
        ? t(`spontaneous.outings.${draft.outing}.name`)
        : t("eventTypes.spontaneous.label")
    : t(`eventTypes.${draft.type ?? "other"}.label`);
  const namePlaceholder =
    spontaneous && draft.template !== null
      ? t(`spontaneous.templates.${draft.template}.namePlaceholder`)
      : venue
        ? t("venue.wizard.namePlaceholder")
        : t("createWizard.namePlaceholder");
  const messagePlaceholder =
    spontaneous && draft.template !== null
      ? t(`spontaneous.templates.${draft.template}.messagePlaceholder`)
      : venue
        ? t("venue.wizard.messagePlaceholder")
        : t("createWizard.welcomeMessagePlaceholder");
  const when = [
    draft.date.trim().length > 0 ? formatEventDate(draft.date) : "",
    (spontaneous || venue) && draft.startTime.trim().length > 0 ? draft.startTime : "",
  ]
    .filter((part) => part.length > 0)
    .join(" · ");

  const pickTheme = (id: string | null) => {
    haptics.tap();
    updateDraft({ coverTheme: id });
  };

  const onPickLocation = (picked: PickedLocation) => {
    if (picked.address !== null) updateDraft({ location: picked.address });
  };

  const handleContinue = () => {
    // Backstop: the picker's minimumDate can't catch every edge case.
    if (parseIsoDate(draft.date) < todayAtLocalMidnight()) {
      setError(t("createWizard.pastDateError"));
      return;
    }
    if (spontaneous && draft.replyBy.trim().length > 0 && draft.replyBy > draft.date) {
      setError(t("spontaneous.wizard.replyByAfterDate"));
      return;
    }
    router.push(venue ? "/create/venue" : { pathname: "/pricing/[id]", params: { id: "draft", context: "create" } });
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Screen
        coverTheme={draft.coverTheme}
        contentStyle={styles.content}
        footer={<Button label={t("createWizard.continue")} disabled={!canContinue} onPress={handleContinue} />}
      >
        <Header
          title={t("compose.title")}
          showBack
          onClose={cancel}
          flowTitle={t("createWizard.flowTitle")}
          stepLabel={t("createWizard.stepLabel", { ...step, name: t("compose.stepName") })}
          step={step.step}
          totalSteps={step.total}
        />

        {/* The invitation: type it right where guests will read it. */}
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }, tokens.surfaceElevatedShadow ?? undefined]}>
          <CoverArt theme={cover} style={styles.cover}>
            <View style={styles.coverText}>
              <View style={[styles.chip, { borderColor: inkMuted }]}>
                <Text style={[styles.chipText, { color: ink }]}>{chipLabel}</Text>
              </View>
              <TextInput
                value={draft.name}
                onChangeText={(name) => updateDraft({ name })}
                placeholder={namePlaceholder}
                placeholderTextColor={inkMuted}
                style={[styles.nameInput, { color: ink, fontFamily: tokens.displayFont }]}
                multiline
                maxLength={80}
                accessibilityLabel={t("editEventForm.nameLabel")}
              />
              <Text style={[styles.when, { color: inkMuted }]} numberOfLines={1}>
                {when.length > 0 ? when : t("compose.whenPlaceholder")}
              </Text>
              {draft.location.trim().length > 0 ? (
                <Text style={[styles.when, { color: inkMuted }]} numberOfLines={1}>
                  {draft.location.trim()}
                </Text>
              ) : null}
            </View>
          </CoverArt>
          <View style={styles.messageRow}>
            <TextInput
              value={draft.welcomeMessage}
              onChangeText={(welcomeMessage) => updateDraft({ welcomeMessage })}
              placeholder={messagePlaceholder}
              placeholderTextColor={tokens.textMuted}
              style={[styles.messageInput, { color: tokens.textPrimary }]}
              multiline
              maxLength={WELCOME_MAX}
              accessibilityLabel={t("editEventForm.welcomeMessageLabel")}
            />
            <View style={styles.messageFooter}>
              <Text style={[styles.counter, { color: tokens.textMuted }]}>
                {draft.welcomeMessage.length} / {WELCOME_MAX}
              </Text>
              <AiWriteButton
                kind="welcome"
                value={draft.welcomeMessage}
                onChange={(welcomeMessage) => updateDraft({ welcomeMessage })}
                // Short on purpose: it sits under the name on the invitation.
                maxChars={AI_MESSAGE_MAX}
                context={{
                  type: draft.type,
                  name: draft.name,
                  date: draft.date,
                  location: draft.location,
                  time: spontaneous || venue ? draft.startTime : undefined,
                  activity:
                    spontaneous && draft.activity !== null && draft.activity !== "other"
                      ? t(`spontaneous.activities.${draft.activity}.name`)
                      : undefined,
                  theme: draft.coverTheme !== null ? t(`coverTheme.names.${draft.coverTheme}`) : undefined,
                }}
              />
            </View>
          </View>
        </View>

        {/* Cover themes: a strip under the invitation, Classic first. */}
        <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>{t("compose.themeLabel")}</Text>
        {/* Full-bleed: scrolls out to the screen edges instead of being cut at the page padding. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stripScroll}
          contentContainerStyle={styles.strip}
        >
          {[{ theme: classic, id: null as string | null, label: t("coverTheme.classic") }]
            .concat(themes.map((theme) => ({ theme, id: theme.id as string | null, label: t(`coverTheme.names.${theme.id}`) })))
            .map(({ theme, id, label }) => {
              const selected = draft.coverTheme === id;
              return (
                <TouchableOpacity
                  key={id ?? "classic"}
                  onPress={() => pickTheme(id)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  style={styles.thumbWrap}
                >
                  <View style={[styles.thumbFrame, { borderColor: selected ? tokens.textPrimary : "transparent" }]}>
                    <CoverArt theme={theme} plain style={styles.thumb} />
                    {id === suggested ? <View style={[styles.suggestedDot, { backgroundColor: tokens.accentFill }]} /> : null}
                  </View>
                  <Text
                    style={[styles.thumbLabel, { color: selected ? tokens.textPrimary : tokens.textSecondary }]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        {/* What doesn't fit on the card. */}
        <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>{t("compose.detailsLabel")}</Text>
        <DateTimeField
          label={t("editEventForm.dateLabel")}
          mode="date"
          value={parseIsoDate(draft.date)}
          displayValue={draft.date.trim().length === 0 ? t("editEventForm.selectDate") : formatEventDate(draft.date)}
          onChange={(selected) => {
            updateDraft({ date: toIsoDate(selected) });
            setError(null);
          }}
          minimumDate={todayAtLocalMidnight()}
        />
        {spontaneous || venue ? (
          <DateTimeField
            label={t("spontaneous.wizard.timeLabel")}
            mode="time"
            value={parseTimeString(draft.startTime.trim().length > 0 ? draft.startTime : "21:00")}
            displayValue={draft.startTime.trim().length > 0 ? draft.startTime : t("spontaneous.wizard.timePlaceholder")}
            onChange={(selected) => updateDraft({ startTime: toTimeString(selected) })}
          />
        ) : null}
        {spontaneous ? (
          <DateTimeField
            label={t("spontaneous.wizard.replyByLabel")}
            mode="date"
            value={parseIsoDate(draft.replyBy.trim().length > 0 ? draft.replyBy : draft.date)}
            displayValue={draft.replyBy.trim().length === 0 ? t("spontaneous.wizard.replyByNone") : formatEventDate(draft.replyBy)}
            onChange={(selected) => {
              updateDraft({ replyBy: toIsoDate(selected) });
              setError(null);
            }}
            minimumDate={todayAtLocalMidnight()}
            hint={t("spontaneous.wizard.replyByHint")}
          />
        ) : null}
        {error !== null ? <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text> : null}
        <LocationField
          label={t("editEventForm.locationLabel")}
          value={draft.location}
          onChangeText={(location) => updateDraft({ location })}
          placeholder={t("createWizard.locationPlaceholder")}
          onPick={onPickLocation}
        />
        {spontaneous ? (
          <Field
            label={t("spontaneous.wizard.spotLimitLabel")}
            value={draft.spotLimit}
            onChangeText={(spotLimit) => updateDraft({ spotLimit: spotLimit.replace(/[^0-9]/g, "") })}
            placeholder={t("spontaneous.wizard.spotLimitPlaceholder")}
            keyboardType="numeric"
            hint={t("spontaneous.wizard.spotLimitHint")}
          />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
  },
  card: {
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  cover: {
    minHeight: 260,
    justifyContent: "flex-end",
  },
  coverText: {
    padding: spacing.lg,
    gap: 4,
  },
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: themeRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  chipText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
  },
  nameInput: {
    fontSize: 32,
    lineHeight: 38,
    padding: 0,
  },
  when: {
    fontFamily: typeface.bodyMedium,
    fontSize: 14,
  },
  messageRow: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  messageInput: {
    fontFamily: typeface.body,
    fontSize: 16,
    lineHeight: 23,
    minHeight: 48,
    padding: 0,
    textAlignVertical: "top",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: {
    fontFamily: typeface.body,
    fontSize: 12,
  },
  sectionLabel: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  stripScroll: {
    marginHorizontal: -spacing.xl,
    flexGrow: 0,
  },
  strip: {
    gap: 10,
    paddingHorizontal: spacing.xl,
    // Room for the selected frame's border, which the scroll view would clip.
    paddingVertical: 2,
  },
  thumbWrap: {
    width: 68,
    gap: 4,
    alignItems: "center",
  },
  thumbFrame: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 2,
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 10,
  },
  suggestedDot: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  thumbLabel: {
    fontFamily: typeface.bodyMedium,
    fontSize: 11,
  },
  error: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
});
