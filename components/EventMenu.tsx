import { showActionSheet } from '@/components/ActionSheet';
import { haptics } from '@/utils/haptics';

export interface EventMenuAction {
  id: string;
  title: string;
  destructive?: boolean;
  onPress: () => void;
}

/** Opens an event's Edit / Delete menu as the app's bottom sheet. No-op without actions. */
export function openEventMenu(title: string, actions: readonly EventMenuAction[]): void {
  if (actions.length === 0) return;
  haptics.press();
  showActionSheet({
    title,
    actions: actions.map((action) => ({
      label: action.title,
      tone: action.destructive === true ? ('delete' as const) : ('edit' as const),
      onPress: action.onPress,
    })),
  });
}
