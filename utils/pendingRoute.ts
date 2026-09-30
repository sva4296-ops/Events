/**
 * A deep-link destination held across the sign-in flow: app/i/[token].tsx sets
 * it when an invite link is opened without a session, and AuthGate takes it
 * once the user is signed in and has a name. In memory only, on purpose: the
 * app process stays alive through the OTP flow, and a stale invite path
 * surviving a cold start would be more surprising than losing it.
 */
let pendingRoute: string | null = null;

export function setPendingRoute(path: string): void {
  pendingRoute = path;
}

export function takePendingRoute(): string | null {
  const path = pendingRoute;
  pendingRoute = null;
  return path;
}
