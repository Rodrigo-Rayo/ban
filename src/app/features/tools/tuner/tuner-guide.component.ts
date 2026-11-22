import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TUNER_FAQS, TUNING_TABLE } from './tuner-content';

/** Static help below the tuner: how to tune, standard tunings, FAQ and a quiet CTA. */
@Component({
  selector: 'app-tuner-guide',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="mt-10 border-t-2 border-ink pt-5" aria-labelledby="tg-how">
      <h2 id="tg-how" class="font-display text-2xl sm:text-3xl uppercase leading-none">Cómo afinar la guitarra</h2>
      <ol class="mt-4 grid gap-3 text-sm sm:text-base leading-relaxed list-decimal pl-5 max-w-2xl">
        <li>Elige <strong>Guitarra</strong> en el selector de instrumento y toca <strong>Activar micrófono</strong>.</li>
        <li>Toca una sola cuerda al aire, empezando por la sexta (la más gruesa, Mi grave), y déjala sonar.</li>
        <li>Si el afinador dice <strong>Sube</strong>, la cuerda está grave: tensa girando la clavija. Si dice <strong>Baja</strong>, está aguda: destensa.</li>
        <li>Ajusta poco a poco hasta que la aguja quede en el centro y aparezca <strong>Afinada</strong>. Mejor llegar a la nota desde abajo: la cuerda se mantiene afinada más tiempo.</li>
        <li>Repite con las demás cuerdas y da una segunda pasada: al tensar unas, las otras se mueven un poco.</li>
      </ol>
    </section>

    <section class="mt-10 border-t-2 border-ink pt-5" aria-labelledby="tg-tunings">
      <h2 id="tg-tunings" class="font-display text-2xl sm:text-3xl uppercase leading-none">Afinaciones estándar</h2>
      <p class="mt-2 text-sm text-ink-muted max-w-2xl">De la cuerda más grave a la más aguda (en el ukelele, en el orden en que se tocan: la cuerda Sol es aguda).</p>
      <div class="mt-4 max-w-2xl">
        <table class="w-full text-sm border-2 border-ink bg-dark-800">
          <thead>
            <tr class="bg-ink text-poster-paper font-mono text-[11px] uppercase tracking-wide text-left">
              <th scope="col" class="px-3 py-2">Instrumento</th>
              <th scope="col" class="px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            @for (row of tunings; track row.instrument) {
              <tr class="border-t border-ink/20 align-top">
                <th scope="row" class="px-3 py-2 text-left font-semibold">{{ row.instrument }}</th>
                <td class="px-3 py-2">
                  {{ row.notesEs }}
                  <span class="block font-mono text-[11px] text-ink-muted">{{ row.notesEn }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="mt-10 border-t-2 border-ink pt-5" aria-labelledby="tg-faq">
      <h2 id="tg-faq" class="font-display text-2xl sm:text-3xl uppercase leading-none">Preguntas frecuentes</h2>
      <div class="mt-4 grid gap-4 max-w-2xl">
        @for (f of faqs; track f.q) {
          <div>
            <h3 class="font-semibold text-base">{{ f.q }}</h3>
            <p class="mt-1 text-sm leading-relaxed">{{ f.a }}</p>
          </div>
        }
      </div>
    </section>

    <section class="mt-10 border-t-2 border-ink pt-5 max-w-2xl" aria-labelledby="tg-cta">
      <h2 id="tg-cta" class="font-display text-2xl uppercase leading-none">¿Buscas banda o músicos?</h2>
      <p class="text-sm leading-relaxed mt-2">En BandYou encuentras grupos que buscan gente y músicos de tu provincia. Gratis.</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <a routerLink="/feed" class="btn-secondary min-h-[44px]">Ver quién busca</a>
        <a routerLink="/metronomo" class="btn-ghost min-h-[44px] underline underline-offset-4">Metrónomo online</a>
      </div>
    </section>
  `,
})
export class TunerGuideComponent {
  readonly faqs = TUNER_FAQS;
  readonly tunings = TUNING_TABLE;
}
