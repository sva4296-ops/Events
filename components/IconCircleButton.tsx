import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { themeRadius } from '@/utils/themeTokens';

interface IconCircleButtonProps {
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  /** 'md' (44) for headers, 'sm' (34) inside cards. */
  size?: 'md' | 'sm';
  tone?: 'default' | 'destructive';
}

/**
 * Round icon button used for the visible edit (pencil) and delete (trash)
 * actions in the Plan screens: pencil on each card, trash in the editor's header.
 */
export function IconCircleButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 'md',
  tone = 'default',
}: IconCircleButtonProps) {
  const { tokens } = useTheme();
  const destructive = tone === 'destructive';

  return (
    <TouchableOpacity
      style={[
        size === 'md' ? styles.md : styles.sm,
        {
          backgroundColor: destructive ? tokens.destructiveSoft : tokens.surface,
          borderColor: destructive ? tokens.destructiveSoft : tokens.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={size === 'sm' ? 6 : 0}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather
        name={icon}
        size={size === 'md' ? 18 : 15}
        color={destructive ? tokens.destructive : tokens.textPrimary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  md: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    width: 34,
    height: 34,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
