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
    const image = options.image ?? 'https://bandyou.es/assets/og-default.jpg';
    const url = options.url ?? this.document.URL;
    const type = options.type ?? 'website';

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

  setProfile(name: string, type: string, city?: string, description?: string, image?: string, url?: string) {
    const typeLabel: Record<string, string> = {
      musician: 'Músico', band: 'Banda', venue: 'Sala', teacher: 'Profesor', rehearsal: 'Local de ensayo',
    };
    const label = typeLabel[type] ?? type;
    const desc = description
      ? description.slice(0, 155)
      : `${label} en ${city ?? 'España'} — BandYou`;
    this.set({ title: `${name} · ${label}`, description: desc, image, url, type: 'profile' });
  }

  setEvent(title: string, date: string, city?: string, description?: string, url?: string) {
    const desc = description
      ? description.slice(0, 155)
      : `Evento: ${title}${city ? ' en ' + city : ''} — BandYou`;
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

  reset() {
    this.set({});
  }
}
