import { Component, HostListener, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';

@Component({
  selector: 'app-gear-form',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './gear-form.component.html',
})
export class GearFormComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private toast = inject(ToastService);
  auth = inject(AuthService);

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

  currentUser = signal<any>(null);
  userProfile = signal<any>(null);

  readonly categories = ['Guitarras', 'Bajos', 'Batería', 'Teclados', 'Amplificadores', 'Efectos', 'PA/Sonido', 'Accesorios', 'Otro'];
  readonly conditions = [
    { id: 'new',       label: 'Nuevo' },
    { id: 'like_new',  label: 'Como nuevo' },
    { id: 'good',      label: 'Bueno' },
    { id: 'acceptable', label: 'Aceptable' },
  ];
  readonly cities = CITIES;

  async ngOnInit() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }
    this.currentUser.set(user);

    const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'] as const;
    const types  = ['musician', 'band', 'venue', 'teacher', 'rehearsal'] as const;
    const results = await Promise.all(
      tables.map(t => this.supabase.client.from(t).select('id,name').eq('user_id', user.id).maybeSingle())
    );
    const idx = results.findIndex(r => r.data);
    if (idx !== -1) this.userProfile.set({ ...results[idx].data, type: types[idx] });

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
      this.form.condition = listing.condition;
      this.form.city = listing.city;
      this.existingImages.set(listing.images ?? []);
    }
  }

  removeExistingImage(idx: number) {
    this.existingImages.update(imgs => imgs.filter((_, i) => i !== idx));
  }

  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

  onFilesChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const valid = Array.from(input.files).filter(f =>
      this.ALLOWED_TYPES.includes(f.type) && f.size <= this.MAX_FILE_SIZE
    );
    const rejected = Array.from(input.files).length - valid.length;
    if (rejected > 0) this.error.set(`${rejected} archivo(s) rechazado(s): solo imágenes hasta 8 MB.`);
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

  goBack() { this.location.back(); }

  get canSubmit() {
    return this.form.title.trim() && this.form.price != null && this.form.price > 0;
  }

  async submit() {
    this.formTouched.set(true);
    if (!this.canSubmit) return;
    const user = this.currentUser();
    if (!user) return;

    this.submitting.set(true);
    this.error.set('');

    const newImageUrls = (await Promise.all(
      this.imageFiles.map(async (file) => {
        const ext  = file.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await this.supabase.client.storage
          .from('gear-images').upload(path, file, { upsert: false });
        if (uploadError) return null;
        return this.supabase.client.storage.from('gear-images').getPublicUrl(path).data.publicUrl;
      })
    )).filter((url): url is string => url !== null);
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
      this.submitting.set(false);
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
      seller_name:         profile?.name ?? user.email?.split('@')[0] ?? 'Usuario',
      seller_profile_type: profile?.type ?? '',
      seller_profile_id:   profile?.id ?? null,
    }).select().single();

    this.submitting.set(false);
    if (error) { this.toast.error('No se pudo publicar el anuncio. Inténtalo de nuevo.'); return; }
    this.toast.success('Anuncio publicado.');
    this._submitted = true;
    this.router.navigate(['/shop', data.id]);
  }
}
