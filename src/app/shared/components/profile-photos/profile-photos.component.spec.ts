import { TestBed } from '@angular/core/testing';
import { ProfilePhotosComponent } from './profile-photos.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { MediaUploadService } from '../../../core/services/media-upload.service';

describe('ProfilePhotosComponent', () => {
  let updates: { table: string; data: Record<string, unknown> }[];
  let media: jasmine.SpyObj<MediaUploadService>;
  let toast: jasmine.SpyObj<ToastService>;

  function create(role: string, photosColumn = true) {
    updates = [];
    const client = {
      from: (table: string) => ({
        update: (data: Record<string, unknown>) => ({
          eq: () => { updates.push({ table, data }); return Promise.resolve({ error: null }); },
        }),
      }),
    };
    media = jasmine.createSpyObj<MediaUploadService>('MediaUploadService', ['upload', 'removeFiles']);
    let n = 0;
    media.upload.and.callFake(async () => `https://cdn/x${++n}.webp`);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']);
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client } },
        { provide: ToastService, useValue: toast },
        { provide: MediaUploadService, useValue: media },
        { provide: MediaFeaturesService, useValue: { has: () => Promise.resolve(photosColumn) } },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePhotosComponent);
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const file = (name = 'a.jpg') => new File(['x'], name, { type: 'image/jpeg' });
  const pick = (files: File[]) => ({ target: { files, value: '' } }) as unknown as Event;

  it('saves the profile photo on that profile table only (a second profile keeps the first one\'s photo)', async () => {
    const c = create('venue');
    await Promise.resolve();
    c.pickAvatar(pick([file()]));
    await c.save('u1');
    expect(updates).toEqual([{ table: 'venues', data: { avatar_url: 'https://cdn/x1.webp' } }]);
  });

  it('saves space photos together with the avatar for venues and rehearsal spaces', async () => {
    const c = create('rehearsal');
    await Promise.resolve();
    c.pickAvatar(pick([file()]));
    c.pickSpacePhotos(pick([file('b.jpg'), file('c.jpg')]));
    await c.save('u1');
    expect(updates.length).toBe(1);
    expect(updates[0].table).toBe('rehearsal_spaces');
    expect(updates[0].data['photos']).toEqual(['https://cdn/x2.webp', 'https://cdn/x3.webp']);
  });

  it('caps space photos at six', async () => {
    const c = create('venue');
    await Promise.resolve();
    c.pickSpacePhotos(pick(Array.from({ length: 8 }, (_, i) => file(`p${i}.jpg`))));
    expect(c.spacePhotos().length).toBe(6);
    expect(toast.error).toHaveBeenCalled();
  });

  it('offers no space photos to musicians and writes nothing when nothing was picked', async () => {
    const c = create('musician');
    await Promise.resolve();
    expect(c.spaceAvailable()).toBeFalse();
    await c.save('u1');
    expect(updates).toEqual([]);
    expect(media.upload).not.toHaveBeenCalled();
  });

  it('rejects files that are not images', async () => {
    const c = create('band');
    c.pickAvatar(pick([new File(['x'], 'a.pdf', { type: 'application/pdf' })]));
    expect(c.avatar()).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });
});
