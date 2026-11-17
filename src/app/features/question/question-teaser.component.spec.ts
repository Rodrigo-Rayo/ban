import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QuestionTeaserComponent } from './question-teaser.component';
import { QuestionsService } from '../../core/services/questions.service';

describe('QuestionTeaserComponent', () => {
  async function render(questions: unknown) {
    TestBed.configureTestingModule({
      imports: [QuestionTeaserComponent],
      providers: [provideRouter([]), { provide: QuestionsService, useValue: { questions: () => Promise.resolve(questions) } }],
    });
    const fixture = TestBed.createComponent(QuestionTeaserComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('links to the open question', async () => {
    const el = await render([{ id: 'q1', title: '¿El peor bolo?', opens_at: new Date(Date.now() - 864e5).toISOString(), closes_at: new Date(Date.now() + 5 * 864e5).toISOString() }]);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/pregunta');
    expect(el.textContent).toContain('¿El peor bolo?');
    expect(el.textContent).toContain('Quedan');
  });

  it('renders nothing without an open question or without the feature', async () => {
    expect((await render(null)).querySelector('a')).toBeNull();
  });
});
