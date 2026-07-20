import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { SeoService } from '../../core/services/seo.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, DatePipe, IconComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);

  recentMusicians  = signal<any[]>([]);
  recentBands      = signal<any[]>([]);
  recentEvents     = signal<any[]>([]);
  recentVenues     = signal<any[]>([]);
  recentTeachers   = signal<any[]>([]);
  recentRehearsals = signal<any[]>([]);
  recentPosts      = signal<any[]>([]);
  recentListings   = signal<any[]>([]);

  loading      = signal(true);
  loadError    = signal(false);
  userCity     = signal('');
  userProfile  = signal<any>(null);
  userType     = signal('');

  today = new Date();

  readonly postTypeMap: Record<string, { label: string; icon: string }> = {
    musician_seeking_band: { label: 'Músico busca banda', icon: 'music'         },
    band_seeking_musician: { label: 'Banda busca músico', icon: 'mic'           },
    event_announcement:    { label: 'Anuncia un evento',  icon: 'calendar'      },
    session_offer:         { label: 'Ofrezco sesión',     icon: 'mic'           },
    gear_sale:             { label: 'Vendo equipamiento',  icon: 'shopping-cart' },
    looking_for_rehearsal: { label: 'Busco local ensayo', icon: 'headphones'    },
    collab:                { label: 'Busco colaboración', icon: 'users'         },
    other:                 { label: 'Anuncio',            icon: 'newspaper'     },
  };

  async ngOnInit() {
    this.seo.set({ title: 'Inicio', description: 'Músicos, bandas, salas y eventos cerca de ti. Conecta con la escena musical de España.' });

    try {
      const { data: { session } } = await this.supabase.auth.getSession();

      if (session) {
        const uid = session.user.id;
        const [{ data: m }, { data: b }, { data: v }, { data: t }, { data: r }] = await Promise.all([
          this.supabase.client.from('musicians').select('*').eq('user_id', uid).maybeSingle(),
          this.supabase.client.from('bands').select('*').eq('user_id', uid).maybeSingle(),
          this.supabase.client.from('venues').select('*').eq('user_id', uid).maybeSingle(),
          this.supabase.client.from('teachers').select('*').eq('user_id', uid).maybeSingle(),
          this.supabase.client.from('rehearsal_spaces').select('*').eq('user_id', uid).maybeSingle(),
        ]);
        const profilePairs: [any, string][] = [[m, 'musician'], [b, 'band'], [v, 'venue'], [t, 'teacher'], [r, 'rehearsal']];
        for (const [data, type] of profilePairs) {
          if (data) {
            this.userProfile.set(data);
            this.userType.set(type);
            this.userCity.set(data.city || '');
            break;
          }
        }
        if (this.userCity()) {
          try { localStorage.setItem('bandyou_city', this.userCity()); } catch {}
        }
      }

      const city = this.userCity();
      const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

      const [
        { data: musicians },
        { data: bands },
        { data: events },
        { data: venues },
        { data: teachers },
        { data: rehearsals },
        { data: posts },
        { data: listings },
      ] = await Promise.all([
        city
          ? this.supabase.client.from('musicians').select('*').eq('city', city).order('created_at', { ascending: false }).limit(12)
          : this.supabase.client.from('musicians').select('*').order('created_at', { ascending: false }).limit(12),
        city
          ? this.supabase.client.from('bands').select('*').eq('city', city).order('created_at', { ascending: false }).limit(12)
          : this.supabase.client.from('bands').select('*').order('created_at', { ascending: false }).limit(12),
        city
          ? this.supabase.client.from('events').select('*').eq('city', city).gte('date', todayStr).order('date', { ascending: true }).limit(5)
          : this.supabase.client.from('events').select('*').gte('date', todayStr).order('date', { ascending: true }).limit(5),
        city
          ? this.supabase.client.from('venues').select('*').eq('city', city).order('created_at', { ascending: false }).limit(5)
          : this.supabase.client.from('venues').select('*').order('created_at', { ascending: false }).limit(5),
        city
          ? this.supabase.client.from('teachers').select('*').eq('city', city).order('created_at', { ascending: false }).limit(5)
          : this.supabase.client.from('teachers').select('*').order('created_at', { ascending: false }).limit(5),
        city
          ? this.supabase.client.from('rehearsal_spaces').select('*').eq('city', city).order('created_at', { ascending: false }).limit(5)
          : this.supabase.client.from('rehearsal_spaces').select('*').order('created_at', { ascending: false }).limit(5),
        this.supabase.client.from('posts').select('*').order('created_at', { ascending: false }).limit(4),
        this.supabase.client.from('gear_listings').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(6),
      ]);

      const globalFallback = (table: string, limit: number, extraFilter?: (q: any) => any) => {
        let q = this.supabase.client.from(table).select('*').order('created_at', { ascending: false }).limit(limit);
        if (extraFilter) q = extraFilter(q);
        return q.then(({ data }) => data || []);
      };

      this.recentMusicians.set((musicians || []).slice(0, 6));
      this.recentBands.set((bands || []).slice(0, 6));
      this.recentEvents.set(events || []);
      this.recentVenues.set(venues || []);
      this.recentTeachers.set(teachers || []);
      this.recentRehearsals.set(rehearsals || []);
      this.recentPosts.set((posts || []).slice(0, 4));
      this.recentListings.set((listings || []).slice(0, 6));

      // Fallbacks run in background and update signals when ready
      if (city) {
        if ((musicians?.length ?? 0) < 6) {
          globalFallback('musicians', 12).then(d => this.recentMusicians.set(d.slice(0, 6)));
        }
        if ((bands?.length ?? 0) < 6) {
          globalFallback('bands', 12).then(d => this.recentBands.set(d.slice(0, 6)));
        }
        if ((events?.length ?? 0) < 2) {
          globalFallback('events', 5, q => q.gte('date', todayStr).order('date', { ascending: true })).then(d => this.recentEvents.set(d));
        }
        if ((venues?.length ?? 0) < 2) {
          globalFallback('venues', 5).then(d => this.recentVenues.set(d));
        }
        if ((teachers?.length ?? 0) < 2) {
          globalFallback('teachers', 5).then(d => this.recentTeachers.set(d));
        }
        if ((rehearsals?.length ?? 0) < 2) {
          globalFallback('rehearsal_spaces', 5).then(d => this.recentRehearsals.set(d));
        }
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadContent() {
    await this.ngOnInit();
  }

  retryLoad() {
    this.loadError.set(false);
    this.loading.set(true);
    this.loadContent();
  }

  private readonly AVATAR_COLORS = [
    '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
  ];

  avatarColor(name: string): string {
    const code = name?.charCodeAt(0) ?? 65;
    return this.AVATAR_COLORS[code % this.AVATAR_COLORS.length];
  }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  }

  postInfo(type: string) {
    return this.postTypeMap[type] ?? { label: 'Anuncio', icon: 'newspaper' };
  }

  isNearby(item: any): boolean {
    return !!this.userCity() && item.city === this.userCity();
  }
}
