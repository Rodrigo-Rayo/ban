import { Component, signal, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

type MapLayer = 'musicians' | 'venues' | 'rehearsal' | 'bands';

interface MapItem {
  id: string;
  name: string;
  city: string;
  type: MapLayer;
  subtitle?: string;
  available?: boolean;
}

const CITY_COORDS: Record<string, [number, number]> = {
  'Madrid':    [40.4168, -3.7038],
  'Barcelona': [41.3874,  2.1686],
  'Valencia':  [39.4699, -0.3763],
  'Sevilla':   [37.3891, -5.9845],
  'Bilbao':    [43.2630, -2.9350],
  'Málaga':    [36.7213, -4.4214],
  'Zaragoza':  [41.6561, -0.8773],
  'Otra':      [40.2000, -3.5000],
};

const LAYER_COLORS: Record<MapLayer, string> = {
  musicians: '#d94e1a',
  bands:     '#7c3aed',
  venues:    '#0891b2',
  rehearsal: '#059669',
};

const LAYER_LABELS: Record<MapLayer, string> = {
  musicians: 'Músicos',
  bands:     'Bandas',
  venues:    'Salas',
  rehearsal: 'Locales ensayo',
};

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './map.component.html',
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private map: any = null;
  private markersLayer: any = null;
  private L: any = null;

  loading = signal(true);
  selectedCity = signal('Toda España');
  mapHeight = `${window.innerHeight - 128}px`;
  activeLayers = signal<Set<MapLayer>>(new Set(['musicians', 'bands', 'venues', 'rehearsal']));

  allItems = signal<MapItem[]>([]);
  selectedItem = signal<MapItem | null>(null);

  readonly cities = ['Toda España', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];
  readonly layers: MapLayer[] = ['musicians', 'bands', 'venues', 'rehearsal'];
  readonly layerLabels = LAYER_LABELS;
  readonly layerColors = LAYER_COLORS;

  async ngOnInit() {
    await this.loadAllItems();
  }

  async ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.initMap();
    }
  }

  private async initMap() {
    this.L = await import('leaflet');
    const L = this.L;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [40.4168, -3.7038],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    setTimeout(() => this.map.invalidateSize(), 100);
    this.renderMarkers();
  }

  private async loadAllItems() {
    const [
      { data: musicians },
      { data: bands },
      { data: venues },
      { data: rehearsals },
    ] = await Promise.all([
      this.supabase.client.from('musicians').select('id,name,city,instrument,available'),
      this.supabase.client.from('bands').select('id,name,city,genre'),
      this.supabase.client.from('venues').select('id,name,city'),
      this.supabase.client.from('rehearsal_spaces').select('id,name,city,hourly_rate'),
    ]);

    const items: MapItem[] = [
      ...(musicians || []).map((m: any) => ({ id: m.id, name: m.name, city: m.city, type: 'musicians' as MapLayer, subtitle: m.instrument, available: m.available })),
      ...(bands || []).map((b: any) => ({ id: b.id, name: b.name, city: b.city, type: 'bands' as MapLayer, subtitle: b.genre })),
      ...(venues || []).map((v: any) => ({ id: v.id, name: v.name, city: v.city, type: 'venues' as MapLayer })),
      ...(rehearsals || []).map((r: any) => ({ id: r.id, name: r.name, city: r.city, type: 'rehearsal' as MapLayer, subtitle: r.hourly_rate ? `${r.hourly_rate}€/h` : undefined })),
    ].filter(item => item.city && CITY_COORDS[item.city]);

    this.allItems.set(items);
    this.loading.set(false);

    if (this.markersLayer) this.renderMarkers();
  }

  renderMarkers() {
    if (!this.map || !this.markersLayer || !this.L) return;
    this.markersLayer.clearLayers();

    const L = this.L;
    const city = this.selectedCity();
    const active = this.activeLayers();

    const grouped: Record<string, MapItem[]> = {};
    for (const item of this.allItems()) {
      if (!active.has(item.type)) continue;
      if (city !== 'Toda España' && item.city !== city) continue;
      if (!grouped[item.city]) grouped[item.city] = [];
      grouped[item.city].push(item);
    }

    for (const [cityName, items] of Object.entries(grouped)) {
      const coords = CITY_COORDS[cityName];
      if (!coords) continue;

      const byType: Partial<Record<MapLayer, MapItem[]>> = {};
      for (const item of items) {
        if (!byType[item.type]) byType[item.type] = [];
        byType[item.type]!.push(item);
      }

      const typesPresent = Object.keys(byType) as MapLayer[];
      const offset = 0.015;
      typesPresent.forEach((type, idx) => {
        const typeItems = byType[type]!;
        const angle = (idx / typesPresent.length) * 2 * Math.PI;
        const jitter: [number, number] = typesPresent.length > 1
          ? [coords[0] + Math.sin(angle) * offset, coords[1] + Math.cos(angle) * offset]
          : [coords[0], coords[1]];

        const color = LAYER_COLORS[type];
        const count = typeItems.length;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:${color};
            color:white;
            width:${count > 9 ? 36 : 30}px;
            height:${count > 9 ? 36 : 30}px;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:12px;
            font-weight:700;
            box-shadow:0 2px 8px rgba(0,0,0,0.4);
            border:2px solid rgba(255,255,255,0.25);
            cursor:pointer;
          ">${count}</div>`,
          iconSize: [count > 9 ? 36 : 30, count > 9 ? 36 : 30],
          iconAnchor: [count > 9 ? 18 : 15, count > 9 ? 18 : 15],
        });

        const listHtml = typeItems.slice(0, 8).map(item => {
          const route = this.getRoute(item);
          return `<div style="padding:3px 0;border-bottom:1px solid rgba(0,0,0,0.08)">
            <a href="${route}" style="font-size:12px;font-weight:600;color:#1a150e;text-decoration:none">${item.name}</a>
            ${item.subtitle ? `<span style="font-size:11px;color:#7a6a5a;margin-left:4px">${item.subtitle}</span>` : ''}
          </div>`;
        }).join('');

        const more = typeItems.length > 8 ? `<p style="font-size:11px;color:#7a6a5a;margin-top:4px">+${typeItems.length - 8} más</p>` : '';

        const popup = L.popup({ maxWidth: 240 }).setContent(`
          <div style="font-family:system-ui;padding:2px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${color};margin-bottom:6px">
              ${LAYER_LABELS[type]} · ${cityName}
            </div>
            ${listHtml}
            ${more}
          </div>
        `);

        L.marker(jitter, { icon }).bindPopup(popup).addTo(this.markersLayer);
      });
    }
  }

  private getRoute(item: MapItem): string {
    const map: Record<MapLayer, string> = {
      musicians: 'musicians', bands: 'bands', venues: 'venues', rehearsal: 'rehearsal',
    };
    return `/${map[item.type]}/${item.id}`;
  }

  toggleLayer(layer: MapLayer) {
    const set = new Set(this.activeLayers());
    if (set.has(layer)) set.delete(layer);
    else set.add(layer);
    this.activeLayers.set(set);
    this.renderMarkers();
  }

  onCityChange(city: string) {
    this.selectedCity.set(city);
    if (city !== 'Toda España' && CITY_COORDS[city] && this.map) {
      this.map.setView(CITY_COORDS[city], 12);
    } else if (this.map) {
      this.map.setView([40.4168, -3.7038], 6);
    }
    this.renderMarkers();
  }

  countsForCity(city: string, layer: MapLayer): number {
    return this.allItems().filter(i => i.type === layer && (city === 'Toda España' || i.city === city)).length;
  }

  totalVisible() {
    const city = this.selectedCity();
    const active = this.activeLayers();
    return this.allItems().filter(i => active.has(i.type) && (city === 'Toda España' || i.city === city)).length;
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
