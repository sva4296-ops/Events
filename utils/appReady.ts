/**
 * Resolves once the JS splash (BrandSplash) has fully faded out, i.e. the
 * user is actually looking at the app. Lets prompts like the notification
 * permission wait instead of popping up over the splash animation.
 */
let ready = false;
const waiters: (() => void)[] = [];

export function markAppReady(): void {
  if (ready) return;
  ready = true;
  waiters.splice(0).forEach((resolve) => resolve());
}

export function whenAppReady(): Promise<void> {
  return ready ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve));
}
