import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { FocusRing } from '@/components/FocusRing';
import { useTheme } from '@/hooks/useTheme';
import { themeRadius } from '@/utils/themeTokens';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  accessibilityLabel: string;
  /** Tints every box in the declined tone. */
  invalid?: boolean;
}

/**
 * Warm Story 2.0 code entry: one box per digit, driven by a single hidden
 * TextInput so paste, SMS autofill (oneTimeCode / sms-otp) and backspace all
 * behave like a normal field.
 */
export function OtpInput({ value, onChange, length = 6, accessibilityLabel, invalid = false }: OtpInputProps) {
  const { tokens } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      style={styles.row}
    >
      {Array.from({ length }, (_, index) => {
        const digit = value[index] ?? '';
        const isActive = focused && index === activeIndex;
        const borderColor = invalid
          ? tokens.statusDeclined
          : isActive
            ? tokens.accentPrimary
            : tokens.border;

        return (
          <FocusRing key={index} active={isActive && !invalid} style={styles.cell}>
            <View style={[styles.box, { backgroundColor: tokens.surface, borderColor }]}>
              {digit.length > 0 ? (
                <Text style={[styles.digit, { color: tokens.textPrimary }]}>{digit}</Text>
              ) : isActive ? (
                <View style={[styles.caret, { backgroundColor: tokens.accentPrimary }]} />
              ) : null}
            </View>
          </FocusRing>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        caretHidden
        accessibilityLabel={accessibilityLabel}
        style={styles.hidden}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  cell: {
    flex: 1,
  },
  box: {
    height: 60,
    borderRadius: themeRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 26,
    fontWeight: '600',
  },
  caret: {
    width: 2,
    height: 26,
    borderRadius: 1,
  },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
