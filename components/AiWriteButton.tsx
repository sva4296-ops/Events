import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { showDialog } from '@/components/ActionSheet';
import { aiWrite, AiQuotaError, type AiWriteContext, type AiWriteKind } from '@/data/aiRepository';
import { useTheme } from '@/hooks/useTheme';
import { haptics } from '@/utils/haptics';
import { captureError } from '@/utils/sentry';
import { themeRadius } from '@/utils/themeTokens';

interface AiWriteButtonProps {
  kind: AiWriteKind;
  value: string;
  onChange: (text: string) => void;
  context: AiWriteContext;
  maxChars: number;
  /** Only works on existing text (e.g. venue notes: tidy, never invent). Hidden while empty. */
  requireText?: boolean;
}

/**
 * Small "Scrie cu AI" / "Îmbunătățește" pill for a Field's `action` slot.
 * Empty field = write from the event's details; text = improve it. After a
 * replacement it turns into "Anulează" until the text is edited again.
 */
export function AiWriteButton({ kind, value, onChange, context, maxChars, requireText = false }: AiWriteButtonProps) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ previous: string; applied: string } | null>(null);

  const hasText = value.trim().length > 0;
  if (requireText && !hasText && undo === null) return null;

  // Still showing what the AI wrote: offer to go back to the organizer's text.
  if (undo !== null && value === undo.applied) {
    return (
      <TouchableOpacity
        style={[styles.pill, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
        onPress={() => {
          onChange(undo.previous);
          setUndo(null);
        }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('ai.undo')}
      >
        <Feather name="rotate-ccw" size={13} color={tokens.textSecondary} />
        <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('ai.undo')}</Text>
      </TouchableOpacity>
    );
  }

  const label = requireText ? t('ai.tidy') : hasText ? t('ai.improve') : t('ai.write');

  const run = async () => {
    if (busy) return;
    haptics.tap();
    setBusy(true);
    try {
      const text = await aiWrite({
        kind,
        language: i18n.language.startsWith('en') ? 'en' : 'ro',
        text: value,
        maxChars,
        context,
      });
      setUndo({ previous: value, applied: text });
      onChange(text);
    } catch (error) {
      if (error instanceof AiQuotaError) {
        showDialog({ title: t('ai.quotaTitle'), message: t('ai.quotaBody') });
      } else {
        captureError(error, { where: 'AiWriteButton', kind });
        showDialog({ title: t('common.somethingWentWrong'), message: t('ai.errorBody') });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: tokens.accentTint, borderColor: tokens.accentTint }]}
      onPress={() => void run()}
      disabled={busy}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tokens.accentText} />
      ) : (
        <Feather name="feather" size={13} color={tokens.accentText} />
      )}
      <Text style={[styles.label, { color: tokens.accentText }]}>{busy ? t('ai.writing') : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
