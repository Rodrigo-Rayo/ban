import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TestComponent } from './test.component';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { QUESTIONS } from './test-data';

describe('TestComponent', () => {
  function render(vs: string | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(vs ? { vs } : {}) } } },
        { provide: SeoService, useValue: jasmine.createSpyObj('SeoService', ['set']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
      ],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: ReturnType<typeof render>) => f.nativeElement as HTMLElement;
  const click = (f: ReturnType<typeof render>, selector: string, i = 0) => {
    (el(f).querySelectorAll(selector)[i] as HTMLElement).click();
    f.detectChanges();
  };

  it('plays a whole gig day, including the question against the clock, to a result', fakeAsync(() => {
    const f = render();
    click(f, '.btn-primary');
    click(f, '.inst button', 2);
    for (let q = 0; q < QUESTIONS.length; q++) {
      expect(el(f).querySelector('.q')?.textContent).toContain(QUESTIONS[q].q);
      if (QUESTIONS[q].urgent) {
        tick(6100);
        f.detectChanges();
        expect(el(f).querySelector('.react')?.textContent).toContain(QUESTIONS[q].timeout!);
      } else {
        click(f, '.opt');
        expect(el(f).querySelector('.react')?.textContent).toContain(QUESTIONS[q].a[0][2]);
      }
      tick(1500);
      f.detectChanges();
    }
    tick(2100);
    f.detectChanges();
    expect(el(f).querySelector('.type-name')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(el(f).querySelector('.inst-name')?.textContent).toContain('Batería');
    tick(1000);
    discardPeriodicTasks();
  }));

  it('ignores a second tap on the same question', fakeAsync(() => {
    const f = render();
    click(f, '.btn-primary');
    click(f, '.inst button');
    click(f, '.opt', 0);
    click(f, '.opt', 1);
    expect(el(f).querySelectorAll('.opt.picked').length).toBe(1);
    tick(1500);
    discardPeriodicTasks();
  }));

  it('shows the challenger from the link and the compatibility at the end', fakeAsync(() => {
    const f = render('met');
    expect(el(f).querySelector('.vs')?.textContent).toContain('El metrónomo');
    click(f, '.btn-primary');
    click(f, '.inst button');
    for (const q of QUESTIONS) {
      if (q.urgent) tick(6100); else click(f, '.opt');
      tick(1500);
      f.detectChanges();
    }
    tick(2100);
    f.detectChanges();
    expect(el(f).querySelector('.duel')?.textContent).toContain('compatibles');
    tick(1000);
    discardPeriodicTasks();
  }));

  it('ignores an unknown challenger in the link', () => {
    expect(el(render('xyz')).querySelector('.vs')).toBeNull();
  });
});
