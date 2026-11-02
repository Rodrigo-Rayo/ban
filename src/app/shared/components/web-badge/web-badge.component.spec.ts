import { TestBed } from '@angular/core/testing';
import { WebBadgeComponent, webBadgeSnippet } from './web-badge.component';
import { ToastService } from '../../../core/services/toast.service';

describe('WebBadgeComponent', () => {
  function render(path: string) {
    TestBed.configureTestingModule({
      providers: [{ provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) }],
    });
    const fixture = TestBed.createComponent(WebBadgeComponent);
    fixture.componentRef.setInput('path', path);
    fixture.detectChanges();
    return fixture;
  }

  it('links to the profile on the real site, whatever host it was copied from', () => {
    expect(webBadgeSnippet('/bands/123')).toContain('href="https://www.bandyou.es/bands/123"');
    expect(webBadgeSnippet('/bands/123')).toContain('src="https://www.bandyou.es/badge-bandyou.png"');
  });

  it('shows the code to paste', () => {
    const el = render('/musicians/9').nativeElement as HTMLElement;
    expect(el.querySelector('code')?.textContent).toContain('/musicians/9');
  });

  it('copies the code and says so', async () => {
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    const fixture = render('/bands/123');
    await fixture.componentInstance.copy();
    expect(write).toHaveBeenCalledWith(webBadgeSnippet('/bands/123'));
    expect(fixture.componentInstance.copied()).toBeTrue();
  });

  it('reports a failed copy instead of pretending it worked', async () => {
    spyOn(navigator.clipboard, 'writeText').and.rejectWith(new Error('denied'));
    const fixture = render('/bands/123');
    await fixture.componentInstance.copy();
    expect(TestBed.inject(ToastService).error).toHaveBeenCalled();
    expect(fixture.componentInstance.copied()).toBeFalse();
  });
});
