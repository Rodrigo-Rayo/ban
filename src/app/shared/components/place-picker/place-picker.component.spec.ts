import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PlacePickerComponent } from './place-picker.component';

@Component({
  imports: [PlacePickerComponent, ReactiveFormsModule],
  template: `<app-place-picker inputId="city" [formControl]="city"/>`,
})
class HostComponent { city = new FormControl('Madrid'); }

describe('PlacePickerComponent', () => {
  function render(value: string) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.city.setValue(value);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const select = (id: string) => el.querySelector<HTMLSelectElement>(`#${id}`)!;
    const choose = (id: string, v: string) => { const s = select(id); s.value = v; s.dispatchEvent(new Event('change')); fixture.detectChanges(); };
    return { fixture, el, select, choose, control: fixture.componentInstance.city };
  }

  it('shows a Spanish province as before', () => {
    const { select } = render('Sevilla');
    expect(select('city-country').value).toBe('ES');
    expect(select('city').value).toBe('Sevilla');
  });

  it('switches to the regions of another country and stores "region, country"', () => {
    const { choose, control, el } = render('Madrid');
    choose('city-country', 'EC');
    expect(control.value).toBe('');
    expect(el.textContent).toContain('Provincia');
    expect(el.textContent).toContain('en tu país aún somos pocos');
    choose('city', 'Pichincha');
    expect(control.value).toBe('Pichincha, Ecuador');
  });

  it('names the division the way each country does', () => {
    const { choose, el } = render('Madrid');
    choose('city-country', 'MX');
    expect(el.querySelector('label[for="city"]')?.textContent).toContain('Estado');
  });

  it('reads back a stored foreign place', () => {
    const { select } = render('Jalisco, México');
    expect(select('city-country').value).toBe('MX');
    expect(select('city').value).toBe('Jalisco');
  });

  it('stores "Otra" for any other country and hides the region', () => {
    const { choose, control, el } = render('Madrid');
    choose('city-country', 'XX');
    expect(control.value).toBe('Otra');
    expect(el.querySelector('#city')).toBeNull();
  });
});
