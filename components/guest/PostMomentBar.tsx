import Feather from '@expo/vector-icons/Feather';
import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, buttonLabelColor } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { floatingTabBar, tabBarBottomInset } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';

/** A tab's main action, just above the tab bar: "Post a moment", "Add guest". */
export function PostMomentBar({ label, onPress, targetRef }: { label: string; onPress: () => void; targetRef?: Ref<View> }) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  return (
    <View style={[styles.bar, { paddingBottom: tabBarBottomInset(insets.bottom) + floatingTabBar.height + spacing.sm }]}>
      <View ref={targetRef} collapsable={false}>
        <Button
          label={label}
          icon={<Feather name="plus" size={20} color={buttonLabelColor('primary', tokens)} />}
          onPress={onPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
  },
});
