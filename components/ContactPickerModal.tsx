import Feather from '@expo/vector-icons/Feather';
import * as Contacts from 'expo-contacts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { normalizeToStoredPhone } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export interface PickedContact {
  name: string;
  /** Already normalized — see utils/countryCodes.ts's normalizeToStoredPhone. */
  phone: string;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string;
}

type LoadState = 'loading' | 'denied' | 'ready' | 'error';

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (contacts: PickedContact[]) => void;
}

/**
 * expo-contacts 57's default export only has a single-select native picker
 * (`Contact.presentPicker()`) — there's no multi-select system picker
 * exposed in this SDK version to call into (checked the installed package's
 * own type definitions, not assumed). This is the substitute: an in-app
 * checklist built from `Contact.getAllDetails`, styled as a Modal + sheet
 * the same way components/PhoneField.tsx's own country picker already is,
 * so this doesn't introduce a new modal-sheet pattern to the app.
 */
export function ContactPickerModal({ visible, onClose, onImport }: ContactPickerModalProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const [state, setState] = useState<LoadState>('loading');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setState('loading');
    setSelected(new Set());

    let cancelled = false;
    void (async () => {
      try {
        const existing = await Contacts.getPermissionsAsync();
        const permission = existing.granted ? existing : await Contacts.requestPermissionsAsync();
        if (cancelled) return;

        if (!permission.granted) {
          // No Sentry in this codebase (checked) — a visible inline state is
          // strictly more useful to the organizer than a breadcrumb they'd
          // never see, so that's what this uses instead.
          setState('denied');
          return;
        }

        const details = await Contacts.Contact.getAllDetails(
          [Contacts.ContactField.GIVEN_NAME, Contacts.ContactField.FAMILY_NAME, Contacts.ContactField.PHONES],
          { sortOrder: Contacts.ContactsSortOrder.GivenName },
        );
        if (cancelled) return;

        const rows: ContactRow[] = details
          .filter((contact) => contact.phones !== undefined && contact.phones.length > 0)
          .map((contact) => {
            const rawPhone = contact.phones?.[0]?.number ?? '';
            const name = [contact.givenName, contact.familyName].filter(Boolean).join(' ').trim();
            return { id: contact.id, name, phone: normalizeToStoredPhone(rawPhone) };
          })
          // A phone with no usable digits (a malformed contact entry) can't
          // be invited — drop it rather than pass an empty string through.
          .filter((row) => row.phone.length > 0);

        setContacts(rows);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const confirm = () => {
    const picked = contacts
      .filter((contact) => selected.has(contact.id))
      .map((contact) => ({ name: contact.name, phone: contact.phone }));
    onImport(picked);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[styles.sheet, { backgroundColor: tokens.surfaceElevated }]}
          activeOpacity={1}
          onPress={() => undefined}
        >
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {t('bulkInviteForm.contactsTitle')}
          </Text>

          {state === 'loading' ? (
            <ActivityIndicator style={styles.centerBlock} color={tokens.accentPrimary} />
          ) : null}

          {state === 'denied' ? (
            <Text style={[styles.message, { color: tokens.textSecondary }]}>
              {t('bulkInviteForm.contactsPermissionDenied')}
            </Text>
          ) : null}

          {state === 'error' ? (
            <Text style={[styles.message, { color: tokens.textSecondary }]}>
              {t('bulkInviteForm.contactsLoadError')}
            </Text>
          ) : null}

          {state === 'ready' && contacts.length === 0 ? (
            <Text style={[styles.message, { color: tokens.textSecondary }]}>
              {t('bulkInviteForm.contactsEmpty')}
            </Text>
          ) : null}

          {state === 'ready' && contacts.length > 0 ? (
            <FlatList
              data={contacts}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => toggle(item.id)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? tokens.accentPrimary : tokens.surfaceBorder ?? 'rgba(0,0,0,0.2)',
                          backgroundColor: isSelected ? tokens.accentPrimary : 'transparent',
                        },
                      ]}
                    >
                      {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowName, { color: tokens.textPrimary }]} numberOfLines={1}>
                        {item.name.length > 0 ? item.name : item.phone}
                      </Text>
                      <Text style={[styles.rowPhone, { color: tokens.textSecondary }]} numberOfLines={1}>
                        {item.phone}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          ) : null}

          <Button
            label={t('bulkInviteForm.contactsImportButton', { count: selected.size })}
            onPress={confirm}
            disabled={selected.size === 0}
            style={styles.confirm}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '80%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  centerBlock: {
    paddingVertical: spacing.xl,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowPhone: {
    fontSize: 13,
  },
  confirm: {
    marginTop: spacing.md,
  },
});
