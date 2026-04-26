import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
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

  recentMusicians  = signal<any[]>([]);
  recentBands      = signal<any[]>([]);
  recentEvents     = signal<any[]>([]);
  recentVenues     = signal<any[]>([]);
  recentTeachers   = signal<any[]>([]);
  recentRehearsals = signal<any[]>([]);
  recentPosts      = signal<any[]>([]);
  recentListings   = signal<any[]>([]);

  loading      = signal(true);
  profileName  = signal('');
  userCity     = signal('');
  userProfile  = signal<any>(null);
  userType     = signal('');
  profileScore = signal(0);
  missingFields = signal<string[]>([]);
  nudgeDismissed = false;

  today = new Date();

  readonly postTypeMap: Record<string, { label: string; emoji: string }> = {
    musician_seeking_band: { label: 'Músico busca banda', emoji: '🎸' },
    band_seeking_musician: { label: 'Banda busca músico', emoji: '🥁' },
    event_announcement:    { label: 'Anuncia un evento',  emoji: '📅' },
    session_offer:         { label: 'Ofrezco sesión',     emoji: '🎙️' },
    gear_sale:             { label: 'Vendo equipamiento',  emoji: '🎛️' },
    looking_for_rehearsal: { label: 'Busco local ensayo', emoji: '🏠' },
    collab:                { label: 'Busco colaboración', emoji: '🤝' },
    other:                 { label: 'Anuncio',            emoji: '📢' },
  };

  async ngOnInit() {
    const { data: { session } } = await this.supabase.auth.getSession();

    if (session) {
      const uid = session.user.id;
      const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'];
      const types  = ['musician', 'band', 'venue', 'teacher', 'rehearsal'];
      for (let i = 0; i < tables.length; i++) {
        const { data } = await this.supabase.client.from(tables[i]).select('*').eq('user_id', uid).maybeSingle();
        if (data) {
          this.userProfile.set(data);
          this.userType.set(types[i]);
          this.profileName.set(data.name || '');
          this.userCity.set(data.city || '');
          this.calculateCompleteness(data, types[i]);
          break;
        }
      }
    }

    const city = this.userCity();

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
        ? this.supabase.client.from('musicians').select('*').eq('city', city).order('created_at', { ascending: false }).limit(6)
        : this.supabase.client.from('musicians').select('*').order('created_at', { ascending: false }).limit(6),
      city
        ? this.supabase.client.from('bands').select('*').eq('city', city).order('created_at', { ascending: false }).limit(5)
        : this.supabase.client.from('bands').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('events').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(5),
      this.supabase.client.from('venues').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('teachers').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('rehearsal_spaces').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('posts').select('*').order('created_at', { ascending: false }).limit(6),
      this.supabase.client.from('gear_listings').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(4),
    ]);

    // If city-filtered results are too few, fall back to global
    const globalFallback = async (table: string, limit: number) => {
      const { data } = await this.supabase.client.from(table).select('*').order('created_at', { ascending: false }).limit(limit);
      return data || [];
    };

    this.recentMusicians.set(
      musicians && musicians.length >= 2 ? musicians : await globalFallback('musicians', 6)
    );
    this.recentBands.set(
      bands && bands.length >= 2 ? bands : await globalFallback('bands', 5)
    );
    this.recentEvents.set(events || []);
    this.recentVenues.set(venues || []);
    this.recentTeachers.set(teachers || []);
    this.recentRehearsals.set(rehearsals || []);
    this.recentPosts.set(posts || []);
    this.recentListings.set(listings || []);

    this.loading.set(false);
  }

  private calculateCompleteness(profile: any, type: string) {
    const checks: { field: string; label: string }[] = [
      { field: 'avatar_url',  label: 'Foto de perfil' },
      { field: 'description', label: 'Descripción / bio' },
      { field: 'city',        label: 'Ciudad' },
      { field: 'genre',       label: 'Género musical' },
    ];
    if (type === 'musician' || type === 'teacher') {
      checks.push({ field: 'instrument', label: 'Instrumento' });
    }
    if (type === 'teacher' || type === 'rehearsal') {
      checks.push({ field: 'hourly_rate', label: 'Precio por hora' });
    }
    if (type === 'venue' || type === 'rehearsal') {
      checks.push({ field: 'capacity', label: 'Capacidad' });
    }
    const missing = checks.filter(c => !profile[c.field]).map(c => c.label);
    this.missingFields.set(missing);
    this.profileScore.set(Math.round(((checks.length - missing.length) / checks.length) * 100));
  }

  dismissNudge() { this.nudgeDismissed = true; }

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
    return this.postTypeMap[type] ?? { label: 'Anuncio', emoji: '📢' };
  }

  isNearby(item: any): boolean {
    return !!this.userCity() && item.city === this.userCity();
  }
}
