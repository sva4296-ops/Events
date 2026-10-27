import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@/components/Button';
import { TemplateIcon } from '@/components/EventTypeIcon';
import { Header } from '@/components/Header';
import { ScaleTouchable } from '@/components/ScaleTouchable';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useTheme } from '@/hooks/useTheme';
import { SPONTANEOUS_TEMPLATES } from '@/types/event';
import { haptics } from '@/utils/haptics';
import { TEMPLATES, wizardStep } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { bandGradientLocations, themeRadius } from '@/utils/themeTokens';

/** Spontaneous events only: karaoke, party or wine tasting. Decides the Plan tab's tool. */
export default function PickTemplateScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const { step, total } = wizardStep('spontaneous', 'template');

  // Preselect the first template so Continue is never a dead button here.
  useEffect(() => {
    if (draft.template === null) updateDraft({ template: 'karaoke' });
  }, [draft.template, updateDraft]);

  return (
    <Screen
      footer={
        <Button
          label={t('createWizard.continue')}
          disabled={draft.template === null}
          onPress={() => router.push({ pathname: '/pricing/[id]', params: { id: 'draft', context: 'create' } })}
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

      <View style={styles.list}>
        {SPONTANEOUS_TEMPLATES.map((id) => {
          const meta = TEMPLATES[id];
          const selected = draft.template === id;
          const includes = t(`spontaneous.templates.${id}.includes`, { returnObjects: true }) as string[];
          return (
            <ScaleTouchable
              key={id}
              scaleTo={0.98}
              onPress={() => {
                haptics.tap();
                updateDraft({ template: id });
              }}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={t(`spontaneous.templates.${id}.name`)}
              style={[
                styles.card,
                {
                  backgroundColor: tokens.surface,
                  borderColor: selected ? tokens.accentPrimary : tokens.border,
                  borderWidth: selected ? 2 : 1.5,
                },
              ]}
            >
              <LinearGradient
                colors={meta.band}
                locations={bandGradientLocations}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.icon}
              >
                <TemplateIcon template={id} size={26} color={meta.bandInk} />
              </LinearGradient>
              <View style={styles.text}>
                <Text style={[styles.name, { color: tokens.textPrimary }]}>{t(`spontaneous.templates.${id}.name`)}</Text>
                <Text style={[styles.description, { color: tokens.textSecondary }]}>
                  {t(`spontaneous.templates.${id}.description`)}
                </Text>
                <View style={styles.includes}>
                  {includes.map((line) => (
                    <View key={line} style={styles.includeRow}>
                      <Feather name="check" size={13} color={tokens.accentText} />
                      <Text style={[styles.includeText, { color: tokens.textSecondary }]}>{line}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {selected ? (
                <View style={[styles.check, { backgroundColor: tokens.accentFill }]}>
                  <Feather name="check" size={15} color={tokens.onAccent} />
                </View>
              ) : null}
            </ScaleTouchable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: themeRadius.xl,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: themeRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 3,
    paddingRight: 24,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  includes: {
    marginTop: 6,
    gap: 3,
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  includeText: {
    fontSize: 12.5,
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
