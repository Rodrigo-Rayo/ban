import { TestBed } from '@angular/core/testing';
import { ListenPlayerComponent } from './listen-player.component';

describe('ListenPlayerComponent', () => {
  function render(links: (string | null)[]) {
    const fixture = TestBed.createComponent(ListenPlayerComponent);
    fixture.componentRef.setInput('links', links);
    fixture.componentRef.setInput('who', 'a Stormy');
    fixture.detectChanges();
    return fixture;
  }

  it('shows nothing when no link can play inside the page', () => {
    const el: HTMLElement = render(['https://youtube.com/@canal', null]).nativeElement;
    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('loads nothing from the provider until play is pressed', () => {
    const fixture = render(['https://soundcloud.com/stormy/tema']);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.textContent).toContain('Escuchar a Stormy');
    expect(el.textContent).toContain('SoundCloud');

    el.querySelector('button')!.click();
    fixture.detectChanges();
    const frame = el.querySelector('iframe')!;
    expect(frame.src).toContain('https://w.soundcloud.com/player/');
    expect(frame.style.height).toBe('166px');
  });
});
