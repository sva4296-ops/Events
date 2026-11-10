import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { FocusRing } from '@/components/FocusRing';
import { useTheme } from '@/hooks/useTheme';
import { COUNTRY_CODES, normalizeDialCode, type CountryCode } from '@/utils/countryCodes';
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
  // Edge-to-edge: Android draws modals under the nav bar, so the sheet
  // clears it (3-button nav ~48dp, gesture pill ~24dp, iOS home indicator).
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const hasError = error !== undefined && error !== null && error.length > 0;
  const borderColor = hasError ? tokens.statusDeclined : focused ? tokens.accentPrimary : tokens.border;
  const selected = COUNTRY_CODES.find((c) => c.dialCode === dialCode) ?? COUNTRY_CODES[0];

  // One box searches by country name, ISO code or prefix. A prefix nobody in
  // the list has can still be used as typed (the "custom prefix" row).
  const needle = query.trim().toLowerCase();
  const typedDialCode = /^\+?[\d\s]+$/.test(needle) ? normalizeDialCode(needle) : null;
  const visibleCountries =
    needle.length === 0
      ? COUNTRY_CODES
      : COUNTRY_CODES.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.iso.toLowerCase() === needle ||
            (typedDialCode !== null && c.dialCode.startsWith(typedDialCode)),
        );
  const customDialCode =
    typedDialCode !== null && !COUNTRY_CODES.some((c) => c.dialCode === typedDialCode) ? typedDialCode : null;

  const closePicker = () => {
    setPickerOpen(false);
    setQuery('');
  };
  const pick = (code: string) => {
    onChangeDialCode(code);
    closePicker();
  };

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
            // The leading 0 stays visible as typed (0753...); toE164/toStoredPhone drop it on save.
            onChangeText={onChangeLocalNumber}
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

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={closePicker}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closePicker}>
            <TouchableOpacity
              style={[styles.sheet, { backgroundColor: tokens.surfaceElevated, paddingBottom: insets.bottom + spacing.lg }]}
              activeOpacity={1}
              onPress={() => undefined}
            >
              <Text style={[styles.sheetTitle, { color: tokens.textPrimary }]}>
                {t('phoneAuth.selectCountry')}
              </Text>
              <View style={[styles.search, { backgroundColor: tokens.surface2, borderColor: tokens.border }]}>
                <Feather name="search" size={18} color={tokens.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: tokens.textPrimary }]}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('phoneAuth.searchCountry')}
                  placeholderTextColor={tokens.textMuted}
                  accessibilityLabel={t('phoneAuth.searchCountry')}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (customDialCode !== null) pick(customDialCode);
                  }}
                />
              </View>
              {customDialCode !== null ? (
                <TouchableOpacity
                  style={[styles.customRow, { backgroundColor: tokens.accentTint }]}
                  onPress={() => pick(customDialCode)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Feather name="plus" size={16} color={tokens.accentText} />
                  <Text style={[styles.customText, { color: tokens.accentText }]}>
                    {t('phoneAuth.useCustomPrefix', { prefix: customDialCode })}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {visibleCountries.length === 0 && customDialCode === null ? (
                <Text style={[styles.empty, { color: tokens.textSecondary }]}>{t('phoneAuth.noCountryMatch')}</Text>
              ) : null}
              <FlatList
                data={visibleCountries}
                keyExtractor={(item) => item.iso}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                renderItem={({ item }: { item: CountryCode }) => {
                  const active = item.dialCode === dialCode;
                  return (
                    <TouchableOpacity style={styles.option} onPress={() => pick(item.dialCode)} activeOpacity={0.7}>
                      <Text
                        style={[styles.optionName, { color: tokens.textPrimary }, active && styles.optionActive]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={[styles.optionDial, { color: active ? tokens.accentText : tokens.textSecondary }]}>
                        {item.dialCode}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
  fill: {
    flex: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    borderRadius: 14,
    marginBottom: spacing.sm,
  },
  customText: {
    fontSize: 15,
    fontWeight: '600',
  },
  empty: {
    fontSize: 14,
    paddingVertical: spacing.md,
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
    // Fixed height, so the sheet doesn't jump as the search narrows the list.
    height: '75%',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  list: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  optionName: {
    flex: 1,
    fontSize: 15,
    marginRight: spacing.md,
  },
  optionActive: {
    fontWeight: '700',
  },
  optionDial: {
    fontSize: 15,
    fontWeight: '600',
  },
});
