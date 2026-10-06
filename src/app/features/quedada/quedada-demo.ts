import { cycleKey, drawAt, madridMonth } from '../../core/utils/quedada-cycle';
import type { QuedadaComment, QuedadaEntry, QuedadaEvent, QuedadaPerson, QuedadaWinner } from './quedada.service';

/**
 * Fake data for trying "La quedada" locally (/quedada?demo=…, /home?demo=…).
 * Never used in production builds (see readDemo in quedada.service.ts).
 */
export const DEMO_STATES = ['inscripcion', 'ganador', 'vacio'] as const;
export type DemoState = typeof DEMO_STATES[number];

export interface DemoStore {
  now: Date;
  entries: QuedadaEntry[];
  winner: QuedadaWinner | null;
  myEvents: QuedadaEvent[];
  myEntry: { id: string; event_id: string } | null;
  people: QuedadaPerson[];
  going: boolean;
  comments: QuedadaComment[];
}

const DAY = 86_400_000;

/** A made-up gig poster (SVG data URL), so the demo shows the poster slot. */
const DEMO_POSTER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#c23a1f"/><circle cx="230" cy="90" r="120" fill="#e8b931" opacity=".9"/><rect x="0" y="250" width="300" height="150" fill="#141210"/><text x="20" y="215" font-family="Impact,Anton,sans-serif" font-size="58" fill="#141210">LOS</text><text x="20" y="300" font-family="Impact,Anton,sans-serif" font-size="46" fill="#f2ebdd">DESAFINADOS</text><text x="20" y="345" font-family="monospace" font-size="16" font-weight="bold" fill="#e8b931">RUIDO BLANCO · EN DIRECTO</text><text x="20" y="372" font-family="monospace" font-size="14" fill="#f2ebdd">SALA CLAMORES · MADRID</text></svg>');
const iso = (d: Date) => d.toISOString().slice(0, 10);

function event(id: string, title: string, owner: string, date: Date, venue: string): QuedadaEvent {
  return { id, user_id: 'u-' + id, title, owner_name: owner, venue, city: 'Madrid', date: iso(date), time: '21:30', image_url: null };
}

export function demoData(state: DemoState): DemoStore {
  const month = madridMonth(new Date());
  const draw = drawAt(month);
  // Inscription states sit 4 days before the draw; winner states after it.
  const now = state === 'inscripcion' || state === 'vacio'
    ? new Date(draw.getTime() - 4 * DAY + 3 * 3_600_000)
    : new Date(draw.getTime() + 2 * DAY);
  const gig = new Date(now.getTime() + 6 * DAY + 5 * 3_600_000);

  const entries: QuedadaEntry[] = state === 'vacio' ? [] : [
    { id: 'e1', user_id: 'u-1', created_at: '', event: { ...event('1', 'Presentación de "Ruido Blanco"', 'Los Desafinados', gig, 'Sala Clamores'), image_url: DEMO_POSTER } },
    { id: 'e2', user_id: 'u-2', created_at: '', event: event('2', 'Jam de funk', 'Groove Machine', new Date(gig.getTime() + 3 * DAY), 'El Junco') },
    { id: 'e3', user_id: 'u-3', created_at: '', event: event('3', 'Acústico en el barrio', 'Marilyn', new Date(gig.getTime() + 5 * DAY), 'La Fídula') },
  ];
  const people: QuedadaPerson[] = ['Álvaro Villoldo', 'Marilyn', 'Borja Llamas', 'Rocker', 'Miguel', 'alerinaldi', 'CompositorMusical']
    .map((name, i) => ({ user_id: 'p' + i, name, avatar_url: null, profile_type: 'musician', profile_id: null }));

  return {
    now,
    entries,
    winner: state === 'ganador'
      ? { cycle: cycleKey(month), province: 'Madrid', entries_count: 3, event: entries[0].event }
      : null,
    myEvents: [event('mine', 'Concierto en Moby Dick', 'Tu banda', new Date(gig.getTime() + 2 * DAY), 'Moby Dick Club')],
    myEntry: null,
    people,
    going: false,
    comments: state === 'inscripcion' || state === 'vacio' ? [] : [
      { id: 'c1', user_id: 'p1', text: '¡Qué ganas! ¿Alguien de Getafe para ir juntos?', created_at: new Date(now.getTime() - 5 * 3_600_000).toISOString(), author_name: 'Marilyn', author_avatar: null, author_profile_type: 'musician', author_profile_id: null },
      { id: 'c2', user_id: 'p2', text: 'Yo voy seguro, os vi en el Clamores el año pasado y fue brutal 🤘', created_at: new Date(now.getTime() - 2 * 3_600_000).toISOString(), author_name: 'Borja Llamas', author_avatar: null, author_profile_type: 'musician', author_profile_id: null },
    ],
  };
}
