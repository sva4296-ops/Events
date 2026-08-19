import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DEFAULT_COUNTRY_CODE, splitStoredPhone, toStoredPhone } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reached from the Account screen's "Edit profile" row. Names go straight to
 * public.users (useUserProfile.saveName — the same write the one-time name
 * step uses). Email/phone go through Supabase's normal auth.updateUser +
 * re-verification instead of a table write: an email change needs the new
 * address's confirmation link clicked before auth.users.email actually
 * changes, and a phone change needs the OTP Supabase sends to the new number
 * confirmed here before auth.users.phone changes — neither is bypassed.
 */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { user } = useAuth();
  const { updateEmail, updatePhone, verifyPhoneChange } = useAuth();
  const { firstName: savedFirstName, lastName: savedLastName, saveName } = useUserProfile();

  const initialPhone = user?.phone !== null && user?.phone !== undefined ? splitStoredPhone(user.phone) : null;

  const [firstName, setFirstName] = useState(savedFirstName ?? '');
  const [lastName, setLastName] = useState(savedLastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [dialCode, setDialCode] = useState(initialPhone?.dialCode ?? DEFAULT_COUNTRY_CODE.dialCode);
  const [localNumber, setLocalNumber] = useState(initialPhone?.localNumber ?? '');
  const [otpCode, setOtpCode] = useState('');
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

    setBusy(true);
    try {
      await saveName(firstName.trim(), lastName.trim());

      const notices: string[] = [];

      if (trimmedEmail.length > 0 && trimmedEmail.toLowerCase() !== (user?.email ?? '').toLowerCase()) {
        const err = await updateEmail(trimmedEmail);
        if (err !== null) {
          setError(err);
          setBusy(false);
          return;
        }
        notices.push(t('editProfile.emailChangeNotice'));
      }

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
});
