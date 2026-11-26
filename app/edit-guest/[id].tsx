import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { showDialog } from '@/components/ActionSheet';
import { Button, buttonLabelColor } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { findCoOrganizerMember } from '@/utils/coOrganizers';
import { DEFAULT_COUNTRY_CODE, splitStoredPhone, toStoredPhone } from '@/utils/countryCodes';
import { haptics } from '@/utils/haptics';
import { reportSupabaseError } from '@/utils/reportError';
import { typography } from '@/utils/themeTokens';
import { buildCoOrganizerMessage, sendPhoneMessage } from '@/utils/whatsappInvite';

type Role = 'guest' | 'co_organizer';

const ROLES: { key: Role; icon: 'user' | 'users' }[] = [
  { key: 'guest', icon: 'user' },
  { key: 'co_organizer', icon: 'users' },
];

/** Postgres unique violation: the phone is already on this event (guest list or co-organizers). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

/**
 * Organizer edit of one guest (`?guestId=`): name, phone, role (invitat /
 * co-organizator) and delete. Same flow as the site's GuestEditDialog. Reached
 * from a guest row's long-press menu in components/GuestDashboard.tsx.
 * The role picker is primary-owner only: event_members RLS is is_event_owner.
 */
export default function EditGuestScreen() {
  const { t } = useTranslation();
  const { id, guestId } = useLocalSearchParams<{ id: string; guestId?: string }>();
  const { getEvent, isOwner, isPrimaryOwner, updateGuest, setGuestRole, removeGuest } = useEvents();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const event = getEvent(id);
  const guest = event?.guests.find((row) => row.id === guestId);

  // The form starts from the guest as first rendered; later refetches don't overwrite typing.
  const [initial] = useState(() => {
    const split = guest?.phone != null ? splitStoredPhone(guest.phone) : null;
    return {
      // mapGuestRow falls back to the phone as the name: don't show that as a name.
      name: guest === undefined || guest.name === guest.phone ? '' : guest.name,
      dialCode: split?.dialCode ?? DEFAULT_COUNTRY_CODE.dialCode,
      localNumber: split?.localNumber ?? '',
    };
  });
  const [name, setName] = useState(initial.name);
  const [dialCode, setDialCode] = useState(initial.dialCode);
  const [localNumber, setLocalNumber] = useState(initial.localNumber);
  const member = event !== undefined && guest !== undefined ? findCoOrganizerMember(event, guest) : undefined;
  const currentRole: Role = member !== undefined ? 'co_organizer' : 'guest';
  const [role, setRole] = useState<Role>(currentRole);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (event === undefined || !isOwner(event)) {
    return (
      <Screen>
        <Header title={t('common.notAvailable')} subtitle={t('addGuestForm.notAvailableSubtitle')} showBack />
      </Screen>
    );
  }
  if (guest === undefined) {
    return (
      <Screen coverTheme={event.coverTheme}>
        <Header title={t('editGuest.notFound')} showBack />
      </Screen>
    );
  }

  const canChangeRole = isPrimaryOwner(event);
  const memberId = member?.id ?? null;

  const save = async () => {
    setError(null);

    // A guest with no phone (linked by account only) may stay without one.
    const digits = localNumber.replace(/\D/g, '');
    let phone: string | null = null;
    if (digits.length > 0 || guest.phone !== null) {
      if (digits.length < 6) {
        setError(t('phoneAuth.errors.invalidPhone'));
        return;
      }
      phone = toStoredPhone(dialCode, localNumber);
    }
    if (phone !== null && user?.phone != null && phone === user.phone && guest.userId !== user.id) {
      setError(t('addGuestForm.selfInviteError'));
      return;
    }

    const trimmedName = name.trim();
    const changedDetails = trimmedName !== initial.name || (phone !== null && phone !== guest.phone);
    const promoting = canChangeRole && role === 'co_organizer' && currentRole === 'guest';
    const demoting = canChangeRole && role === 'guest' && currentRole === 'co_organizer';

    if (promoting) {
      if (phone === null && guest.userId === null) {
        setError(t('editGuest.errors.needPhone'));
        return;
      }
      if (phone !== null && event.coOrganizers.some((row) => row.phone === phone)) {
        setError(t('editGuest.errors.alreadyCoOrganizer'));
        return;
      }
    }

    setBusy(true);
    try {
      if (changedDetails) {
        try {
          await updateGuest(event.id, guest.id, trimmedName, phone !== guest.phone ? phone : null, memberId);
        } catch (err) {
          if (isUniqueViolation(err)) setError(t('editGuest.errors.alreadyOnList'));
          else reportSupabaseError(err);
          return;
        }
      }

      if (promoting || demoting) {
        try {
          await setGuestRole(
            event.id,
            { phone: phone ?? guest.phone, name: trimmedName, userId: guest.userId },
            role,
            memberId,
          );
        } catch (err) {
          if (isUniqueViolation(err)) setError(t('editGuest.errors.alreadyCoOrganizer'));
          else reportSupabaseError(err);
          return;
        }
      }

      haptics.success();
      router.back();

      // Same "you're a co-organizer" message as the co-organizers screen, offered, not sent.
      const notifyPhone = phone ?? guest.phone;
      if (promoting && notifyPhone !== null) {
        showDialog({
          title: t('editGuest.promotedTitle'),
          message: t('editGuest.promotedBody', { name: trimmedName.length > 0 ? trimmedName : t('editGuest.theGuest') }),
          buttons: [
            { label: t('common.done'), style: 'cancel' },
            {
              label: t('editGuest.notifyWhatsApp'),
              onPress: () =>
                void sendPhoneMessage(notifyPhone, buildCoOrganizerMessage(trimmedName, event.name), 'whatsapp'),
            },
          ],
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const label = initial.name.length > 0 ? initial.name : guest.name;
    confirmDelete(
      t('editGuest.deleteTitle'),
      t(member !== undefined ? 'editGuest.deleteBodyCoOrganizer' : 'editGuest.deleteBody', { name: label }),
      // The member row goes first inside removeGuest, or the guest could come back.
      () =>
        removeGuest(event.id, guest.id, memberId).then((ok) => {
          if (ok) router.back();
        }),
    );
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        coverTheme={event.coverTheme}
        contentStyle={styles.content}
        footer={
          <View style={styles.footer}>
            <Button
              label={busy ? t('editGuest.saving') : t('common.save')}
              disabled={busy}
              onPress={() => void save()}
            />
            <Button
              label={t('editGuest.delete')}
              variant="danger"
              disabled={busy}
              icon={<Feather name="trash-2" size={18} color={busy ? tokens.textMuted : buttonLabelColor('danger', tokens)} />}
              onPress={remove}
            />
          </View>
        }
      >
        <Header title={t('editGuest.title')} showBack />

        <Field
          label={t('editGuest.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('editGuest.namePlaceholder')}
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

        {canChangeRole ? (
          <View style={styles.roleBlock}>
            <Text style={[styles.roleLabel, { color: tokens.textSecondary }]}>{t('editGuest.roleLabel')}</Text>
            {ROLES.map(({ key, icon }) => {
              const selected = role === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    if (!selected) haptics.tap();
                    setRole(key);
                    setError(null);
                  }}
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
                    <Feather name={icon} size={18} color={selected ? tokens.accentText : tokens.textSecondary} />
                  </View>
                  <View style={styles.roleText}>
                    <Text style={[styles.roleName, { color: selected ? tokens.accentText : tokens.textPrimary }]}>
                      {t(`editGuest.role.${key}`)}
                      {currentRole === key ? (
                        <Text style={[styles.roleCurrent, { color: tokens.textSecondary }]}>
                          {t('editGuest.currentRole')}
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={[styles.roleHint, { color: tokens.textSecondary }]}>
                      {t(`editGuest.roleHint.${key}`)}
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
            {currentRole === 'co_organizer' && role === 'guest' ? (
              <Text style={[styles.note, { color: tokens.textSecondary }]}>{t('editGuest.demoteNote')}</Text>
            ) : null}
          </View>
        ) : null}
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
  roleBlock: {
    gap: 8,
  },
  roleLabel: {
    ...typography.label,
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
  roleName: {
    fontSize: 14,
    fontWeight: '600',
  },
  roleCurrent: {
    fontWeight: '400',
  },
  roleHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});
