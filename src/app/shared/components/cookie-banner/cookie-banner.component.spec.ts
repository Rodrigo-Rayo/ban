import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CookieBannerComponent, COOKIE_NOTICE_KEY } from './cookie-banner.component';

describe('CookieBannerComponent', () => {
  let fixture: ComponentFixture<CookieBannerComponent>;
  let component: CookieBannerComponent;

  function create() {
    fixture = TestBed.createComponent(CookieBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.removeItem(COOKIE_NOTICE_KEY);
    await TestBed.configureTestingModule({
      imports: [CookieBannerComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => localStorage.removeItem(COOKIE_NOTICE_KEY));

  it('shows the notice on first visit', () => {
    create();
    expect(component.visible()).toBeTrue();
  });

  it('offers a single dismiss button and no reject/accept choice', () => {
    create();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('Entendido');
  });

  it('hides and remembers the notice after dismiss', () => {
    create();
    component.dismiss();
    expect(component.visible()).toBeFalse();
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBe('acknowledged');
  });

  it('stays hidden for users who answered the legacy accept/reject banner', () => {
    localStorage.setItem(COOKIE_NOTICE_KEY, 'rejected');
    create();
    expect(component.visible()).toBeFalse();
  });
});
