import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstEmbed } from '../../../core/utils/media-embed';

/**
 * "Escuchar" on a profile: plays the first link that can play inside the page
 * (Spotify, SoundCloud, a YouTube video). Nothing loads from the provider until
 * the visitor presses play — no third-party requests or cookies before that.
 * Renders nothing when no link can play here (e.g. only a YouTube channel).
 */
@Component({
  selector: 'app-listen-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (embed(); as e) {
      @if (!playing()) {
        <button type="button" (click)="playing.set(true)"
          class="press w-full flex items-center gap-4 border-2 border-ink bg-ink text-poster-paper px-4 py-3 min-h-[72px] text-left hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
          <span class="w-12 h-12 flex-shrink-0 bg-primary-500 border-2 border-poster-paper flex items-center justify-center" aria-hidden="true">
            <svg class="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>
          </span>
          <span class="min-w-0">
            <span class="block font-display text-2xl uppercase leading-none">Escuchar {{ who() }}</span>
            <span class="block font-mono text-[11px] font-bold uppercase tracking-wide text-poster-paper/70 mt-1.5">Se reproduce aquí · {{ e.provider }}</span>
          </span>
        </button>
      } @else {
        <div class="border-2 border-ink bg-ink" [class.aspect-video]="e.height === null">
          <iframe [src]="safeSrc()" [title]="'Reproductor de ' + e.provider"
            class="block w-full" [class.h-full]="e.height === null" [style.height.px]="e.height"
            allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen"
            allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
      }
    }
  `,
})
export class ListenPlayerComponent {
  private sanitizer = inject(DomSanitizer);

  /** Candidate links, best first (Spotify, SoundCloud, YouTube…). */
  readonly links = input<readonly (string | null | undefined)[]>([]);
  /** Who is playing, as it reads after "Escuchar": "a Stormy"… Empty = just "Escuchar". */
  readonly who = input('');

  readonly playing = signal(false);
  readonly embed = computed(() => firstEmbed(this.links()));

  constructor() {
    // Other links (another profile in the same component): back to "press play".
    effect(() => {
      this.embed();
      untracked(() => this.playing.set(false));
    });
  }
  /** The src is rebuilt by mediaEmbed from validated parts on fixed provider hosts. */
  readonly safeSrc = computed((): SafeResourceUrl | null => {
    const e = this.embed();
    return e ? this.sanitizer.bypassSecurityTrustResourceUrl(e.src) : null;
  });
}
