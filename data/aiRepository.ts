import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/data/supabaseClient';

/**
 * AI writing help for text fields, through the ai-write Edge Function
 * (supabase/functions/ai-write). The Anthropic key lives only there; the
 * function also enforces a daily quota per user.
 */

export type AiWriteKind = 'welcome' | 'moment' | 'venueNotes' | 'invite' | 'dish';

export interface AiWriteContext {
  type: string | null;
  name: string;
  date: string | null;
  location: string;
  /** Extra label for the field, e.g. the course name for a dish. */
  detail?: string;
}

export interface AiWriteInput {
  kind: AiWriteKind;
  language: 'ro' | 'en';
  /** The field's current text: empty = write from scratch, otherwise improve it. */
  text: string;
  maxChars: number;
  context: AiWriteContext;
  /** Meters the call against this event's plan allowance (omit in the create wizard). */
  eventId?: string;
}

/** A limit was hit (the function answered 429): the account's daily cap or the event's plan allowance. */
export class AiQuotaError extends Error {
  constructor(readonly scope: 'daily' | 'event') {
    super('ai_quota');
  }
}

async function quotaScope(response: { json: () => Promise<unknown> }): Promise<'daily' | 'event'> {
  const body = (await response.json().catch(() => null)) as { scope?: unknown } | null;
  return body?.scope === 'event' ? 'event' : 'daily';
}

/**
 * The function's HTTP answer behind a FunctionsHttpError. Duck-typed: on
 * React Native `error.context` is the fetch polyfill's Response, which is
 * not always `instanceof` the global Response, so that check missed every
 * 429 and showed the generic "non-2xx" message instead of the quota one.
 */
function httpResponse(error: unknown): { status: number; json: () => Promise<unknown> } | null {
  if (!(error instanceof FunctionsHttpError)) return null;
  const context = error.context as { status?: unknown; json?: unknown } | undefined;
  if (typeof context?.status !== 'number' || typeof context.json !== 'function') return null;
  return context as { status: number; json: () => Promise<unknown> };
}

export async function aiWrite(input: AiWriteInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-write', {
    method: 'POST',
    body: input,
  });
  if (error) {
    const response = httpResponse(error);
    if (response?.status === 429) throw new AiQuotaError(await quotaScope(response));
    // Turn the function's answer into a readable code, e.g. "ai_write 502 ai_error upstream 401".
    if (response !== null) {
      const body = (await response.json().catch(() => null)) as { error?: unknown; upstream?: unknown; reason?: unknown } | null;
      const upstream = typeof body?.upstream === 'number' ? ` upstream ${body.upstream}` : '';
      const reason = typeof body?.reason === 'string' ? ` ${body.reason}` : '';
      throw new Error(`ai_write ${response.status} ${String(body?.error ?? 'unknown')}${upstream}${reason}`);
    }
    throw error;
  }
  const text = (data as { text?: unknown } | null)?.text;
  if (typeof text !== 'string' || text.trim().length === 0) throw new Error('ai_empty');
  return text.trim();
}

/** Asks ai-write to pick one of the cover themes for this title and type. */
export async function suggestCoverTheme(context: { type: string | null; name: string; detail?: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-write', {
    method: 'POST',
    body: { kind: 'theme', context },
  });
  if (error) {
    const response = httpResponse(error);
    if (response?.status === 429) throw new AiQuotaError(await quotaScope(response));
    throw error;
  }
  const theme = (data as { theme?: unknown } | null)?.theme;
  if (typeof theme !== 'string') throw new Error('ai_empty');
  return theme;
}

/** AI calls this event has used so far (organizers only; 0 otherwise). */
export async function fetchAiEventUsage(eventId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_ai_event_usage', { p_event_id: eventId });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
