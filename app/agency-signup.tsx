import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { AgencyFields, validateAgencyFields, type AgencyFieldErrors } from '@/components/AgencyFields';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useAgency } from '@/hooks/useAgency';
import { reportSupabaseError } from '@/utils/reportError';

/**
 * "Add business account" — reached from app/profile.tsx, only shown there
 * while the signed-in user isn't already an agency owner. Upgrades the
 * existing account in place (useAgency().becomeAgency, a real client-side
 * insert into public.agencies — see 20260821000001_agency_self_signup.sql
 * for the RLS policy that allows it). No email/password/name fields here —
 * the account already exists and already has a name; this is just the
 * business details that account didn't have yet. Field UI + validation live
 * in components/AgencyFields.tsx, shared with app/edit-profile.tsx's
 * business-info section so the two forms can't drift apart.
 */
export default function AgencySignupScreen() {
  const { t } = useTranslation();
  const { becomeAgency } = useAgency();

  const [companyName, setCompanyName] = useState('');
  const [cui, setCui] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<AgencyFieldErrors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = validateAgencyFields(companyName, cui, t);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await becomeAgency({
        companyName: companyName.trim(),
        cui: cui.trim().toUpperCase(),
        registrationNumber: registrationNumber.trim().length > 0 ? registrationNumber.trim() : undefined,
        address: address.trim().length > 0 ? address.trim() : undefined,
      });
      router.back();
    } catch (err) {
      // Surfaces the real Postgres/Supabase message (e.g. an RLS policy
      // rejection) instead of swallowing it — same convention every other
      // fire-and-forget write in this app uses (see app/add-guest/[id].tsx).
      reportSupabaseError(err);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        footer={
          <Button
            label={busy ? t('agencySignup.creatingButton') : t('agencySignup.createButton')}
            disabled={busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header title={t('agencySignup.headline')} subtitle={t('agencySignup.subtitle')} showBack />

        <AgencyFields
          companyName={companyName}
          onChangeCompanyName={(value) => {
            setCompanyName(value);
            setErrors((current) => ({ ...current, companyName: undefined }));
          }}
          cui={cui}
          onChangeCui={(value) => {
            setCui(value);
            setErrors((current) => ({ ...current, cui: undefined }));
          }}
          registrationNumber={registrationNumber}
          onChangeRegistrationNumber={setRegistrationNumber}
          address={address}
          onChangeAddress={setAddress}
          errors={errors}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
