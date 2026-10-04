import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { MediaUploadService, MEDIA_ACCEPT, mediaPickError } from '../../../core/services/media-upload.service';
import { MAX_SPACE_PHOTOS } from '../space-gallery/space-gallery.component';

type PhotoRole = 'musician' | 'band' | 'venue' | 'teacher' | 'rehearsal' | 'listener';

interface Picked { file: File; preview: string }

const PROFILE_TABLE: Partial<Record<PhotoRole, string>> = {
  musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal_spaces',
};
const SPACE_ROLES: readonly PhotoRole[] = ['venue', 'rehearsal'];

/**
 * Photos picked while creating a profile (onboarding, or a second profile such as
 * "Crear sala"): the profile photo for every type and, for venues and rehearsal
 * spaces, up to six photos of the space. Nothing is uploaded until the profile row
 * exists — the parent calls save() after it. The photo is saved on THAT profile
 * only, so a second profile never replaces the photo of the first one.
 */
@Component({
  selector: 'app-profile-photos',
  template: `
    <section class="mb-6" [attr.aria-labelledby]="uid">
      <h2 [id]="uid" class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink mb-3">
        Fotos <span class="text-ink-muted normal-case font-normal tracking-normal">(opcional)</span>
      </h2>

      <div class="flex items-center gap-4">
        <div class="w-20 h-20 flex-shrink-0 border-2 border-ink bg-dark-800 overflow-hidden flex items-center justify-center">
          @if (avatar(); as a) {
            <img [src]="a.preview" alt="Tu foto de perfil" class="w-full h-full object-cover" width="80" height="80"/>
          } @else {
            <span class="font-display text-3xl text-ink-muted" aria-hidden="true">+</span>
          }
        </div>
        <div class="flex flex-col gap-2">
          <label class="btn-secondary min-h-[44px] text-xs cursor-pointer focus-within:ring-2 focus-within:ring-primary-500">
            {{ avatar() ? 'Cambiar foto de perfil' : 'Añadir foto de perfil' }}
            <input type="file" class="sr-only" [accept]="accept" (change)="pickAvatar($event)"/>
          </label>
          @if (avatar()) {
            <button type="button" class="text-xs underline text-ink-muted self-start min-h-[32px]" (click)="clearAvatar()">Quitar</button>
          }
        </div>
      </div>

      @if (spaceAvailable()) {
        <p class="text-sm text-ink mt-5 mb-2 font-semibold">Fotos del espacio <span class="text-ink-muted font-normal">· hasta {{ max }}</span></p>
        <div class="grid grid-cols-3 gap-2">
          @for (p of spacePhotos(); track p.preview; let i = $index) {
            <div class="relative aspect-square border-2 border-ink overflow-hidden">
              <img [src]="p.preview" [alt]="'Foto del espacio ' + (i + 1)" class="w-full h-full object-cover"/>
              <button type="button" (click)="removeSpacePhoto(i)" [attr.aria-label]="'Quitar foto ' + (i + 1)"
                class="absolute top-1 right-1 w-8 h-8 bg-ink text-dark-900 font-bold leading-none flex items-center justify-center">×</button>
            </div>
          }
          @if (spacePhotos().length < max) {
            <label class="aspect-square border-2 border-dashed border-ink flex flex-col items-center justify-center gap-1 cursor-pointer text-ink-muted hover:text-ink focus-within:ring-2 focus-within:ring-primary-500">
              <span class="font-display text-3xl leading-none" aria-hidden="true">+</span>
              <span class="font-mono text-[10px] font-bold uppercase tracking-wide">Añadir</span>
              <input type="file" multiple class="sr-only" [accept]="accept" (change)="pickSpacePhotos($event)"
                     aria-label="Añadir fotos del espacio"/>
            </label>
          }
        </div>
      }
      <p class="text-xs text-ink-muted mt-3">Sube solo fotos tuyas o con permiso de su autor.</p>
    </section>
  `,
})
export class ProfilePhotosComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private features = inject(MediaFeaturesService);
  private media = inject(MediaUploadService);

  readonly role = input.required<PhotoRole>();

  readonly uid = 'profile-photos-' + Math.random().toString(36).slice(2, 8);
  readonly accept = MEDIA_ACCEPT;
  readonly max = MAX_SPACE_PHOTOS;
  readonly avatar = signal<Picked | null>(null);
  readonly spacePhotos = signal<Picked[]>([]);
  private readonly photosColumn = signal(false);
  readonly spaceAvailable = computed(() => SPACE_ROLES.includes(this.role()) && this.photosColumn());

  ngOnInit() {
    const role = this.role();
    if (role === 'venue' || role === 'rehearsal') {
      void this.features.has(role === 'venue' ? 'venuePhotos' : 'rehearsalPhotos').then(ok => this.photosColumn.set(ok));
    }
  }

  ngOnDestroy() {
    const a = this.avatar();
    if (a) URL.revokeObjectURL(a.preview);
    this.spacePhotos().forEach(p => URL.revokeObjectURL(p.preview));
  }

  pickAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const problem = mediaPickError(file);
    if (problem) { this.toast.error(problem); return; }
    this.clearAvatar();
    this.avatar.set({ file, preview: URL.createObjectURL(file) });
  }

  clearAvatar() {
    const a = this.avatar();
    if (a) URL.revokeObjectURL(a.preview);
    this.avatar.set(null);
  }

  pickSpacePhotos(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const room = MAX_SPACE_PHOTOS - this.spacePhotos().length;
    const valid = files.filter(f => {
      const problem = mediaPickError(f);
      if (problem) this.toast.error(problem);
      return !problem;
    });
    if (valid.length > room) this.toast.error(`Máximo ${MAX_SPACE_PHOTOS} fotos: se añaden solo ${room}.`);
    const added = valid.slice(0, room).map(file => ({ file, preview: URL.createObjectURL(file) }));
    this.spacePhotos.update(list => [...list, ...added]);
  }

  removeSpacePhoto(index: number) {
    const target = this.spacePhotos()[index];
    if (target) URL.revokeObjectURL(target.preview);
    this.spacePhotos.update(list => list.filter((_, i) => i !== index));
  }

  /**
   * Uploads what was picked onto the profile that now exists. Best effort: the
   * profile is already saved, so failures are toasted and never block entry.
   */
  async save(userId: string): Promise<void> {
    const table = PROFILE_TABLE[this.role()];
    if (!table) return;
    const update: Record<string, unknown> = {};

    const avatar = this.avatar();
    if (avatar) {
      const url = await this.media.upload(avatar.file, 'spaces');
      if (url) update['avatar_url'] = url;
    }
    if (this.spaceAvailable()) {
      const urls: string[] = [];
      for (const p of this.spacePhotos()) {
        const url = await this.media.upload(p.file, 'spaces');
        if (url) urls.push(url);
      }
      if (urls.length) update['photos'] = urls;
    }
    if (!Object.keys(update).length) return;

    const { error } = await this.supabase.client.from(table).update(update).eq('user_id', userId);
    if (error) {
      this.toast.error('El perfil está creado, pero no se pudieron guardar las fotos. Añádelas desde el perfil.');
      void this.media.removeFiles([update['avatar_url'] as string, ...((update['photos'] as string[]) ?? [])]);
    }
  }
}
