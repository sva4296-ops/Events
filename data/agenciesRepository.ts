import { supabase } from '@/data/supabaseClient';
import type { Agency } from '@/types/event';
import type { AgencyRow } from '@/types/supabase';

/**
 * Supabase-backed agencies. hooks/useAgency.tsx is the only caller.
 * "Does this user own an agency" is answered by whether a row exists here, not
 * a separate account_type column on users — see CLAUDE.md §3.
 */

function mapAgencyRow(row: AgencyRow): Agency {
  return {
    id: row.id,
    companyName: row.company_name,
    cui: row.cui,
    registrationNumber: row.registration_number,
    address: row.address,
  };
}

/** Null for an individual account — RLS limits this to the caller's own row anyway. */
export async function fetchMyAgency(userId: string): Promise<Agency | null> {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data === null ? null : mapAgencyRow(data as AgencyRow);
}

export interface AgencyInfo {
  companyName: string;
  cui: string;
  registrationNumber?: string;
  address?: string;
}

/** Upgrades the signed-in user to a business account — app/agency-signup.tsx,
 * reached from Profile. Allowed by the "user can create own agency" insert
 * policy (20260821000001_agency_self_signup.sql), which only ever lets a
 * session insert a row for its own uid. */
export async function insertAgency(userId: string, info: AgencyInfo): Promise<Agency> {
  const { data, error } = await supabase
    .from('agencies')
    .insert({
      owner_user_id: userId,
      company_name: info.companyName,
      cui: info.cui,
      registration_number: info.registrationNumber ?? null,
      address: info.address ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapAgencyRow(data as AgencyRow);
}

/** Edits the signed-in user's existing agency row — app/edit-profile.tsx's
 * business-info section. Allowed by the "agency owner updates own agency"
 * policy (20260813000001_agencies.sql), scoped to owner_user_id = auth.uid()
 * the same way the insert policy is. */
export async function updateAgency(userId: string, info: AgencyInfo): Promise<Agency> {
  const { data, error } = await supabase
    .from('agencies')
    .update({
      company_name: info.companyName,
      cui: info.cui,
      registration_number: info.registrationNumber ?? null,
      address: info.address ?? null,
    })
    .eq('owner_user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return mapAgencyRow(data as AgencyRow);
}
