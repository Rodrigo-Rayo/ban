import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { TeacherFormComponent } from './teacher-form.component';
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

describe('professional profile forms: one account, one profile', () => {
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

    it('shows the one-profile notice and never saves when the account already has another profile', async () => {
      supabase.client.from.and.callFake((t: string) => builder({ data: t === 'musicians' ? { id: 'm1' } : null, error: null }));
      await component.ngOnInit();
      expect(component.otherProfile()).toBe('musician');
      supabase.client.from.calls.reset();
      await component.onSubmit();
      expect(supabase.client.from).not.toHaveBeenCalled();
    });

    it('saves when the account has no other profile', async () => {
      supabase.client.from.and.callFake(() => builder({ data: null, error: null }));
      await component.ngOnInit();
      expect(component.otherProfile()).toBeNull();
      component.form.patchValue({ name: 'Rodri', city: 'Madrid' });
      supabase.client.from.and.callFake(() => builder({ data: { id: 't1' }, error: null }));
      await component.onSubmit();
      expect(supabase.client.from).toHaveBeenCalledWith('teachers');
    });
  });
});
