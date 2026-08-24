import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

/**
 * RevenueCat wiring for the pricing screen only — app/pricing.tsx. This is
 * new infrastructure (react-native-purchases wasn't a dependency before
 * this pass; requires a native rebuild, same as every other native
 * dependency addition — see CLAUDE.md's dev-build note). Deliberately
 * narrow: configuration + a price lookup + the purchasePackage call itself.
 * Purchase *recording* (writing a row Supabase-side), webhook verification,
 * and entitlement gating are NOT built here — out of scope for this pass,
 * same "flag, don't silently build partial infra" convention as every other
 * deferred item in CLAUDE.md §7.
 */

let configured = false;

/** Idempotent — safe to call from every pricing-screen mount. Returns false
 * (rather than throwing) when no API key is set for the current platform,
 * so the screen can degrade to "price unavailable" instead of crashing. */
function ensureRevenueCatConfigured(): boolean {
  if (configured) return true;

  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    default: undefined,
  });
  if (typeof apiKey !== 'string' || apiKey.length === 0) return false;

  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

/** Every package across every offering, keyed by RevenueCat package
 * identifier — the same identifier plan_features.revenuecat_package_id is
 * expected to hold. Returns an empty map (never throws) when RevenueCat
 * isn't configured or the fetch itself fails; callers treat "not in the
 * map" as "show this card without a price," per the request that specified
 * this screen's behavior. */
export async function fetchOfferingPackages(): Promise<Map<string, PurchasesPackage>> {
  const packages = new Map<string, PurchasesPackage>();
  if (!ensureRevenueCatConfigured()) return packages;

  const offerings = await Purchases.getOfferings();
  for (const offering of Object.values(offerings.all)) {
    for (const pkg of offering.availablePackages) {
      packages.set(pkg.identifier, pkg);
    }
  }
  return packages;
}

export async function purchasePlanPackage(pkg: PurchasesPackage) {
  return Purchases.purchasePackage(pkg);
}

/** True when a purchasePackage rejection was the user backing out of the
 * native sheet, not a real failure — callers should skip the error alert
 * for this case. */
export function isUserCancelledPurchase(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'userCancelled' in error &&
    (error as { userCancelled: unknown }).userCancelled === true
  );
}
