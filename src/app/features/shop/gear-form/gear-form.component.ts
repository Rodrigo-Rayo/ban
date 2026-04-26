import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-gear-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './gear-form.component.html',
})
export class GearFormComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  editId = signal<string | null>(null);
  existingImages = signal<string[]>([]);
  submitting = signal(false);
  error = signal('');
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
  readonly cities = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza', 'Otra'];

  async ngOnInit() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }
    this.currentUser.set(user);

    const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'];
    const types  = ['musician', 'band', 'venue', 'teacher', 'rehearsal'];
    for (let i = 0; i < tables.length; i++) {
      const { data } = await this.supabase.client
        .from(tables[i]).select('id,name').eq('user_id', user.id).maybeSingle();
      if (data) { this.userProfile.set({ ...data, type: types[i] }); break; }
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
      this.form.condition = listing.condition;
      this.form.city = listing.city;
      this.existingImages.set(listing.images ?? []);
    }
  }

  removeExistingImage(idx: number) {
    this.existingImages.update(imgs => imgs.filter((_, i) => i !== idx));
  }

  onFilesChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const added = Array.from(input.files).slice(0, 4 - this.imageFiles.length);
    this.imageFiles = [...this.imageFiles, ...added].slice(0, 4);
    this.refreshPreviews();
  }

  removeImage(idx: number) {
    this.imageFiles.splice(idx, 1);
    this.refreshPreviews();
  }

  private refreshPreviews() {
    this.imagePreviews.set(this.imageFiles.map(f => URL.createObjectURL(f)));
  }

  get canSubmit() {
    return this.form.title.trim() && this.form.price != null && this.form.price > 0;
  }

  async submit() {
    if (!this.canSubmit) return;
    const user = this.currentUser();
    if (!user) return;

    this.submitting.set(true);
    this.error.set('');

    const newImageUrls: string[] = [];
    for (let i = 0; i < this.imageFiles.length; i++) {
      const file = this.imageFiles[i];
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await this.supabase.client.storage
        .from('gear-images').upload(path, file, { upsert: false });
      if (!uploadError) {
        const { data: { publicUrl } } = this.supabase.client.storage
          .from('gear-images').getPublicUrl(path);
        newImageUrls.push(publicUrl);
      }
      this.uploadProgress.set(Math.round(((i + 1) / this.imageFiles.length) * 100));
    }

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
      if (error) { this.error.set(`Error: ${error.message}`); return; }
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
    if (error) { console.error('Supabase insert error:', error); this.error.set(`Error: ${error.message} (${error.code})`); return; }
    this.router.navigate(['/shop', data.id]);
  }
}
