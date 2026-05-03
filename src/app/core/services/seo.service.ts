import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);

  set(options: { title?: string; description?: string; image?: string; url?: string }) {
    const appName = 'BandYou';
    const fullTitle = options.title ? `${options.title} · ${appName}` : `${appName} — La red musical de España`;
    const desc = options.description ?? 'Directorio de músicos, bandas, salas y profesores. Mensajes directos, agenda de eventos.';
    const image = options.image ?? '/assets/og-default.jpg';

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: desc });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: desc });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    if (options.url) {
      this.meta.updateTag({ property: 'og:url', content: options.url });
    }
  }

  setProfile(name: string, type: string, city?: string, description?: string, image?: string) {
    const typeLabel: Record<string, string> = {
      musician: 'Músico', band: 'Banda', venue: 'Sala', teacher: 'Profesor', rehearsal: 'Local de ensayo',
    };
    const label = typeLabel[type] ?? type;
    const desc = description
      ? description.slice(0, 155)
      : `${label} en ${city ?? 'España'} — BandYou`;
    this.set({ title: `${name} · ${label}`, description: desc, image });
  }

  setEvent(title: string, date: string, city?: string, description?: string) {
    const desc = description
      ? description.slice(0, 155)
      : `Evento: ${title}${city ? ' en ' + city : ''} — BandYou`;
    this.set({ title, description: desc });
  }

  setListing(title: string, price: number, city?: string) {
    this.set({
      title,
      description: `${title}${price ? ' · ' + price + '€' : ''}${city ? ' · ' + city : ''} — BandYou Tienda`,
    });
  }

  reset() {
    this.set({});
  }
}
