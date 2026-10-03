import { Component, ElementRef, OnDestroy, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { MediaFeature, MediaFeaturesService } from '../../../core/services/media-features.service';
import { MediaUploadService, MEDIA_ACCEPT } from '../../../core/services/media-upload.service';

export const MAX_SPACE_PHOTOS = 6;
export type SpaceKind = 'venue' | 'rehearsal';

const SOURCES: Record<SpaceKind, { table: 'venues' | 'rehearsal_spaces'; feature: MediaFeature }> = {
  venue:     { table: 'venues',           feature: 'venuePhotos' },
  rehearsal: { table: 'rehearsal_spaces', feature: 'rehearsalPhotos' },
};

/**
 * "Fotos del espacio" for venues and rehearsal spaces: a scroll-snap strip on
 * mobile / grid from sm up, a lightbox, and add/remove for the owner. It loads
 * and saves `photos` itself, and renders nothing until the column exists
 * (MediaFeaturesService), so host pages never name the new column.
 */
@Component({
  selector: 'app-space-gallery',
  templateUrl: './space-gallery.component.html',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class SpaceGalleryComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private features = inject(MediaFeaturesService);
  private media = inject(MediaUploadService);

  readonly kind = input.required<SpaceKind>();
  readonly profileId = input.required<string>();
  readonly name = input.required<string>();
  readonly isOwner = input(false);

  readonly accept = MEDIA_ACCEPT;
  readonly max = MAX_SPACE_PHOTOS;
  readonly available = signal(false);
  readonly photos = signal<string[]>([]);
  readonly busy = signal(false);
  /** Index of the photo open in the lightbox, or null. */
  readonly openIndex = signal<number | null>(null);
  readonly canAdd = computed(() => this.isOwner() && this.photos().length < MAX_SPACE_PHOTOS);
  readonly visible = computed(() => this.available() && (this.photos().length > 0 || this.isOwner()));

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private returnFocus: HTMLElement | null = null;

  async ngOnInit() {
    const { table, feature } = SOURCES[this.kind()];
    if (!(await this.features.has(feature))) return;
    try {
      const { data, error } = await this.supabase.client.from(table).select('photos').eq('id', this.profileId()).maybeSingle();
      if (error) return; // non-critical: the gallery simply stays hidden
      this.photos.set(Array.isArray(data?.photos) ? (data.photos as string[]).filter(Boolean) : []);
      this.available.set(true);
    } catch { /* non-critical: the gallery stays hidden */ }
  }

  ngOnDestroy() {
    this.unlockScroll();
  }

  async onFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // allow picking the same files again
    if (!files.length || this.busy()) return;
    const room = MAX_SPACE_PHOTOS - this.photos().length;
    if (files.length > room) this.toast.error(`Máximo ${MAX_SPACE_PHOTOS} fotos: se añaden solo ${room}.`);
    this.busy.set(true);
    try {
      const urls: string[] = [];
      for (const file of files.slice(0, room)) {
        const url = await this.media.upload(file, 'spaces');
        if (url) urls.push(url);
      }
      if (!urls.length) return;
      const next = [...this.photos(), ...urls];
      if (await this.save(next)) {
        this.photos.set(next);
        this.toast.success(urls.length === 1 ? 'Foto añadida.' : `${urls.length} fotos añadidas.`);
      } else {
        await Promise.all(urls.map(u => this.media.remove(u)));
      }
    } finally {
      this.busy.set(false);
    }
  }

  async removePhoto(index: number) {
    const url = this.photos()[index];
    if (!url || this.busy()) return;
    const ok = await this.confirm.ask({
      title: '¿Quitar esta foto?',
      message: 'Dejará de verse en tu perfil.',
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      const next = this.photos().filter((_, i) => i !== index);
      if (await this.save(next)) {
        this.photos.set(next);
        this.toast.success('Foto quitada.');
        void this.media.remove(url);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Persists the list; false (already toasted) when nothing was saved. */
  private async save(photos: string[]): Promise<boolean> {
    try {
      const { error, count } = await this.supabase.client.from(SOURCES[this.kind()].table)
        .update({ photos }, { count: 'exact' }).eq('id', this.profileId());
      if (error || count === 0) {
        this.toast.error('No se pudieron guardar las fotos. Inténtalo de nuevo.');
        return false;
      }
      return true;
    } catch {
      this.toast.error('No se pudieron guardar las fotos. Inténtalo de nuevo.');
      return false;
    }
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────

  open(index: number, trigger: HTMLElement) {
    this.returnFocus = trigger;
    this.openIndex.set(index);
    document.body.style.overflow = 'hidden';
    setTimeout(() => this.dialog()?.nativeElement.querySelector<HTMLElement>('[data-close]')?.focus());
  }

  close() {
    if (this.openIndex() === null) return;
    this.openIndex.set(null);
    this.unlockScroll();
    const target = this.returnFocus;
    this.returnFocus = null;
    setTimeout(() => target?.focus());
  }

  step(delta: number) {
    const i = this.openIndex();
    const n = this.photos().length;
    if (i === null || n < 2) return;
    this.openIndex.set((i + delta + n) % n);
  }

  onKeydown(event: KeyboardEvent) {
    if (this.openIndex() === null) return;
    if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); this.step(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); this.step(-1); }
    else if (event.key === 'Tab') this.trapFocus(event);
  }

  /** Keeps Tab inside the lightbox. */
  private trapFocus(event: KeyboardEvent) {
    const root = this.dialog()?.nativeElement;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('button'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || !root.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !root.contains(active))) { event.preventDefault(); first.focus(); }
  }

  private unlockScroll() {
    if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
  }

  /** Unique ids when several galleries could share a page. */
  get uid(): string {
    return `gallery-${this.kind()}-${this.profileId()}`;
  }
}
