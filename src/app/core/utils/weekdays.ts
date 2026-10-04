const WEEK_DAYS = [
  { key: 'lunes', label: 'lunes' },
  { key: 'martes', label: 'martes' },
  { key: 'miercoles', label: 'miércoles' },
  { key: 'jueves', label: 'jueves' },
  { key: 'viernes', label: 'viernes' },
  { key: 'sabado', label: 'sábado' },
  { key: 'domingo', label: 'domingo' },
] as const;

const stripAccents = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** ['jueves','Lunes'] -> "Lunes y jueves"; all seven -> "Todos los días"; none -> "". */
export function joinWeekdays(listed: string[]): string {
  const set = new Set(listed.map(stripAccents));
  const names = WEEK_DAYS.filter(d => set.has(d.key)).map(d => d.label);
  if (names.length === 0) return '';
  if (names.length === WEEK_DAYS.length) return 'Todos los días';
  const text = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
