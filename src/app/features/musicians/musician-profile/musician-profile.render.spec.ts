import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MusicianProfileComponent, joinWeekdays } from './musician-profile.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';

const musician = {
  id: 'm-1', user_id: 'owner-1', name: 'Ana García', instrument: 'Batería', genre: 'Rock', city: 'Madrid',
  description: 'Toco desde los 12.', avatar_url: null, experience: null, influences: null,
  availability_days: 'lunes, jueves', availability_slots: null,
  spotify_url: null, youtube_url: null, instagram_url: null, soundcloud_url: null, website_url: null,
};

/** Renders the real template to check the contact/owner affordances. */
async function render(sessionUserId: string | null, data: object = musician) {
  const builder: any = { select: () => builder, eq: () => builder, maybeSingle: () => Promise.resolve({ data, error: null }) };
  await TestBed.configureTestingModule({
    imports: [MusicianProfileComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'm-1' } } } },
      {
        provide: SupabaseService,
        useValue: {
          auth: { getSession: () => Promise.resolve({ data: { session: sessionUserId ? { user: { id: sessionUserId } } : null } }) },
          client: { from: () => builder },
        },
      },
      { provide: MessagesService, useValue: {} },
      { provide: FavoritesService, useValue: { isFavorite: () => Promise.resolve(false), toggle: () => Promise.resolve(true) } },
      { provide: SeoService, useValue: jasmine.createSpyObj('SeoService', ['setProfile', 'injectJsonLd', 'setNotFound']) },
      { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error', 'success']) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MusicianProfileComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MusicianProfileComponent (rendered)', () => {
  it('shows one "Escribir mensaje" and "Favorito" to a visitor', async () => {
    const el = await render('visitor-1');
    const text = el.textContent ?? '';
    expect(text.match(/Escribir mensaje/g)?.length).toBe(1);
    expect(text).toContain('Favorito');
    expect(text).not.toContain('Guardar');
    expect(text).not.toContain('Editar perfil');
    expect(el.querySelector('app-avatar-upload')).toBeNull();
  });

  it('keeps the same "Escribir mensaje" label when logged out', async () => {
    const el = await render(null);
    const text = el.textContent ?? '';
    expect(text).toContain('Escribir mensaje');
    expect(text).not.toContain('Inicia sesión');
  });

  it('shows "Editar perfil" and "Cambiar foto" to the owner, without message or favorite', async () => {
    const el = await render('owner-1');
    const text = el.textContent ?? '';
    expect(text).toContain('Editar perfil');
    expect(el.querySelector('app-avatar-upload')).not.toBeNull();
    expect(text).toContain('Cambiar foto');
    expect(text).not.toContain('Escribir mensaje');
    expect(text).not.toContain('Favorito');
  });

  it('replaces the buttons by a quiet line when the profile has no account', async () => {
    const el = await render('visitor-1', { ...musician, user_id: null });
    const text = el.textContent ?? '';
    expect(text).toContain('Este perfil aún no tiene cuenta en BandYou');
    expect(text).not.toContain('Escribir mensaje');
  });

  it('prints each datum once: city and instrument live in the poster strip only', async () => {
    const el = await render('visitor-1');
    const labels = Array.from(el.querySelectorAll('dt')).map(dt => dt.textContent?.trim());
    expect(labels).not.toContain('Instrumento');
    expect(labels).not.toContain('Ciudad');
  });
});

describe('joinWeekdays', () => {
  it('lists the available days as plain text in week order', () => {
    expect(joinWeekdays(['Jueves', 'lunes'])).toBe('Lunes y jueves');
    expect(joinWeekdays(['sábado', 'miércoles', 'lunes'])).toBe('Lunes, miércoles y sábado');
    expect(joinWeekdays(['martes'])).toBe('Martes');
  });

  it('handles accents, empty and full weeks', () => {
    expect(joinWeekdays(['miercoles'])).toBe('Miércoles');
    expect(joinWeekdays([])).toBe('');
    expect(joinWeekdays(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])).toBe('Todos los días');
  });
});
