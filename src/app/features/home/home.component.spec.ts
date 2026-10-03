import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomeComponent, seededRandom, shuffled, cityFirst } from './home.component';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { MessagesService } from '../../core/services/messages.service';
import { AvatarUploadService } from '../../core/services/avatar-upload.service';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  const user = signal<{ id: string } | null>({ id: 'me' });
  const profileType = signal('musician');
  const unread = signal(0);
  const avatarUrl = signal<string | null>(null);

  beforeEach(async () => {
    user.set({ id: 'me' });
    profileType.set('musician');
    unread.set(0);
    avatarUrl.set(null);
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user, userProfileType: profileType, userProfileData: signal(null),
            loadUserProfile: () => Promise.resolve(),
          },
        },
        { provide: SupabaseService, useValue: { client: {} } },
        { provide: VacanciesService, useValue: { listOpen: () => Promise.resolve([]) } },
        { provide: MessagesService, useValue: { unreadCount: unread } },
        { provide: AvatarUploadService, useValue: { avatarUrl, uploading: signal(false) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  describe('next-step strip', () => {
    it('offers a direct photo upload (no wizard) when the profile has no photo', () => {
      component.userProfile.set({ name: 'Lola', avatar_url: null });
      const step = component.nextStep();
      expect(step?.upload).toBeTrue();
      expect(step?.cta).toBe('Añadir foto');
      expect(step?.link).toBeUndefined();
    });

    it('hides once a photo has been uploaded', () => {
      component.userProfile.set({ name: 'Lola', avatar_url: null });
      avatarUrl.set('https://x/avatar.png');
      expect(component.nextStep()).toBeNull();
    });

    it('is not shown when the profile already has a photo', () => {
      component.userProfile.set({ name: 'Lola', avatar_url: 'https://x/a.png' });
      expect(component.nextStep()).toBeNull();
    });

    it('is not shown to listeners (no profile row can hold a photo)', () => {
      profileType.set('listener');
      component.userProfile.set({ name: 'Ana', avatar_url: null });
      expect(component.nextStep()).toBeNull();
    });

    it('never nudges about unread messages (the badges already do)', () => {
      unread.set(2);
      component.userProfile.set({ name: 'Lola', avatar_url: 'https://x/a.png' });
      expect(component.nextStep()).toBeNull();
    });

    it('only musicians and bands get the "publish your gig" nudge', () => {
      profileType.set('venue');
      expect(component.canPublishGigs()).toBeFalse();
      profileType.set('band');
      expect(component.canPublishGigs()).toBeTrue();
    });
  });

  describe('"Gente nueva"', () => {
    const person = (id: string, user_id: string) =>
      ({ id, user_id, name: id, city: 'Madrid', instrument: 'Bajo', avatar_url: null, created_at: '' });

    it('never includes the signed-in user', () => {
      component.recentMusicians.set([person('a', 'me'), person('b', 'u2'), person('c', 'u3')]);
      expect(component.newPeople().map(m => m.id)).toEqual(['b', 'c']);
    });

    it('puts the user city first, then people with a photo', () => {
      component.userCity.set('Madrid');
      const p = (id: string, city: string, photo: boolean) =>
        ({ id, user_id: 'u-' + id, name: id, city, instrument: 'Bajo', avatar_url: photo ? 'x.png' : null, created_at: '' });
      component.recentMusicians.set([p('far-photo', 'Bilbao', true), p('here-nophoto', 'Madrid', false), p('here-photo', 'Madrid', true)]);
      expect(component.newPeople().map(m => m.id)).toEqual(['here-photo', 'here-nophoto', 'far-photo']);
    });

    it('shows at most eight people', () => {
      component.recentMusicians.set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(i => person(i, `u${i}`)));
      expect(component.newPeople().length).toBe(8);
    });
  });

  describe('Se busca and carousel', () => {
    const vacancy = (id: string, band: string, city = 'Bilbao') =>
      ({ id, instrument: 'Batería', genre: 'Rock', bands: { id: 'b-' + id, name: band, city, genre: 'Rock' } });
    const post = (id: string, type: string, author: string) =>
      ({ id, type, text: 'x', city: 'Madrid', instrument: null, author_name: author, author_profile_type: null, author_profile_id: null, created_at: new Date().toISOString() });

    it('merges vacancies first and skips a band post already shown as a vacancy', () => {
      component.recentVacancies.set([vacancy('1', 'Los Despistados')]);
      component.recentPosts.set([
        post('p1', 'band_seeking_musician', 'Los Despistados'),
        post('p2', 'musician_seeking_band', 'Sofía'),
      ]);
      const items = component.seBuscaItems();
      expect(items.map(i => i.id)).toEqual(['v-1', 'p-p2']);
      expect(items[0].stampLabel).toBe('Busca batería');
      expect(items[0].link).toEqual(['/bands', 'b-1']);
    });

    it('lists vacancies from the user city first', () => {
      component.userCity.set('Madrid');
      component.recentVacancies.set([vacancy('1', 'A', 'Bilbao'), vacancy('2', 'B', 'Madrid')]);
      expect(component.seBuscaItems()[0].title).toBe('B');
    });

    it('caps the list at five rows', () => {
      component.recentPosts.set(['1', '2', '3', '4', '5', '6', '7'].map(i => post(i, 'collab', 'P' + i)));
      expect(component.seBuscaItems().length).toBe(5);
    });

    it('builds carousel slides only from content that exists', () => {
      expect(component.featuredSlides()).toEqual([]);
      component.recentVacancies.set([vacancy('1', 'Los Despistados')]);
      component.recentVenues.set([{ id: 's1', name: 'Sala X', city: 'Madrid', avatar_url: null, capacity: 300, created_at: '' }]);
      component.recentListings.set([{ id: 'g1', title: 'Fender', price: 500, condition: null, category: null, city: 'Madrid', images: null, created_at: '' }]);
      // Vacancies are already in the Se busca list, so the carousel does not repeat them.
      expect(component.featuredSlides().map(s => s.kicker)).toEqual(jasmine.arrayWithExactContents(['Sala', 'En la tienda']));
    });

    it('draws a random item per kind, stable within a visit and different across visits', () => {
      const venues = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id, city: 'Madrid', avatar_url: null, capacity: null, created_at: '' }));
      component.recentVenues.set(venues);
      const titleFor = (seed: number) => { component.featuredSeed.set(seed); return component.featuredSlides()[0].title; };
      expect(titleFor(7)).toBe(titleFor(7));
      const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(titleFor));
      expect(seen.size).toBeGreaterThan(1);
    });
  });

  describe('city first', () => {
    it('keeps local items first and fills with the rest of Spain without duplicates', () => {
      const x = (id: string) => ({ id });
      expect(cityFirst([x('a'), x('b')], [x('b'), x('c'), x('d')], 3).map(i => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('lists rehearsal spaces of the user city before the others', () => {
      component.userCity.set('Madrid');
      const r = (id: string, city: string) => ({ id, name: id, city, avatar_url: null, capacity: null, created_at: '' });
      component.recentRehearsals.set([r('b1', 'Bilbao'), r('m1', 'Madrid'), r('m2', 'Madrid')]);
      const shown = component.rehearsalsShown().map(x => x.city);
      expect(shown).toEqual(['Madrid', 'Madrid', 'Bilbao']);
    });
  });

  describe('random helpers', () => {
    it('seededRandom is deterministic per seed and stays in [0, 1)', () => {
      const a = seededRandom(42), b = seededRandom(42);
      const xs = [a(), a(), a()];
      expect([b(), b(), b()]).toEqual(xs);
      expect(xs.every(x => x >= 0 && x < 1)).toBeTrue();
    });
    it('shuffled keeps every item and does not mutate the input', () => {
      const input = [1, 2, 3, 4, 5];
      const out = shuffled(input, seededRandom(3));
      expect([...out].sort()).toEqual(input);
      expect(input).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
