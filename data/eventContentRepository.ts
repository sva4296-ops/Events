import type {
  Contribution,
  EventContent,
  Fund,
  Message,
  Moment,
  MomentReaction,
  Photo,
  ReactionType,
} from '@/types/guest';
import { createId } from '@/utils/id';

/** Who is acting — always the authenticated user, never a hardcoded identity. */
export interface Actor {
  id: string;
  label: string;
}

export interface FundDraft {
  title: string;
  description: string;
  target_amount: number;
  currency: string;
}

/**
 * The seam between the guest screens and wherever the data really lives.
 * Today: empty local state — a new event genuinely has no content until the
 * organizer creates some. Next pass: Supabase queries + realtime channels.
 * Screens only ever touch this interface, so the swap stays contained here.
 */
export interface EventContentRepository {
  load: (eventId: string) => Promise<EventContent>;
  sendMessage: (eventId: string, content: string, actor: Actor) => Message;
  toggleReaction: (momentId: string, reaction: ReactionType, actor: Actor) => MomentReaction;
  addPhoto: (eventId: string, url: string, actor: Actor) => Photo;
  contribute: (fundId: string, amount: number, actor: Actor) => Contribution;
  createMoment: (eventId: string, title: string, photoUrl: string, actor: Actor) => Moment;
  createFund: (eventId: string, input: FundDraft) => Fund;
}

export const localRepository: EventContentRepository = {
  load: async (eventId) => ({
    moments: [],
    reactions: [],
    messages: [],
    photos: [],
    fund: null,
    contributions: [],
    schedule: [],
    venue: { event_id: eventId, name: '', address: '', notes: [], map_image_url: '' },
    menu: null,
    seatingTables: [],
    accommodations: [],
    vendors: [],
  }),

  sendMessage: (eventId, content, actor) => ({
    id: createId(),
    event_id: eventId,
    sender_id: actor.id,
    sender_label: actor.label,
    content,
    created_at: new Date().toISOString(),
  }),

  toggleReaction: (momentId, reaction, actor) => ({
    id: createId(),
    moment_id: momentId,
    user_id: actor.id,
    reaction_type: reaction,
  }),

  addPhoto: (eventId, url, actor) => ({
    id: createId(),
    event_id: eventId,
    uploaded_by: actor.id,
    uploaded_by_label: actor.label,
    url,
    created_at: new Date().toISOString(),
  }),

  contribute: (fundId, amount, actor) => ({
    id: createId(),
    fund_id: fundId,
    contributor_name: actor.label,
    amount,
    stripe_payment_id: null,
    created_at: new Date().toISOString(),
  }),

  createMoment: (eventId, title, photoUrl, actor) => ({
    id: createId(),
    event_id: eventId,
    organizer_id: actor.id,
    title,
    photo_url: photoUrl,
    created_at: new Date().toISOString(),
  }),

  createFund: (eventId, input) => ({
    id: createId(),
    event_id: eventId,
    current_amount: 0,
    ...input,
  }),
};
