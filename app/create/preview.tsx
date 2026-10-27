import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { InviteCard } from "@/components/InviteCard";
import { InviteReveal } from "@/components/InviteReveal";
import { Screen } from "@/components/Screen";
import { useCancelCreate } from "@/hooks/useCancelCreate";
import { useEventDraft } from "@/hooks/useEventDraft";
import { useEvents } from "@/hooks/useEvents";
import { spacing } from "@/utils/theme";

import { reportSupabaseError } from "@/utils/reportError";
import { wizardStep } from "@/utils/spontaneous";

export default function PreviewScreen() {
  const { t } = useTranslation();
  const { draft } = useEventDraft();
  const { createEvent, setPlanTier } = useEvents();
  const cancel = useCancelCreate();
  const step = wizardStep(draft.type, 'preview');

  const handleGenerate = async () => {
    try {
      const event = await createEvent(draft);
      // The plan was picked at the start of the wizard, before the event existed.
      if (draft.planTier !== null) {
        await setPlanTier(event.id, draft.planTier).catch(reportSupabaseError);
      }
      // Replace, not push: a back tap must never land on this submit button again.
      router.replace({ pathname: "/create/share", params: { id: event.id } });
    } catch (error) {
      reportSupabaseError(error);
    }
  };

  return (
    <Screen
      coverTheme={draft.coverTheme}
      footer={
        <View style={styles.actions}>
          <Button
            label={t("createWizard.previewEdit")}
            variant="secondary"
            onPress={() => router.back()}
            style={styles.editButton}
          />
          <Button
            label={t("createWizard.previewButton")}
            onPress={() => void handleGenerate()}
            style={styles.confirmButton}
          />
        </View>
      }
      contentStyle={styles.content}
    >
      <Header
        title={t("createWizard.previewTitle")}
        subtitle={t("createWizard.previewSubtitle")}
        showBack
        onClose={cancel}
        flowTitle={t("createWizard.flowTitle")}
        stepLabel={t("createWizard.stepLabel", { ...step, name: t("createWizard.stepPreview") })}
        step={step.step}
        totalSteps={step.total}
      />

      <InviteReveal type={draft.type}>
        <InviteCard
          event={draft.type === "spontaneous" ? draft : { ...draft, template: null, startTime: null }}
          coverPhoto
        />
      </InviteReveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  editButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1.4,
  },
});
