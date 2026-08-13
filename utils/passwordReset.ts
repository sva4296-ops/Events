import * as Linking from 'expo-linking';

/**
 * Deep link Supabase's resetPasswordForEmail redirects to once the emailed
 * link is tapped — same Linking.createURL pattern buildInviteLink uses in
 * utils/invite.ts.
 */
export function buildResetPasswordRedirectUrl(): string {
  return Linking.createURL('/reset-password');
}

interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Supabase's recovery redirect appends the session tokens as a URL fragment
 * (`#access_token=...&refresh_token=...&type=recovery`) under the implicit
 * flow this project's supabase-js client is on. `detectSessionInUrl` is off
 * (data/supabaseClient.ts — "no browser redirect to parse in a native app"),
 * so nothing parses this automatically; app/reset-password.tsx calls this
 * itself and feeds the result into supabase.auth.setSession(). Checks the
 * fragment first, then falls back to the query string, since which one a
 * real redirect actually uses has never been exercised from this
 * environment (no device/simulator run — see CLAUDE.md's verification-status
 * note).
 */
export function extractRecoveryTokens(url: string): RecoveryTokens | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const fromFragment = readTokens(url.slice(hashIndex + 1), 'fragment');
    if (fromFragment !== null) return fromFragment;
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) {
    const queryString = url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined);
    return readTokens(queryString, 'query');
  }

  return null;
}

// TODO(temporary): remove alongside the console.log calls in
// app/reset-password.tsx once the recovery flow is confirmed on a device.
function readTokens(paramString: string, source: 'fragment' | 'query'): RecoveryTokens | null {
  const params = new URLSearchParams(paramString);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  console.log(
    `[reset-password] parsed ${source} params:`,
    Array.from(params.keys()),
    '| type:',
    type,
    '| has access_token:',
    accessToken !== null,
    '| has refresh_token:',
    refreshToken !== null,
  );
  if (accessToken === null || refreshToken === null) return null;
  return { accessToken, refreshToken };
}
