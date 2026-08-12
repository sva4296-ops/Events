/**
 * Client-side id generation, needed only because Storage upload paths
 * ({eventId}/{photoId}/...) must be known before the `photos` row exists to
 * hand out its own default id — see remoteEventContentRepository.ts's
 * addPhoto. Prefers the native crypto.randomUUID where available; the
 * Math.random fallback is fine here since this only ever backs a Postgres
 * primary key, not a security token.
 */
export function generateId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof globalCrypto?.randomUUID === 'function') return globalCrypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
