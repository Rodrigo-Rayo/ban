import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { TeacherFormComponent } from './teacher-form.component';
import { confirmSecondProfile } from './professional-profile';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';

function builder(result: { data?: any; error?: any }) {
  const b: any = { then(res: any, rej: any) { return Promise.resolve(result).then(res, rej); } };
  ['select', 'eq', 'upsert'].forEach(m => (b[m] = jasmine.createSpy(m).and.returnValue(b)));
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.resolveTo(result);
  b.single = jasmine.createSpy('single').and.resolveTo(result);
  return b;
}

describe('professional profile forms: second profile warning', () => {
  describe('confirmSecondProfile()', () => {
    let confirm: jasmine.SpyObj<ConfirmService>;
    const auth = (type: string) => ({ userProfileType: () => type }) as unknown as AuthService;
    beforeEach(() => {
      confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
      confirm.ask.and.resolveTo(true);
    });

    it('does not ask when the user has no profile', async () => {
      expect(await confirmSecondProfile(auth(''), confirm, 'teacher', false)).toBeTrue();
      expect(confirm.ask).not.toHaveBeenCalled();
    });

    it('does not ask when the existing profile is the same type or when editing', async () => {
      expect(await confirmSecondProfile(auth('teacher'), confirm, 'teacher', false)).toBeTrue();
      expect(await confirmSecondProfile(auth('musician'), confirm, 'teacher', true)).toBeTrue();
      expect(confirm.ask).not.toHaveBeenCalled();
    });

    it('asks when the user already has a profile of a different type', async () => {
      await confirmSecondProfile(auth('musician'), confirm, 'venue', false);
      expect(confirm.ask).toHaveBeenCalledTimes(1);
      expect(confirm.ask.calls.mostRecent().args[0].title).toContain('músico');
    });

    it('returns false when the user cancels', async () => {
      confirm.ask.and.resolveTo(false);
      expect(await confirmSecondProfile(auth('band'), confirm, 'rehearsal', false)).toBeFalse();
    });
  });

  describe('TeacherFormComponent', () => {
    let component: TeacherFormComponent;
    let supabase: any;
    let confirm: jasmine.SpyObj<ConfirmService>;

    beforeEach(async () => {
      confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
      confirm.ask.and.resolveTo(false);
      supabase = {
        auth: { getUser: jasmine.createSpy().and.resolveTo({ data: { user: { id: 'u1' } } }) },
        client: { from: jasmine.createSpy('from').and.callFake(() => builder({ data: null, error: null })) },
      };
      await TestBed.configureTestingModule({
        imports: [TeacherFormComponent],
        providers: [
          provideRouter([]),
          { provide: SupabaseService, useValue: supabase },
          { provide: ConfirmService, useValue: confirm },
          { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
          { provide: AuthService, useValue: { userProfileType: () => 'musician', userProfileData: () => ({ name: 'Rodri' }) } },
        ],
      })
        .overrideComponent(TeacherFormComponent, { set: { imports: [ReactiveFormsModule], template: '<div></div>' } })
        .compileComponents();
      component = TestBed.createComponent(TeacherFormComponent).componentInstance;
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    });

    it('prefills the name from the existing profile', async () => {
      await component.ngOnInit();
      expect(component.form.get('name')!.value).toBe('Rodri');
    });

    it('warns before saving and does not save when the user cancels', async () => {
      await component.ngOnInit();
      supabase.client.from.calls.reset();
      await component.onSubmit();
      expect(confirm.ask).toHaveBeenCalled();
      expect(supabase.client.from).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('saves after the user accepts', async () => {
      confirm.ask.and.resolveTo(true);
      supabase.client.from.and.callFake(() => builder({ data: { id: 't1' }, error: null }));
      await component.ngOnInit();
      await component.onSubmit();
      expect(supabase.client.from).toHaveBeenCalledWith('teachers');
    });
  });
});
