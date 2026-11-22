import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { COUNTRIES } from '../../../core/constants/regions';
import { countryByCode, parsePlace, placeValue, SPAIN } from '../../../core/utils/place';
import { SPAIN_COLS, SPAIN_TILES } from './spain-tiles';
import { activityBucket, ActivityBucket, loadSceneCounts, PlaceCounts, placeCounts, SceneCounts } from './scene-counts';

interface MapTile { value: string; label: string; code: string; col: number; row: number }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const countsText = (c: PlaceCounts) => [plural(c.musicians, 'músico', 'músicos'), plural(c.bands, 'banda', 'bandas'), plural(c.posts, 'anuncio', 'anuncios')];

/** Tile colors per activity step; ink text on paper and yellow, white on poster red. */
export const BUCKET_CLASS: Record<ActivityBucket | 'none', string> = {
  none: 'bg-dark-700 text-ink-muted border-ink/20',
  zero: 'bg-dark-800 text-ink-muted border-ink/20',
  low: 'bg-poster-yellow/40 text-ink border-ink/40',
  mid: 'bg-poster-yellow text-ink border-ink',
  high: 'bg-primary-500 text-white border-ink',
};

export const LEGEND: readonly { bucket: ActivityBucket; label: string }[] = [
  { bucket: 'zero', label: 'Nadie aún' }, { bucket: 'low', label: '1–2' }, { bucket: 'mid', label: '3–9' }, { bucket: 'high', label: '10 o más' },
];

/** "Mapa de la escena": musicians, bands and live ads per province (or region abroad), from /api/counts. */
@Component({
  selector: 'app-scene-map',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-map.component.html',
})
export class SceneMapComponent implements OnInit {
  private auth = inject(AuthService);

  readonly countries = [{ code: SPAIN, name: 'España' }, ...COUNTRIES.map(c => ({ code: c.code, name: c.name }))];
  readonly cols = SPAIN_COLS;
  readonly legend = LEGEND;
  readonly bucketClass = BUCKET_CLASS;
  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly country = signal(SPAIN);
  readonly counts = signal<SceneCounts | null>(null);
  readonly selected = signal<string | null>(null);
  readonly showAll = signal(false);

  readonly isSpain = computed(() => this.country() === SPAIN);
  readonly countryName = computed(() => this.countries.find(c => c.code === this.country())?.name ?? 'España');

  readonly tiles = computed<MapTile[]>(() => {
    if (this.isSpain()) return SPAIN_TILES.map(t => ({ value: t.name, label: t.name, code: t.code, col: t.col, row: t.row }));
    const regions = countryByCode(this.country())?.regions ?? [];
    return regions.map(r => ({ value: placeValue(this.country(), r), label: r, code: '', col: 0, row: 0 }));
  });

  /** Abroad: regions with people first (busiest first), the rest behind "Ver todas". */
  readonly regionsActive = computed(() => this.tiles().filter(t => this.total(t.value) > 0).sort((a, b) => this.total(b.value) - this.total(a.value)));
  readonly regionsRest = computed(() => this.tiles().filter(t => !this.total(t.value)));

  readonly summary = computed(() => {
    const c = this.counts();
    if (!c) return '';
    let people = 0, places = 0, posts = 0;
    for (const t of this.tiles()) {
      const p = placeCounts(c, t.value);
      people += p.musicians + p.bands;
      posts += p.posts;
      if (p.musicians + p.bands) places++;
    }
    if (!people && !posts) return `Aún no hay nadie en ${this.countryName()}.`;
    const where = this.isSpain() ? plural(places, 'provincia', 'provincias') : plural(places, 'región', 'regiones');
    return `${people === 1 ? '1 músico o banda' : `${people} músicos y bandas`} en ${where} · ${plural(posts, 'anuncio activo', 'anuncios activos')}`;
  });

  readonly panel = computed(() => {
    const value = this.selected();
    const tile = value ? this.tiles().find(t => t.value === value) : null;
    if (!tile) return null;
    const c = this.counts();
    const counts = c ? placeCounts(c, tile.value) : null;
    return { value: tile.value, label: tile.label, counts, text: counts ? countsText(counts).join(' · ') : '', empty: counts?.total === 0 };
  });

  async ngOnInit() {
    let city = '';
    try { city = localStorage.getItem('bandyou_city') ?? ''; } catch { /* storage blocked */ }
    const { country } = parsePlace(city);
    if (countryByCode(country)) this.country.set(country);
    this.counts.set(await loadSceneCounts());
  }

  setCountry(code: string) {
    this.country.set(code === SPAIN || countryByCode(code) ? code : SPAIN);
    this.selected.set(null);
    this.showAll.set(false);
  }

  select(value: string) { this.selected.update(v => (v === value ? null : value)); }

  total(value: string): number {
    const c = this.counts();
    return c ? placeCounts(c, value).total : 0;
  }

  tileClass(value: string): string {
    const c = this.counts();
    return BUCKET_CLASS[c ? activityBucket(placeCounts(c, value).total) : 'none'];
  }

  ariaLabel(t: MapTile): string {
    const c = this.counts();
    return c ? `${t.label}: ${countsText(placeCounts(c, t.value)).join(', ')}` : t.label;
  }
}
