import type { ViewStyle } from 'react-native';

import { Button } from '@/components/Button';

type GuestButtonVariant = 'purple' | 'gold' | 'outline';

interface GuestButtonProps {
  label: string;
  onPress: () => void;
  variant?: GuestButtonVariant;
  style?: ViewStyle;
}

/**
 * Warm Story 2.0: the guest tabs' buttons are the shared `Button` now, so
 * they follow the theme. Kept as a thin alias so existing callers don't
 * change: purple → primary, gold → tonal, outline → secondary.
 */
export function GuestButton({ label, onPress, variant = 'purple', style }: GuestButtonProps) {
  const mapped = variant === 'purple' ? 'primary' : variant === 'gold' ? 'tonal' : 'secondary';
  return <Button label={label} onPress={onPress} variant={mapped} style={style} />;
}
