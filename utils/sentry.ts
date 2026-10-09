import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

/**
 * Sentry crash/error reporting. Installed but not configured yet: without
 * EXPO_PUBLIC_SENTRY_DSN nothing is initialized and every call below is a
 * no-op, so the app behaves exactly as before.
 *
 * To turn it on later:
 * 1. Create a React Native project in Sentry, put its DSN in .env and in the
 *    EAS environment variables (EXPO_PUBLIC_SENTRY_DSN; the DSN is public, not a secret).
 * 2. For readable stack traces, add the "@sentry/react-native/expo" plugin to
 *    app.json (organization + project), use getSentryExpoConfig in
 *    metro.config.js, and set SENTRY_AUTH_TOKEN as an EAS secret.
 * 3. New native build (the SDK is a native module).
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export const sentryEnabled = dsn.length > 0;

export function initSentry(): void {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn,
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // No phone numbers / IPs attached by default; private data stays out of reports.
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

/** Safe to call anywhere; does nothing while Sentry isn't configured. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  Sentry.captureException(error, context !== undefined ? { extra: context } : undefined);
}

/** Wraps the root component (error boundary + touch breadcrumbs) only when configured. */
export function wrapRoot<P extends Record<string, unknown>>(
  component: ComponentType<P>,
): ComponentType<P> {
  return sentryEnabled ? Sentry.wrap(component) : component;
}
