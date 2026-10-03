import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
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

    it('shows at most four people', () => {
      component.recentMusicians.set(['1', '2', '3', '4', '5', '6'].map(i => person(i, `u${i}`)));
      expect(component.newPeople().length).toBe(4);
    });
  });
});
