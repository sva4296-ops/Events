import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SwipeableRow } from '@/components/SwipeableRow';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surfaceElevated,
    borderColor: tokens.surfaceBorder ?? 'transparent',
    borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

/** Matches the vendor's own (user-typed) category text, so this stays
 * Romanian-keyword-based regardless of UI language — see the file-level note
 * on never translating user-generated content. */
function vendorIcon(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('foto') || normalized.includes('video')) return '📷';
  if (normalized.includes('muz') || normalized.includes('dj')) return '🎵';
  if (normalized.includes('catering') || normalized.includes('mânc') || normalized.includes('manc')) {
    return '🍽️';
  }
  if (normalized.includes('flor')) return '💐';
  if (normalized.includes('tort') || normalized.includes('cofet')) return '🎂';
  if (normalized.includes('transport') || normalized.includes('mașin') || normalized.includes('masin')) {
    return '🚗';
  }
  if (normalized.includes('decor')) return '🎈';
  return '🏷️';
}

export default function DetaliiVendorsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content, deleteVendor } = useEventContent(id ?? '');
  const { tokens } = useTheme();

  if (content === null) {
    return (
      <Screen>
        <Header title={t('detalii.hub.vendorsTitle')} showBack />
      </Screen>
    );
  }

  const card = cardStyle(tokens);

  return (
    <GuestScreen topInset>
      <Header
        title={t('detalii.hub.vendorsTitle')}
        subtitle={t('detalii.vendorsDescription')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surfaceElevated }]}
              onPress={() => router.push(`/vendor/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă furnizor"
            >
              <Feather name="plus" size={18} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {content.vendors.length === 0 ? (
        <EmptyState
          message={owner ? t('detalii.vendorsEmptyOwner') : t('detalii.vendorsEmptyGuest')}
          action={
            owner ? <GuestButton label={t('detalii.addVendor')} onPress={() => router.push(`/vendor/${id}`)} /> : undefined
          }
        />
      ) : (
        <>
          <View style={styles.stack}>
            {content.vendors.map((vendor) => (
              <SwipeableRow
                key={vendor.id}
                enabled={owner}
                actions={[
                  {
                    label: t('common.edit'),
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/vendor/${id}?itemId=${vendor.id}`),
                  },
                  {
                    label: t('common.delete'),
                    icon: 'trash-2',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        t('detalii.deleteVendorTitle'),
                        t('detalii.deleteVendorBody', { name: vendor.name }),
                        () => deleteVendor(vendor.id),
                      ),
                  },
                ]}
              >
                <View style={[styles.vendorCard, card]}>
                  <View style={[styles.vendorIconWrap, { backgroundColor: tokens.surface }]}>
                    <Text style={styles.vendorIcon}>{vendorIcon(vendor.category)}</Text>
                  </View>
                  <View style={styles.vendorBody}>
                    <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{vendor.name}</Text>
                    <Text style={[styles.rowSubtitle, { color: tokens.textSecondary }]} numberOfLines={1}>
                      {[vendor.category, vendor.handle].filter((part) => part.length > 0).join(' · ')}
                    </Text>
                  </View>
                  {vendor.external_url.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(vendor.external_url)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Vezi ${vendor.name}`}
                    >
                      <Text style={[styles.vendorLink, { color: tokens.accentPrimary }]}>
                        {t('detalii.vendorLink')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </SwipeableRow>
            ))}
          </View>
          <Text style={[styles.vendorCaption, { color: tokens.textSecondary }]}>
            {t('detalii.vendorCaption')}
          </Text>
        </>
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: gSpace.md,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 13,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
    borderRadius: themeRadius.lg,
    padding: gSpace.lg,
  },
  vendorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorIcon: {
    fontSize: 18,
  },
  vendorBody: {
    flex: 1,
    gap: 2,
  },
  vendorLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  vendorCaption: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    paddingHorizontal: gSpace.xs,
  },
});
