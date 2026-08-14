import Feather from '@expo/vector-icons/Feather';
import { Link, router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TABS } from '@/app/(main)/guest/[id]/_layout';
import { GuestButton } from '@/components/guest/GuestButton';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gRadius, gSpace } from '@/utils/guestTheme';

interface EventTopMenuProps {
  id: string;
  name: string;
  /** Owner-only actions: the manage/participants shortcut and (on Acasă
   * specifically) the add-a-moment button. */
  owner: boolean;
}

function tabHref(id: string, name: string): string {
  return name === 'index' ? `/guest/${id}` : `/guest/${id}/${name}`;
}

/**
 * Web-only. Replaces both EventHeaderBar and EventSidebar with a single
 * horizontal menu: event name, the six nav destinations, and the owner-only
 * actions that used to live elsewhere (the header's manage/participants
 * icon, Acasă's floating "add a moment" button) — one bar instead of a
 * header strip + a separate left rail below it. No back arrow: the events
 * list is always visible in the master-detail left pane
 * (app/(main)/_layout.tsx), so there's nothing a back button would need to
 * reach that isn't already on screen. Native is untouched — EventHeaderBar
 * and the floating FAB stay exactly as they were; this component never
 * renders there.
 */
export function EventTopMenu({ id, name, owner }: EventTopMenuProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { tokens } = useTheme();

  const onAcasa = pathname === tabHref(id, 'index');

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: tokens.tabBar.background,
          borderBottomColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
        {name}
      </Text>

      <View style={styles.nav}>
        {TABS.map((tab) => {
          const href = tabHref(id, tab.name);
          const active = pathname === href;
          return (
            <Link key={tab.name} href={href} asChild>
              <TouchableOpacity
                style={styles.item}
                activeOpacity={0.75}
                accessibilityRole="link"
                accessibilityLabel={tab.label}
              >
                <View
                  style={[styles.iconWrap, active ? { backgroundColor: tokens.accentPrimary } : null]}
                >
                  <Feather
                    name={tab.icon}
                    size={active ? 18 : 16}
                    color={active ? tokens.tabBar.active : tokens.tabBar.inactive}
                  />
                </View>
                <Text
                  style={[styles.label, { color: active ? tokens.textPrimary : tokens.textSecondary }]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>

      <View style={styles.actions}>
        {owner && onAcasa ? (
          <GuestButton
            label={t('postMomentForm.title')}
            onPress={() => router.push(`/post-moment/${id}`)}
          />
        ) : null}
        {owner ? (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: tokens.surfaceElevated }]}
            onPress={() => router.push(`/event/${id}`)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Lista de invitați și statistici"
          >
            <Feather name="users" size={18} color={tokens.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.xl,
    paddingVertical: gSpace.md,
    paddingHorizontal: gSpace.xl,
    borderBottomWidth: 1,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    flexShrink: 1,
  },
  nav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: gSpace.lg,
  },
  item: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: gSpace.xs,
    paddingHorizontal: gSpace.sm,
  },
  iconWrap: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: gSpace.sm,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
