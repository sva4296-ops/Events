import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

/**
 * The app's long-press menu (Edit / Delete / Cancel): a small centered popup
 * in the theme instead of the system Alert, which looks out of place on Android.
 * Imperative so it can open from a gesture callback: call showActionSheet()
 * anywhere; ActionSheetHost is mounted once in app/_layout.tsx.
 */
let present: ((request: SheetRequest) => void) | null = null;

export function showActionSheet(request: SheetRequest): void {
  present?.(request);
}

const DEFAULT_ICON: Record<NonNullable<SheetAction['tone']>, FeatherName> = {
  default: 'chevron-right',
  edit: 'edit-2',
  delete: 'trash-2',
};

export function ActionSheetHost() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [request, setRequest] = useState<SheetRequest | null>(null);
  const [visible, setVisible] = useState(false);
  // Run after the sheet is gone: an action that opens another dialog (the
  // delete confirmation) can't present over a Modal that's still closing on iOS.
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    present = (next) => {
      setRequest(next);
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
      {visible && request !== null ? (
        <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          entering={ZoomIn.duration(180)}
          style={[styles.popup, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          {request.title !== undefined && request.title.length > 0 ? (
            <Text style={[styles.title, { color: tokens.textPrimary }]} numberOfLines={2}>
              {request.title}
            </Text>
          ) : null}

          <View style={[styles.group, { backgroundColor: tokens.surface2 }]}>
            {request.actions.map((action, index) => {
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
