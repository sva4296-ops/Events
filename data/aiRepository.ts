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
}

/** Today's quota is used up (the function answered 429). */
export class AiQuotaError extends Error {}

export async function aiWrite(input: AiWriteInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-write', {
    method: 'POST',
    body: input,
  });
  if (error) {
    if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 429) {
      throw new AiQuotaError('ai_quota');
    }
    // Turn the function's answer into a readable code, e.g. "ai_write 502 ai_error upstream 401".
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      const body = (await error.context.json().catch(() => null)) as { error?: unknown; upstream?: unknown } | null;
      const upstream = typeof body?.upstream === 'number' ? ` upstream ${body.upstream}` : '';
      throw new Error(`ai_write ${error.context.status} ${String(body?.error ?? 'unknown')}${upstream}`);
    }
    throw error;
  }
  const text = (data as { text?: unknown } | null)?.text;
  if (typeof text !== 'string' || text.trim().length === 0) throw new Error('ai_empty');
  return text.trim();
}
