import { TestBed } from '@angular/core/testing';
import { StoryButtonComponent } from './story-button.component';
import { ToastService } from '../../../core/services/toast.service';

describe('StoryButtonComponent', () => {
  function render(card: unknown) {
    TestBed.configureTestingModule({
      providers: [{ provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) }],
    });
    const fixture = TestBed.createComponent(StoryButtonComponent);
    fixture.componentRef.setInput('card', card);
    fixture.componentRef.setInput('label', 'Tu cartel para historias');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('is hidden until there is something to draw', () => {
    expect(render(null).querySelector('button')).toBeNull();
  });

  it('shows the given label once the profile is there', () => {
    const el = render({ kicker: 'Banda · Madrid', title: 'Stormy', lines: ['Rock'] });
    expect(el.querySelector('button')?.textContent).toContain('Tu cartel para historias');
  });
});
