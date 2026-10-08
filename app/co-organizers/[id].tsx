import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { CO_ORGANIZER_RELATIONS, type CoOrganizer, type CoOrganizerRelation } from '@/types/event';
import { confirmDelete } from '@/utils/confirm';
import { DEFAULT_COUNTRY_CODE, toStoredPhone } from '@/utils/countryCodes';
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
  const [relation, setRelation] = useState<CoOrganizerRelation | 'restaurant' | null>(null);

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

  const submit = async (channel: 'whatsapp' | 'sms') => {
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
      await sendPhoneMessage(phone, buildCoOrganizerMessage(name, event.name, relation === 'restaurant'), channel);
      setName('');
      setLocalNumber('');
      setRelation(null);
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
    confirmDelete(t('coOrganizers.removeTitle'), t('coOrganizers.removeBody', { name: labelFor(member) }), () => {
      removeCoOrganizer(event.id, member.id).catch((err: unknown) => reportSupabaseError(err));
    });

  const disabled = localNumber.trim().length === 0 || relation === null || busy;
  const hasPending = event.coOrganizers.some((member) => member.userId === null);

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        coverType={event?.type}
        contentStyle={styles.content}
        footer={
          <View style={styles.footer}>
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
            {[...CO_ORGANIZER_RELATIONS, 'restaurant' as const].map((value) => {
              const selected = relation === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setRelation(value)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.relationChip,
                    {
                      backgroundColor: selected ? tokens.accentTint : tokens.surface,
                      borderColor: selected ? tokens.accentText : tokens.border,
                    },
                  ]}
                >
                  <Text style={[styles.relationText, { color: selected ? tokens.accentText : tokens.textPrimary }]}>
                    {t(`coOrganizers.relation.${value}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Field
          label={t('coOrganizers.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('coOrganizers.namePlaceholder')}
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
          error={error}
        />
      </Screen>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationChip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 4,
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
