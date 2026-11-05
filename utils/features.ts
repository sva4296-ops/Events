/**
 * Live video (Live tab). Off until Cloudflare Stream is set up: the tab shows
 * "coming soon" and nothing calls event_streams / the live-stream function.
 * Turning it on also needs: supabase db push, the CLOUDFLARE_* secrets,
 * functions deploy live-stream, povestea-web deployed, and a build with
 * react-native-webview + expo-keep-awake.
 */
export const LIVE_VIDEO_ENABLED = false;

/**
 * Fund (Fond tab, the fund card on Acasă, the pricing bullet). Hidden for now:
 * nothing is deleted, the screens and data stay; set to true to bring it back.
 */
export const FUND_ENABLED = false;

/**
 * TESTING ONLY: lets "Alege" set any plan, paid ones included, without a
 * purchase. Needs 20261012000001_allow_unpaid_plans_for_testing.sql on the
 * database. Before launch: set to false AND add a migration that re-applies
 * the paid-plan lock from 20261009000001_lock_paid_plan_tier.sql.
 */
export const PAID_PLANS_FOR_TESTING = true;
