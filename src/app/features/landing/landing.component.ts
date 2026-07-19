import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SupabaseService } from '../../core/services/supabase.service';
import { SeoService } from '../../core/services/seo.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, CommonModule, IconComponent],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);
  private auth = inject(AuthService);
  private router = inject(Router);

  stats = signal({ musicians: 0, bands: 0, events: 0, venues: 0 });

  statItems = computed(() => [
    { value: this.stats().musicians, label: 'Músicos' },
    { value: this.stats().bands,     label: 'Bandas' },
    { value: this.stats().venues,    label: 'Salas' },
    { value: this.stats().events,    label: 'Eventos próximos' },
  ]);

  catalog = [
    { tab: 'musicians', label: 'Músicos',    icon: 'music',      desc: 'Guitarras, bajos, voces y más' },
    { tab: 'bands',     label: 'Bandas',     icon: 'mic',        desc: 'Buscan miembros o proyectos' },
    { tab: 'venues',    label: 'Salas',      icon: 'building',   desc: 'Conciertos y eventos en directo' },
    { tab: 'teachers',  label: 'Profesores', icon: 'book-open',  desc: 'Clases particulares y talleres' },
    { tab: 'events',    label: 'Agenda',     icon: 'calendar',   desc: 'Bolos, jams, open stages' },
  ];

  steps = [
    { n: '01', title: 'Crea tu perfil',        desc: 'Instrumento, estilos, zona y disponibilidad. Cinco minutos.' },
    { n: '02', title: 'Explora el directorio', desc: 'Filtra por ciudad, género, instrumento y nivel.' },
    { n: '03', title: 'Escribe directamente',  desc: 'Sin matches, sin swipes. Ves un perfil y escribes.' },
    { n: '04', title: 'Toca',                  desc: 'Sala de ensayo, estudio, concierto — todo coordinado.' },
  ];

  roles = [
    { id: 'musician',  label: 'Soy músico',       icon: 'music',      desc: 'Busco banda o colaboraciones' },
    { id: 'band',      label: 'Tengo una banda',   icon: 'mic',        desc: 'Buscamos miembros' },
    { id: 'venue',     label: 'Tengo una sala',    icon: 'building',   desc: 'Programo conciertos' },
    { id: 'teacher',   label: 'Doy clases',        icon: 'book-open',  desc: 'Quiero más alumnos' },
    { id: 'rehearsal', label: 'Local de ensayo',   icon: 'headphones', desc: 'Alquilo espacio' },
  ];

  constructor() {
    // React to auth state — handles both immediate (cached session) and
    // delayed (async Supabase restore) login detection.
    // setTimeout escapes the reactive context so Angular's router doesn't
    // mount the home component mid-change-detection, which leaves it blank.
    effect(() => {
      if (this.auth.isLoggedIn()) {
        setTimeout(() => this.router.navigate(['/home']));
      }
    });
  }

  async ngOnInit() {
    if (this.auth.isLoggedIn()) {
      return; // effect() will handle the redirect
    }

    this.seo.set({
      description: 'BandYou — La red musical de España. Conecta con músicos, bandas, salas, profesores y locales de ensayo. Mensajes directos, agenda de eventos.',
    });

    const [
      { count: musicians },
      { count: bands },
      { count: events },
      { count: venues },
    ] = await Promise.all([
      this.supabase.client.from('musicians').select('*', { count: 'exact', head: true }),
      this.supabase.client.from('bands').select('*', { count: 'exact', head: true }),
      this.supabase.client.from('events').select('*', { count: 'exact', head: true })
        .gte('date', new Date().toISOString().split('T')[0]),
      this.supabase.client.from('venues').select('*', { count: 'exact', head: true }),
    ]);
    this.stats.set({
      musicians: musicians ?? 0,
      bands: bands ?? 0,
      events: events ?? 0,
      venues: venues ?? 0,
    });
  }
}
