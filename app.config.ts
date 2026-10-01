import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Wraps app.json. Associated Domains (universal links) force Expo CLI to code
 * sign even simulator builds, which needs a paid Apple Developer team. Set
 * SKIP_ASSOCIATED_DOMAINS=1 (see `yarn ios:sim`) to drop them for local builds.
 * EAS and normal builds are unaffected.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.SKIP_ASSOCIATED_DOMAINS !== '1') return config as ExpoConfig;

  const ios = { ...config.ios };
  delete ios.associatedDomains;
  return { ...config, ios } as ExpoConfig;
};
