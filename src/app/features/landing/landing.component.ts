import { Component, signal, inject, OnInit, effect } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { SeoService } from '../../core/services/seo.service';
import { AuthService } from '../../core/services/auth.service';
import { avatarColor } from '../../core/utils/display.utils';

interface LandingVacancy { id: string; instrument: string; genre: string | null; bands: { id: string; name: string; city: string | null; genre: string | null } | null; }
interface LandingPerson { id: string; name: string; city: string | null; instrument: string | null; avatar_url: string | null; }

@Component({
    selector: 'app-landing',
    imports: [RouterLink],
    templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
  readonly avatarColor = avatarColor;
  private supabase = inject(SupabaseService);
  private vacanciesSvc = inject(VacanciesService);
  private seo = inject(SeoService);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Curated teasers; each block is hidden while empty. */
  vacancies = signal<LandingVacancy[]>([]);
  people = signal<LandingPerson[]>([]);

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
      url: 'https://bandyou.es/',
    });

    this.seo.injectJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'BandYou',
      url: 'https://bandyou.es',
      logo: 'https://bandyou.es/og-default.jpg',
      description: 'La red musical de España. Conecta con músicos, bandas, salas de conciertos, profesores y locales de ensayo sin algoritmos ni intermediarios.',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'ES',
      },
    });

    try {
      const [vac, ppl] = await Promise.all([
        this.vacanciesSvc.listOpen({ limit: 4 }).then(data => ({ data }), () => ({ data: [] })),
        this.supabase.client.from('musicians')
          .select('id, name, city, instrument, avatar_url')
          .order('created_at', { ascending: false }).limit(4),
      ]);
      this.vacancies.set((vac.data || []) as unknown as LandingVacancy[]);
      this.people.set((ppl.data || []) as unknown as LandingPerson[]);
    } catch {
      // Teasers are non-critical — the landing renders fine without them
    }
  }
}
