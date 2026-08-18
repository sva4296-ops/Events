import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/useTheme';
import { COUNTRY_CODES, type CountryCode } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

interface PhoneFieldProps {
  label: string;
  dialCode: string;
  onChangeDialCode: (dialCode: string) => void;
  localNumber: string;
  onChangeLocalNumber: (value: string) => void;
  placeholder?: string;
  hint?: string;
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
}: PhoneFieldProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = COUNTRY_CODES.find((c) => c.dialCode === dialCode) ?? COUNTRY_CODES[0];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: tokens.textPrimary }]}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.dialCode,
            { backgroundColor: tokens.surface, borderColor: tokens.surfaceBorder ?? '#EAE4F0' },
          ]}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={[styles.dialCodeText, { color: tokens.textPrimary }]}>
            {selected?.dialCode ?? dialCode}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: tokens.surface, borderColor: tokens.surfaceBorder ?? '#EAE4F0', color: tokens.textPrimary },
          ]}
          value={localNumber}
          onChangeText={onChangeLocalNumber}
          placeholder={placeholder}
          placeholderTextColor={tokens.textSecondary}
          keyboardType="phone-pad"
          accessibilityLabel={label}
        />
      </View>
      {hint !== undefined ? <Text style={[styles.hint, { color: tokens.textSecondary }]}>{hint}</Text> : null}

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

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dialCode: {
    borderRadius: themeRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialCodeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    borderRadius: themeRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: themeRadius.lg,
    borderTopRightRadius: themeRadius.lg,
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
