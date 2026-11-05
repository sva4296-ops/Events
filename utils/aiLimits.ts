/**
 * AI calls per event, by plan (null plan = Esențial). Mirrors EVENT_LIMITS in
 * supabase/functions/ai-write/index.ts, which is the real enforcement; this
 * only drives the "N left" hint on the AI button.
 */
const EVENT_AI_LIMITS: Record<string, number> = { esential: 10, complet: 100, premium: 300, agentie: 300 };

export function eventAiLimit(planTier: string | null): number {
  return EVENT_AI_LIMITS[planTier ?? 'esential'] ?? EVENT_AI_LIMITS.esential!;
}

/** Premium-tier allowance: shown as "unlimited", not as a number. */
export function isUnlimitedAi(planTier: string | null): boolean {
  return eventAiLimit(planTier) >= 300;
}
