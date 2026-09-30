import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, NavigationStart, Router } from '@angular/router';

export const SITE_URL = 'https://bandyou.es';

export interface SeoOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  /** Marks the current page noindex (e.g. a profile id that does not exist). */
  noindex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);
  private router = inject(Router);
  private canonical?: HTMLLinkElement;
  private pageNoindex = false;

  constructor() {
    // robots is derived per navigation from route `data.noindex` so a noindex
    // page (login, inbox…) never leaks its tag onto the next page.
    this.router.events.subscribe(e => {
      // Reset the per-page flag only on real page changes, not query-param updates.
      if (e instanceof NavigationStart && pathOf(e.url) !== pathOf(this.router.url)) this.pageNoindex = false;
      if (e instanceof NavigationEnd) this.applyRobots();
    });
  }

  set(options: SeoOptions) {
    const appName = 'BandYou';
    const fullTitle = options.title ? `${options.title} · ${appName}` : `${appName} — La red musical de España`;
    const desc = options.description ?? 'Directorio de músicos, bandas, salas y profesores. Mensajes directos, agenda de eventos.';
    const image = options.image || `${SITE_URL}/og-default.jpg`;
    const url = options.url ?? this.currentCanonicalUrl();
    const type = options.type ?? 'website';

    if (options.noindex) this.pageNoindex = true;
    this.applyRobots();

    // Clear stale JSON-LD injected by the previous page so navigating away
    // from a profile/event does not leave the old schema in <head>.
    this.clearJsonLd();

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: desc });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: desc });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:site_name', content: 'BandYou' });
    this.meta.updateTag({ property: 'og:locale', content: 'es_ES' });
    this.meta.updateTag({ property: 'og:image:alt', content: options.title ? `${options.title} — BandYou` : 'BandYou — La red musical de España' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    if (!this.canonical) {
      this.canonical =
        (this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)
        ?? (() => {
          const el = this.document.createElement('link');
          el.setAttribute('rel', 'canonical');
          this.document.head.appendChild(el);
          return el;
        })();
    }
    this.canonical.setAttribute('href', url);
  }

  /**
   * Sets meta tags for a profile page and includes city and optional
   * subtitle (e.g. instrument or specialty) in the page title.
   *
   * Produces titles like: "María García · Guitarrista en Madrid · BandYou"
   */
  setProfile(
    name: string,
    type: string,
    city?: string,
    description?: string,
    image?: string,
    url?: string,
    subtitle?: string,
  ) {
    const typeLabel: Record<string, string> = {
      musician: 'Músico',
      band: 'Banda',
      venue: 'Sala',
      teacher: 'Profesor',
      rehearsal: 'Local de ensayo',
    };
    const label = subtitle || (typeLabel[type] ?? type);
    const locationSuffix = city ? ` en ${city}` : '';
    const desc = description
      ? truncate(description)
      : `${label}${locationSuffix} — BandYou`;
    this.set({ title: `${name} · ${label}${locationSuffix}`, description: desc, image, url, type: 'website' });
  }

  /**
   * Sets meta tags for an event page. Falls back to a description that
   * includes the human-readable date and city when no description is provided.
   */
  setEvent(title: string, date: string, city?: string, description?: string, url?: string) {
    let humanDate = '';
    if (date) {
      try {
        humanDate = new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch {
        humanDate = date;
      }
    }
    const desc = description
      ? truncate(description)
      : `${title}${humanDate ? ' · ' + humanDate : ''}${city ? ' en ' + city : ''} — BandYou`;
    this.set({ title, description: desc, url, type: 'website' });
  }

  setListing(title: string, price: number, city?: string, url?: string, image?: string) {
    this.set({
      title,
      description: `${title}${price ? ' · ' + price + '€' : ''}${city ? ' · ' + city : ''} — BandYou Tienda`,
      url,
      image,
    });
  }

  /** Call when a detail page's record does not exist (soft 404). */
  setNotFound() {
    this.set({ title: 'No encontrado', noindex: true });
  }

  injectJsonLd(data: object): void {
    let script = this.document.getElementById('ld-json') as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script') as HTMLScriptElement;
      script.id = 'ld-json';
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  private clearJsonLd(): void {
    const existing = this.document.getElementById('ld-json');
    if (existing) existing.remove();
  }

  /** Canonical URL from the router path: fixed host, no query string or fragment. */
  private currentCanonicalUrl(): string {
    const path = pathOf(this.router.url);
    return `${SITE_URL}${path}`;
  }

  private applyRobots(): void {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let routeNoindex = false;
    while (route) {
      if (route.data?.['noindex']) routeNoindex = true;
      route = route.firstChild;
    }
    this.meta.updateTag({
      name: 'robots',
      content: routeNoindex || this.pageNoindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large',
    });
  }

  reset() {
    this.set({});
  }
}

const DESCRIPTION_MAX = 155;

function pathOf(url: string): string {
  return url.split(/[?#]/)[0] || '/';
}

/** Trims to the meta-description budget on a word boundary. */
function truncate(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_MAX) return clean;
  const cut = clean.slice(0, DESCRIPTION_MAX - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length) + '…';
}
