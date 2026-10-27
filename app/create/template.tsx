import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { ScaleTouchable } from '@/components/ScaleTouchable';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useTheme } from '@/hooks/useTheme';
import { haptics } from '@/utils/haptics';
import { getOuting, OUTINGS } from '@/utils/outings';
import { wizardStep } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { typeface } from '@/utils/themeTokens';

/** Spontaneous events only: the kind of outing. The activity (and with it the Plan tab's tool) comes next. */
export default function PickTemplateScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const { step, total } = wizardStep('spontaneous', 'template');

  // Preselect the first kind so Continue is never a dead button here.
  useEffect(() => {
    if (draft.outing === null) {
      const first = getOuting(null);
      updateDraft({ outing: first.id, template: first.template });
    }
  }, [draft.outing, updateDraft]);

  return (
    <Screen
      footer={
        <Button
          label={t('createWizard.continue')}
          disabled={draft.outing === null}
          onPress={() => router.push('/create/activity')}
        />
      }
    >
      <Header
        title={t('spontaneous.wizard.templateTitle')}
        subtitle={t('spontaneous.wizard.templateSubtitle')}
        showBack
        onClose={cancel}
        flowTitle={t('createWizard.flowTitle')}
        stepLabel={t('createWizard.stepLabel', { step, total, name: t('spontaneous.wizard.stepTemplate') })}
        step={step}
        totalSteps={total}
      />

      {/* Same list style as the type step: no cards, no icon boxes. */}
      <View style={styles.list}>
        {OUTINGS.map((outing, index) => {
          const id = outing.id;
          const selected = draft.outing === id;
          return (
            <ScaleTouchable
              key={id}
              scaleTo={0.98}
              onPress={() => {
                haptics.tap();
                // A new kind resets the activity picked for the previous one.
                if (draft.outing !== id) {
                  updateDraft({ outing: id, template: outing.template, activity: null, coverTheme: null });
                }
              }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={t(`spontaneous.outings.${id}.name`)}
              style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border }]}
            >
              <View style={[styles.radio, { borderColor: selected ? tokens.accentFill : tokens.border }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: tokens.accentFill }]} /> : null}
              </View>
              <View style={styles.text}>
                <Text
                  style={[
                    styles.name,
                    { color: selected ? tokens.accentText : tokens.textPrimary, fontFamily: tokens.displayFont },
                  ]}
                >
                  {t(`spontaneous.outings.${id}.name`)}
                </Text>
                <Text style={[styles.description, { color: tokens.textSecondary }]}>
                  {t(`spontaneous.outings.${id}.description`)}
                </Text>
                <Text style={[styles.includes, { color: tokens.textMuted }]}>{t(`spontaneous.outings.${id}.features`)}</Text>
              </View>
              <Feather name={outing.icon} size={20} color={selected ? tokens.accentText : tokens.textMuted} />
            </ScaleTouchable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
  },
  description: {
    fontFamily: typeface.body,
    fontSize: 13,
    lineHeight: 18,
  },
  includes: {
    fontFamily: typeface.body,
    fontSize: 12,
    marginTop: 2,
  },
});
