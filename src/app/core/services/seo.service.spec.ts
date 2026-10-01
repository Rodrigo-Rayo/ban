import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { SeoService } from './seo.service';

describe('SeoService unread title', () => {
  let seo: SeoService;
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    seo = TestBed.inject(SeoService);
    title = TestBed.inject(Title);
    seo.set({ title: 'Mensajes' });
  });

  it('prefixes the page title with the unread count', () => {
    seo.setUnreadCount(3);
    expect(title.getTitle()).toBe('(3) Mensajes · BandYou');
  });

  it('keeps the prefix when the page title changes', () => {
    seo.setUnreadCount(2);
    seo.set({ title: 'Buscar' });
    expect(title.getTitle()).toBe('(2) Buscar · BandYou');
  });

  it('removes the prefix when everything is read', () => {
    seo.setUnreadCount(5);
    seo.setUnreadCount(0);
    expect(title.getTitle()).toBe('Mensajes · BandYou');
  });

  it('caps the prefix at 99+', () => {
    seo.setUnreadCount(150);
    expect(title.getTitle()).toBe('(99+) Mensajes · BandYou');
  });
});
