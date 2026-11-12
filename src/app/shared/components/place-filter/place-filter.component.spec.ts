import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlaceFilterComponent } from './place-filter.component';

@Component({
  imports: [PlaceFilterComponent, FormsModule],
  template: `<app-place-filter [ngModel]="city()" (ngModelChange)="city.set($event); changes = changes + 1"/>`,
})
class HostComponent { city = signal('Toda España'); changes = 0; }

describe('PlaceFilterComponent', () => {
  async function render(value = 'Toda España') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.city.set(value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const box = el.querySelector('input')!;
    const update = () => fixture.detectChanges();
    const type = (text: string) => { box.dispatchEvent(new Event('focus')); box.value = text; box.dispatchEvent(new Event('input')); update(); };
    const key = (k: string) => { box.dispatchEvent(new KeyboardEvent('keydown', { key: k })); update(); };
    const options = () => [...el.querySelectorAll<HTMLElement>('[role="option"]')].map(o => [...o.querySelectorAll('span')].map(s => s.textContent!.trim()).join(' '));
    return { fixture, host: fixture.componentInstance, el, box, update, type, key, options };
  }

  it('shows the current place, and an empty box for all of Spain', async () => {
    expect((await render()).box.value).toBe('');
    expect((await render('Madrid')).box.value).toBe('Madrid');
    expect((await render('Pichincha, Ecuador')).box.value).toBe('Pichincha, Ecuador');
    expect((await render('pais:AR')).box.value).toBe('Todo Argentina');
  });

  it('suggests Spain and each country before typing', async () => {
    const { box, update, options } = await render();
    box.dispatchEvent(new Event('focus'));
    update();
    expect(options()[0]).toBe('Toda España');
    expect(options()).toContain('Todo Ecuador');
    expect(options()).not.toContain('Pichincha Ecuador');
  });

  it('narrows the list as you type and picks with the keyboard', async () => {
    const { host, box, type, key, options } = await render();
    type('pichin');
    expect(options()).toEqual(['Pichincha Ecuador']);
    key('Enter');
    expect(host.city()).toBe('Pichincha, Ecuador');
    expect(box.value).toBe('Pichincha, Ecuador');
  });

  it('moves through matches with the arrow keys', async () => {
    const { host, type, key } = await render();
    type('cordoba');
    key('ArrowDown');
    key('Enter');
    expect(host.city()).toBe('Córdoba, Argentina');
  });

  it('picks with a click', async () => {
    const { host, el, type } = await render();
    type('sevi');
    el.querySelector<HTMLElement>('[role="option"]')!.click();
    expect(host.city()).toBe('Sevilla');
  });

  it('says so when nothing matches', async () => {
    const { el, type, options } = await render();
    type('zzzz');
    expect(options()).toEqual([]);
    expect(el.textContent).toContain('Ningún sitio con ese nombre');
  });

  it('goes back to the current place on Escape or when leaving half-typed', async () => {
    const { host, box, type, key, update } = await render('Madrid');
    type('Bar');
    key('Escape');
    expect(box.value).toBe('Madrid');
    type('Bar');
    box.dispatchEvent(new Event('blur'));
    update();
    expect(box.value).toBe('Madrid');
    expect(host.changes).toBe(0);
  });

  it('takes a place typed in full when leaving the box', async () => {
    const { host, box, type, update } = await render('Madrid');
    type('malaga');
    box.dispatchEvent(new Event('blur'));
    update();
    expect(host.city()).toBe('Málaga');
    expect(box.value).toBe('Málaga');
  });

  it('clearing the box means all of Spain', async () => {
    const { host, box, type, update } = await render('Madrid');
    type('');
    box.dispatchEvent(new Event('blur'));
    update();
    expect(host.city()).toBe('Toda España');
  });

  it('offers your own zone right after all of Spain', async () => {
    localStorage.setItem('bandyou_city', 'Pichincha, Ecuador');
    try {
      const { box, update, options } = await render();
      box.dispatchEvent(new Event('focus'));
      update();
      expect(options().slice(0, 2)).toEqual(['Toda España', 'Pichincha, Ecuador Tu zona']);
    } finally {
      localStorage.removeItem('bandyou_city');
    }
  });

  it('clears the place with one tap', async () => {
    const { host, el, update, box } = await render('Madrid');
    const clear = el.querySelector<HTMLButtonElement>('button[aria-label="Quitar filtro: Madrid"]')!;
    clear.click();
    update();
    expect(host.city()).toBe('Toda España');
    expect(box.value).toBe('');
    expect(el.querySelector('button')).toBeNull();
  });

  it('marks the letters that match', async () => {
    const { el, type } = await render();
    type('sevi');
    expect(el.querySelector('[role="option"] mark')?.textContent).toBe('Sevi');
  });

  it('is a combobox tied to its list', async () => {
    const { box, update, el } = await render();
    expect(box.getAttribute('role')).toBe('combobox');
    expect(box.getAttribute('aria-expanded')).toBe('false');
    box.dispatchEvent(new Event('focus'));
    update();
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector(`#${box.getAttribute('aria-controls')}`)?.getAttribute('role')).toBe('listbox');
    expect(box.getAttribute('aria-activedescendant')).toBeTruthy();
  });
});
