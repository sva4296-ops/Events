import Feather from '@expo/vector-icons/Feather';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing } from '@/utils/theme';

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
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && selected !== undefined) onChange(selected);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.value}>{displayValue}</Text>
        <Feather name={mode === 'date' ? 'calendar' : 'clock'} size={18} color={colors.muted} />
      </TouchableOpacity>
      {hint !== undefined ? <Text style={styles.hint}>{hint}</Text> : null}

      {show ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      ) : null}
      {show && Platform.OS === 'ios' ? (
        <TouchableOpacity
          style={styles.done}
          onPress={() => setShow(false)}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Text style={styles.doneLabel}>{t('common.done')}</Text>
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
    color: colors.text,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
  },
  value: {
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.faint,
  },
  done: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  doneLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
