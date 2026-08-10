import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '@/utils/theme';

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
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={secure || keyboardType !== 'default' ? 'none' : 'sentences'}
        accessibilityLabel={label}
      />
      {hint !== undefined ? <Text style={styles.hint}>{hint}</Text> : null}
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
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
    fontSize: 16,
    color: colors.text,
  },
  multiline: {
    minHeight: 110,
    paddingTop: spacing.md,
  },
  hint: {
    fontSize: 12,
    color: colors.faint,
  },
});
