import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BandProfileComponent } from './band-profile.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { Band, BandVacancy } from '../../../core/models';

const band = { id: 'b-1', user_id: 'owner-1', name: 'Los Tests', city: 'Madrid', genre: 'Rock', avatar_url: null } as unknown as Band;
const closedVacancy = { id: 'v-1', band_id: 'b-1', instrument: 'Batería', description: '', genre: '', open: false } as unknown as BandVacancy;
const openVacancy = { id: 'v-2', band_id: 'b-1', instrument: 'Bajo', description: '', genre: '', open: true } as unknown as BandVacancy;

describe('BandProfileComponent', () => {
  let component: BandProfileComponent;
  let confirmSpy: jasmine.SpyObj<ConfirmService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let notifSpy: jasmine.SpyObj<NotificationsService>;
  let deleteResult: { data: any; error: any };
  let deleteCalls: string[];

  beforeEach(async () => {
    deleteResult = { data: [{ id: 'v-1' }], error: null };
    deleteCalls = [];
    const table = (name: string) => {
      const b: any = {};
      b.delete = () => { deleteCalls.push(name); return b; };
      b.update = () => b;
      b.insert = () => Promise.resolve({ error: null });
      b.eq = () => b;
      b.select = () => Promise.resolve(name === 'band_vacancies' ? deleteResult : { data: [], error: null });
      b.then = (res: any, rej: any) => Promise.resolve({ error: null }).then(res, rej);
      return b;
    };
    const supabase = {
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
      client: { from: (t: string) => table(t) },
    };
    confirmSpy = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']);
    notifSpy = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['create']);
    notifSpy.create.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [BandProfileComponent],
      providers: [
        { provide: SupabaseService, useValue: supabase },
        { provide: MessagesService, useValue: jasmine.createSpyObj('MessagesService', ['getOrCreateConversation']) },
        { provide: FavoritesService, useValue: jasmine.createSpyObj('FavoritesService', ['isFavorite', 'toggle']) },
        { provide: NotificationsService, useValue: notifSpy },
        { provide: SeoService, useValue: jasmine.createSpyObj('SeoService', ['setProfile', 'injectJsonLd', 'setNotFound']) },
        { provide: ToastService, useValue: toastSpy },
        { provide: ConfirmService, useValue: confirmSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'b-1' } } } },
      ],
    })
    .overrideComponent(BandProfileComponent, { set: { imports: [], template: '<div></div>' } })
    .compileComponents();

    component = TestBed.createComponent(BandProfileComponent).componentInstance;
    component.band.set(band);
    component.currentUserId.set('owner-1');
    component.vacancies.set([closedVacancy, openVacancy]);
  });

  it('detects the owner and hides messaging for them', () => {
    expect(component.isOwner()).toBeTrue();
    expect(component.canMessage()).toBeFalse();
    component.currentUserId.set('visitor');
    expect(component.isOwner()).toBeFalse();
    expect(component.canMessage()).toBeTrue();
  });

  it('uses the full instrument list and no "Cualquiera" genre', () => {
    expect(component.instruments).toContain('Flauta');
    expect(component.instruments.length).toBeGreaterThan(11);
    expect(component.genres).not.toContain('Cualquiera');
  });

  it('deleteVacancy asks for confirmation and removes the vacancy when accepted', async () => {
    confirmSpy.ask.and.returnValue(Promise.resolve(true));
    await component.deleteVacancy(closedVacancy);
    expect(confirmSpy.ask).toHaveBeenCalledWith(jasmine.objectContaining({ danger: true, confirmLabel: 'Eliminar' }));
    expect(deleteCalls).toEqual(['band_vacancies']);
    expect(component.vacancies().map(v => v.id)).toEqual(['v-2']);
    expect(toastSpy.error).not.toHaveBeenCalled();
  });

  it('deleteVacancy does nothing when the confirmation is declined', async () => {
    confirmSpy.ask.and.returnValue(Promise.resolve(false));
    await component.deleteVacancy(closedVacancy);
    expect(deleteCalls).toEqual([]);
    expect(component.vacancies().length).toBe(2);
  });

  it('deleteVacancy surfaces an error when RLS deletes nothing', async () => {
    confirmSpy.ask.and.returnValue(Promise.resolve(true));
    deleteResult = { data: [], error: null };
    await component.deleteVacancy(closedVacancy);
    expect(toastSpy.error).toHaveBeenCalledWith('No se pudo eliminar la vacante.');
    expect(component.vacancies().length).toBe(2);
  });

  it('closeVacancy uses the confirm service instead of window.confirm', async () => {
    const nativeSpy = spyOn(window, 'confirm');
    confirmSpy.ask.and.returnValue(Promise.resolve(true));
    await component.closeVacancy('v-2');
    expect(nativeSpy).not.toHaveBeenCalled();
    expect(confirmSpy.ask).toHaveBeenCalled();
    expect(component.vacancies().find(v => v.id === 'v-2')?.open).toBeFalse();
  });

  it('submitApply notifies the band owner naming the musician', async () => {
    component.currentUserId.set('visitor');
    component.myMusicianId.set('m-9');
    component.myMusicianName.set('Ana García');
    component.vacancies.set([{ ...openVacancy, instrument: 'Batería' } as BandVacancy]);
    component.applyingTo.set('v-2');
    await component.submitApply();
    expect(notifSpy.create).toHaveBeenCalledWith(
      'owner-1', 'application', jasmine.any(String),
      'Ana García quiere tocar la batería en tu banda', 'band', 'b-1');
  });
});
