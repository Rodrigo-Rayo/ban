import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService, Toast, ToastType } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with an empty toasts list', () => {
    expect(service.toasts()).toEqual([]);
  });

  describe('show()', () => {
    it('adds a toast with the correct message, type, and id', () => {
      service.show('Hello', 'success');
      const toasts = service.toasts();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Hello');
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].id).toBeGreaterThan(0);
    });

    it('defaults type to success when not specified', () => {
      service.show('Default type');
      expect(service.toasts()[0].type).toBe('success');
    });

    it('auto-dismisses after the default durationMs of 3500ms', fakeAsync(() => {
      service.show('Auto-dismiss');
      expect(service.toasts().length).toBe(1);
      tick(3500);
      expect(service.toasts().length).toBe(0);
    }));

    it('auto-dismisses after a custom durationMs', fakeAsync(() => {
      service.show('Custom duration', 'info', 1000);
      expect(service.toasts().length).toBe(1);
      tick(999);
      expect(service.toasts().length).toBe(1);
      tick(1);
      expect(service.toasts().length).toBe(0);
    }));

    it('does not dismiss before durationMs has elapsed', fakeAsync(() => {
      service.show('Still visible', 'info', 2000);
      tick(1999);
      expect(service.toasts().length).toBe(1);
      tick(1);
    }));

    it('assigns unique ids to each toast', () => {
      service.show('First');
      service.show('Second');
      service.show('Third');
      const ids = service.toasts().map((t: Toast) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('allows multiple toasts to coexist before any timer fires', fakeAsync(() => {
      service.show('Toast A', 'success', 5000);
      service.show('Toast B', 'error', 5000);
      service.show('Toast C', 'info', 5000);
      expect(service.toasts().length).toBe(3);
      tick(5000);
      expect(service.toasts().length).toBe(0);
    }));

    it('dismisses toasts independently when durations differ', fakeAsync(() => {
      service.show('Short', 'info', 1000);
      service.show('Long', 'info', 3000);
      tick(1000);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Long');
      tick(2000);
      expect(service.toasts().length).toBe(0);
    }));
  });

  describe('success()', () => {
    it('creates a toast with type success', () => {
      service.success('Operation succeeded');
      const toast = service.toasts()[0];
      expect(toast.type).toBe('success');
      expect(toast.message).toBe('Operation succeeded');
    });

    it('auto-dismisses after 3500ms', fakeAsync(() => {
      service.success('Done');
      tick(3500);
      expect(service.toasts().length).toBe(0);
    }));
  });

  describe('error()', () => {
    it('creates a toast with type error', () => {
      service.error('Something went wrong');
      const toast = service.toasts()[0];
      expect(toast.type).toBe('error');
      expect(toast.message).toBe('Something went wrong');
    });

    it('auto-dismisses after 5000ms', fakeAsync(() => {
      service.error('Failure');
      tick(4999);
      expect(service.toasts().length).toBe(1);
      tick(1);
      expect(service.toasts().length).toBe(0);
    }));

    it('stays visible before 5000ms have elapsed', fakeAsync(() => {
      service.error('Persistent error');
      tick(3500);
      expect(service.toasts().length).toBe(1);
      tick(1500);
    }));
  });

  describe('info()', () => {
    it('creates a toast with type info', () => {
      service.info('Just so you know');
      const toast = service.toasts()[0];
      expect(toast.type).toBe('info');
      expect(toast.message).toBe('Just so you know');
    });

    it('auto-dismisses after 3500ms', fakeAsync(() => {
      service.info('FYI');
      tick(3500);
      expect(service.toasts().length).toBe(0);
    }));
  });

  describe('dismiss()', () => {
    it('removes the toast with the matching id', () => {
      service.show('Keep', 'info', 9999);
      service.show('Remove', 'info', 9999);
      const toasts = service.toasts();
      const idToRemove = toasts[1].id;
      service.dismiss(idToRemove);
      const remaining = service.toasts();
      expect(remaining.length).toBe(1);
      expect(remaining[0].message).toBe('Keep');
    });

    it('does not alter the list when an unknown id is provided', fakeAsync(() => {
      service.show('Stays', 'success', 9999);
      const before = service.toasts().length;
      service.dismiss(99999);
      expect(service.toasts().length).toBe(before);
      tick(9999);
    }));

    it('leaves an empty list when dismissing the only toast', fakeAsync(() => {
      service.show('Lone toast', 'success', 9999);
      const id = service.toasts()[0].id;
      service.dismiss(id);
      expect(service.toasts()).toEqual([]);
      tick(9999);
    }));

    it('is a no-op on an already empty list', () => {
      service.dismiss(1);
      expect(service.toasts()).toEqual([]);
    });
  });
});
