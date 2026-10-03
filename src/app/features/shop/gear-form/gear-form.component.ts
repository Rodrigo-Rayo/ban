import { publishErrorMessage } from '../../../core/utils/publish-error';
import { IMAGE_MAX_SIDE, RAW_IMAGE_MAX_BYTES, shrinkImage } from '../../../core/utils/image-resize';
import { Component, ElementRef, HostListener, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import type { User } from '@supabase/supabase-js';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';
import { GEAR_CONDITIONS, GEAR_CONDITION_FORM_OPTIONS } from '../../../core/constants/gear';

interface GearFormUserProfile { id: string; name: string; type: 'musician' | 'band' | 'venue' | 'teacher' | 'rehearsal'; }

@Component({
    selector: 'app-gear-form',
    imports: [FormsModule, RouterLink],
    templateUrl: './gear-form.component.html'
})
export class GearFormComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  editId = signal<string | null>(null);
  existingImages = signal<string[]>([]);
  submitting = signal(false);
  error = signal('');
  formTouched = signal(false);
  imageFiles: File[] = [];
  imagePreviews = signal<string[]>([]);
  uploadProgress = signal(0);

  form = {
    title: '',
    description: '',
    price: null as number | null,
    category: 'Guitarras',
    condition: 'good',
    city: 'Madrid',
  };

  currentUser = signal<User | null>(null);
  userProfile = signal<GearFormUserProfile | null>(null);

  readonly categories = ['Guitarras', 'Bajos', 'Batería', 'Teclados', 'Amplificadores', 'Efectos', 'PA/Sonido', 'Accesorios', 'Otro'];
  /** Stored value of the listing being edited when it is a legacy-only one ("muy bueno"): kept as is. */
  private legacyCondition: { id: string; label: string } | null = null;

  /** Form options; a legacy value (e.g. "Muy bueno") is offered only while editing a listing that has it. */
  get conditions(): { id: string; label: string }[] {
    return this.legacyCondition ? [...GEAR_CONDITION_FORM_OPTIONS, this.legacyCondition] : [...GEAR_CONDITION_FORM_OPTIONS];
  }
  readonly cities = CITIES;

  async ngOnInit() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) { this.router.navigate(['/auth/login']); return; }
      this.currentUser.set(user);

      const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'] as const;
      const types  = ['musician', 'band', 'venue', 'teacher', 'rehearsal'] as const;
      const results = await Promise.all(
        tables.map(t => this.supabase.client.from(t).select('id,name').eq('user_id', user.id).maybeSingle())
      );
      const idx = results.findIndex(r => r.data);
      if (idx !== -1) {
        const d = results[idx].data;
        if (d?.id && d?.name) this.userProfile.set({ id: d.id, name: d.name, type: types[idx] });
      }

      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.editId.set(id);
        const { data: listing } = await this.supabase.client
          .from('gear_listings').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
        if (!listing) { this.router.navigate(['/shop']); return; }
        this.form.title = listing.title;
        this.form.description = listing.description ?? '';
        this.form.price = listing.price;
        this.form.category = listing.category;
        this.form.condition = this.normalizeCondition(listing.condition);
        this.form.city = listing.city;
        this.existingImages.set(listing.images ?? []);
      }
    } catch {
      this.toast.error('No se pudo cargar el formulario. Inténtalo de nuevo.');
      this.router.navigate(['/shop']);
    }
  }

  /** Maps any stored condition ("bueno", "good"…) to a form option id; legacy-only values stay selectable. */
  private normalizeCondition(stored: string | null): string {
    const v = (stored ?? '').trim().toLowerCase();
    const opt = GEAR_CONDITIONS.find(c => c.id === v || c.values.includes(v));
    if (!opt) return 'good';
    if (opt.legacy) {
      this.legacyCondition = { id: stored as string, label: opt.label };
      return stored as string;
    }
    return opt.id;
  }

  removeExistingImage(idx: number) {
    this.existingImages.update(imgs => imgs.filter((_, i) => i !== idx));
  }

  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  /** Phone photos are accepted large and shrunk before upload. */
  private readonly MAX_FILE_SIZE = RAW_IMAGE_MAX_BYTES;

  onFilesChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const valid = Array.from(input.files).filter(f =>
      this.ALLOWED_TYPES.includes(f.type) && f.size <= this.MAX_FILE_SIZE
    );
    const rejected = Array.from(input.files).length - valid.length;
    if (rejected > 0) this.error.set(`${rejected} archivo(s) rechazado(s): solo imágenes JPG, PNG o WebP hasta 20 MB.`);
    const added = valid.slice(0, 4 - this.imageFiles.length);
    this.imageFiles = [...this.imageFiles, ...added].slice(0, 4);
    this.refreshPreviews();
  }

  removeImage(idx: number) {
    this.imageFiles = this.imageFiles.filter((_, i) => i !== idx);
    this.refreshPreviews();
  }

  private currentPreviewUrls: string[] = [];

  private refreshPreviews() {
    // Revoke old object URLs to prevent memory leaks
    this.currentPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    this.currentPreviewUrls = this.imageFiles.map(f => URL.createObjectURL(f));
    this.imagePreviews.set([...this.currentPreviewUrls]);
  }

  ngOnDestroy() {
    this.currentPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  }

  private _submitted = false;

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (!this._submitted && !this.submitting() && (this.form.title.trim().length > 0 || this.imageFiles.length > 0)) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  get canSubmit() {
    return this.form.title.trim() && this.form.price != null && this.form.price > 0;
  }

  get titleInvalid(): boolean {
    return this.formTouched() && !this.form.title.trim();
  }

  get priceInvalid(): boolean {
    return this.formTouched() && (!this.form.price || this.form.price <= 0);
  }

  async submit() {
    this.formTouched.set(true);
    if (!this.canSubmit) {
      // Move focus to the first field that needs fixing (WCAG 3.3.1).
      const firstId = !this.form.title.trim() ? 'gear-title' : 'gear-price';
      this.host.nativeElement.querySelector<HTMLElement>('#' + firstId)?.focus();
      return;
    }
    const user = this.currentUser();
    if (!user) return;

    this.submitting.set(true);
    this.error.set('');
    try {

    const newImageUrls = (await Promise.all(
      this.imageFiles.map(async (raw) => {
        // Shrunk in the browser first (longest side 1600 px, WebP): visitors download exactly what is uploaded.
        const file = await shrinkImage(raw, IMAGE_MAX_SIDE.photo);
        const ext  = file.type.split('/')[1] ?? 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await this.supabase.client.storage
          .from('gear-images').upload(path, file, { upsert: false, contentType: file.type, cacheControl: '31536000' });
        if (uploadError) return null;
        return this.supabase.client.storage.from('gear-images').getPublicUrl(path).data.publicUrl;
      })
    )).filter((url): url is string => url !== null);
    if (newImageUrls.length < this.imageFiles.length) {
      // Don't publish with silently missing photos.
      this.toast.error('No se pudieron subir algunas fotos. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }
    this.uploadProgress.set(100);

    const allImages = [...this.existingImages(), ...newImageUrls];
    const editId = this.editId();

    if (editId) {
      const { error } = await this.supabase.client.from('gear_listings').update({
        title:       this.form.title.trim(),
        description: this.form.description.trim(),
        price:       this.form.price,
        category:    this.form.category,
        condition:   this.form.condition,
        city:        this.form.city,
        images:      allImages,
      }).eq('id', editId).eq('user_id', user.id);
      if (error) { this.toast.error('No se pudo guardar el anuncio. Inténtalo de nuevo.'); return; }
      this.toast.success('Anuncio actualizado.');
      this._submitted = true;
      this.router.navigate(['/shop', editId]);
      return;
    }

    const profile = this.userProfile();
    const { error, data } = await this.supabase.client.from('gear_listings').insert({
      user_id:             user.id,
      title:               this.form.title.trim(),
      description:         this.form.description.trim(),
      price:               this.form.price,
      category:            this.form.category,
      condition:           this.form.condition,
      city:                this.form.city,
      images:              allImages,
      seller_name:         profile?.name ?? ((await this.supabase.client.rpc('get_profile_name', { p_user_id: user.id })).data as string | null) ?? 'Usuario',
      seller_profile_type: profile?.type ?? null,
      seller_profile_id:   profile?.id ?? null,
    }).select().single();

      if (error) { this.toast.error(publishErrorMessage(error, 'No se pudo publicar el anuncio. Inténtalo de nuevo.')); return; }
      this.toast.success('Anuncio publicado.');
      this._submitted = true;
      this.router.navigate(['/shop', data.id]);
    } catch {
      this.toast.error('Error inesperado. Inténtalo de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }
}
