import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { GearFormComponent } from './gear-form.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

// ---------------------------------------------------------------------------
// Supabase query-builder mock
// ---------------------------------------------------------------------------
function mockBuilder(resolveValue: { data?: any; error?: any }) {
  const b: any = {
    then(resolve: any, reject: any) {
      return Promise.resolve(resolveValue).then(resolve, reject);
    },
  };
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'or', 'in',
   'order', 'limit', 'range', 'ilike', 'head', 'not', 'gte', 'lte', 'lt',
   'filter'].forEach(m => {
    b[m] = jasmine.createSpy(m).and.returnValue(b);
  });
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(resolveValue));
  b.single     = jasmine.createSpy('single').and.returnValue(Promise.resolve(resolveValue));
  return b;
}

// ---------------------------------------------------------------------------
// File / Event test helpers
// ---------------------------------------------------------------------------
function createFile(name: string, type: string, size = 100): File {
  const content = new Array(Math.min(size, 1000)).fill('a').join('');
  const file = new File([content], name, { type });
  if (size > 1000) {
    // Override the size property to simulate large files without allocating memory.
    Object.defineProperty(file, 'size', { value: size, configurable: true });
  }
  return file;
}

function createFileEvent(files: File[]): Event {
  // Build a minimal FileList-like object that Array.from() can iterate.
  const fileList: any = { length: files.length };
  files.forEach((f, i) => { fileList[i] = f; });
  fileList[Symbol.iterator] = function* () { yield* files; };
  return { target: { files: fileList } } as any;
}

describe('GearFormComponent', () => {
  let component: GearFormComponent;
  let supabaseSpy: any;
  let authSpy: any;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let locationSpy: jasmine.SpyObj<Location>;
  let routeMock: any;

  const fakeUser = { id: 'u1', email: 'test@test.com' };

  beforeEach(async () => {
    // Default builder: all profile-table queries return no data; gear_listings
    // insert/update succeeds.
    const defaultBuilder = mockBuilder({ data: null, error: null });
    const createBuilder  = mockBuilder({ data: { id: 'gear-new-1' }, error: null });

    supabaseSpy = {
      auth: {
        getUser: jasmine.createSpy('getUser').and.returnValue(
          Promise.resolve({ data: { user: fakeUser } })
        ),
      },
      client: {
        from: jasmine.createSpy('from').and.callFake((table: string) => {
          if (table === 'gear_listings') return createBuilder;
          return defaultBuilder;
        }),
        storage: {
          from: jasmine.createSpy('storageFrom').and.returnValue({
            upload: jasmine.createSpy('upload').and.returnValue(Promise.resolve({ error: null })),
            getPublicUrl: jasmine.createSpy('getPublicUrl')
              .and.returnValue({ data: { publicUrl: 'https://example.com/img.jpg' } }),
          }),
        },
      },
    };

    authSpy  = { loadUserProfile: jasmine.createSpy().and.returnValue(Promise.resolve()) };
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    routerSpy   = jasmine.createSpyObj<Router>('Router', ['navigate']);
    locationSpy = jasmine.createSpyObj<Location>('Location', ['back']);

    routeMock = {
      snapshot: { paramMap: { get: jasmine.createSpy('get').and.returnValue(null) } },
    };

    await TestBed.configureTestingModule({
      imports: [GearFormComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthService,     useValue: authSpy },
        { provide: ToastService,    useValue: toastSpy },
        { provide: Router,          useValue: routerSpy },
        { provide: Location,        useValue: locationSpy },
        { provide: ActivatedRoute,  useValue: routeMock },
      ],
    })
    .overrideComponent(GearFormComponent, { set: { imports: [], template: '<div></div>' } })
    .compileComponents();

    component = TestBed.createComponent(GearFormComponent).componentInstance;

    // Stub URL methods to avoid jsdom errors from createObjectURL / revokeObjectURL.
    spyOn(URL, 'createObjectURL').and.returnValue('blob:fake-url');
    spyOn(URL, 'revokeObjectURL').and.stub();
  });

  // ---------------------------------------------------------------------------
  // Helper: put the component into a state ready for submit()
  // ---------------------------------------------------------------------------
  function readyToSubmit() {
    component.currentUser.set(fakeUser as any);
    component.userProfile.set({ id: 'm-1', name: 'Lola', type: 'musician' } as any);
    component.form.title = 'Test Guitar';
    component.form.price = 100;
    component.imageFiles = [];   // no uploads needed
  }

  // -------------------------------------------------------------------------
  // canSubmit getter
  // -------------------------------------------------------------------------

  it('1. canSubmit returns falsy when title is empty', () => {
    component.form.title = '';
    component.form.price = 50;
    expect(component.canSubmit).toBeFalsy();
  });

  it('2. canSubmit returns falsy when price is null', () => {
    component.form.title = 'Guitar';
    component.form.price = null;
    expect(component.canSubmit).toBeFalsy();
  });

  it('3. canSubmit returns falsy when price is 0', () => {
    component.form.title = 'Guitar';
    component.form.price = 0;
    expect(component.canSubmit).toBeFalsy();
  });

  it('3b. canSubmit returns falsy when price is negative', () => {
    component.form.title = 'Guitar';
    component.form.price = -10;
    expect(component.canSubmit).toBeFalsy();
  });

  it('4. canSubmit returns truthy when title is non-empty and price is positive', () => {
    component.form.title = 'Guitar';
    component.form.price = 150;
    expect(component.canSubmit).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // removeExistingImage()
  // -------------------------------------------------------------------------

  it('5. removeExistingImage removes the image at the given index', () => {
    component.existingImages.set(['img-a.jpg', 'img-b.jpg', 'img-c.jpg']);
    component.removeExistingImage(1);
    expect(component.existingImages()).toEqual(['img-a.jpg', 'img-c.jpg']);
  });

  it('6. removeExistingImage keeps all other images intact', () => {
    component.existingImages.set(['img-a.jpg', 'img-b.jpg']);
    component.removeExistingImage(0);
    expect(component.existingImages()).toEqual(['img-b.jpg']);
  });

  // -------------------------------------------------------------------------
  // onFilesChange()
  // -------------------------------------------------------------------------

  it('7. onFilesChange rejects files with an unsupported mime type', () => {
    const badFile = createFile('doc.pdf', 'application/pdf');
    component.onFilesChange(createFileEvent([badFile]));
    expect(component.imageFiles.length).toBe(0);
  });

  it('8. onFilesChange accepts big phone photos (shrunk before upload) but rejects over 20 MB', () => {
    component.onFilesChange(createFileEvent([createFile('phone.jpg', 'image/jpeg', 9 * 1024 * 1024)]));
    expect(component.imageFiles.length).toBe(1);
    component.onFilesChange(createFileEvent([createFile('huge.jpg', 'image/jpeg', 21 * 1024 * 1024)]));
    expect(component.imageFiles.length).toBe(1);
  });

  it('9. onFilesChange sets error message describing the number of rejected files', () => {
    const badFile  = createFile('doc.pdf', 'application/pdf');
    const goodFile = createFile('photo.jpg', 'image/jpeg');
    component.onFilesChange(createFileEvent([badFile, goodFile]));
    expect(component.error()).toContain('1 archivo(s) rechazado(s)');
  });

  it('10. onFilesChange accepts valid jpeg and png images', () => {
    const jpg = createFile('photo.jpg', 'image/jpeg');
    const png = createFile('photo.png', 'image/png');
    component.onFilesChange(createFileEvent([jpg, png]));
    expect(component.imageFiles.length).toBe(2);
  });

  it('11. onFilesChange caps total imageFiles at 4 even when more are supplied', () => {
    const files = Array.from({ length: 6 }, (_, i) =>
      createFile(`photo${i}.jpg`, 'image/jpeg')
    );
    component.onFilesChange(createFileEvent(files));
    expect(component.imageFiles.length).toBe(4);
  });

  it('11b. onFilesChange respects existing files when enforcing the 4-file cap', () => {
    const existing = createFile('existing.jpg', 'image/jpeg');
    component.imageFiles = [existing, existing, existing]; // 3 already present
    const newFile = createFile('new.png', 'image/png');
    const extraFile = createFile('extra.webp', 'image/webp');
    component.onFilesChange(createFileEvent([newFile, extraFile]));
    // only 1 slot left → imageFiles should still be exactly 4
    expect(component.imageFiles.length).toBe(4);
  });

  // -------------------------------------------------------------------------
  // removeImage()
  // -------------------------------------------------------------------------

  it('12. removeImage removes the file at the specified index', () => {
    const f0 = createFile('a.jpg', 'image/jpeg');
    const f1 = createFile('b.jpg', 'image/jpeg');
    const f2 = createFile('c.jpg', 'image/jpeg');
    component.imageFiles = [f0, f1, f2];
    component.removeImage(1);
    expect(component.imageFiles).toEqual([f0, f2]);
  });

  // -------------------------------------------------------------------------
  // submit() — guard and finally behaviour (image upload path is not tested)
  // -------------------------------------------------------------------------

  it('13. submit sets formTouched to true', async () => {
    readyToSubmit();
    await component.submit();
    expect(component.formTouched()).toBeTrue();
  });

  it('14. submit returns early (before DB call) when canSubmit is false', async () => {
    component.currentUser.set(fakeUser as any);
    component.form.title = '';   // canSubmit will be false
    component.form.price = 100;
    supabaseSpy.client.from.calls.reset();
    await component.submit();
    expect(supabaseSpy.client.from).not.toHaveBeenCalled();
  });

  it('14b. exposes title/price errors only after a submit attempt', async () => {
    component.form.title = '';
    component.form.price = null;
    expect(component.titleInvalid).toBeFalse();
    expect(component.priceInvalid).toBeFalse();
    await component.submit();
    expect(component.titleInvalid).toBeTrue();
    expect(component.priceInvalid).toBeTrue();
  });

  it('15. submit returns early when currentUser is null', async () => {
    component.currentUser.set(null);
    component.form.title = 'Guitar';
    component.form.price = 100;
    supabaseSpy.client.from.calls.reset();
    await component.submit();
    expect(supabaseSpy.client.from).not.toHaveBeenCalled();
  });

  it('16. submit sets submitting to true during execution', async () => {
    let capturedDuringSubmit = false;
    supabaseSpy.client.from.and.callFake(() => {
      capturedDuringSubmit = component.submitting();
      return mockBuilder({ data: { id: 'g-1' }, error: null });
    });
    readyToSubmit();
    await component.submit();
    expect(capturedDuringSubmit).toBeTrue();
  });

  it('sends sellers without a profile to onboarding before uploading anything', async () => {
    readyToSubmit();
    component.userProfile.set(null);
    (supabaseSpy.client as any).rpc = jasmine.createSpy('rpc').and.resolveTo({ data: null, error: null });
    await component.submit();
    expect(supabaseSpy.client.from).not.toHaveBeenCalledWith('gear_listings');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('17. submit resets submitting to false in finally on success', async () => {
    readyToSubmit();
    await component.submit();
    expect(component.submitting()).toBeFalse();
  });

  it('17b. submit resets submitting to false in finally on DB error', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: { message: 'fail' } }));
    readyToSubmit();
    await component.submit();
    expect(component.submitting()).toBeFalse();
  });

  it('18. submit calls toast.error on unexpected exception', async () => {
    supabaseSpy.client.from.and.throwError('Unexpected DB failure');
    readyToSubmit();
    await component.submit();
    expect(toastSpy.error).toHaveBeenCalledWith('Error inesperado. Inténtalo de nuevo.');
    expect(component.submitting()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // ngOnInit() — auth guard
  // -------------------------------------------------------------------------

  it('19. ngOnInit redirects to /auth/login when supabase returns no user', async () => {
    supabaseSpy.auth.getUser.and.returnValue(
      Promise.resolve({ data: { user: null } })
    );
    await component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  // -------------------------------------------------------------------------
  // Conditions (legacy Spanish values in the DB)
  // -------------------------------------------------------------------------

  it('20. offers the form conditions without the legacy-only "Muy bueno"', () => {
    expect(component.conditions.map(c => c.id)).toEqual(['new', 'like_new', 'good', 'acceptable']);
  });

  function editListingWithCondition(condition: string) {
    routeMock.snapshot.paramMap.get.and.returnValue('g1');
    const listing = { id: 'g1', title: 'Guitarra', description: '', price: 100, category: 'Guitarras', condition, city: 'Madrid', images: [] };
    supabaseSpy.client.from.and.callFake((table: string) =>
      table === 'gear_listings' ? mockBuilder({ data: listing, error: null }) : mockBuilder({ data: null, error: null }));
    return component.ngOnInit();
  }

  it('21. editing a listing stored as "bueno" selects the "good" option', async () => {
    await editListingWithCondition('bueno');
    expect(component.form.condition).toBe('good');
  });

  it('22. editing a legacy "muy bueno" listing keeps it selectable', async () => {
    await editListingWithCondition('muy bueno');
    expect(component.form.condition).toBe('muy bueno');
    expect(component.conditions.some(c => c.id === 'muy bueno' && c.label === 'Muy bueno')).toBeTrue();
  });
});
