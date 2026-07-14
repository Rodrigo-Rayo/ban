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
  profileName  = signal('');
  userCity     = signal('');
  userProfile  = signal<any>(null);
  userType     = signal('');
  profileScore = signal(0);
  missingFields = signal<string[]>([]);
  nudgeDismissed = false;

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
        ? this.supabase.client.from('bands').select('*').eq('city', city).order('created_at', { ascending: false }).limit(6)
        : this.supabase.client.from('bands').select('*').order('created_at', { ascending: false }).limit(6),
      this.supabase.client.from('events').select('*').gte('date', (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()).order('date', { ascending: true }).limit(5),
      this.supabase.client.from('venues').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('teachers').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('rehearsal_spaces').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('posts').select('*').order('created_at', { ascending: false }).limit(4),
      this.supabase.client.from('gear_listings').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(6),
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
      bands && bands.length >= 2 ? bands : await globalFallback('bands', 6)
    );
    this.recentEvents.set(events || []);
    this.recentVenues.set(venues || []);
    this.recentTeachers.set(teachers || []);
    this.recentRehearsals.set(rehearsals || []);
    const fallbackPosts = [
      { id: '_p1', type: 'band_seeks_musician', text: 'Banda de rock alternativo busca batería con experiencia en directo. Tocamos indie y alternativo. Mínimo 2 años de experiencia.', city: 'Madrid', author_name: 'Los Eternos', created_at: new Date(Date.now() - 2*3600000).toISOString() },
      { id: '_p2', type: 'musician_seeks_band', text: 'Guitarrista con 8 años de experiencia busca proyecto serio. Estilos: blues, rock clásico, jazz. Disponible fines de semana.', city: 'Barcelona', author_name: 'Carlos M.', created_at: new Date(Date.now() - 5*3600000).toISOString() },
      { id: '_p3', type: 'seeks_rehearsal', text: 'Cuarteto de jazz busca sala de ensayo para ensayos semanales. Preferiblemente con piano o teclado disponible. Zona centro.', city: 'Valencia', author_name: 'Jazz Quartet VLC', created_at: new Date(Date.now() - 24*3600000).toISOString() },
      { id: '_p4', type: 'offers_lessons', text: 'Profesor de piano con 15 años de experiencia ofrece clases online y presenciales. Todos los niveles. Lectura musical incluida.', city: 'Sevilla', author_name: 'Roberto Alonso', created_at: new Date(Date.now() - 48*3600000).toISOString() },
    ];
    const realPosts = posts || [];
    this.recentPosts.set([...realPosts, ...fallbackPosts].slice(0, 4));
    const fallbackListings = [
      { id: '_f1', title: 'Gibson Les Paul Standard', price: 1200, condition: 'Usado', category: 'Guitarras eléctricas', images: [] },
      { id: '_f2', title: 'Roland TD-17KVX', price: 850, condition: 'Usado', category: 'Batería electrónica', images: [] },
      { id: '_f3', title: 'Fender Stratocaster MIM', price: 650, condition: 'Nuevo', category: 'Guitarras eléctricas', images: [] },
      { id: '_f4', title: 'Marshall JCM800 Head', price: 950, condition: 'Usado', category: 'Amplificadores', images: [] },
      { id: '_f5', title: 'Boss GT-1000 Core', price: 380, condition: 'Nuevo', category: 'Efectos', images: [] },
      { id: '_f6', title: 'Shure SM58', price: 95, condition: 'Usado', category: 'Micrófonos', images: [] },
      { id: '_f7', title: 'Ibanez RG550', price: 720, condition: 'Usado', category: 'Guitarras eléctricas', images: [] },
      { id: '_f8', title: 'Focusrite Scarlett 2i2', price: 140, condition: 'Nuevo', category: 'Interfaces de audio', images: [] },
    ];
    const real = listings || [];
    const padded = [...real, ...fallbackListings].slice(0, 6);
    this.recentListings.set(padded);

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

  private readonly AVATAR_COLORS = [
    '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
  ];

  avatarColor(name: string): string {
    const code = name?.charCodeAt(0) ?? 65;
    return this.AVATAR_COLORS[code % this.AVATAR_COLORS.length];
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
    return this.postTypeMap[type] ?? { label: 'Anuncio', icon: 'newspaper' };
  }

  isNearby(item: any): boolean {
    return !!this.userCity() && item.city === this.userCity();
  }
}
