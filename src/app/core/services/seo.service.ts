import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);
  private canonical?: HTMLLinkElement;

  set(options: { title?: string; description?: string; image?: string; url?: string; type?: string }) {
    const appName = 'BandYou';
    const fullTitle = options.title ? `${options.title} · ${appName}` : `${appName} — La red musical de España`;
    const desc = options.description ?? 'Directorio de músicos, bandas, salas y profesores. Mensajes directos, agenda de eventos.';
    const image = options.image ?? 'https://bandyou.es/og-default.jpg';
    const url = options.url ?? this.document.URL;
    const type = options.type ?? 'website';

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
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    if (!this.canonical) {
      this.canonical = this.document.createElement('link');
      this.canonical.setAttribute('rel', 'canonical');
      this.document.head.appendChild(this.canonical);
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
      ? description.slice(0, 155)
      : `${label}${locationSuffix} — BandYou`;
    this.set({ title: `${name} · ${label}${locationSuffix}`, description: desc, image, url, type: 'profile' });
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
      ? description.slice(0, 155)
      : `${title}${humanDate ? ' · ' + humanDate : ''}${city ? ' en ' + city : ''} — BandYou`;
    this.set({ title, description: desc, url, type: 'website' });
  }

  setListing(title: string, price: number, city?: string, url?: string) {
    this.set({
      title,
      description: `${title}${price ? ' · ' + price + '€' : ''}${city ? ' · ' + city : ''} — BandYou Tienda`,
      url,
    });
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

  reset() {
    this.set({});
  }
}
