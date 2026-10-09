import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { Screen } from '@/components/Screen';
import { LongPressRow } from '@/components/LongPressRow';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surface,
    borderColor: tokens.border,
    borderWidth: 1,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

/** Matches the vendor's own (user-typed) category text, so this stays
 * Romanian-keyword-based regardless of UI language — see the file-level note
 * on never translating user-generated content. */
function vendorIcon(category: string): keyof typeof Feather.glyphMap {
  const normalized = category.toLowerCase();
  if (normalized.includes('foto') || normalized.includes('video')) return 'camera';
  if (normalized.includes('muz') || normalized.includes('dj')) return 'music';
  if (normalized.includes('catering') || normalized.includes('mânc') || normalized.includes('manc')) {
    return 'coffee';
  }
  if (normalized.includes('flor')) return 'feather';
  if (normalized.includes('tort') || normalized.includes('cofet')) return 'gift';
  if (normalized.includes('transport') || normalized.includes('mașin') || normalized.includes('masin')) {
    return 'truck';
  }
  if (normalized.includes('decor')) return 'star';
  return 'tag';
}

export default function DetaliiVendorsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content, deleteVendor } = useEventContent(id ?? '');
  const { hydrated: planHydrated, capabilities } = usePlanGate(id ?? '');
  const { tokens } = useTheme();

  if (content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header title={t('detalii.hub.vendorsTitle')} showBack />
      </Screen>
    );
  }

  // Reached both via the hub card (already routed to /pricing instead when
  // locked) and directly, e.g. a stale deep link. Server-side: a trigger on
  // vendors inserts (see the plan-feature-gating migration).
  if (planHydrated && !capabilities.vendorTaggingEnabled) {
    return (
      <GuestScreen coverType={event?.type} topInset>
        <Header title={t('detalii.hub.vendorsTitle')} showBack />
        <EmptyState
          icon="lock"
          message={t('planGate.vendorsLocked')}
          action={
            owner ? (
              <GuestButton
                label={t('common.viewPlans')}
                onPress={() => router.push(`/pricing/${id}`)}
              />
            ) : undefined
          }
        />
      </GuestScreen>
    );
  }

  const card = cardStyle(tokens);

  return (
    <GuestScreen coverType={event?.type} topInset>
      <Header
        title={t('detalii.hub.vendorsTitle')}
        subtitle={t('detalii.vendorsDescription')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border, borderWidth: 1 }]}
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
              <LongPressRow
                title={vendor.name}
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
                  <View style={[styles.vendorIconWrap, { backgroundColor: tokens.accentTint }]}>
                    <Feather name={vendorIcon(vendor.category)} size={20} color={tokens.accentText} />
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
                      <Text style={[styles.vendorLink, { color: tokens.accentText }]}>
                        {t('detalii.vendorLink')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {owner ? (
                    <IconCircleButton
                      size="sm"
                      icon="edit-2"
                      accessibilityLabel={t('common.edit')}
                      onPress={() => router.push(`/vendor/${id}?itemId=${vendor.id}`)}
                    />
                  ) : null}
                </View>
              </LongPressRow>
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
    width: 44,
    height: 44,
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
    borderRadius: themeRadius.xl,
    padding: gSpace.lg,
  },
  vendorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
