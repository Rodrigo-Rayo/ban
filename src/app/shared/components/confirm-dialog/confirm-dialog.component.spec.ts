import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmService } from '../../../core/services/confirm.service';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let svc: ConfirmService;
  const flush = async () => { fixture.detectChanges(); await fixture.whenStable(); await Promise.resolve(); };
  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const press = (key: string, shiftKey = false) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] });
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    svc = TestBed.inject(ConfirmService);
    document.body.appendChild(fixture.nativeElement);
  });
  afterEach(() => fixture.nativeElement.remove());

  it('focuses "Cancelar" first for destructive actions', async () => {
    svc.ask({ title: '¿Eliminar?', danger: true });
    await flush();
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    svc.ask({ title: '¿Eliminar?', danger: true });
    await flush();
    press('Tab');
    expect(document.activeElement).toBe(buttons()[1]);
    press('Tab');
    expect(document.activeElement).toBe(buttons()[0]);
    press('Tab', true);
    expect(document.activeElement).toBe(buttons()[1]);
  });

  it('Escape cancels only while a question is open', async () => {
    const answer = svc.ask({ title: '¿Seguro?' });
    await flush();
    press('Escape');
    expect(await answer).toBeFalse();
    expect(() => press('Escape')).not.toThrow();
  });
});
