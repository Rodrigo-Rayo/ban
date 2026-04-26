import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FavoritesService } from '../../core/services/favorites.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [RouterLink, CommonModule, IconComponent],
  templateUrl: './favorites.component.html',
})
export class FavoritesComponent implements OnInit {
  private favSvc = inject(FavoritesService);
  private supabase = inject(SupabaseService);

  loading = signal(true);
  activeTab = signal('all');
  favorites = signal<any[]>([]);
  resolved = signal<Record<string, any>>({});

  readonly tabs = [
    { id: 'all',       label: 'Todo' },
    { id: 'musician',  label: 'Músicos' },
    { id: 'band',      label: 'Bandas' },
    { id: 'venue',     label: 'Salas' },
    { id: 'event',     label: 'Eventos' },
    { id: 'teacher',   label: 'Clases' },
    { id: 'rehearsal', label: 'Locales' },
  ];

  readonly tableMap: Record<string, string> = {
    musician: 'musicians', band: 'bands', venue: 'venues',
    event: 'events', teacher: 'teachers', rehearsal: 'rehearsal_spaces',
  };

  readonly routeMap: Record<string, string> = {
    musician: '/musicians', band: '/bands', venue: '/venues',
    event: '/events', teacher: '/teachers', rehearsal: '/rehearsal',
  };

  get filteredFavs() {
    const tab = this.activeTab();
    return tab === 'all' ? this.favorites() : this.favorites().filter(f => f.entity_type === tab);
  }

  countFor(type: string) {
    return this.favorites().filter(f => f.entity_type === type).length;
  }

  item(fav: any) {
    return this.resolved()[`${fav.entity_type}:${fav.entity_id}`] || null;
  }

  route(fav: any) {
    return [this.routeMap[fav.entity_type] || '/', fav.entity_id];
  }

  typeLabel(type: string) {
    const map: Record<string, string> = {
      musician: 'Músico', band: 'Banda', venue: 'Sala',
      event: 'Evento', teacher: 'Clase', rehearsal: 'Local',
    };
    return map[type] || type;
  }

  async ngOnInit() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) { this.loading.set(false); return; }

    const favs = await this.favSvc.getByUser(session.user.id);
    this.favorites.set(favs);

    const groups: Record<string, string[]> = {};
    for (const f of favs) {
      (groups[f.entity_type] ??= []).push(f.entity_id);
    }

    const map: Record<string, any> = {};
    for (const [type, ids] of Object.entries(groups)) {
      const table = this.tableMap[type];
      if (!table) continue;
      const { data } = await this.supabase.client.from(table).select('*').in('id', ids);
      for (const it of data || []) map[`${type}:${it.id}`] = it;
    }
    this.resolved.set(map);
    this.loading.set(false);
  }
}
