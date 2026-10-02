/**
 * Gear condition values. The form stores the English ids, but older/seed listings
 * were saved with Spanish values ("bueno", "muy bueno", "como nuevo"), so filters
 * and labels must accept every alias.
 */
export interface GearConditionOption {
  id: string;
  label: string;
  /** Every value that may be stored in gear_listings.condition for this option. */
  values: string[];
  /** Legacy-only values are filterable/displayable but not offered in the form. */
  legacy?: boolean;
}

export const GEAR_CONDITIONS: readonly GearConditionOption[] = [
  { id: 'new',        label: 'Nuevo',      values: ['new', 'nuevo'] },
  { id: 'like_new',   label: 'Como nuevo', values: ['like_new', 'como nuevo'] },
  { id: 'very_good',  label: 'Muy bueno',  values: ['very_good', 'muy bueno'], legacy: true },
  { id: 'good',       label: 'Bueno',      values: ['good', 'bueno'] },
  { id: 'acceptable', label: 'Aceptable',  values: ['acceptable', 'aceptable'] },
];

/** Options shown when creating/editing a listing (no legacy-only values). */
export const GEAR_CONDITION_FORM_OPTIONS = GEAR_CONDITIONS.filter(c => !c.legacy);

function find(value: string | null | undefined): GearConditionOption | undefined {
  const v = (value ?? '').trim().toLowerCase();
  return GEAR_CONDITIONS.find(c => c.id === v || c.values.includes(v));
}

/** Human label for any stored condition value ("bueno" and "good" → "Bueno"). */
export function gearConditionLabel(value: string | null | undefined): string {
  const opt = find(value);
  if (opt) return opt.label;
  const v = (value ?? '').trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
}

/** Stored values to match when filtering by a condition id (for `.in('condition', …)`). */
export function gearConditionValues(id: string): string[] {
  return find(id)?.values ?? [id];
}
