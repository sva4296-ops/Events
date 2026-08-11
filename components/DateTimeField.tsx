import Feather from '@expo/vector-icons/Feather';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

interface DateTimeFieldProps {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  displayValue: string;
  onChange: (value: Date) => void;
  hint?: string;
}

/** Tap-to-open native date/time picker, styled to match Field. */
export function DateTimeField({ label, value, mode, displayValue, onChange, hint }: DateTimeFieldProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && selected !== undefined) onChange(selected);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: tokens.textPrimary }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.input,
          {
            backgroundColor: tokens.surface,
            borderColor: tokens.surfaceBorder ?? '#EAE4F0',
          },
        ]}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.value, { color: tokens.textPrimary }]}>{displayValue}</Text>
        <Feather name={mode === 'date' ? 'calendar' : 'clock'} size={18} color={tokens.textSecondary} />
      </TouchableOpacity>
      {hint !== undefined ? (
        <Text style={[styles.hint, { color: tokens.textSecondary }]}>{hint}</Text>
      ) : null}

      {show ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          // iOS only — the picker otherwise follows the device's system
          // appearance, not this app's own (possibly overridden) theme state,
          // which is exactly what made the wheel unreadable in dark mode.
          // Android has no equivalent prop in this library: its native dialog
          // is themed by the app's Android theme resource, resolved at the
          // native/activity level, not switchable from this in-app JS toggle
          // without native code changes this project hasn't made — see
          // CLAUDE.md for why that's flagged rather than silently attempted.
          themeVariant={Platform.OS === 'ios' ? tokens.mode : undefined}
        />
      ) : null}
      {show && Platform.OS === 'ios' ? (
        <TouchableOpacity
          style={styles.done}
          onPress={() => setShow(false)}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Text style={[styles.doneLabel, { color: tokens.accentPrimary }]}>{t('common.done')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: themeRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
  },
  value: {
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
  },
  done: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  doneLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
