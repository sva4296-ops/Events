import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FocusRing } from '@/components/FocusRing';
import { useTheme } from '@/hooks/useTheme';
import { COUNTRY_CODES, stripLeadingZero, type CountryCode } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';

interface PhoneFieldProps {
  label: string;
  dialCode: string;
  onChangeDialCode: (dialCode: string) => void;
  localNumber: string;
  onChangeLocalNumber: (value: string) => void;
  placeholder?: string;
  hint?: string;
  /** Shown under the field in the declined/error tone; also tints the border. */
  error?: string | null;
}

/**
 * Country-code picker + local-number input, styled to match Field.tsx.
 * Shared by app/auth/phone.tsx (Feature 1) and app/add-guest/[id].tsx's
 * phone-invite mode (Feature 2) so the picker isn't built twice.
 */
export function PhoneField({
  label,
  dialCode,
  onChangeDialCode,
  localNumber,
  onChangeLocalNumber,
  placeholder,
  hint,
  error,
}: PhoneFieldProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasError = error !== undefined && error !== null && error.length > 0;
  const borderColor = hasError ? tokens.statusDeclined : focused ? tokens.accentPrimary : tokens.border;
  const selected = COUNTRY_CODES.find((c) => c.dialCode === dialCode) ?? COUNTRY_CODES[0];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>{label}</Text>
      <FocusRing active={focused && !hasError}>
        <View style={[styles.box, { backgroundColor: tokens.surface, borderColor }]}>
          <TouchableOpacity
            style={[styles.dialCode, { borderRightColor: tokens.border }]}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('phoneAuth.selectCountry')}
          >
            <Text style={[styles.dialCodeText, { color: tokens.textPrimary }]}>
              {selected !== undefined && sharedDialCodes(dialCode) === 1
                ? `${selected.iso} ${selected.dialCode}`
                : dialCode}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={localNumber}
            onChangeText={(value) => onChangeLocalNumber(stripLeadingZero(value))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={tokens.textMuted}
            keyboardType="phone-pad"
            accessibilityLabel={label}
          />
        </View>
      </FocusRing>
      {hasError ? (
        <Text style={[styles.hint, { color: tokens.statusDeclined }]}>{error}</Text>
      ) : hint !== undefined ? (
        <Text style={[styles.hint, { color: tokens.textSecondary }]}>{hint}</Text>
      ) : null}

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        >
          <View style={[styles.sheet, { backgroundColor: tokens.surfaceElevated }]}>
            <Text style={[styles.sheetTitle, { color: tokens.textPrimary }]}>
              {t('phoneAuth.selectCountry')}
            </Text>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.iso}
              style={styles.list}
              renderItem={({ item }: { item: CountryCode }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChangeDialCode(item.dialCode);
                    setPickerOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionName, { color: tokens.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.optionDial, { color: tokens.textSecondary }]}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/** +1 (and a few others) belong to several countries — show the ISO code only when it's unambiguous. */
function sharedDialCodes(dialCode: string): number {
  return COUNTRY_CODES.filter((c) => c.dialCode === dialCode).length;
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
  dialCode: {
    minHeight: 44,
    paddingRight: 10,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  dialCodeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: themeRadius.sheet,
    borderTopRightRadius: themeRadius.sheet,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  optionName: {
    fontSize: 15,
  },
  optionDial: {
    fontSize: 15,
    fontWeight: '600',
  },
});
