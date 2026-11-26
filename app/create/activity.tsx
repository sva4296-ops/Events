import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { CoverArt } from '@/components/CoverArt';
import { defaultCover } from '@/components/EventCover';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useTheme } from '@/hooks/useTheme';
import { getCoverTheme } from '@/utils/coverThemes';
import { haptics } from '@/utils/haptics';
import { getOuting, type Activity } from '@/utils/outings';
import { templateMeta, wizardStep } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { themeRadius, typeface } from '@/utils/themeTokens';

/**
 * Spontaneous wizard, "Ce faceți?": activity chips for the kind of outing
 * picked before. An activity sets the Plan tab's tool, the cover theme and a
 * title (only over an empty title or one we suggested ourselves); the card
 * below shows what it adds. "Altceva" and "Sari peste" keep the kind's defaults.
 */
export default function PickActivityScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const outing = getOuting(draft.outing);
  const step = wizardStep('spontaneous', 'activity');
  const outingName = t(`spontaneous.outings.${outing.id}.name`);

  // Titles we filled in: replaceable by the next pick, never the organizer's own.
  const suggestedTitles = new Set(
    outing.activities.map((activity) => t(`spontaneous.activities.${activity.id}.title`)),
  );
  const nameIsOurs = draft.name.trim().length === 0 || suggestedTitles.has(draft.name.trim());

  const pick = (activity: Activity | null) => {
    haptics.tap();
    const title = activity !== null ? t(`spontaneous.activities.${activity.id}.title`) : '';
    updateDraft({
      activity: activity?.id ?? 'other',
      template: activity?.template ?? outing.template,
      coverTheme: activity?.coverTheme ?? outing.coverTheme,
      ...(nameIsOurs ? { name: title } : {}),
    });
  };

  const skip = () => {
    updateDraft({ activity: null, template: outing.template, coverTheme: draft.coverTheme ?? outing.coverTheme });
    router.push('/create/invite');
  };

  const kind = templateMeta(draft.template).planKind;
  const toolKey = draft.template === 'trip' ? 'gear' : (kind ?? 'none');
  const theme = getCoverTheme(draft.coverTheme) ?? defaultCover('spontaneous', tokens);
  const themeName = draft.coverTheme !== null ? t(`coverTheme.names.${draft.coverTheme}`) : t('coverTheme.classic');
  const chips: (Activity | null)[] = [...outing.activities, null];

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <TouchableOpacity onPress={skip} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.skip, { color: tokens.textSecondary }]}>{t('spontaneous.wizard.skip')}</Text>
          </TouchableOpacity>
          <Button
            label={t('createWizard.continue')}
            disabled={draft.activity === null}
            onPress={() => router.push('/create/invite')}
            style={styles.continue}
          />
        </View>
      }
    >
      <Header
        title={t('spontaneous.wizard.activityTitle')}
        subtitle={t('spontaneous.wizard.activitySubtitle', { outing: outingName })}
        showBack
        onClose={cancel}
        flowTitle={t('createWizard.flowTitle')}
        stepLabel={t('createWizard.stepLabel', { ...step, name: t('spontaneous.wizard.stepActivity') })}
        step={step.step}
        totalSteps={step.total}
      />

      <View style={styles.chips}>
        {chips.map((activity) => {
          const id = activity?.id ?? 'other';
          const selected = draft.activity === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => pick(activity)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: tokens.accentFill, borderColor: tokens.accentFill }
                  : { backgroundColor: tokens.surface, borderColor: tokens.border },
              ]}
            >
              <Feather
                name={activity?.icon ?? 'plus'}
                size={15}
                color={selected ? tokens.onAccent : tokens.textSecondary}
              />
              <Text style={[styles.chipText, { color: selected ? tokens.onAccent : tokens.textPrimary }]}>
                {t(`spontaneous.activities.${id}.name`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {draft.activity !== null ? (
        <View style={[styles.summary, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.summaryLabel, { color: tokens.textSecondary }]}>{t('spontaneous.wizard.adds')}</Text>
          <View style={[styles.summaryRow, { borderTopColor: tokens.border }]}>
            <Text style={[styles.rowKey, { color: tokens.textSecondary }]}>{t('spontaneous.wizard.tool')}</Text>
            <Text style={[styles.rowValue, { color: tokens.textPrimary }]}>{t(`spontaneous.tools.${toolKey}`)}</Text>
          </View>
          <View style={[styles.summaryRow, { borderTopColor: tokens.border }]}>
            <Text style={[styles.rowKey, { color: tokens.textSecondary }]}>{t('spontaneous.wizard.theme')}</Text>
            <View style={styles.themeValue}>
              <CoverArt theme={theme} plain style={styles.swatch} />
              <Text style={[styles.rowValue, { color: tokens.textPrimary }]}>{themeName}</Text>
            </View>
          </View>
          {draft.name.trim().length > 0 ? (
            <View style={[styles.summaryRow, { borderTopColor: tokens.border }]}>
              <Text style={[styles.rowKey, { color: tokens.textSecondary }]}>{t('spontaneous.wizard.title')}</Text>
              <Text style={[styles.rowTitle, { color: tokens.textPrimary, fontFamily: tokens.displayFont }]} numberOfLines={1}>
                {draft.name}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  skip: {
    fontFamily: typeface.bodyMedium,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  continue: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: themeRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
  },
  summary: {
    borderWidth: 1,
    borderRadius: themeRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  summaryLabel: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowKey: {
    width: 80,
    fontFamily: typeface.body,
    fontSize: 13,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: typeface.bodyMedium,
    fontSize: 14,
  },
  rowTitle: {
    flex: 1,
    fontSize: 18,
  },
  themeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 26,
    height: 18,
    borderRadius: 5,
  },
});
