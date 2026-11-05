// Short AI-written texts for the app's text fields (welcome message, moment
// title, venue notes, the invitation line, menu dishes). Signed-in users only, with a daily quota per user.
//
// POST { kind, language, text, maxChars, context: { type, name, date, location, detail? } }
//   -> { text }            on success
//   -> { error: 'quota' }  (429) when the user used today's quota
//
// Secrets (never in the app or EAS):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Optional: AI_MODEL (default claude-haiku-5-5), AI_DAILY_LIMIT (default 150).
// Optional body.eventId: meters the call against that event's plan allowance
// (Esențial 10, Complet 100, Premium/Agenție 300); see consumeQuota.
// Deploy: supabase functions deploy ai-write


import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Kind = 'welcome' | 'moment' | 'venueNotes' | 'invite' | 'dish';
const KINDS: readonly Kind[] = ['welcome', 'moment', 'venueNotes', 'invite', 'dish'];
/** Kinds that only rework the organizer's own text and never start from nothing. */
const NEEDS_TEXT: readonly Kind[] = ['venueNotes', 'dish'];

const EVENT_TYPES: Record<string, string> = {
  wedding: 'nuntă',
  baptism: 'botez',
  birthday: 'zi de naștere',
  cause: 'eveniment caritabil',
  corporate: 'eveniment corporate',
  memorial: 'comemorare',
  other: 'eveniment',
  spontaneous: 'ieșire cu prietenii',
  venue: 'seară la un local',
};

/** AI calls per event, by plan; null plan = Esențial. Mirrored in utils/aiLimits.ts. */
const EVENT_LIMITS: Record<string, number> = { esential: 10, complet: 100, premium: 300, agentie: 300 };
/** Per-account daily abuse guard, whatever the plan. */
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '150');

/**
 * Counts one AI call: the account's daily cap, then (with an event) that
 * event's plan allowance. Returns the error response to send, or null.
 * 429 bodies say which limit: { error: 'quota', scope: 'daily' | 'event', limit }.
 */
// deno-lint-ignore no-explicit-any
async function consumeQuota(admin: any, userId: string, eventId: string | null): Promise<Response | null> {
  let eventLimit = 0;
  if (eventId !== null) {
    const { data: event } = await admin.from('events').select('organizer_id, plan_tier').eq('id', eventId).maybeSingle();
    if (event === null) return json({ error: 'not_found' }, 404);
    let organizer = event.organizer_id === userId;
    if (!organizer) {
      const { data: member } = await admin
        .from('event_members')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      organizer = member !== null;
    }
    if (!organizer) return json({ error: 'forbidden' }, 403);
    eventLimit = EVENT_LIMITS[event.plan_tier ?? 'esential'] ?? EVENT_LIMITS.esential;
  }

  const { data: dailyOk, error: dailyError } = await admin.rpc('consume_ai_quota', { p_user_id: userId, p_limit: DAILY_LIMIT });
  if (dailyError) {
    // Shows in Dashboard > Edge Functions > ai-write > Logs.
    console.error('consume_ai_quota failed', dailyError.message);
    return json({ error: 'server_error' }, 500);
  }
  if (dailyOk !== true) return json({ error: 'quota', scope: 'daily', limit: DAILY_LIMIT }, 429);

  if (eventId !== null) {
    const { data: eventOk, error: eventError } = await admin.rpc('consume_ai_event_quota', {
      p_event_id: eventId,
      p_limit: eventLimit,
    });
    if (eventError) {
      console.error('consume_ai_event_quota failed', eventError.message);
      await refund(admin, userId, null);
      return json({ error: 'server_error' }, 500);
    }
    if (eventOk !== true) {
      await refund(admin, userId, null);
      return json({ error: 'quota', scope: 'event', limit: eventLimit }, 429);
    }
  }
  return null;
}

/** Gives the call back when the AI request failed (best effort). */
// deno-lint-ignore no-explicit-any
async function refund(admin: any, userId: string, eventId: string | null): Promise<void> {
  const { error } = await admin.rpc('refund_ai_quota', { p_user_id: userId, p_event_id: eventId });
  if (error) console.error('refund_ai_quota failed', error.message);
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Trims and caps user-supplied strings so a request can't blow up the prompt. */
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

const RULES_RO = [
  'Scrii în limba română, cu diacritice, natural și cald, ca un om, nu ca o reclamă.',
  'Răspunzi DOAR cu textul cerut: fără ghilimele, fără titlu, fără explicații, fără markdown.',
  'Nu inventa fapte (ore, adrese, nume, detalii) care nu apar în date.',
  'Folosește cel mult un emoji, sau niciunul.',
  'Pentru o comemorare, tonul e sobru și respectuos, fără emoji.',
].join('\n');

const RULES_EN = [
  'Write in English, natural and warm, like a person, not an ad.',
  'Reply ONLY with the requested text: no quotes, no title, no explanations, no markdown.',
  "Don't invent facts (times, addresses, names, details) that aren't in the data.",
  'Use at most one emoji, or none.',
  'For a memorial, keep the tone sober and respectful, with no emoji.',
].join('\n');

function buildPrompt(kind: Kind, ro: boolean, text: string, maxChars: number, context: Record<string, string>): string {
  const label = ro
    ? { type: 'Tip eveniment', name: 'Nume', date: 'Data', location: 'Locație', draft: 'Textul organizatorului' }
    : { type: 'Event type', name: 'Name', date: 'Date', location: 'Location', draft: "The organizer's text" };
  const lines = [
    `${label.type}: ${ro ? (EVENT_TYPES[context.type] ?? 'eveniment') : context.type || 'event'}`,
    context.name ? `${label.name}: ${context.name}` : '',
    context.date ? `${label.date}: ${context.date}` : '',
    context.location ? `${label.location}: ${context.location}` : '',
    context.time ? `${ro ? 'Ora' : 'Time'}: ${context.time}` : '',
    context.activity ? `${ro ? 'Activitate' : 'Activity'}: ${context.activity}` : '',
    // The cover theme sets the mood (e.g. "Neon", "Elegant", "Crăciun").
    context.theme ? `${ro ? 'Tema vizuală (stare, ton)' : 'Visual theme (mood, tone)'}: ${context.theme}` : '',
  ].filter(Boolean);
  const data = lines.join('\n');
  const draft = text.length > 0 ? `\n\n${label.draft}:\n${text}` : '';
  const limitLine = (extra: string) =>
    ro ? `Maxim ${maxChars} de caractere${extra}.` : `At most ${maxChars} characters${extra}.`;

  if (kind === 'welcome') {
    const task =
      text.length > 0
        ? ro
          ? `Îmbunătățește mesajul scurt al organizatorului de pe invitație, păstrând ce a vrut să spună. Fă-l mai cald și mai concis.`
          : `Improve the organizer's short invitation message, keeping what they meant. Make it warmer and tighter.`
        : ro
          ? `Scrie mesajul scurt de pe invitație, din partea organizatorilor, potrivit cu numele, tipul și tema vizuală a evenimentului.`
          : `Write the short message on the invitation, from the organizers, matching the event's name, type and visual theme.`;
    // Shown on the invitation card under the name: short, no date or place (already on the card).
    const constraints = ro
      ? `1-2 propoziții scurte. Fără dată, oră sau locație: apar deja pe invitație. Tonul după tema vizuală și tipul evenimentului.`
      : `1-2 short sentences. No date, time or place: they're already on the invitation. Tone follows the visual theme and event type.`;
    return `${task}\n${constraints}\n${limitLine('')}\n\n${data}${draft}`;
  }

  if (kind === 'moment') {
    const task =
      text.length > 0
        ? ro
          ? `Rescrie titlul acestui moment postat de organizator pentru invitați, mai frumos și scurt.`
          : `Rewrite the title of this moment the organizer posts for guests, nicer and short.`
        : ro
          ? `Propune un titlu scurt pentru un moment (o actualizare cu poză) pe care organizatorul îl postează pentru invitați înainte de eveniment.`
          : `Suggest a short title for a moment (an update with a photo) the organizer posts for guests before the event.`;
    return `${task}\n${limitLine(ro ? ', o singură propoziție' : ', one sentence')}\n\n${data}${draft}`;
  }

  if (kind === 'invite') {
    // The app adds the greeting ("Bună Maria!"), date, place and the personal
    // link around this line, so it must contain none of them.
    const task =
      text.length > 0
        ? ro
          ? `Îmbunătățește fraza de invitație scrisă de organizator. Se trimite pe WhatsApp fiecărui invitat, după salutul cu numele lui.`
          : `Improve the organizer's invitation line. It's sent on WhatsApp to each guest, right after a greeting with their name.`
        : ro
          ? `Scrie fraza de invitație pe care organizatorul o trimite pe WhatsApp fiecărui invitat, după salutul cu numele lui.`
          : `Write the invitation line the organizer sends on WhatsApp to each guest, right after a greeting with their name.`;
    const constraints = ro
      ? `Te adresezi unei singure persoane, cu „tu” (ex. „te invităm”). Menționează numele evenimentului. Fără salut, fără dată, fără locație, fără link: aplicația le adaugă singură. 1-2 propoziții.`
      : `Address one person directly ("we'd love you to join"). Mention the event's name. No greeting, no date, no place, no link: the app adds them. 1-2 sentences.`;
    return `${task}\n${constraints}\n${limitLine('')}\n\n${data}${draft}`;
  }

  if (kind === 'dish') {
    // Guests with allergies read this: never add ingredients.
    const task = ro
      ? `Reformulează frumos și apetisant descrierea acestui fel din meniu, pentru invitați. NU adăuga ingrediente, garnituri sau detalii care nu apar în textul organizatorului; doar formulează mai frumos ce a scris. Fără numele felului la început.`
      : `Rephrase this menu dish nicely and appetizingly for guests. Do NOT add ingredients, sides or details that aren't in the organizer's text; only phrase what they wrote more nicely. Don't start with the course name.`;
    const course = context.detail ? (ro ? `Felul: ${context.detail}\n` : `Course: ${context.detail}\n`) : '';
    return `${task}\n${limitLine(ro ? ', o singură propoziție' : ', one sentence')}\n\n${course}${data}${draft}`;
  }

  // venueNotes: only tidy what the organizer wrote, never add information.
  const task = ro
    ? `Aranjează notele practice ale organizatorului despre locație (parcare, acces, ținută etc.) ca listă clară pentru invitați: o notă pe rând, fără liniuțe sau numerotare. Nu adăuga informații noi, doar reformulează și corectează.`
    : `Tidy the organizer's practical notes about the venue (parking, access, dress code, etc.) into a clear list for guests: one note per line, no bullets or numbers. Don't add new information, only rephrase and correct.`;
  return `${task}\n${limitLine(ro ? ' în total' : ' in total')}\n\n${data}${draft}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (apiKey.length === 0) return json({ error: 'not_configured' }, 503);

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (jwt.length === 0) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // The user always comes from the verified token, never from the body.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || userData.user === null) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const kind = body.kind as Kind;
  if (!KINDS.includes(kind)) return json({ error: 'bad_request' }, 400);
  const ro = body.language !== 'en';
  const text = clean(body.text, 1500);
  if (NEEDS_TEXT.includes(kind) && text.length === 0) return json({ error: 'bad_request' }, 400);
  const maxChars = Math.min(Math.max(Number(body.maxChars) || 300, 40), 600);
  const rawContext = (body.context ?? {}) as Record<string, unknown>;
  const context = {
    type: clean(rawContext.type, 20),
    name: clean(rawContext.name, 120),
    date: clean(rawContext.date, 40),
    location: clean(rawContext.location, 160),
    detail: clean(rawContext.detail, 60),
    time: clean(rawContext.time, 10),
    activity: clean(rawContext.activity, 40),
    theme: clean(rawContext.theme, 40),
  };

  const userId = userData.user.id;
  const eventId = clean(body.eventId, 40) || null;
  const denied = await consumeQuota(admin, userId, eventId);
  if (denied !== null) return denied;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5',
      max_tokens: 1024,
      system: ro ? RULES_RO : RULES_EN,
      messages: [{ role: 'user', content: buildPrompt(kind, ro, text, maxChars, context) }],
    }),
  });
  if (!res.ok) {
    // Anthropic's reason (bad key, no credits, unknown model...) goes to the
    // function logs; the app only gets the status code, never the body.
    console.error('anthropic error', res.status, (await res.text()).slice(0, 500));
    await refund(admin, userId, eventId);
    return json({ error: 'ai_error', upstream: res.status }, 502);
  }

  const result = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  const output = (result.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim()
    .replace(/^["„“]+|["”"]+$/g, '')
    .slice(0, maxChars);
  if (output.length === 0) {
    // Why the answer had no text (e.g. "refusal", "max_tokens", or only non-text blocks).
    const reason = `${result.stop_reason ?? 'none'}:${(result.content ?? []).map((block) => block.type).join('+') || 'empty'}`;
    console.error('empty AI answer', reason);
    await refund(admin, userId, eventId);
    return json({ error: 'ai_error', reason }, 502);
  }

  return json({ text: output }, 200);
});
