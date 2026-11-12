import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CITIES } from '../../../core/constants/cities';
import { COUNTRIES } from '../../../core/constants/regions';
import { OTHER_COUNTRY, OTHER_VALUE, SPAIN, countryByCode, parsePlace, placeValue } from '../../../core/utils/place';

const PROVINCES = CITIES.filter(c => c !== OTHER_VALUE);

/** Country, then its province/state/department. The value is what the `city` columns store. */
@Component({
  selector: 'app-place-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PlacePickerComponent), multi: true }],
  template: `
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label [for]="inputId() + '-country'" class="block font-mono text-[11px] font-bold uppercase tracking-wide text-ink mb-1.5">País</label>
        <select [id]="inputId() + '-country'" class="input-field" (change)="pickCountry($any($event.target).value)" [disabled]="disabled()" autocomplete="country-name">
          <option [value]="spain" [selected]="country() === spain">España</option>
          @for (c of countries; track c.code) { <option [value]="c.code" [selected]="country() === c.code">{{ c.name }}</option> }
          <option [value]="other" [selected]="country() === other">Otro país</option>
        </select>
      </div>
      @if (country() !== other) {
        <div>
          <label [for]="inputId()" class="block font-mono text-[11px] font-bold uppercase tracking-wide text-ink mb-1.5">{{ division() }} @if (required()) {<span aria-hidden="true">*</span>}</label>
          <select [id]="inputId()" class="input-field" (change)="pickRegion($any($event.target).value)" [disabled]="disabled()"
            [required]="required()" (blur)="onTouched()" autocomplete="address-level1">
            <option value="" disabled [selected]="!region()">Elige</option>
            @for (r of regions(); track r) { <option [value]="r" [selected]="region() === r">{{ r }}</option> }
          </select>
        </div>
      }
    </div>
    @if (country() !== spain) {
      <p class="mt-2 text-sm text-ink-muted leading-snug">BandYou nació en España y en tu país aún somos pocos. Invita a tu gente para que os encontréis aquí.</p>
    }
  `,
})
export class PlacePickerComponent implements ControlValueAccessor {
  /** id of the province select, so existing labels and error links keep working. */
  readonly inputId = input.required<string>();
  readonly required = input(true);

  readonly spain = SPAIN;
  readonly other = OTHER_COUNTRY;
  readonly countries = COUNTRIES;
  readonly country = signal(SPAIN);
  readonly region = signal('');
  readonly disabled = signal(false);

  readonly regions = computed(() => this.country() === SPAIN ? PROVINCES : countryByCode(this.country())?.regions ?? []);
  readonly division = computed(() => this.country() === SPAIN ? 'Provincia' : countryByCode(this.country())?.division ?? 'Provincia');

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    const p = parsePlace(value);
    this.country.set(p.country);
    this.region.set(p.region);
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  pickCountry(code: string) {
    this.country.set(code);
    this.region.set('');
    this.onChange(placeValue(code, ''));
    this.onTouched();
  }

  pickRegion(region: string) {
    this.region.set(region);
    this.onChange(placeValue(this.country(), region));
  }
}
