import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ToastService } from '../../../core/services/toast.service';
import { ShareCard, StoryImage, shareImage } from '../../../core/utils/share-card';
import { storyFeedback } from '../../../core/utils/story-feedback';

/**
 * "Imagen para historias" for a profile: a poster-style story image (same look as
 * the ones for Se busca and events), drawn in the browser when idle so the tap can
 * open the share sheet at once (Safari needs that).
 */
@Component({
  selector: 'app-story-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (card()) {
      <button type="button" (click)="share()" [attr.aria-busy]="making()"
        class="btn-ghost min-h-[44px] w-full" [class.opacity-60]="making()">
        <app-icon name="camera" [size]="16"/> {{ making() ? 'Creando imagen…' : label() }}
      </button>
    }
  `,
})
export class StoryButtonComponent {
  private toast = inject(ToastService);

  /** What to draw; null hides the button. */
  readonly card = input<ShareCard | null>(null);
  /** Image file name (already slugged). */
  readonly filename = input('bandyou.png');
  /** Link shared with the image. */
  readonly url = input('');
  readonly label = input('Imagen para historias');

  readonly making = signal(false);
  private story: StoryImage | null = null;

  constructor() {
    // A new card (profile loaded or changed): render it ahead of the tap.
    effect(() => {
      const card = this.card();
      this.story = card ? new StoryImage(() => card) : null;
      this.story?.prepare();
    });
  }

  async share() {
    if (!this.story || this.making()) return;
    this.making.set(true);
    try {
      const blob = await this.story.blob();
      storyFeedback(await shareImage(blob, this.filename(), this.url()), this.toast);
    } catch {
      this.toast.error('No se pudo crear la imagen.');
    } finally {
      this.making.set(false);
    }
  }
}
