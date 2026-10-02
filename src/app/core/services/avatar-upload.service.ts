import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

/** Accepted avatar types — mirrored by the file inputs' `accept` attribute. */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';
const ALLOWED = AVATAR_ACCEPT.split(',');
const MAX_BYTES = 5 * 1024 * 1024;
/** Every profile table that carries an avatar_url keyed by user_id. */
const PROFILE_TABLES = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'] as const;

/**
 * Uploads the signed-in user's profile photo and stores its URL on their profile.
 * Single implementation for every "Cambiar foto" entry point (Mi panel, Portada,
 * own profile pages); `avatarUrl` lets the navbar update without a reload.
 */
@Injectable({ providedIn: 'root' })
export class AvatarUploadService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  /** Latest uploaded avatar URL in this session (null until one is uploaded). */
  readonly avatarUrl = signal<string | null>(null);
  readonly uploading = signal(false);

  /** Validates, uploads and saves. Returns the new public URL, or null on failure (already toasted). */
  async upload(file: File | null | undefined): Promise<string | null> {
    if (!file) return null;
    if (!ALLOWED.includes(file.type)) {
      this.toast.error('Usa una imagen JPG, PNG o WebP.');
      return null;
    }
    if (file.size > MAX_BYTES) {
      this.toast.error('La imagen no puede superar 5 MB.');
      return null;
    }
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) {
      this.toast.error('Inicia sesión para cambiar tu foto.');
      return null;
    }
    this.uploading.set(true);
    try {
      const path = `${session.user.id}/avatar`;
      const { error } = await this.supabase.client.storage.from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        this.toast.error('No se pudo subir la imagen. Inténtalo de nuevo.');
        return null;
      }
      const { data: urlData } = this.supabase.client.storage.from('avatars').getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;

      // The user's profile lives in one of these tables; updating by user_id in all
      // of them is harmless where no row exists and avoids guessing the role.
      const results = await Promise.all(PROFILE_TABLES.map(t =>
        this.supabase.client.from(t).update({ avatar_url: url }, { count: 'exact' }).eq('user_id', session.user.id)));
      const saved = results.some(r => !r.error && (r.count ?? 0) > 0);
      if (!saved) {
        this.toast.error('Crea tu perfil para poder añadir una foto.');
        return null;
      }
      this.avatarUrl.set(url);
      this.toast.success('Foto actualizada.');
      return url;
    } catch {
      this.toast.error('No se pudo subir la imagen. Inténtalo de nuevo.');
      return null;
    } finally {
      this.uploading.set(false);
    }
  }
}
