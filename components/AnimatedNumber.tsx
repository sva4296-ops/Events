import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

interface AnimatedNumberProps {
  value: number;
  /** Formats the (rounded) in-between values too, e.g. formatMoney. */
  format?: (value: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that counts up from 0 on mount, and from its previous value when
 * `value` changes. Only the text changes (no layout/style animation); screen
 * readers always get the final value. Respects the system "reduce motion"
 * setting by rendering the final value directly.
 */
export function AnimatedNumber({ value, format = String, style, duration = 700 }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    const from = displayRef.current;
    if (from === value) return;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const next = from + (value - from) * easeOutCubic(progress);
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduceMotion]);

  const shown = reduceMotion ? value : display;
  return (
    <Text style={style} accessibilityLabel={format(value)}>
      {format(Math.round(shown))}
    </Text>
  );
}
