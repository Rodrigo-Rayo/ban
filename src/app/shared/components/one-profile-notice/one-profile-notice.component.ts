import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

const LABELS: Record<string, string> = {
  musician: 'músico', band: 'banda', venue: 'sala', teacher: 'profesor', rehearsal: 'local de ensayo',
};

/**
 * One account, one profile: shown instead of a profile form when the account
 * already has a profile of another type.
 */
@Component({
  selector: 'app-one-profile-notice',
  imports: [RouterLink],
  template: `
    <section class="card-flat p-6" aria-labelledby="one-profile-title">
      <h2 id="one-profile-title" class="text-3xl text-ink leading-[1.05] mb-3">Ya tienes un perfil de {{ currentLabel() }}</h2>
      <p class="text-sm text-ink-2 leading-relaxed mb-2">Cada cuenta tiene un solo perfil.</p>
      <ul class="text-sm text-ink-2 leading-relaxed mb-5 list-disc pl-5 flex flex-col gap-1">
        <li>Para que tu perfil pase a ser {{ wantedArticle() }}, cambia el tipo en <strong>Editar perfil</strong> (el perfil de {{ currentLabel() }} se sustituye).</li>
        <li>Para tener los dos, crea otra cuenta con otro email.</li>
      </ul>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a routerLink="/onboarding" class="btn-primary min-h-[44px] text-xs">Editar perfil</a>
        <a routerLink="/dashboard" class="btn-secondary min-h-[44px] text-xs">Volver a mi panel</a>
      </div>
    </section>
  `,
})
export class OneProfileNoticeComponent {
  /** Type of the profile the account already has. */
  readonly current = input.required<string>();
  /** What the form creates, with its article: "una sala", "un local de ensayo"… */
  readonly wantedArticle = input.required<string>();
  readonly currentLabel = computed(() => LABELS[this.current()] ?? 'otro tipo');
}
