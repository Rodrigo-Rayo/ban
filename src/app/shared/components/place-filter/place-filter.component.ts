import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ALL_PLACES, OTHER_VALUE, PLACE_FILTER_GROUPS, PlaceMatch, exactPlace, placeOption, searchPlaces } from '../../../core/utils/place';

let nextId = 0;

/** What shows before typing: all of Spain, its provinces, then each country as a whole. */
const SUGGESTIONS: readonly PlaceMatch[] = PLACE_FILTER_GROUPS.flatMap((g, i) =>
  (i === 0 ? g.options : g.options.slice(0, 1)).map(o => ({ ...o, group: g.label })));

/** Text in the box for a filter value; empty for "all of Spain", so the placeholder says it. */
function display(value: string): string {
  if (!value || value === ALL_PLACES) return '';
  const o = placeOption(value);
  if (!o) return value;
  return o.group === 'España' || o.value.startsWith('pais:') || o.value === OTHER_VALUE ? o.label : `${o.label}, ${o.group}`;
}

/** Place filter you can type into: "cor" offers Córdoba, A Coruña, Córdoba (Argentina)… */
@Component({
  selector: 'app-place-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PlaceFilterComponent), multi: true }],
  host: { class: 'relative block' },
  template: `
    <input type="text" role="combobox" autocomplete="off" spellcheck="false" placeholder="Toda España"
      [class]="inputClass()" [attr.aria-label]="label()" aria-autocomplete="list"
      [attr.aria-expanded]="open()" [attr.aria-controls]="id + '-list'"
      [attr.aria-activedescendant]="open() && results().length ? id + '-' + active() : null"
      [value]="text()" (input)="onInput($any($event.target).value)"
      (focus)="onFocus($any($event.target))" (click)="open.set(true)" (blur)="onBlur()" (keydown)="onKey($event)" />
    <svg aria-hidden="true" viewBox="0 0 24 24" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
    @if (open()) {
      <ul [id]="id + '-list'" role="listbox" [attr.aria-label]="label()" (mousedown)="$event.preventDefault()"
        class="absolute z-30 left-0 mt-1 w-full min-w-[16rem] max-h-72 overflow-y-auto bg-dark-800 border-2 border-ink shadow-[4px_4px_0_0_#141210]">
        @for (o of results(); track o.value; let i = $index) {
          <li [id]="id + '-' + i" role="option" [attr.aria-selected]="i === active()"
            (click)="pick(o)" (mousemove)="active.set(i)"
            class="flex items-baseline justify-between gap-3 px-3 py-2.5 min-h-[44px] cursor-pointer text-sm"
            [class.bg-ink]="i === active()" [class.text-poster-paper]="i === active()" [class.text-ink]="i !== active()" [class.font-bold]="o.value === value()">
            <span>{{ o.label }}</span>
            @if (o.group !== 'España' && !o.value.startsWith('pais:')) {
              <span class="font-mono text-[11px] uppercase tracking-wide shrink-0" [class.text-ink-muted]="i !== active()">{{ o.group }}</span>
            }
          </li>
        } @empty {
          <li class="px-3 py-2.5 text-sm text-ink-muted">Ningún sitio con ese nombre</li>
        }
      </ul>
    }
  `,
})
export class PlaceFilterComponent implements ControlValueAccessor {
  readonly label = input('Filtrar por provincia o país');
  readonly inputClass = input('input-field pr-9');

  readonly id = `place-filter-${nextId++}`;
  readonly value = signal(ALL_PLACES);
  readonly text = signal('');
  readonly open = signal(false);
  readonly active = signal(0);
  /** True once the person types, so the list narrows instead of showing every suggestion. */
  private readonly typed = signal(false);

  readonly results = computed(() => this.typed() && this.text().trim() ? searchPlaces(this.text()) : SUGGESTIONS);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value || ALL_PLACES);
    this.text.set(display(this.value()));
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  onFocus(el: HTMLInputElement) {
    el.select();
    this.typed.set(false);
    this.active.set(Math.max(0, this.results().findIndex(o => o.value === this.value())));
    this.open.set(true);
    this.scrollToActive();
  }

  onInput(text: string) {
    this.text.set(text);
    this.typed.set(true);
    this.active.set(0);
    this.open.set(true);
  }

  onBlur() {
    // Clearing the box means "all of Spain"; a place typed in full counts as picked;
    // anything else half-typed goes back to the current place.
    const typedPlace = this.typed() ? exactPlace(this.text()) : undefined;
    if (!this.text().trim() && this.value() !== ALL_PLACES) this.commit(ALL_PLACES);
    else if (typedPlace) this.commit(typedPlace.value);
    else this.text.set(display(this.value()));
    this.open.set(false);
    this.onTouched();
  }

  onKey(e: KeyboardEvent) {
    const n = this.results().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.open()) { this.open.set(true); return; }
      if (n) this.active.set((this.active() + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
      this.scrollToActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = this.results()[this.active()];
      if (this.open() && o) this.pick(o);
    } else if (e.key === 'Escape' && this.open()) {
      e.preventDefault();
      this.text.set(display(this.value()));
      this.open.set(false);
    }
  }

  pick(o: PlaceMatch) {
    this.commit(o.value);
    this.open.set(false);
    this.host.nativeElement.querySelector('input')?.blur();
  }

  private commit(value: string) {
    this.text.set(display(value));
    if (value === this.value()) return;
    this.value.set(value);
    this.onChange(value);
  }

  private scrollToActive() {
    setTimeout(() => this.host.nativeElement.querySelector(`#${this.id}-${this.active()}`)?.scrollIntoView({ block: 'nearest' }));
  }
}
