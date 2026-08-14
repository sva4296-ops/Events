/**
 * Web-only content widths for the guest event tabs — caps a screen's content
 * column instead of letting it stretch edge-to-edge across a wide browser
 * window (native is unaffected; screens pass these to `GuestScreen`'s
 * `webMaxWidth`, which only applies them when `Platform.OS === 'web'`).
 * `narrow` is a single reading column (feed/chat/card-style screens);
 * `wide` is for screens arranged as a multi-section dashboard.
 */
export const WEB_CONTENT_WIDTH = {
  narrow: 640,
  wide: 1040,
} as const;
