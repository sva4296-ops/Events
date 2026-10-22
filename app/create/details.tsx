import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
} from "react-native";

import { AiWriteButton } from "@/components/AiWriteButton";
import { Button } from "@/components/Button";
import { DateTimeField } from "@/components/DateTimeField";
import { Field } from "@/components/Field";
import { Header } from "@/components/Header";
import { LocationField } from "@/components/LocationField";
import { type PickedLocation } from "@/components/MapPickerModal";
import { Screen } from "@/components/Screen";
import { useCancelCreate } from "@/hooks/useCancelCreate";
import { useEventDraft } from "@/hooks/useEventDraft";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/utils/theme";
import { EVENT_TYPE_COLORS } from "@/utils/eventCovers";

import { parseIsoDate, parseTimeString, toIsoDate, toTimeString } from "@/utils/dateInput";
import { formatEventDate } from "@/utils/format";
import { wizardStep } from "@/utils/spontaneous";

/** Soft cap for the invitation quote — keeps it readable on the invitation card. */
const WELCOME_MAX = 280;

/** Local midnight, not `new Date()` as-is — a same-day event must still count as valid regardless of the current time of day. */
function todayAtLocalMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default function EventDetailsScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const [dateError, setDateError] = useState<string | null>(null);
  const spontaneous = draft.type === "spontaneous";
  const venue = draft.type === "venue";
  const step = wizardStep(draft.type, "details");
  const canContinue =
    draft.name.trim().length > 0 && draft.date.trim().length > 0;

  // The pin opens the map; the address under the pin fills the field (still
  // editable as text). Coordinates are set later, on the venue screen.
  const onPickLocation = (picked: PickedLocation) => {
    if (picked.address !== null) updateDraft({ location: picked.address });
  };

  const handleContinue = () => {
    // Backstop, not just UI prevention: minimumDate on the picker below can't
    // catch manual text entry or picker-library edge cases, so the date is
    // re-validated here regardless of how it was set.
    if (parseIsoDate(draft.date) < todayAtLocalMidnight()) {
      setDateError(t("createWizard.pastDateError"));
      return;
    }
    if (spontaneous && draft.replyBy.trim().length > 0 && draft.replyBy > draft.date) {
      setDateError(t('spontaneous.wizard.replyByAfterDate'));
      return;
    }
    router.push(venue ? '/create/venue' : '/create/preview');
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Screen
        coverType={draft.type}
        footer={
          <Button
            label={t("createWizard.detailsButton")}
            disabled={!canContinue}
            onPress={handleContinue}
          />
        }
      >
        <Header
          title={t("createWizard.detailsTitle")}
          showBack
          onClose={cancel}
          flowTitle={t("createWizard.flowTitle")}
          stepLabel={t("createWizard.stepLabel", { ...step, name: t("createWizard.stepDetails") })}
          step={step.step}
          totalSteps={step.total}
          progressColor={draft.type !== null ? EVENT_TYPE_COLORS[draft.type].fill : undefined}
        />

        <Field
          label={t("editEventForm.nameLabel")}
          value={draft.name}
          onChangeText={(name) => updateDraft({ name })}
          placeholder={
            spontaneous && draft.template !== null
              ? t(`spontaneous.templates.${draft.template}.namePlaceholder`)
              : venue
                ? t('venue.wizard.namePlaceholder')
                : t('createWizard.namePlaceholder')
          }
        />
        <DateTimeField
          label={t("editEventForm.dateLabel")}
          mode="date"
          value={parseIsoDate(draft.date)}
          displayValue={
            draft.date.trim().length === 0
              ? t("editEventForm.selectDate")
              : formatEventDate(draft.date)
          }
          onChange={(selected) => {
            updateDraft({ date: toIsoDate(selected) });
            setDateError(null);
          }}
          minimumDate={todayAtLocalMidnight()}
        />
        {spontaneous || venue ? (
          <DateTimeField
            label={t('spontaneous.wizard.timeLabel')}
            mode="time"
            value={parseTimeString(draft.startTime.trim().length > 0 ? draft.startTime : '21:00')}
            displayValue={draft.startTime.trim().length > 0 ? draft.startTime : t('spontaneous.wizard.timePlaceholder')}
            onChange={(selected) => updateDraft({ startTime: toTimeString(selected) })}
          />
        ) : null}
        {spontaneous ? (
          <>
            <DateTimeField
              label={t('spontaneous.wizard.replyByLabel')}
              mode="date"
              value={parseIsoDate(draft.replyBy.trim().length > 0 ? draft.replyBy : draft.date)}
              displayValue={
                draft.replyBy.trim().length === 0 ? t('spontaneous.wizard.replyByNone') : formatEventDate(draft.replyBy)
              }
              onChange={(selected) => {
                updateDraft({ replyBy: toIsoDate(selected) });
                setDateError(null);
              }}
              minimumDate={todayAtLocalMidnight()}
              hint={t('spontaneous.wizard.replyByHint')}
            />
          </>
        ) : null}
        {dateError !== null ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>
            {dateError}
          </Text>
        ) : null}
        <LocationField
          label={t("editEventForm.locationLabel")}
          value={draft.location}
          onChangeText={(location) => updateDraft({ location })}
          placeholder={t("createWizard.locationPlaceholder")}
          onPick={onPickLocation}
        />
        {spontaneous ? (
          <Field
            label={t('spontaneous.wizard.spotLimitLabel')}
            value={draft.spotLimit}
            onChangeText={(spotLimit) => updateDraft({ spotLimit: spotLimit.replace(/[^0-9]/g, '') })}
            placeholder={t('spontaneous.wizard.spotLimitPlaceholder')}
            keyboardType="numeric"
            hint={t('spontaneous.wizard.spotLimitHint')}
          />
        ) : null}
        <Field
          label={t("editEventForm.welcomeMessageLabel")}
          value={draft.welcomeMessage}
          onChangeText={(welcomeMessage) => updateDraft({ welcomeMessage })}
          placeholder={
            spontaneous && draft.template !== null
              ? t(`spontaneous.templates.${draft.template}.messagePlaceholder`)
              : venue
                ? t('venue.wizard.messagePlaceholder')
                : t('createWizard.welcomeMessagePlaceholder')
          }
          multiline
          maxLength={WELCOME_MAX}
          action={
            <AiWriteButton
              kind="welcome"
              value={draft.welcomeMessage}
              onChange={(welcomeMessage) => updateDraft({ welcomeMessage })}
              maxChars={WELCOME_MAX}
              context={{ type: draft.type, name: draft.name, date: draft.date, location: draft.location }}
            />
          }
          hint={`${draft.welcomeMessage.length} / ${WELCOME_MAX}`}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  error: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
});
