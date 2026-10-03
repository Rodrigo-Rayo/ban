import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Event as AppEvent } from '../../core/models';

function makeEvent(id: string): AppEvent {
  return { id, title: `Evento ${id}`, venue: 'Sala', city: 'Madrid', date: '2026-12-01', genre: 'Rock' } as unknown as AppEvent;
}

function domEvent(): Event {
  return { preventDefault: () => undefined, stopPropagation: () => undefined } as unknown as Event;
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let toast: jasmine.SpyObj<ToastService>;
  let deleteSpy: jasmine.Spy;

  beforeEach(async () => {
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    deleteSpy = jasmine.createSpy('delete');
    const chain = { eq: () => chain, then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res) };
    deleteSpy.and.returnValue(chain);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }), deleteAccount: () => Promise.resolve() } },
        { provide: SupabaseService, useValue: { client: { from: () => ({ delete: deleteSpy }) }, auth: {} } },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    component.events.set([makeEvent('a'), makeEvent('b')]);
  });

  it('asks through ConfirmService before deleting an event, and not through window.confirm', async () => {
    const nativeConfirm = spyOn(window, 'confirm');
    confirm.ask.and.resolveTo(true);
    await component.deleteEvent('a', domEvent());
    expect(confirm.ask).toHaveBeenCalledWith(jasmine.objectContaining({ title: '¿Eliminar este evento?', confirmLabel: 'Eliminar', danger: true }));
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('removes a confirmed event from the list immediately', async () => {
    confirm.ask.and.resolveTo(true);
    await component.deleteEvent('a', domEvent());
    expect(component.events().map(e => e.id)).toEqual(['b']);
    expect(toast.success).toHaveBeenCalledWith('Evento eliminado.');
  });

  it('keeps the event when the user cancels', async () => {
    confirm.ask.and.resolveTo(false);
    await component.deleteEvent('a', domEvent());
    expect(component.events().length).toBe(2);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('uses one tab bar with counts inside (Agenda, Se busca, Tienda)', () => {
    component.myPosts.set([{ id: 'p', type: 'collab', text: 'x', city: null, created_at: '2026-01-01' }]);
    expect(component.tabs()).toEqual([
      { id: 'events', label: 'Agenda', count: 2 },
      { id: 'posts', label: 'Se busca', count: 1 },
      { id: 'gear', label: 'Tienda', count: 0 },
    ]);
  });

  it('names profile types the way the site does: venue is "Sala", rehearsal is "Local"', () => {
    component.profileType.set('venue');
    expect(component.profileLabel()).toBe('Sala');
    component.profileType.set('rehearsal');
    expect(component.profileLabel()).toBe('Local');
  });

  it('reflects an uploaded photo on the profile', () => {
    component.profile.set({ name: 'Lola', avatar_url: null });
    component.onAvatarUploaded('https://x/avatar.png');
    expect(component.profile()?.avatar_url).toBe('https://x/avatar.png');
  });

  it('only accepts "ELIMINAR" to delete the account', async () => {
    component.deleteConfirmText.set('BORRAR');
    await component.deleteAccount();
    expect(component.deletingAccount()).toBeFalse();
  });
});
