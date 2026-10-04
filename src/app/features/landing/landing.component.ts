import { Component, signal, inject, OnInit, effect } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { SeoService } from '../../core/services/seo.service';
import { AuthService } from '../../core/services/auth.service';
import { avatarColor } from '../../core/utils/display.utils';
import { LEGAL_INFO } from '../legal/legal-info';

interface LandingVacancy { id: string; instrument: string; genre: string | null; bands: { id: string; name: string; city: string | null; genre: string | null } | null; }
interface LandingPerson { id: string; name: string; city: string | null; instrument: string | null; avatar_url: string | null; }

@Component({
    selector: 'app-landing',
    imports: [RouterLink],
    templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
  readonly contactEmail = LEGAL_INFO.legalEmail;
  readonly avatarColor = avatarColor;
  private supabase = inject(SupabaseService);
  private vacanciesSvc = inject(VacanciesService);
  private seo = inject(SeoService);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Curated teasers; each block is hidden while empty. */
  vacancies = signal<LandingVacancy[]>([]);
  people = signal<LandingPerson[]>([]);

  catalog: { label: string; desc: string; short: string; link: string; query?: Record<string, string> }[] = [
    { label: 'Se busca',  short: 'Vacantes y músicos', desc: 'Bandas que necesitan gente y músicos que buscan banda', link: '/feed' },
    { label: 'Músicos',   short: 'Guitarras, bajos, voces', desc: 'Guitarras, bajos, voces y más',      link: '/search', query: { tab: 'musicians' } },
    { label: 'Bandas',    short: 'Buscan miembros', desc: 'Buscan miembros o proyectos',        link: '/search', query: { tab: 'bands' } },
    { label: 'Locales',   short: 'Ensayo por horas', desc: 'Locales de ensayo por horas',        link: '/search', query: { tab: 'rehearsal' } },
    { label: 'Clases',    short: 'Profes y talleres', desc: 'Profesores y talleres',              link: '/search', query: { tab: 'teachers' } },
    { label: 'Agenda',    short: 'Bolos y jams', desc: 'Bolos, jams, open stages',           link: '/search', query: { tab: 'events' } },
    { label: 'Salas',     short: 'Música en directo', desc: 'Conciertos y eventos en directo',    link: '/search', query: { tab: 'venues' } },
    { label: 'Tienda',    short: 'Segunda mano', desc: 'Instrumentos y equipo de segunda mano', link: '/shop' },
  ];

  steps = [
    { n: '01', title: 'Crea tu perfil',        desc: 'Instrumento, estilos, zona y disponibilidad. Cinco minutos.' },
    { n: '02', title: 'Explora el directorio', desc: 'Filtra por ciudad, género, instrumento y nivel.' },
    { n: '03', title: 'Escribe directamente',  desc: 'Sin matches, sin swipes. Ves un perfil y escribes.' },
    { n: '04', title: 'Toca',                  desc: 'Local de ensayo, estudio, concierto — todo coordinado.' },
  ];

  roles = [
    { id: 'musician',  label: 'Soy músico',       icon: 'music',      desc: 'Busco banda o colaboraciones' },
    { id: 'band',      label: 'Tengo una banda',   icon: 'mic',        desc: 'Buscamos miembros' },
    { id: 'venue',     label: 'Tengo una sala',    icon: 'building',   desc: 'Programo conciertos' },
    { id: 'teacher',   label: 'Doy clases',        icon: 'book-open',  desc: 'Quiero más alumnos' },
    { id: 'rehearsal', label: 'Tengo un local',     icon: 'headphones', desc: 'Alquilo espacio' },
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
      url: 'https://www.bandyou.es/',
    });

    this.seo.injectJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'BandYou',
          url: 'https://www.bandyou.es',
          logo: 'https://www.bandyou.es/icon-512.png',
          description: 'La red musical de España. Conecta con músicos, bandas, salas de conciertos, profesores y locales de ensayo sin algoritmos ni intermediarios.',
          address: { '@type': 'PostalAddress', addressCountry: 'ES' },
        },
        {
          '@type': 'WebSite',
          name: 'BandYou',
          url: 'https://www.bandyou.es/',
          inLanguage: 'es-ES',
        },
      ],
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
