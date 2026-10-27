import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { Field } from '@/components/Field';
import { GuestPickModal } from '@/components/GuestPickModal';
import { Header } from '@/components/Header';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import type { CoOrganizer, Guest } from '@/types/event';
import { confirmDelete } from '@/utils/confirm';
import { DEFAULT_COUNTRY_CODE, splitStoredPhone, toStoredPhone } from '@/utils/countryCodes';
import { reportSupabaseError } from '@/utils/reportError';
import { typography } from '@/utils/themeTokens';
import { buildCoOrganizerMessage, sendPhoneMessage } from '@/utils/whatsappInvite';

/**
 * Owner only. Adds a co-organizer by phone (event_members) and sends them a
 * WhatsApp or SMS; they get access once they sign in with that number.
 * Reached from app/edit-event/[id].tsx.
 */
export default function CoOrganizersScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isPrimaryOwner, addCoOrganizer, removeCoOrganizer } = useEvents();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const event = getEvent(id);

  const [dialCode, setDialCode] = useState(DEFAULT_COUNTRY_CODE.dialCode);
  const [localNumber, setLocalNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [relation, setRelation] = useState<'co_organizer' | 'restaurant' | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // True while the form holds a guest picked from the list: they already got the
  // invitation, so we just add them, no WhatsApp/SMS. Editing the phone clears it.
  const [fromGuest, setFromGuest] = useState(false);

  if (event === undefined || !isPrimaryOwner(event)) {
    return (
      <Screen>
        <Header title={t('common.notAvailable')} subtitle={t('coOrganizers.notAvailableSubtitle')} showBack />
      </Screen>
    );
  }

  const labelFor = (member: CoOrganizer) =>
    member.name ?? (member.phone !== null ? `+${member.phone}` : t('coOrganizers.title'));
  const rowLabel = (member: CoOrganizer) =>
    `${labelFor(member)} · ${
      member.role === 'restaurant'
        ? t('coOrganizers.relation.restaurant')
        : member.relation !== null
          ? t(`coOrganizers.relation.${member.relation}`)
          : t('home.coOrganizer')
    }`;

  /** `channel` null = just add the row (picked guest), no message. */
  const submit = async (channel: 'whatsapp' | 'sms' | null) => {
    setError(null);
    if (relation === null) return;

    if (localNumber.replace(/\D/g, '').length < 6) {
      setError(t('phoneAuth.errors.invalidPhone'));
      return;
    }

    // Digits only, no '+': the format users.phone is stored in (auto-link).
    const phone = toStoredPhone(dialCode, localNumber);
    if (user?.phone != null && phone === user.phone) {
      setError(t('coOrganizers.selfError'));
      return;
    }
    if (event.coOrganizers.some((member) => member.phone === phone)) {
      setError(t('coOrganizers.alreadyAddedError'));
      return;
    }

    setBusy(true);
    try {
      await addCoOrganizer(event.id, phone, name.trim(), relation);
      // The row is saved; opening WhatsApp/SMS is best-effort.
      if (channel !== null) {
        await sendPhoneMessage(phone, buildCoOrganizerMessage(name, event.name, relation === 'restaurant'), channel);
      }
      setName('');
      setLocalNumber('');
      setRelation(null);
      setFromGuest(false);
    } catch (err) {
      reportSupabaseError(err);
    } finally {
      setBusy(false);
    }
  };

  const resend = (member: CoOrganizer) => {
    if (member.phone === null) return;
    void sendPhoneMessage(
      member.phone,
      buildCoOrganizerMessage(member.name ?? '', event.name, member.role === 'restaurant'),
      'whatsapp',
    );
  };

  const remove = (member: CoOrganizer) =>
    confirmDelete(t('coOrganizers.removeTitle'), t('coOrganizers.removeBody', { name: labelFor(member) }), () =>
      removeCoOrganizer(event.id, member.id).catch((err: unknown) => reportSupabaseError(err)),
    );

  // Invited guests with a phone who aren't co-organizers yet: picking one fills name + phone.
  const pickableGuests = event.guests.filter(
    (guest) => guest.phone !== null && !event.coOrganizers.some((member) => member.phone === guest.phone),
  );
  const pickGuest = (guest: Guest) => {
    if (guest.phone === null) return;
    const split = splitStoredPhone(guest.phone);
    setDialCode(split.dialCode);
    setLocalNumber(split.localNumber);
    // mapGuestRow falls back to the phone as the name: don't copy that into the name field.
    setName(guest.name === guest.phone ? '' : guest.name);
    setError(null);
    setFromGuest(true);
  };

  const disabled = localNumber.trim().length === 0 || relation === null || busy;
  const hasPending = event.coOrganizers.some((member) => member.userId === null);

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        coverTheme={event?.coverTheme}
        contentStyle={styles.content}
        footer={
          <View style={styles.footer}>
            {fromGuest ? (
              <Button
                label={busy ? t('coOrganizers.adding') : t('coOrganizers.addOnly')}
                disabled={disabled}
                onPress={() => void submit(null)}
              />
            ) : (
              <>
            <Button
              label={busy ? t('coOrganizers.adding') : t('coOrganizers.addWhatsApp')}
              variant="whatsapp"
              icon={<Feather name="message-circle" size={20} color={buttonLabelColor('whatsapp', tokens)} />}
              disabled={disabled}
              onPress={() => void submit('whatsapp')}
            />
            <Button
              label={t('coOrganizers.addSms')}
              variant="ghost"
              disabled={disabled}
              onPress={() => void submit('sms')}
            />
              </>
            )}
          </View>
        }
      >
        <Header title={t('coOrganizers.title')} subtitle={t('coOrganizers.subtitle')} showBack />

        {event.coOrganizers.length > 0 ? (
          <View style={styles.list}>
            <ListGroup title={t('coOrganizers.listTitle')}>
              {event.coOrganizers.map((member) => (
                <ListRow
                  key={member.id}
                  icon={member.userId !== null ? 'user-check' : 'clock'}
                  label={rowLabel(member)}
                  onPress={member.userId === null ? () => resend(member) : undefined}
                  trailing={
                    <View style={styles.trailing}>
                      <Text style={[styles.status, { color: tokens.textSecondary }]} numberOfLines={1}>
                        {member.userId !== null ? t('coOrganizers.statusActive') : t('coOrganizers.statusPending')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => remove(member)}
                        activeOpacity={0.7}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('coOrganizers.removeLabel')}
                      >
                        <Feather name="x" size={18} color={tokens.statusDeclined} />
                      </TouchableOpacity>
                    </View>
                  }
                />
              ))}
            </ListGroup>
            {hasPending ? (
              <Text style={[styles.hint, { color: tokens.textSecondary }]}>{t('coOrganizers.resendHint')}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.relationBlock}>
          <Text style={[styles.relationLabel, { color: tokens.textSecondary }]}>
            {t('coOrganizers.relationLabel')}
          </Text>
          <View style={styles.relationRow}>
            {(['co_organizer', 'restaurant'] as const).map((value) => {
              const selected = relation === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setRelation(value)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: selected ? tokens.accentTint : tokens.surface,
                      borderColor: selected ? tokens.accentText : tokens.border,
                    },
                  ]}
                >
                  <View style={[styles.roleIcon, { backgroundColor: selected ? tokens.surface : tokens.surface2 }]}>
                    <Feather
                      name={value === 'restaurant' ? 'coffee' : 'users'}
                      size={18}
                      color={selected ? tokens.accentText : tokens.textSecondary}
                    />
                  </View>
                  <View style={styles.roleText}>
                    <Text style={[styles.relationText, { color: selected ? tokens.accentText : tokens.textPrimary }]}>
                      {t(`coOrganizers.relation.${value}`)}
                    </Text>
                    <Text style={[styles.roleInfo, { color: tokens.textSecondary }]}>
                      {t(`coOrganizers.roleInfo.${value}`)}
                    </Text>
                  </View>
                  <Feather
                    name={selected ? 'check-circle' : 'circle'}
                    size={20}
                    color={selected ? tokens.accentText : tokens.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {pickableGuests.length > 0 ? (
          <Button
            label={t('coOrganizers.pickGuest')}
            variant="tonal"
            icon={<Feather name="users" size={20} color={buttonLabelColor('tonal', tokens)} />}
            onPress={() => setPickerOpen(true)}
          />
        ) : null}

        <Field
          label={t('coOrganizers.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('coOrganizers.namePlaceholder')}
        />

        <PhoneField
          label={t('phoneAuth.phoneLabel')}
          dialCode={dialCode}
          onChangeDialCode={(value) => {
            setDialCode(value);
            setFromGuest(false);
          }}
          localNumber={localNumber}
          onChangeLocalNumber={(value) => {
            setLocalNumber(value);
            setError(null);
            setFromGuest(false);
          }}
          placeholder={t('phoneAuth.phonePlaceholder')}
          error={error}
        />
      </Screen>
      <GuestPickModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        guests={pickableGuests}
        onPick={pickGuest}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  footer: {
    gap: 8,
  },
  list: {
    gap: 8,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  status: {
    fontSize: 13,
  },
  relationBlock: {
    gap: 8,
  },
  relationLabel: {
    ...typography.label,
  },
  relationRow: {
    gap: 8,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    flex: 1,
    gap: 2,
  },
  roleInfo: {
    fontSize: 13,
    lineHeight: 18,
  },
  relationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    paddingHorizontal: 4,
  },
});
