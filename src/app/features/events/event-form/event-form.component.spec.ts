import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { EventFormComponent, futureDate } from './event-form.component';
import { localToday } from '../../../core/utils/date';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { MediaUploadService } from '../../../core/services/media-upload.service';

describe('EventFormComponent', () => {
  let component: EventFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventFormComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: {} },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
      ],
    })
      .overrideComponent(EventFormComponent, { set: { imports: [ReactiveFormsModule], template: '<div></div>' } })
      .compileComponents();
    component = TestBed.createComponent(EventFormComponent).componentInstance;
  });

  it('requires a time (events.time is NOT NULL in the database)', () => {
    component.form.patchValue({ title: 'Concierto de prueba', venue: 'Sala', city: 'Madrid', date: localToday(), genre: 'Rock', time: '' });
    expect(component.form.get('time')!.hasError('required')).toBeTrue();
    expect(component.form.valid).toBeFalse();

    component.form.patchValue({ time: '21:00' });
    expect(component.form.valid).toBeTrue();
  });

  it('genre is optional', () => {
    component.form.patchValue({ title: 'Concierto de prueba', venue: 'Sala', city: 'Madrid', date: localToday(), time: '21:00', genre: '' });
    expect(component.form.valid).toBeTrue();
  });

  it('accepts today in local time and rejects yesterday', () => {
    const today = localToday();
    const yesterday = localToday(new Date(Date.now() - 86400000));
    expect(futureDate(new FormControl(today))).toBeNull();
    expect(futureDate(new FormControl(yesterday))).toEqual({ pastDate: true });
  });

  it('localToday uses the local calendar day, not UTC', () => {
    // 00:30 local time on Jan 2 must be Jan 2 even where UTC is still Jan 1.
    const localMidnightish = new Date(2026, 0, 2, 0, 30);
    expect(localToday(localMidnightish)).toBe('2026-01-02');
  });
});

describe('EventFormComponent poster (feature-detected)', () => {
  let insert: jasmine.Spy;
  let upload: jasmine.Spy;

  async function setup(available: boolean) {
    insert = jasmine.createSpy('insert').and.returnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'ev1' }, error: null }) }),
    });
    upload = jasmine.createSpy('upload').and.resolveTo('https://cdn.test/media/u1/events/1-a.jpg');
    const state = signal(available);
    await TestBed.configureTestingModule({
      imports: [EventFormComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: {
          auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
          client: { from: () => ({ insert }) },
        } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: MediaFeaturesService, useValue: { state: () => state.asReadonly(), has: () => Promise.resolve(available) } },
        { provide: MediaUploadService, useValue: { upload } },
      ],
    })
      .overrideComponent(EventFormComponent, { set: { imports: [ReactiveFormsModule], template: '<div></div>' } })
      .compileComponents();
    const component = TestBed.createComponent(EventFormComponent).componentInstance;
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.form.patchValue({ title: 'Concierto de prueba', venue: 'Sala', city: 'Madrid', date: localToday(), time: '21:00' });
    return component;
  }

  function pick(component: EventFormComponent, file: File) {
    component.onPosterChange({ target: { files: [file], value: 'x' } } as unknown as Event);
  }

  it('without the image_url column: no poster UI and the insert never names image_url', async () => {
    const component = await setup(false);
    expect(component.canAddPoster()).toBeFalse();
    await component.onSubmit();
    expect(insert).toHaveBeenCalled();
    expect('image_url' in insert.calls.mostRecent().args[0]).toBeFalse();
    expect(upload).not.toHaveBeenCalled();
  });

  it('with the column but no poster chosen: the insert stays as today', async () => {
    const component = await setup(true);
    expect(component.canAddPoster()).toBeTrue();
    await component.onSubmit();
    expect('image_url' in insert.calls.mostRecent().args[0]).toBeFalse();
  });

  it('with the column and a poster: uploads it and saves its URL', async () => {
    const component = await setup(true);
    pick(component, new File(['x'], 'cartel.jpg', { type: 'image/jpeg' }));
    expect(component.posterPreview()).toBeTruthy();
    await component.onSubmit();
    expect(upload).toHaveBeenCalledWith(jasmine.any(File), 'events');
    expect(insert.calls.mostRecent().args[0].image_url).toBe('https://cdn.test/media/u1/events/1-a.jpg');
  });

  it('does not publish when the poster upload fails', async () => {
    const component = await setup(true);
    upload.and.resolveTo(null);
    pick(component, new File(['x'], 'cartel.png', { type: 'image/png' }));
    await component.onSubmit();
    expect(insert).not.toHaveBeenCalled();
    expect(component.error()).toContain('No se pudo subir el cartel');
  });

  it('rejects a non-image poster with a Spanish message', async () => {
    const component = await setup(true);
    pick(component, new File(['x'], 'cartel.pdf', { type: 'application/pdf' }));
    expect(component.posterFile()).toBeNull();
    expect(component.posterError()).toBe('Usa una imagen JPG, PNG o WebP.');
  });
});
