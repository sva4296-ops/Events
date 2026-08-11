import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  secure?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  multiline = false,
  secure = false,
  keyboardType = 'default',
}: FieldProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: tokens.textPrimary }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: tokens.surface,
            borderColor: tokens.surfaceBorder ?? '#EAE4F0',
            color: tokens.textPrimary,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={secure || keyboardType !== 'default' ? 'none' : 'sentences'}
        accessibilityLabel={label}
      />
      {hint !== undefined ? (
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
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: themeRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
    fontSize: 16,
  },
  multiline: {
    minHeight: 110,
    paddingTop: spacing.md,
  },
  hint: {
    fontSize: 12,
  },
});
