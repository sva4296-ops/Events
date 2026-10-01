import { Easing, FadeInDown } from 'react-native-reanimated';

/** Only the first rows animate in; anything below the fold appears instantly. */
const STAGGER_MAX = 8;
const STAGGER_STEP_MS = 40;

/**
 * `entering` animation for the n-th item of a list: fade + 10px rise,
 * cascading 40ms apart. Transform + opacity only, runs on the UI thread,
 * and Reanimated skips it when the system "reduce motion" setting is on.
 */
export function staggerIn(index: number) {
  if (index >= STAGGER_MAX) return undefined;
  return FadeInDown.duration(260)
    .delay(index * STAGGER_STEP_MS)
    .easing(Easing.out(Easing.quad))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
}
