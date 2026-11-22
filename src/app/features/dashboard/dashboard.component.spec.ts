import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DashboardComponent, hasRecentBandAd } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Event as AppEvent } from '../../core/models';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { MediaUploadService } from '../../core/services/media-upload.service';

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

  describe('event poster in the inline editor', () => {
    function setupUpdate(available: boolean) {
      const update = jasmine.createSpy('update').and.callFake(() => {
        const chain = { eq: () => chain, then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res) };
        return chain;
      });
      const supabase = TestBed.inject(SupabaseService) as unknown as { client: { from: () => unknown } };
      supabase.client.from = () => ({ update });
      const features = TestBed.inject(MediaFeaturesService);
      spyOn(features, 'state').and.returnValue(signal(available).asReadonly());
      return update;
    }

    it('never sends image_url while the column does not exist', async () => {
      const update = setupUpdate(false);
      const fresh = TestBed.createComponent(DashboardComponent).componentInstance;
      fresh.events.set([makeEvent('a')]);
      fresh.startEditEvent(makeEvent('a'), domEvent());
      await fresh.saveEditEvent('a');
      expect(update).toHaveBeenCalled();
      expect('image_url' in update.calls.mostRecent().args[0]).toBeFalse();
    });

    it('uploads a new poster and saves its URL once available', async () => {
      const update = setupUpdate(true);
      const upload = spyOn(TestBed.inject(MediaUploadService), 'upload').and.resolveTo('https://cdn.test/media/u1/events/n.jpg');
      const fresh = TestBed.createComponent(DashboardComponent).componentInstance;
      fresh.events.set([makeEvent('a')]);
      fresh.startEditEvent(makeEvent('a'), domEvent());
      fresh.onEditPosterChange({ target: { files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })], value: 'x' } } as unknown as Event);
      await fresh.saveEditEvent('a');
      expect(upload).toHaveBeenCalled();
      expect(update.calls.mostRecent().args[0].image_url).toBe('https://cdn.test/media/u1/events/n.jpg');
      expect(fresh.events()[0].image_url).toBe('https://cdn.test/media/u1/events/n.jpg');
    });

    it('clears the poster when removed', async () => {
      const update = setupUpdate(true);
      spyOn(TestBed.inject(MediaUploadService), 'remove').and.resolveTo();
      const fresh = TestBed.createComponent(DashboardComponent).componentInstance;
      const ev = { ...makeEvent('a'), image_url: 'https://cdn.test/media/u1/events/old.jpg' } as AppEvent;
      fresh.events.set([ev]);
      fresh.startEditEvent(ev, domEvent());
      fresh.removeEditPoster();
      expect(fresh.editPosterShown()).toBeNull();
      await fresh.saveEditEvent('a');
      expect(update.calls.mostRecent().args[0].image_url).toBeNull();
    });
  });

  describe('Se busca card ("¿Os falta alguien?")', () => {
    const DAY = 86400000;
    const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

    /** Panel load with one profile row and the given own posts; records every table queried. */
    function loadPanel(type: 'band' | 'musician', posts: { type: string; created_at: string }[]) {
      const tables: string[] = [];
      const rows: Record<string, unknown> = {
        [type === 'band' ? 'bands' : 'musicians']: { id: 'p1', name: 'Los Test', city: 'Valencia', user_id: 'u1' },
        posts: posts.map((p, i) => ({ id: `post${i}`, text: 'x', city: null, ...p })),
      };
      const supabase = TestBed.inject(SupabaseService) as unknown as { client: { from: (t: string) => unknown }; auth: unknown };
      supabase.auth = { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) };
      supabase.client.from = (table: string) => {
        tables.push(table);
        const isList = table === 'posts' || table === 'events' || table === 'gear_listings';
        const result = { data: rows[table] ?? (isList ? [] : null), error: null };
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'order', 'limit', 'gte']) chain[m] = () => chain;
        chain['maybeSingle'] = () => Promise.resolve(result);
        chain['then'] = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
        return chain;
      };
      const fx = TestBed.createComponent(DashboardComponent);
      return { fx, tables };
    }

    async function render(fx: ComponentFixture<DashboardComponent>) {
      await fx.componentInstance.ngOnInit();
      fx.detectChanges();
      return fx.nativeElement as HTMLElement;
    }

    beforeEach(() => { try { localStorage.removeItem('bandyou_post_nudge_until'); } catch { /* ignore */ } });
    afterEach(() => { try { localStorage.removeItem('bandyou_post_nudge_until'); } catch { /* ignore */ } });

    it('shows for a band without a "Buscamos músico" ad in the last 30 days, linking to the prefilled composer', async () => {
      const { fx } = loadPanel('band', [
        { type: 'band_seeking_musician', created_at: iso(45) },
        { type: 'collab', created_at: iso(2) },
      ]);
      const el = await render(fx);
      expect(fx.componentInstance.showPostNudge()).toBeTrue();
      expect(el.querySelector('#post-nudge-title')?.textContent).toContain('¿Os falta alguien?');
      expect(el.textContent).toContain('los músicos de Valencia lo verán en Se busca y en Google');
      const link = Array.from(el.querySelectorAll('a')).find(a => a.textContent?.includes('Publicar anuncio'));
      expect(link?.getAttribute('href')).toBe('/feed?new=1');
    });

    it('stays hidden for a band with a recent "Buscamos músico" ad', async () => {
      const { fx } = loadPanel('band', [{ type: 'band_seeking_musician', created_at: iso(10) }]);
      const el = await render(fx);
      expect(fx.componentInstance.showPostNudge()).toBeFalse();
      expect(el.querySelector('#post-nudge-title')).toBeNull();
    });

    it('never shows the band card to musicians and adds no query for it', async () => {
      const { fx, tables } = loadPanel('musician', [{ type: 'musician_seeking_band', created_at: iso(3) }]);
      await fx.componentInstance.ngOnInit();
      // The panel's own load only: the posts list it already shows, nothing extra for the card.
      expect(tables.filter(t => t === 'posts').length).toBe(1);
      expect(fx.componentInstance.showPostNudge()).toBeFalse();
    });

    it('"Ahora no" hides it and the choice survives a reload', async () => {
      const first = loadPanel('band', []);
      const el = await render(first.fx);
      (Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Ahora no')) as HTMLButtonElement).click();
      first.fx.detectChanges();
      expect(el.querySelector('#post-nudge-title')).toBeNull();
      expect(Number(localStorage.getItem('bandyou_post_nudge_until'))).toBeGreaterThan(Date.now());

      const again = loadPanel('band', []);
      await render(again.fx);
      expect(again.fx.componentInstance.showPostNudge()).toBeFalse();
    });

    it('hasRecentBandAd counts only band_seeking_musician ads from the last 30 days', () => {
      expect(hasRecentBandAd([{ type: 'band_seeking_musician', created_at: iso(29) }])).toBeTrue();
      expect(hasRecentBandAd([{ type: 'band_seeking_musician', created_at: iso(31) }])).toBeFalse();
      expect(hasRecentBandAd([{ type: 'musician_seeking_band', created_at: iso(1) }])).toBeFalse();
    });
  });
});
