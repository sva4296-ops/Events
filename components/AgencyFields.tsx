import type { TFunction } from 'i18next';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/Field';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';

// Romanian CUI: 2-10 digits, optional "RO" prefix for VAT-registered agencies.
export const CUI_PATTERN = /^RO?\d{2,10}$/i;

export interface AgencyFieldErrors {
  companyName?: string;
  cui?: string;
}

/** Shared by app/agency-signup.tsx (create) and app/edit-profile.tsx's
 * business-info section (update) so the two forms can't drift apart. */
export function validateAgencyFields(companyName: string, cui: string, t: TFunction): AgencyFieldErrors {
  const errors: AgencyFieldErrors = {};
  if (companyName.trim().length === 0) {
    errors.companyName = t('agencySignup.errors.companyNameRequired');
  }
  if (!CUI_PATTERN.test(cui.trim())) {
    errors.cui = t('agencySignup.errors.cuiInvalid');
  }
  return errors;
}

interface AgencyFieldsProps {
  companyName: string;
  onChangeCompanyName: (value: string) => void;
  cui: string;
  onChangeCui: (value: string) => void;
  registrationNumber: string;
  onChangeRegistrationNumber: (value: string) => void;
  address: string;
  onChangeAddress: (value: string) => void;
  errors: AgencyFieldErrors;
}

/**
 * Company name, CUI, registration number, and address — the four fields
 * every business-account form needs, whether creating (app/agency-signup.tsx)
 * or editing (app/edit-profile.tsx). Controlled, same value/onChange-pair
 * shape as components/PhoneField.tsx; validation lives in
 * validateAgencyFields above, not in this component, so a caller decides
 * when to run it (on submit).
 */
export function AgencyFields({
  companyName,
  onChangeCompanyName,
  cui,
  onChangeCui,
  registrationNumber,
  onChangeRegistrationNumber,
  address,
  onChangeAddress,
  errors,
}: AgencyFieldsProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <>
      <Field
        label={t('agencySignup.companyNameLabel')}
        value={companyName}
        onChangeText={onChangeCompanyName}
        placeholder={t('agencySignup.companyNamePlaceholder')}
      />
      {errors.companyName !== undefined ? (
        <Text style={[styles.error, { color: tokens.destructive }]}>{errors.companyName}</Text>
      ) : null}

      <Field
        label={t('agencySignup.cuiLabel')}
        value={cui}
        onChangeText={onChangeCui}
        placeholder={t('agencySignup.cuiPlaceholder')}
        hint={t('agencySignup.cuiHint')}
      />
      {errors.cui !== undefined ? (
        <Text style={[styles.error, { color: tokens.destructive }]}>{errors.cui}</Text>
      ) : null}

      <Field
        label={t('agencySignup.registrationNumberLabel')}
        value={registrationNumber}
        onChangeText={onChangeRegistrationNumber}
        placeholder={t('agencySignup.registrationNumberPlaceholder')}
      />

      <Field
        label={t('agencySignup.addressLabel')}
        value={address}
        onChangeText={onChangeAddress}
        placeholder={t('agencySignup.addressPlaceholder')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 12,
    paddingHorizontal: spacing.xs,
  },
});
