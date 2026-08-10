/** Short, URL-friendly id — good enough for local-only v1 invites. */
export function createId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);
  return `${stamp}${random}`;
}
