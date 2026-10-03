import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

/** Accepted photo types — mirrored by the file inputs' `accept` attribute. */
export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp';
const ALLOWED = MEDIA_ACCEPT.split(',');
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = 'media';
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Folder inside `${uid}/` for each kind of photo. */
export type MediaKind = 'events' | 'spaces';

/** Friendly Spanish error for a file that cannot be uploaded, or null when it is fine. */
export function mediaFileError(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'Usa una imagen JPG, PNG o WebP.';
  if (file.size > MAX_BYTES) return 'La imagen no puede superar 5 MB.';
  return null;
}

/**
 * Uploads photos (event posters, space galleries) to the public 'media' bucket
 * under the signed-in user's folder and returns their public URLs. It does not
 * touch any table: callers save the URL where it belongs.
 */
@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  /** Validates and uploads one file. Returns its public URL, or null (already toasted). */
  async upload(file: File | null | undefined, kind: MediaKind): Promise<string | null> {
    if (!file) return null;
    const invalid = mediaFileError(file);
    if (invalid) { this.toast.error(invalid); return null; }
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) { this.toast.error('Inicia sesión para subir fotos.'); return null; }
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${session.user.id}/${kind}/${Date.now()}-${rand}.${EXT[file.type]}`;
      const storage = this.supabase.client.storage.from(BUCKET);
      const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
      if (error) { this.toast.error('No se pudo subir la imagen. Inténtalo de nuevo.'); return null; }
      return storage.getPublicUrl(path).data.publicUrl;
    } catch {
      this.toast.error('No se pudo subir la imagen. Inténtalo de nuevo.');
      return null;
    }
  }

  /** Best-effort removal of a photo previously uploaded by this user. Never throws. */
  async remove(publicUrl: string): Promise<void> {
    const marker = `/object/public/${BUCKET}/`;
    const at = publicUrl.indexOf(marker);
    if (at === -1) return;
    const path = decodeURIComponent(publicUrl.slice(at + marker.length).split('?')[0]);
    try {
      await this.supabase.client.storage.from(BUCKET).remove([path]);
    } catch { /* orphaned file: harmless, the URL is no longer referenced */ }
  }
}
