import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpaceGalleryComponent } from './space-gallery.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { MediaUploadService } from '../../../core/services/media-upload.service';

const PHOTOS = ['https://cdn.test/media/u1/spaces/1.jpg', 'https://cdn.test/media/u1/spaces/2.jpg'];

describe('SpaceGalleryComponent', () => {
  let fixture: ComponentFixture<SpaceGalleryComponent>;
  let component: SpaceGalleryComponent;
  let from: jasmine.Spy;
  let select: jasmine.Spy;
  let update: jasmine.Spy;
  let upload: jasmine.Spy;
  let remove: jasmine.Spy;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let has: jasmine.Spy;

  async function setup(opts: { available: boolean; isOwner?: boolean; photos?: string[] }) {
    select = jasmine.createSpy('select').and.returnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { photos: opts.photos ?? PHOTOS }, error: null }) }),
    });
    update = jasmine.createSpy('update').and.returnValue({ eq: () => Promise.resolve({ error: null, count: 1 }) });
    from = jasmine.createSpy('from').and.returnValue({ select, update });
    upload = jasmine.createSpy('upload').and.callFake((f: File) => Promise.resolve(`https://cdn.test/media/u1/spaces/${f.name}`));
    remove = jasmine.createSpy('remove').and.resolveTo();
    has = jasmine.createSpy('has').and.resolveTo(opts.available);
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    confirm.ask.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [SpaceGalleryComponent],
      providers: [
        { provide: SupabaseService, useValue: { client: { from } } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: ConfirmService, useValue: confirm },
        { provide: MediaFeaturesService, useValue: { has } },
        { provide: MediaUploadService, useValue: { upload, remove } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SpaceGalleryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('kind', 'venue');
    fixture.componentRef.setInput('profileId', 'v1');
    fixture.componentRef.setInput('name', 'Sala Caracol');
    fixture.componentRef.setInput('isOwner', opts.isOwner ?? false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => { document.body.style.overflow = ''; });

  it('before the SQL is run: renders nothing and never selects photos', async () => {
    await setup({ available: false, isOwner: true });
    expect(has).toHaveBeenCalledWith('venuePhotos');
    expect(from).not.toHaveBeenCalled();
    expect(el().textContent?.trim()).toBe('');
  });

  it('shows the photos with alt text once available', async () => {
    await setup({ available: true });
    expect(from).toHaveBeenCalledWith('venues');
    expect(select).toHaveBeenCalledWith('photos');
    const imgs = el().querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('alt')).toBe('Foto de Sala Caracol');
    expect(el().textContent).not.toContain('Añadir fotos');
  });

  it('stays hidden for visitors when the space has no photos', async () => {
    await setup({ available: true, photos: [] });
    expect(el().querySelector('section')).toBeNull();
  });

  it('lets the owner add photos (up to 6) and saves the list', async () => {
    await setup({ available: true, isOwner: true });
    expect(el().textContent).toContain('Añadir fotos');
    const files = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'].map(n => new File(['x'], n, { type: 'image/jpeg' }));
    await component.onFiles({ target: { files, value: 'x' } } as unknown as Event);
    expect(upload).toHaveBeenCalledTimes(4); // 2 existing + 4 = 6
    const saved = update.calls.mostRecent().args[0].photos as string[];
    expect(saved.length).toBe(6);
    expect(component.photos().length).toBe(6);
    expect(component.canAdd()).toBeFalse();
  });

  it('removes a photo after confirmation and deletes the file', async () => {
    await setup({ available: true, isOwner: true });
    await component.removePhoto(0);
    expect(update.calls.mostRecent().args[0]).toEqual({ photos: [PHOTOS[1]] });
    expect(remove).toHaveBeenCalledWith(PHOTOS[0]);
  });

  it('opens a lightbox that closes with Escape and returns focus', async () => {
    await setup({ available: true });
    const thumb = el().querySelector<HTMLButtonElement>('ul button')!;
    thumb.click();
    fixture.detectChanges();
    expect(el().querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.openIndex()).toBe(1);
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el().querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    await new Promise(r => setTimeout(r));
    expect(document.activeElement).toBe(thumb);
  });
});
