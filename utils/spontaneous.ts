import type { EventTypeId, RsvpStatus, SpontaneousTemplate } from '@/types/event';
import type { Attendee, BillSplit, PlanItemKind } from '@/types/spontaneous';
import i18n from '@/utils/i18n';

/** Per-template look and the Plan tab's tool. Colors follow the prototype. */
export interface TemplateMeta {
  id: SpontaneousTemplate;
  planKind: PlanItemKind;
  /** Three-stop band, same role as EventTypeMeta.band. */
  band: readonly [string, string, string];
  bandInk: string;
  accent: string;
}

export const TEMPLATES: Record<SpontaneousTemplate, TemplateMeta> = {
  karaoke: {
    id: 'karaoke',
    planKind: 'song',
    band: ['#2B1B4F', '#7A2E8E', '#E8457A'],
    bandInk: '#FFFFFF',
    accent: '#E8457A',
  },
  party: {
    id: 'party',
    planKind: 'bring',
    band: ['#FFB547', '#FF7A3D', '#E8457A'],
    bandInk: '#FFFFFF',
    accent: '#E0601F',
  },
  tasting: {
    id: 'tasting',
    planKind: 'wine',
    band: ['#C2738C', '#8E2C48', '#4A1A2E'],
    bandInk: '#FFFFFF',
    accent: '#8E2C48',
  },
};

export function templateMeta(template: SpontaneousTemplate | null): TemplateMeta {
  return TEMPLATES[template ?? 'party'];
}

/**
 * Create-wizard step numbers. The plan comes right after the type (and the
 * spontaneous template), so the organizer knows what they unlock before
 * filling anything in; the cover theme comes just before the preview.
 */
type WizardStep = 'type' | 'template' | 'plan' | 'details' | 'venue' | 'theme' | 'preview';

export function wizardStep(type: EventTypeId | null, step: WizardStep): { step: number; total: number } {
  const order: WizardStep[] =
    type === 'spontaneous'
      ? ['type', 'template', 'plan', 'details', 'theme', 'preview']
      : type === 'venue'
        ? ['type', 'plan', 'details', 'venue', 'theme', 'preview']
        : ['type', 'plan', 'details', 'theme', 'preview'];
  // +1: the share screen after the event is created.
  return { step: order.indexOf(step) + 1, total: order.length + 1 };
}

/** "vineri, 30 octombrie · 21:00" in the app language; no year (the event is days away). */
export function formatSpontaneousWhen(date: string, startTime: string | null): string {
  const trimmed = date.trim();
  if (trimmed.length === 0) return i18n.t('common.dateToBeAnnounced');
  const parsed = new Date(trimmed);
  const day = Number.isNaN(parsed.getTime())
    ? trimmed
    : parsed.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = startTime?.trim() ?? '';
  return time.length > 0 ? `${day} · ${time}` : day;
}

/** People already taking a spot: confirmed guests plus their +1. Matches guard_spot_limit. */
export function spotsTaken(attendees: readonly Attendee[]): number {
  return attendees.filter((a) => a.status === 'confirmed').reduce((sum, a) => sum + 1 + (a.plusOne ? 1 : 0), 0);
}

/** Rounded up to the leu so the shares never come out short of the total. */
export function billPerPerson(bill: BillSplit): number {
  return Math.ceil(bill.totalAmount / Math.max(1, bill.peopleCount));
}

/** Host counts as paid; then every confirmed payment. */
export function billPaidCount(attendees: readonly Attendee[]): number {
  return 1 + attendees.filter((a) => a.billConfirmedAt !== null).length;
}

/** "AD" from "Ana Dumitru", "M" from "Mihai". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}` : (parts[0]?.[0] ?? '?');
  return letters.toUpperCase();
}

/** Avatar fills, from the prototype. Text on them is always dark ink. */
export const AVATAR_COLORS = ['#FFD23F', '#FF6B8A', '#C9A7F5', '#8FD3FE', '#7FD8B5', '#FFB547'] as const;
export const AVATAR_INK = '#2B2740';

/** Who gets the event tabs: confirmed guests, plus "maybe" on a spontaneous event. */
export function canOpenEventPage(type: EventTypeId, status: RsvpStatus): boolean {
  return status === 'confirmed' || (type === 'spontaneous' && status === 'maybe');
}

/** Typed digits → positive int, anything else → no limit. */
export function parseSpotLimit(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
