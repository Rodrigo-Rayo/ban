import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { EventFormComponent, futureDate } from './event-form.component';
import { localToday } from '../../../core/utils/date';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';

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
