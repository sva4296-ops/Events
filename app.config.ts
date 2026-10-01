import type { ConfigContext, ExpoConfig } from 'expo/config';

// Plain require: this file runs in Node, but the app's tsconfig has no Node types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { existsSync } = require('fs') as { existsSync: (path: string) => boolean };

/**
 * Wraps app.json.
 *
 * - Associated Domains (universal links) force Expo CLI to code sign even
 *   simulator builds, which needs a paid Apple Developer team. Set
 *   SKIP_ASSOCIATED_DOMAINS=1 (see `yarn ios:sim`) to drop them for local builds.
 * - react-native-maps: Android renders Google Maps and needs an API key
 *   (Maps SDK for Android, free on mobile). It comes from
 *   GOOGLE_MAPS_ANDROID_API_KEY (.env locally, EAS environment variables for
 *   cloud builds). iOS uses Apple Maps and needs no key.
 * - Push (FCM): Android needs Firebase's google-services.json. Taken from the
 *   GOOGLE_SERVICES_JSON EAS file variable if set, else ./google-services.json
 *   when present; without either, builds still work, just without push.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const ios = { ...config.ios };
  if (process.env.SKIP_ASSOCIATED_DOMAINS === '1') {
    delete ios.associatedDomains;
  }

  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '';
  const plugins: ExpoConfig['plugins'] = [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: androidMapsKey }],
  ];
  // Read by utils/maps.ts: without a key Google Maps crashes on Android, so maps stay hidden there.
  const extra = { ...config.extra, hasAndroidMapsKey: androidMapsKey.length > 0 };

  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);
  const android = { ...config.android, ...(googleServicesFile !== undefined ? { googleServicesFile } : {}) };

  return { ...config, ios, android, plugins, extra } as ExpoConfig;
};
