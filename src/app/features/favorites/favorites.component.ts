import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
  loadError = signal(false);
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

  readonly filteredFavs = computed(() => {
    const tab = this.activeTab();
    const favs = this.favorites();
    return tab === 'all' ? favs : favs.filter(f => f.entity_type === tab);
  });

  readonly countByType = computed(() => {
    const counts: Record<string, number> = {};
    for (const f of this.favorites()) {
      counts[f.entity_type] = (counts[f.entity_type] ?? 0) + 1;
    }
    return counts;
  });

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

  typeIcon(type: string) {
    const map: Record<string, string> = {
      musician: 'music', band: 'mic', venue: 'building',
      event: 'calendar', teacher: 'book-open', rehearsal: 'headphones',
    };
    return map[type] || 'user';
  }

  private readonly AVATAR_COLORS = [
    '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
  ];

  avatarColor(name: string): string {
    const code = name?.charCodeAt(0) ?? 65;
    return this.AVATAR_COLORS[code % this.AVATAR_COLORS.length];
  }

  async ngOnInit() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) return;

      const favs = await this.favSvc.getByUser(session.user.id);
      this.favorites.set(favs);

      const groups: Record<string, string[]> = {};
      for (const f of favs) {
        (groups[f.entity_type] ??= []).push(f.entity_id);
      }

      const entries = Object.entries(groups).filter(([type]) => this.tableMap[type]);
      const results = await Promise.all(
        entries.map(([type, ids]) =>
          this.supabase.client.from(this.tableMap[type]).select('*').in('id', ids)
            .then(({ data }) => ({ type, data: data || [] }))
        )
      );
      const map: Record<string, any> = {};
      for (const { type, data } of results) {
        for (const it of data) map[`${type}:${it.id}`] = it;
      }
      this.resolved.set(map);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
