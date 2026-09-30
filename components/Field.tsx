import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { FocusRing } from '@/components/FocusRing';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  /** Shown under the field in the declined/error tone; also tints the border. */
  error?: string | null;
  multiline?: boolean;
  secure?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  /** Optional leading icon, e.g. a pin for a location field. */
  icon?: ReactNode;
  maxLength?: number;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  multiline = false,
  secure = false,
  keyboardType = 'default',
  icon,
  maxLength,
}: FieldProps) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = error !== undefined && error !== null && error.length > 0;
  const borderColor = hasError ? tokens.statusDeclined : focused ? tokens.accentPrimary : tokens.border;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>{label}</Text>
      <FocusRing active={focused && !hasError}>
        <View
          style={[
            styles.box,
            multiline && styles.multiline,
            { backgroundColor: tokens.surface, borderColor },
          ]}
        >
          {icon !== undefined ? <View style={styles.icon}>{icon}</View> : null}
          <TextInput
            style={[styles.input, multiline && styles.inputMultiline, { color: tokens.textPrimary }]}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={tokens.textMuted}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            secureTextEntry={secure}
            keyboardType={keyboardType}
            autoCapitalize={secure || keyboardType !== 'default' ? 'none' : 'sentences'}
            maxLength={maxLength}
            accessibilityLabel={label}
          />
        </View>
      </FocusRing>
      {hasError ? (
        <Text style={[styles.hint, { color: tokens.statusDeclined }]}>{error}</Text>
      ) : hint !== undefined ? (
        <Text style={[styles.hint, { color: tokens.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: themeRadius.md,
    borderWidth: 1.5,
  },
  multiline: {
    minHeight: 112,
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  inputMultiline: {
    lineHeight: 24,
    paddingVertical: 0,
    minHeight: 84,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
