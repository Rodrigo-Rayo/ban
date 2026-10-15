/** A line-up row in the band form. `id` once saved; `linked` when the member joined with their own profile. */
export interface MemberDraft {
  id?: string;
  name: string;
  instrument: string;
  linked?: boolean;
}

export interface MemberSavePlan {
  remove: string[];
  update: { id: string; name: string; instrument: string }[];
  insert: { name: string; instrument: string }[];
}

/**
 * What saving the band form does to band_members: keep the rows that are still
 * there (so a member linked through an invite stays linked), rename the ones
 * that changed, add the new ones and delete the rows taken out of the form.
 * A new row without a name or an instrument is skipped; a saved one left blank
 * keeps its old values (never deleted by accident: it may be linked). Never an
 * upsert: the table only allows writing name and instrument
 * (supabase/2026_10_band_invites.sql).
 */
export function planMemberSave(
  saved: readonly { id: string; name: string; instrument: string | null }[],
  drafts: readonly MemberDraft[],
): MemberSavePlan {
  const before = new Map(saved.map(s => [s.id, s]));
  const kept = new Set(drafts.filter(d => d.id && before.has(d.id)).map(d => d.id!));
  const valid = drafts
    .map(d => ({ ...d, name: d.name.trim() }))
    .filter(d => d.name && d.instrument);
  return {
    remove: saved.filter(s => !kept.has(s.id)).map(s => s.id),
    update: valid
      .filter(d => d.id && kept.has(d.id))
      .filter(d => before.get(d.id!)!.name !== d.name || (before.get(d.id!)!.instrument ?? '') !== d.instrument)
      .map(d => ({ id: d.id!, name: d.name, instrument: d.instrument })),
    insert: valid.filter(d => !d.id || !before.has(d.id)).map(d => ({ name: d.name, instrument: d.instrument })),
  };
}
