import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

import { Button } from "@/components/Button";
import { DateTimeField } from "@/components/DateTimeField";
import { Field } from "@/components/Field";
import { Header } from "@/components/Header";
import {
  MapPickerModal,
  type PickedLocation,
} from "@/components/MapPickerModal";
import { Screen } from "@/components/Screen";
import { useCancelCreate } from "@/hooks/useCancelCreate";
import { useEventDraft } from "@/hooks/useEventDraft";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/utils/theme";
import { EVENT_TYPE_COLORS } from "@/utils/eventCovers";

import { parseIsoDate, toIsoDate } from "@/utils/dateInput";
import { formatEventDate } from "@/utils/format";
import { mapsAvailable } from "@/utils/maps";

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
  const [mapOpen, setMapOpen] = useState(false);
  const canContinue =
    draft.name.trim().length > 0 && draft.date.trim().length > 0;

  // The pin opens the map; the address under the pin fills the field (still
  // editable as text). Coordinates are set later, on the venue screen.
  const onPickLocation = (picked: PickedLocation) => {
    if (picked.address !== null) updateDraft({ location: picked.address });
    setMapOpen(false);
  };

  const handleContinue = () => {
    // Backstop, not just UI prevention: minimumDate on the picker below can't
    // catch manual text entry or picker-library edge cases, so the date is
    // re-validated here regardless of how it was set.
    if (parseIsoDate(draft.date) < todayAtLocalMidnight()) {
      setDateError(t("createWizard.pastDateError"));
      return;
    }
    router.push("/create/preview");
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
          stepLabel={t("createWizard.stepLabel", {
            step: 2,
            total: 5,
            name: t("createWizard.stepDetails"),
          })}
          step={2}
          totalSteps={5}
          progressColors={draft.type !== null ? EVENT_TYPE_COLORS[draft.type].gradient : undefined}
        />

        <Field
          label={t("editEventForm.nameLabel")}
          value={draft.name}
          onChangeText={(name) => updateDraft({ name })}
          placeholder={t("createWizard.namePlaceholder")}
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
        {dateError !== null ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>
            {dateError}
          </Text>
        ) : null}
        <Field
          label={t("editEventForm.locationLabel")}
          value={draft.location}
          onChangeText={(location) => updateDraft({ location })}
          placeholder={t("createWizard.locationPlaceholder")}
          icon={
            mapsAvailable ? (
              <TouchableOpacity
                onPress={() => setMapOpen(true)}
                activeOpacity={0.7}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("createWizard.pickOnMap")}
              >
                <Feather name="map-pin" size={18} color={tokens.accentText} />
              </TouchableOpacity>
            ) : (
              <Feather name="map-pin" size={18} color={tokens.textSecondary} />
            )
          }
        />
        <Field
          label={t("editEventForm.welcomeMessageLabel")}
          value={draft.welcomeMessage}
          onChangeText={(welcomeMessage) => updateDraft({ welcomeMessage })}
          placeholder={t("createWizard.welcomeMessagePlaceholder")}
          multiline
          maxLength={WELCOME_MAX}
          hint={`${draft.welcomeMessage.length} / ${WELCOME_MAX}`}
        />
      </Screen>
      {mapOpen ? (
        <MapPickerModal
          initial={null}
          onClose={() => setMapOpen(false)}
          onPick={onPickLocation}
        />
      ) : null}
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
