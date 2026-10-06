import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { MediaFeaturesService } from '../../core/services/media-features.service';

const USER = { id: 'user-1', user_metadata: { terms_accepted_at: '2026-01-01' } };
const MUSICIAN_ROW = { id: 'm1', name: 'Lola', city: 'Madrid', genre: 'Rock', instrument: 'Guitarra' };

/** Thenable query builder: every chained call returns itself, awaiting resolves to `result`. */
function builder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'upsert', 'delete', 'update', 'limit']) b[m] = () => b;
  b['maybeSingle'] = () => Promise.resolve(result);
  b['single'] = () => Promise.resolve(result);
  b['then'] = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return b;
}

function makeSupabase(existing: { table: string; row: unknown } | null) {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: USER } }),
      updateUser: () => Promise.resolve({}),
    },
    client: {
      from: (table: string) =>
        builder({ data: existing && existing.table === table ? existing.row : null, error: null }),
    },
  };
}

describe('OnboardingComponent', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  let router: Router;
  let toast: jasmine.SpyObj<ToastService>;
  let confirm: jasmine.SpyObj<ConfirmService>;

  async function setup(existing: { table: string; row: unknown } | null) {
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    confirm.ask.and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: makeSupabase(existing) },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    localStorage.removeItem('bandyou_role');
    await component.ngOnInit();
  }

  afterEach(() => localStorage.removeItem('bandyou_role'));

  describe('creating a profile', () => {
    beforeEach(() => setup(null));

    it('starts at the role step', () => {
      expect(component.isEditing()).toBeFalse();
      expect(component.step()).toBe(0);
    });

    it('says "Crear perfil" / "Creando perfil…" (the account already exists)', () => {
      expect(component.submitLabel()).toBe('Crear perfil');
      expect(component.submitBusyLabel()).toBe('Creando perfil…');
    });

    it('lands on /dashboard (where "Cambiar foto" lives) with a toast', async () => {
      component.role.set('musician');
      component.nameForm.patchValue({ name: 'Lola' });
      await component.onSubmit();
      expect(toast.success).toHaveBeenCalledWith('Perfil creado.');
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('sends listeners to /home (no profile row to hold a photo)', async () => {
      component.role.set('listener');
      component.nameForm.patchValue({ name: 'Ana' });
      await component.onSubmit();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('uses "Sala" and "Local" in the role list', () => {
      const labels = Object.fromEntries(component.roles.map(r => [r.id, r.label]));
      expect(labels['venue']).toBe('Sala');
      expect(labels['rehearsal']).toBe('Local');
    });
  });

  describe('editing a profile', () => {
    beforeEach(() => setup({ table: 'musicians', row: MUSICIAN_ROW }));

    it('detects the existing profile and skips the role step', () => {
      expect(component.isEditing()).toBeTrue();
      expect(component.step()).toBe(1);
      expect(component.nameForm.value.name).toBe('Lola');
    });

    it('says "Guardar cambios" / "Guardando…"', () => {
      expect(component.submitLabel()).toBe('Guardar cambios');
      expect(component.submitBusyLabel()).toBe('Guardando…');
    });

    it('saves, shows "Perfil actualizado." and goes to /dashboard', async () => {
      await component.onSubmit();
      expect(toast.success).toHaveBeenCalledWith('Perfil actualizado.');
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
      expect(confirm.ask).not.toHaveBeenCalled();
    });

    it('"Atrás" on the first step leaves for /dashboard instead of the role step', () => {
      component.back();
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
      expect(component.step()).toBe(1);
    });

    it('"Cambiar tipo de perfil" opens the role step explicitly', () => {
      component.changeRole();
      expect(component.step()).toBe(0);
    });

    it('asks through ConfirmService (not window.confirm) before a role change', async () => {
      const nativeConfirm = spyOn(window, 'confirm');
      confirm.ask.and.resolveTo(false);
      component.role.set('band');
      await component.onSubmit();
      expect(confirm.ask).toHaveBeenCalledWith(jasmine.objectContaining({ danger: true }));
      expect(nativeConfirm).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('"También doy clases" (musicians.gives_lessons)', () => {
    it('loads the saved choice and sends it on save', async () => {
      await setup({ table: 'musicians', row: { ...MUSICIAN_ROW, gives_lessons: true } });
      const supabase = TestBed.inject(SupabaseService) as unknown as { client: { from: (t: string) => Record<string, unknown> } };
      const upserts: Record<string, unknown>[] = [];
      const original = supabase.client.from;
      supabase.client.from = (t: string) => {
        const b = original(t);
        const up = b['upsert'] as (row: Record<string, unknown>) => unknown;
        b['upsert'] = (row: Record<string, unknown>) => { if (t === 'musicians') upserts.push(row); return up(row); };
        return b;
      };
      await TestBed.inject(MediaFeaturesService).has('giveLessons');
      expect(component.canGiveLessons()).toBeTrue();
      expect(component.givesLessons()).toBeTrue();
      component.givesLessons.set(false);
      await component.onSubmit();
      expect(upserts.at(-1)?.['gives_lessons']).toBeFalse();
    });
  });
});
