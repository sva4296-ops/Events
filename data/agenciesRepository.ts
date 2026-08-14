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
