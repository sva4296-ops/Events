import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { ContactPickerModal, type PickedContact } from '@/components/ContactPickerModal';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_COUNTRY_CODE, splitStoredPhone, toStoredPhone } from '@/utils/countryCodes';
import { reportSupabaseError } from '@/utils/reportError';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';
import { generateId } from '@/utils/uuid';

interface GuestFormRow {
  id: string;
  name: string;
  dialCode: string;
  localNumber: string;
}

function emptyRow(): GuestFormRow {
  return { id: generateId(), name: '', dialCode: DEFAULT_COUNTRY_CODE.dialCode, localNumber: '' };
}

/**
 * "Bulk invite guests" — reached from app/event/[id].tsx's "+ Add multiple"
 * button. Manual rows and contacts-import both feed the same `rows` list
 * (an imported contact is converted back to a dialCode/localNumber pair via
 * utils/countryCodes.ts's splitStoredPhone, so every row renders through the
 * identical PhoneField the single-invite screen already uses — no separate
 * read-only row type). Submitting calls useEvents().addGuestsBatch (the
 * upsert_event_guests_batch RPC) and hands off to the send-invites queue,
 * not a WhatsApp send here — that's a per-guest action, done one at a time
 * on the next screen.
 */
export default function BulkAddGuestsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, addGuestsBatch } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);

  const [rows, setRows] = useState<GuestFormRow[]>([emptyRow()]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  if (event === undefined || !isOwner(event)) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('addGuestForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const updateRow = (rowId: string, patch: Partial<GuestFormRow>) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const removeRow = (rowId: string) => {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== rowId)));
  };

  const addRow = () => {
    setRows((current) => [...current, emptyRow()]);
  };

  const importContacts = (picked: PickedContact[]) => {
    if (picked.length === 0) return;
    const imported = picked.map((contact) => {
      const { dialCode, localNumber } = splitStoredPhone(contact.phone);
      return { id: generateId(), name: contact.name, dialCode, localNumber };
    });
    setRows((current) => {
      // A still-blank starter row shouldn't linger once real rows are
      // imported — drop it rather than leave an empty row mixed in.
      const base = current.filter((row) => row.localNumber.trim().length > 0);
      return [...base, ...imported];
    });
  };

  const validRows = rows.filter((row) => row.localNumber.replace(/\D/g, '').length >= 6);

  const submit = async () => {
    if (validRows.length === 0) return;
    setBusy(true);
    try {
      const guests = validRows.map((row) => ({
        phone: toStoredPhone(row.dialCode, row.localNumber),
        name: row.name.trim(),
      }));
      await addGuestsBatch(event.id, guests);
      router.replace(`/send-invites/${event.id}`);
    } catch (err) {
      reportSupabaseError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        footer={
          <Button
            label={busy ? t('bulkInviteForm.sending') : t('bulkInviteForm.submit', { count: validRows.length })}
            disabled={busy || validRows.length === 0}
            onPress={() => void submit()}
          />
        }
      >
        <Header title={t('bulkInviteForm.title')} subtitle={t('bulkInviteForm.subtitle')} showBack />

        <TouchableOpacity
          style={[styles.importButton, { borderColor: tokens.accentPrimary }]}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Feather name="users" size={16} color={tokens.accentPrimary} />
          <Text style={[styles.importButtonText, { color: tokens.accentPrimary }]}>
            {t('bulkInviteForm.importFromContacts')}
          </Text>
        </TouchableOpacity>

        {rows.map((row, index) => (
          <View
            key={row.id}
            style={[styles.rowCard, { borderColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.08)' }]}
          >
            <View style={styles.rowHead}>
              <Text style={[styles.rowLabel, { color: tokens.textSecondary }]}>
                {t('bulkInviteForm.guestNumber', { number: index + 1 })}
              </Text>
              {rows.length > 1 ? (
                <TouchableOpacity
                  onPress={() => removeRow(row.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('bulkInviteForm.removeRow')}
                >
                  <Feather name="x" size={18} color={tokens.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <Field
              label={t('addGuestForm.nameLabel')}
              value={row.name}
              onChangeText={(value) => updateRow(row.id, { name: value })}
              placeholder={t('addGuestForm.namePlaceholder')}
            />
            <PhoneField
              label={t('phoneAuth.phoneLabel')}
              dialCode={row.dialCode}
              onChangeDialCode={(value) => updateRow(row.id, { dialCode: value })}
              localNumber={row.localNumber}
              onChangeLocalNumber={(value) => updateRow(row.id, { localNumber: value })}
              placeholder={t('phoneAuth.phonePlaceholder')}
            />
          </View>
        ))}

        <Button label={t('bulkInviteForm.addAnother')} variant="secondary" onPress={addRow} />
      </Screen>

      <ContactPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onImport={importContacts}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 46,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
  },
  importButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: themeRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
