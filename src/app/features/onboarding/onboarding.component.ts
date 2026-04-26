import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

export type Role = 'musician' | 'band' | 'venue' | 'teacher' | 'rehearsal';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, IconComponent],
  templateUrl: './onboarding.component.html',
})
export class OnboardingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  step = signal(0);
  role = signal<Role>('musician');
  loading = signal(false);
  error = signal('');
  isEditing = signal(false);

  selectedInstruments = signal<string[]>([]);
  selectedGenres = signal<string[]>([]);
  selectedLevel = signal<string>('');

  roles: { id: Role; label: string; icon: string; desc: string }[] = [
    { id: 'musician',  label: 'Músico',         icon: 'music',      desc: 'Toco solo o busco banda' },
    { id: 'band',      label: 'Banda',           icon: 'mic',        desc: 'Buscamos miembros o bolos' },
    { id: 'venue',     label: 'Sala / Espacio',  icon: 'building',   desc: 'Programo conciertos' },
    { id: 'teacher',   label: 'Profesor',        icon: 'book-open',  desc: 'Doy clases de música' },
    { id: 'rehearsal', label: 'Local de ensayo', icon: 'headphones', desc: 'Alquilo espacio' },
  ];

  instruments = ['Guitarra', 'Bajo', 'Batería', 'Teclados', 'Voz', 'Violín', 'Trompeta', 'Saxofón', 'Piano', 'Flauta', 'Clarinete', 'Contrabajo', 'Arpa', 'Percusión', 'Otro'];
  genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Reggae', 'Punk', 'Clásico', 'Experimental', 'Hip-Hop', 'Bossa Nova'];
  levels = [
    { id: 'principiante', label: 'Principiante', desc: 'Empezando el camino' },
    { id: 'aficionado',   label: 'Aficionado',   desc: 'Toco en casa y jams' },
    { id: 'semi-pro',     label: 'Semi-pro',     desc: 'Bolos y sesiones esporádicas' },
    { id: 'pro',          label: 'Profesional',  desc: 'Vivo de la música' },
    { id: 'experto',      label: 'Experto',      desc: 'Sesionista / maestro' },
  ];
  cities = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza', 'Otra'];

  nameForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });
  zoneForm = this.fb.group({
    city:          ['Madrid', Validators.required],
    description:   [''],
    contactEmail:  ['', Validators.email],
    capacity:      [''],
    hourly_rate:   [''],
    experience:    [''],
    spotify_url:   [''],
    youtube_url:   [''],
    instagram_url: [''],
    soundcloud_url:[''],
    website_url:   [''],
    phone:         [''],
    address:       [''],
    influences:    [''],
    modality:      ['presencial'],
    experience_years: [''],
  });

  hasInstrumentStep = computed(() => this.role() === 'musician' || this.role() === 'teacher');
  hasLevelStep      = computed(() => this.role() === 'musician' || this.role() === 'teacher');
  totalSteps        = computed(() => this.hasInstrumentStep() ? 5 : 4);

  toggleInstrument(i: string) {
    const cur = this.selectedInstruments();
    this.selectedInstruments.set(cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]);
  }
  toggleGenre(g: string) {
    const cur = this.selectedGenres();
    if (cur.includes(g)) { this.selectedGenres.set(cur.filter(x => x !== g)); return; }
    if (cur.length < 5) this.selectedGenres.set([...cur, g]);
  }

  next() { this.step.update(s => s + 1); }
  back() { this.step.update(s => Math.max(0, s - 1)); }

  canProceedStep1() {
    return this.nameForm.valid;
  }
  canProceedStep2() {
    if (this.hasInstrumentStep()) return this.selectedInstruments().length > 0;
    return true;
  }
  canProceedStep3() {
    return this.selectedGenres().length > 0;
  }

  async ngOnInit() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return;

    const checks: { table: string; role: Role }[] = [
      { table: 'musicians',        role: 'musician'  },
      { table: 'bands',            role: 'band'      },
      { table: 'venues',           role: 'venue'     },
      { table: 'teachers',         role: 'teacher'   },
      { table: 'rehearsal_spaces', role: 'rehearsal' },
    ];
    for (const { table, role } of checks) {
      const { data } = await this.supabase.client.from(table).select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        this.role.set(role);
        this.isEditing.set(true);
        this.nameForm.patchValue({ name: data.name });
        this.zoneForm.patchValue({
          city:           data.city ?? 'Madrid',
          description:    data.description ?? '',
          contactEmail:   data.contact_email ?? '',
          capacity:       data.capacity ?? '',
          hourly_rate:    data.hourly_rate ?? '',
          experience:     data.experience ?? '',
          spotify_url:    data.spotify_url ?? '',
          youtube_url:    data.youtube_url ?? '',
          instagram_url:  data.instagram_url ?? '',
          soundcloud_url: data.soundcloud_url ?? '',
          website_url:    data.website_url ?? '',
          phone:          data.phone ?? '',
          address:        data.address ?? '',
          influences:     data.influences ?? '',
          modality:       data.modality ?? 'presencial',
          experience_years: data.experience_years ?? '',
        });
        if (data.genre)       this.selectedGenres.set(data.genre.split(',').map((s: string) => s.trim()).filter(Boolean));
        if (data.genres)      this.selectedGenres.set(data.genres.split(',').map((s: string) => s.trim()).filter(Boolean));
        if (data.instrument)  this.selectedInstruments.set([data.instrument]);
        if (data.level)       this.selectedLevel.set(data.level);
        break;
      }
    }
    if (!this.isEditing()) {
      const savedRole = (localStorage.getItem('bandyou_role') || 'musician') as Role;
      this.role.set(savedRole);
    }
  }

  async onSubmit() {
    this.loading.set(true);
    this.error.set('');

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }

    const z = this.zoneForm.value;
    const role = this.role();

    await this.supabase.client.from('profiles').update({ role }).eq('id', user.id);

    const genre = this.selectedGenres().join(', ');
    const instrument = this.selectedInstruments().join(', ');
    let saveError = null;

    if (role === 'musician') {
      const { error } = await this.supabase.client.from('musicians').upsert({
        user_id: user.id, name: this.nameForm.value.name,
        city: z.city, genre, instrument, level: this.selectedLevel(),
        description: z.description, contact_email: z.contactEmail || user.email,
        available: true, spotify_url: z.spotify_url, youtube_url: z.youtube_url,
        instagram_url: z.instagram_url, soundcloud_url: z.soundcloud_url,
        influences: z.influences, experience: z.experience,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'band') {
      const { error } = await this.supabase.client.from('bands').upsert({
        user_id: user.id, name: this.nameForm.value.name,
        city: z.city, genre, description: z.description,
        contact_email: z.contactEmail || user.email,
        spotify_url: z.spotify_url, youtube_url: z.youtube_url,
        instagram_url: z.instagram_url, website_url: z.website_url,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'venue') {
      const { error } = await this.supabase.client.from('venues').upsert({
        user_id: user.id, name: this.nameForm.value.name,
        city: z.city, genres: genre, capacity: z.capacity,
        description: z.description, contact_email: z.contactEmail || user.email,
        instagram_url: z.instagram_url, website_url: z.website_url,
        phone: z.phone, address: z.address, equipment: z.description,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'teacher') {
      const { error } = await this.supabase.client.from('teachers').upsert({
        user_id: user.id, name: this.nameForm.value.name,
        city: z.city, instrument, level: this.selectedLevel(),
        hourly_rate: z.hourly_rate, experience: z.experience,
        description: z.description, contact_email: z.contactEmail || user.email,
        instagram_url: z.instagram_url, youtube_url: z.youtube_url,
        website_url: z.website_url, modality: z.modality,
        experience_years: z.experience_years,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'rehearsal') {
      const { error } = await this.supabase.client.from('rehearsal_spaces').upsert({
        user_id: user.id, name: this.nameForm.value.name,
        city: z.city, hourly_rate: z.hourly_rate, capacity: z.capacity,
        description: z.description, contact_email: z.contactEmail || user.email,
        phone: z.phone, address: z.address, website_url: z.website_url,
        instagram_url: z.instagram_url,
      }, { onConflict: 'user_id' });
      saveError = error;
    }

    this.loading.set(false);
    if (saveError) {
      console.error('[onboarding] save error:', saveError.code, saveError.message, saveError.details);
      this.error.set(`Error al guardar: ${saveError.message} (${saveError.code})`);
    } else {
      localStorage.removeItem('bandyou_role');
      this.step.set(this.totalSteps());
    }
  }

  goToDashboard() { this.router.navigate(['/dashboard']); }
}
