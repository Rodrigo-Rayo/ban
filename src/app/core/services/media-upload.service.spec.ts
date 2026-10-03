import { TestBed } from '@angular/core/testing';
import { MediaUploadService, mediaFileError } from './media-upload.service';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

function file(type: string, bytes = 1024): File {
  return new File([new Uint8Array(bytes)], 'foto', { type });
}

describe('MediaUploadService', () => {
  let svc: MediaUploadService;
  let toast: jasmine.SpyObj<ToastService>;
  let upload: jasmine.Spy;
  let remove: jasmine.Spy;
  let storageFrom: jasmine.Spy;
  let session: unknown;

  beforeEach(() => {
    session = { user: { id: 'u1' } };
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    upload = jasmine.createSpy('upload').and.resolveTo({ error: null });
    remove = jasmine.createSpy('remove').and.resolveTo({ error: null });
    storageFrom = jasmine.createSpy('storage.from').and.returnValue({
      upload,
      remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/storage/v1/object/public/media/${path}` } }),
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: {
          auth: { getSession: () => Promise.resolve({ data: { session } }) },
          client: { storage: { from: storageFrom } },
        } },
        { provide: ToastService, useValue: toast },
      ],
    });
    svc = TestBed.inject(MediaUploadService);
  });

  it('validates type and size with friendly Spanish messages', () => {
    expect(mediaFileError(file('image/gif'))).toBe('Usa una imagen JPG, PNG o WebP.');
    expect(mediaFileError(file('image/png', 5 * 1024 * 1024 + 1))).toBe('La imagen no puede superar 5 MB.');
    expect(mediaFileError(file('image/webp'))).toBeNull();
  });

  it('rejects an invalid file without touching storage', async () => {
    expect(await svc.upload(file('application/pdf'), 'events')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Usa una imagen JPG, PNG o WebP.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads into the user folder of the media bucket and returns the public URL', async () => {
    const url = await svc.upload(file('image/jpeg'), 'spaces');
    expect(storageFrom).toHaveBeenCalledWith('media');
    const path = upload.calls.mostRecent().args[0] as string;
    expect(path).toMatch(/^u1\/spaces\/\d+-[a-z0-9]+\.jpg$/);
    expect(url).toBe(`https://cdn.test/storage/v1/object/public/media/${path}`);
  });

  it('asks to sign in when there is no session', async () => {
    session = null;
    expect(await svc.upload(file('image/png'), 'events')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Inicia sesión para subir fotos.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns null with a toast when storage fails', async () => {
    upload.and.resolveTo({ error: { message: 'Bucket not found' } });
    expect(await svc.upload(file('image/png'), 'events')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('No se pudo subir la imagen. Inténtalo de nuevo.');
  });

  it('removes a media URL by its storage path and ignores foreign URLs', async () => {
    await svc.remove('https://cdn.test/storage/v1/object/public/media/u1/spaces/1-a.jpg');
    expect(remove).toHaveBeenCalledWith(['u1/spaces/1-a.jpg']);
    remove.calls.reset();
    await svc.remove('https://cdn.test/storage/v1/object/public/avatars/u1/avatar');
    expect(remove).not.toHaveBeenCalled();
  });
});
