import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { AgencyFields, validateAgencyFields, type AgencyFieldErrors } from '@/components/AgencyFields';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { useAgency } from '@/hooks/useAgency';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DEFAULT_COUNTRY_CODE, splitStoredPhone, toStoredPhone } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reached from the Account screen's "Edit profile" row. Names and email go
 * straight to public.users (useUserProfile.saveName/saveEmail) — plain
 * column writes, no verification. Phone is different: it's the account's
 * actual auth identifier, so it goes through Supabase's normal
 * auth.updateUser + re-verification instead — a phone change needs the OTP
 * Supabase sends to the new number confirmed here before auth.users.phone
 * actually changes. Email used to work this same way (an "Edit profile"
 * change needing a confirmation-link click) before auth went phone-only;
 * now it's just optional contact info, same as a name.
 *
 * Business accounts (useAgency().isAgencyOwner — true whenever a row exists
 * for this user in public.agencies, not a signup-time flag) get an extra
 * section here for editing their company info, reusing the exact same
 * fields/validation as app/agency-signup.tsx via components/AgencyFields.tsx.
 * Submitting it calls useAgency().updateAgency, an UPDATE against the
 * existing row (the "agency owner updates own agency" RLS policy), never an
 * insert — individual accounts never see this section at all.
 */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { user } = useAuth();
  const { updatePhone, verifyPhoneChange } = useAuth();
  const {
    firstName: savedFirstName,
    lastName: savedLastName,
    email: savedEmail,
    saveName,
    saveEmail,
  } = useUserProfile();
  const { agency, isAgencyOwner, hydrated: agencyHydrated, updateAgency } = useAgency();

  const initialPhone = user?.phone !== null && user?.phone !== undefined ? splitStoredPhone(user.phone) : null;

  const [firstName, setFirstName] = useState(savedFirstName ?? '');
  const [lastName, setLastName] = useState(savedLastName ?? '');
  const [email, setEmail] = useState(savedEmail ?? '');
  const [dialCode, setDialCode] = useState(initialPhone?.dialCode ?? DEFAULT_COUNTRY_CODE.dialCode);
  const [localNumber, setLocalNumber] = useState(initialPhone?.localNumber ?? '');
  const [otpCode, setOtpCode] = useState('');
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [companyName, setCompanyName] = useState(agency?.companyName ?? '');
  const [cui, setCui] = useState(agency?.cui ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(agency?.registrationNumber ?? '');
  const [address, setAddress] = useState(agency?.address ?? '');
  const [agencyErrors, setAgencyErrors] = useState<AgencyFieldErrors>({});

  // Pre-fills once the agency query resolves — covers the cold-cache case
  // where this screen mounts before useAgency()'s data has arrived.
  useEffect(() => {
    if (agency === null) return;
    setCompanyName(agency.companyName);
    setCui(agency.cui);
    setRegistrationNumber(agency.registrationNumber ?? '');
    setAddress(agency.address ?? '');
  }, [agency]);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 0 && !EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    let agencyValues: { companyName: string; cui: string; registrationNumber?: string; address?: string } | null =
      null;
    if (isAgencyOwner) {
      const nextAgencyErrors = validateAgencyFields(companyName, cui, t);
      setAgencyErrors(nextAgencyErrors);
      if (Object.keys(nextAgencyErrors).length > 0) return;
      agencyValues = {
        companyName: companyName.trim(),
        cui: cui.trim().toUpperCase(),
        registrationNumber: registrationNumber.trim().length > 0 ? registrationNumber.trim() : undefined,
        address: address.trim().length > 0 ? address.trim() : undefined,
      };
    }

    setBusy(true);
    try {
      await saveName(firstName.trim(), lastName.trim());
      // Plain column write — no Supabase Auth involved, no re-verification.
      // Unlike phone below, this never touches the account's auth identity.
      await saveEmail(trimmedEmail.length > 0 ? trimmedEmail : null);
      if (agencyValues !== null) {
        await updateAgency(agencyValues);
      }

      const notices: string[] = [];

      const trimmedLocalNumber = localNumber.trim();
      if (trimmedLocalNumber.length > 0) {
        const newPhone = toStoredPhone(dialCode, trimmedLocalNumber);
        if (newPhone !== user?.phone) {
          const err = await updatePhone(newPhone);
          if (err !== null) {
            setError(err);
            setBusy(false);
            return;
          }
          setPendingPhone(newPhone);
          notices.push(t('editProfile.phoneChangeNotice'));
        }
      }

      setNotice(notices.length > 0 ? notices.join(' ') : t('editProfile.savedNotice'));
    } catch {
      setError(t('editProfile.errors.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmPhone = async () => {
    if (pendingPhone === null || otpCode.trim().length === 0) return;
    setError(null);
    setConfirmBusy(true);
    const err = await verifyPhoneChange(pendingPhone, otpCode.trim());
    setConfirmBusy(false);
    if (err !== null) {
      setError(err);
      return;
    }
    setPendingPhone(null);
    setOtpCode('');
    setNotice(t('editProfile.phoneConfirmedNotice'));
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        footer={
          <Button
            label={busy ? t('editProfile.saving') : t('common.saveChanges')}
            disabled={!canSubmit || busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header title={t('editProfile.title')} subtitle={t('editProfile.subtitle')} showBack />

        <Field
          label={t('nameStep.firstNameLabel')}
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            setError(null);
          }}
          placeholder={t('nameStep.firstNamePlaceholder')}
        />
        <Field
          label={t('nameStep.lastNameLabel')}
          value={lastName}
          onChangeText={(value) => {
            setLastName(value);
            setError(null);
          }}
          placeholder={t('nameStep.lastNamePlaceholder')}
        />
        <Field
          label={t('auth.emailLabel')}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          placeholder={t('auth.emailPlaceholder')}
          keyboardType="email-address"
        />
        <PhoneField
          label={t('phoneAuth.phoneLabel')}
          dialCode={dialCode}
          onChangeDialCode={setDialCode}
          localNumber={localNumber}
          onChangeLocalNumber={(value) => {
            setLocalNumber(value);
            setError(null);
          }}
          placeholder={t('phoneAuth.phonePlaceholder')}
        />

        {agencyHydrated && isAgencyOwner ? (
          <>
            <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>
              {t('editProfile.businessSectionLabel')}
            </Text>
            <AgencyFields
              companyName={companyName}
              onChangeCompanyName={(value) => {
                setCompanyName(value);
                setAgencyErrors((current) => ({ ...current, companyName: undefined }));
              }}
              cui={cui}
              onChangeCui={(value) => {
                setCui(value);
                setAgencyErrors((current) => ({ ...current, cui: undefined }));
              }}
              registrationNumber={registrationNumber}
              onChangeRegistrationNumber={setRegistrationNumber}
              address={address}
              onChangeAddress={setAddress}
              errors={agencyErrors}
            />
          </>
        ) : null}

        {error !== null ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text>
        ) : null}
        {notice !== null ? (
          <Text style={[styles.notice, { color: tokens.accentPrimary }]}>{notice}</Text>
        ) : null}

        {pendingPhone !== null ? (
          <>
            <Field
              label={t('editProfile.phoneCodeLabel')}
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder={t('editProfile.phoneCodePlaceholder')}
              keyboardType="numeric"
            />
            <Button
              label={confirmBusy ? t('editProfile.confirming') : t('editProfile.confirmCode')}
              variant="secondary"
              disabled={confirmBusy || otpCode.trim().length === 0}
              onPress={() => void confirmPhone()}
            />
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  error: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
  notice: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
});
