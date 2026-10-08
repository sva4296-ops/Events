import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius, typeface, typography } from '@/utils/themeTokens';

type FeatherName = keyof typeof Feather.glyphMap;

export interface SheetAction {
  label: string;
  onPress: () => void;
  /** 'delete' draws it red with a trash icon. */
  tone?: 'default' | 'edit' | 'delete';
  icon?: FeatherName;
  /** Current choice in a picker (language, theme): check mark on the right. */
  selected?: boolean;
}

interface SheetRequest {
  title?: string;
  actions: SheetAction[];
}

export interface DialogButton {
  label: string;
  /** 'cancel' = neutral, 'destructive' = red, 'default' = accent. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface DialogRequest {
  title: string;
  message?: string;
  /** None = a single "OK"-style close button. */
  buttons?: DialogButton[];
}

type HostRequest = { kind: 'sheet'; sheet: SheetRequest } | { kind: 'dialog'; dialog: DialogRequest };

/**
 * The app's long-press menu (Edit / Delete / Cancel): a small centered popup
 * in the theme instead of the system Alert, which looks out of place on Android.
 * Imperative so it can open from a gesture callback: call showActionSheet()
 * anywhere; ActionSheetHost is mounted once in app/_layout.tsx.
 */
let present: ((request: HostRequest) => void) | null = null;

export function showActionSheet(request: SheetRequest): void {
  present?.({ kind: 'sheet', sheet: request });
}

/**
 * The app's confirmation / message popup, same look as the action sheet,
 * replacing Alert.alert everywhere. Falls back to the system Alert only if
 * the host isn't mounted yet.
 */
export function showDialog(request: DialogRequest): void {
  if (present === null) {
    Alert.alert(
      request.title,
      request.message,
      request.buttons?.map((button) => ({ text: button.label, style: button.style, onPress: button.onPress })),
    );
    return;
  }
  present({ kind: 'dialog', dialog: request });
}

const DEFAULT_ICON: Record<NonNullable<SheetAction['tone']>, FeatherName> = {
  default: 'chevron-right',
  edit: 'edit-2',
  delete: 'trash-2',
};

export function ActionSheetHost() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [current, setCurrent] = useState<HostRequest | null>(null);
  const [visible, setVisible] = useState(false);
  // Run after the sheet is gone: an action that opens another dialog (the
  // delete confirmation) can't present over a Modal that's still closing on iOS.
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    present = (next) => {
      setCurrent(next);
      setVisible(true);
    };
    return () => {
      present = null;
    };
  }, []);

  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const close = (action?: () => void) => {
    pending.current = action ?? null;
    setVisible(false);
    // iOS runs it from onDismiss; Android's Modal has no onDismiss.
    if (Platform.OS !== 'ios') runPending();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => close()}
      onDismiss={runPending}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: 'rgba(10,8,20,0.55)' }]}
        activeOpacity={1}
        onPress={() => close()}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      />
      {visible && current?.kind === 'dialog' ? (
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            entering={ZoomIn.duration(180)}
            style={[styles.popup, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            accessibilityRole="alert"
          >
            <View style={styles.dialogText}>
              <Text style={[styles.dialogTitle, { color: tokens.textPrimary }]}>{current.dialog.title}</Text>
              {current.dialog.message !== undefined && current.dialog.message.length > 0 ? (
                <Text style={[styles.dialogMessage, { color: tokens.textSecondary }]}>{current.dialog.message}</Text>
              ) : null}
            </View>
            <View style={[styles.dialogButtons, (current.dialog.buttons?.length ?? 1) > 2 && styles.dialogButtonsStacked]}>
              {(current.dialog.buttons ?? [{ label: t('common.close'), style: 'cancel' as const }]).map((button, index) => {
                const kind = button.style ?? 'default';
                const background =
                  kind === 'destructive' ? tokens.destructiveSoft : kind === 'cancel' ? tokens.surface2 : tokens.accentFill;
                const color =
                  kind === 'destructive' ? tokens.destructive : kind === 'cancel' ? tokens.textPrimary : tokens.onAccent;
                return (
                  <TouchableOpacity
                    key={`${button.label}-${index}`}
                    style={[styles.dialogButton, { backgroundColor: background }]}
                    onPress={() => close(button.onPress)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.dialogButtonLabel, { color }]} numberOfLines={1}>
                      {button.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </View>
      ) : null}
      {visible && current?.kind === 'sheet' ? (
        <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          entering={ZoomIn.duration(180)}
          style={[styles.popup, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          {current.sheet.title !== undefined && current.sheet.title.length > 0 ? (
            <Text style={[styles.title, { color: tokens.textPrimary }]} numberOfLines={2}>
              {current.sheet.title}
            </Text>
          ) : null}

          <View style={[styles.group, { backgroundColor: tokens.surface2 }]}>
            {current.sheet.actions.map((action, index) => {
              const tone = action.tone ?? 'default';
              const color = tone === 'delete' ? tokens.destructive : tokens.textPrimary;
              return (
                <TouchableOpacity
                  key={`${action.label}-${index}`}
                  style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}
                  onPress={() => close(action.onPress)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.icon,
                      { backgroundColor: tone === 'delete' ? tokens.destructiveSoft : tokens.surface },
                    ]}
                  >
                    <Feather name={action.icon ?? DEFAULT_ICON[tone]} size={18} color={color} />
                  </View>
                  <Text style={[styles.label, { color }]}>{action.label}</Text>
                  {action.selected === true ? <Feather name="check" size={20} color={tokens.accentText} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.cancel, { backgroundColor: tokens.surface2 }]}
            onPress={() => close()}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelLabel, { color: tokens.textPrimary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  dialogText: {
    gap: 8,
    paddingHorizontal: 4,
  },
  dialogTitle: {
    ...typography.subtitle,
  },
  dialogMessage: {
    ...typography.bodySmall,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogButtonsStacked: {
    flexDirection: 'column',
  },
  dialogButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dialogButtonLabel: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  popup: {
    width: '100%',
    maxWidth: 340,
    borderRadius: themeRadius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  title: {
    ...typography.subtitle,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  group: {
    borderRadius: themeRadius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: typeface.bodySemiBold,
    fontSize: 16,
  },
  cancel: {
    minHeight: 52,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 16,
  },
});
