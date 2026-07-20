import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { RegistrationStateService } from '../../core/services/registration-state.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CITIES } from '../../core/constants/cities';

export type Role = 'musician' | 'band' | 'venue' | 'teacher' | 'rehearsal' | 'listener';

function optionalUrl(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  try { new URL(control.value); return null; } catch { return { url: true }; }
}

function optionalPositiveNumber(control: AbstractControl): ValidationErrors | null {
  if (!control.value && control.value !== 0) return null;
  const n = Number(control.value);
  return isNaN(n) || n < 0 ? { positiveNumber: true } : null;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, IconComponent],
  templateUrl: './onboarding.component.html',
})
export class OnboardingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private registrationState = inject(RegistrationStateService);

  step = signal(0);
  role = signal<Role>('musician');
  originalRole = signal<Role | null>(null);
  loading = signal(false);
  error = signal('');
  isEditing = signal(false);
  pendingConfirmation = signal(false);
  pendingEmail = signal('');

  selectedInstruments = signal<string[]>([]);
  selectedGenres = signal<string[]>([]);
  selectedLevel = signal<string>('');

  bandMembers: { name: string; instrument: string }[] = [];
  selectedDays = signal<string[]>([]);
  selectedSlots = signal<string[]>([]);

  readonly DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  readonly DAYS_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  readonly SLOTS = ['mañanas', 'tardes', 'noches'];

  roles: { id: Role; label: string; icon: string; desc: string; separator?: boolean }[] = [
    { id: 'musician',  label: 'Músico',         icon: 'music',      desc: 'Toco solo o busco banda' },
    { id: 'band',      label: 'Banda',           icon: 'mic',        desc: 'Buscamos miembros o bolos' },
    { id: 'venue',     label: 'Sala / Espacio',  icon: 'building',   desc: 'Programo conciertos' },
    { id: 'teacher',   label: 'Profesor',        icon: 'book-open',  desc: 'Doy clases de música' },
    { id: 'rehearsal', label: 'Local de ensayo', icon: 'headphones', desc: 'Alquilo espacio' },
    { id: 'listener',  label: 'Soy del público', icon: 'radio',      desc: 'Descubro artistas y eventos', separator: true },
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
  cities = CITIES;

  nameForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });
  zoneForm = this.fb.group({
    city:             ['Madrid', Validators.required],
    description:      [''],
    contactEmail:     ['', Validators.email],
    capacity:         ['', optionalPositiveNumber],
    hourly_rate:      ['', optionalPositiveNumber],
    experience:       [''],
    spotify_url:      ['', optionalUrl],
    youtube_url:      ['', optionalUrl],
    instagram_url:    ['', optionalUrl],
    soundcloud_url:   ['', optionalUrl],
    website_url:      ['', optionalUrl],
    phone:            ['', Validators.pattern(/^[+\d\s\-().]{0,20}$/)],
    address:          [''],
    influences:       [''],
    modality:         ['presencial'],
    experience_years: ['', optionalPositiveNumber],
  });

  isListener        = computed(() => this.role() === 'listener');
  hasInstrumentStep = computed(() => this.role() === 'musician' || this.role() === 'teacher');
  hasLevelStep      = computed(() => this.role() === 'musician' || this.role() === 'teacher');
  totalSteps        = computed(() => {
    if (this.isListener()) return 2;
    return this.hasInstrumentStep() ? 5 : 4;
  });

  get namePlaceholder() {
    const map: Record<Role, string> = {
      musician:  'Tu nombre artístico o real',
      band:      'Nombre de la banda',
      venue:     'Nombre de la sala',
      teacher:   'Tu nombre completo',
      rehearsal: 'Nombre del local de ensayo',
      listener:  'Tu nombre o apodo',
    };
    return map[this.role()];
  }

  get nameSubtitle() {
    const map: Record<Role, string> = {
      musician:  'El nombre que verán los demás músicos en tu perfil.',
      band:      'El nombre con el que apareceréis en el directorio.',
      venue:     'El nombre con el que te conoce el público.',
      teacher:   'El nombre que verán tus potenciales alumnos.',
      rehearsal: 'El nombre con el que aparecerás en el directorio.',
      listener:  'El nombre que verán los demás en tu perfil.',
    };
    return map[this.role()];
  }

  get descriptionPlaceholder() {
    const map: Record<Role, string> = {
      musician:  'Cuéntanos sobre ti, tu estilo, lo que buscas...',
      band:      'Describid la banda, vuestro sonido, lo que buscáis...',
      venue:     'Describe la sala, el tipo de eventos que programas...',
      teacher:   'Cuéntanos tu experiencia y enfoque de enseñanza...',
      rehearsal: 'Describe el local, equipamiento, características...',
      listener:  '',
    };
    return map[this.role()];
  }

  get contactEmailPlaceholder() {
    const map: Record<Role, string> = {
      musician:  'tu@email.com',
      band:      'contacto@labanda.com',
      venue:     'info@tusala.com',
      teacher:   'clases@tumail.com',
      rehearsal: 'info@tulocal.com',
      listener:  '',
    };
    return map[this.role()];
  }

  toggleInstrument(i: string) {
    const cur = this.selectedInstruments();
    this.selectedInstruments.set(cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]);
  }
  toggleGenre(g: string) {
    const cur = this.selectedGenres();
    if (cur.includes(g)) { this.selectedGenres.set(cur.filter(x => x !== g)); return; }
    if (cur.length < 5) this.selectedGenres.set([...cur, g]);
  }
  toggleDay(d: string) {
    const cur = this.selectedDays();
    this.selectedDays.set(cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]);
  }
  toggleSlot(s: string) {
    const cur = this.selectedSlots();
    this.selectedSlots.set(cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]);
  }
  addMember() { this.bandMembers = [...this.bandMembers, { name: '', instrument: '' }]; }
  removeMember(i: number) { this.bandMembers = this.bandMembers.filter((_, idx) => idx !== i); }

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
    // Read stored role synchronously before any async operations so later
    // Supabase responses never race-overwrite a role the user already picked.
    const VALID_ROLES: Role[] = ['musician', 'band', 'venue', 'teacher', 'rehearsal', 'listener'];
    const stored = localStorage.getItem('bandyou_role');
    if (stored && VALID_ROLES.includes(stored as Role)) {
      this.role.set(stored as Role);
    }

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      if (!this.registrationState.hasPending) {
        this.router.navigate(['/auth/register']);
        return;
      }

      // Sign up immediately so email confirmation can be sent before the user fills the form
      const email = this.registrationState.email;
      const { data, error } = await this.supabase.signUpWithEmail(email, this.registrationState.password);
      this.registrationState.clear();

      if (error) {
        this.error.set(error.message || 'Error al crear la cuenta. Inténtalo de nuevo.');
        return;
      }

      if (!data.session) {
        // Supabase requires email confirmation — show the waiting screen
        this.pendingEmail.set(email);
        this.pendingConfirmation.set(true);
        return;
      }

      // No confirmation required — user is now logged in, show the empty onboarding form
      return;
    }

    const [
      { data: musicianData },
      { data: bandData },
      { data: venueData },
      { data: teacherData },
      { data: rehearsalData },
    ] = await Promise.all([
      this.supabase.client.from('musicians').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('bands').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('venues').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('teachers').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('rehearsal_spaces').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const found = [
      { data: musicianData, role: 'musician' as Role },
      { data: bandData,     role: 'band'     as Role },
      { data: venueData,    role: 'venue'    as Role },
      { data: teacherData,  role: 'teacher'  as Role },
      { data: rehearsalData, role: 'rehearsal' as Role },
    ].find(r => r.data !== null);

    if (!found) {
      const { data: profileRow } = await this.supabase.client
        .from('profiles').select('role, name').eq('id', user.id).maybeSingle();
      if (profileRow?.role === 'listener') {
        this.role.set('listener');
        this.originalRole.set('listener');
        this.isEditing.set(true);
        if (profileRow.name) this.nameForm.patchValue({ name: profileRow.name });
      }
    }

    if (found) {
      const { data, role } = found;
      this.role.set(role);
      this.originalRole.set(role);
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
      if (data.instrument)  this.selectedInstruments.set(data.instrument.split(',').map((s: string) => s.trim()).filter(Boolean));
      if (data.level)       this.selectedLevel.set(data.level);
      if (role === 'band') {
        const { data: members } = await this.supabase.client
          .from('band_members').select('name,instrument').eq('band_id', data.id);
        if (members) this.bandMembers = members.map((m: any) => ({ name: m.name, instrument: m.instrument }));
      }
      if (role === 'musician') {
        if (data.availability_days)  this.selectedDays.set(data.availability_days.split(',').filter(Boolean));
        if (data.availability_slots) this.selectedSlots.set(data.availability_slots.split(',').filter(Boolean));
      }
    }

  }

  async onSubmit() {
    this.loading.set(true);
    this.error.set('');

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) { this.loading.set(false); this.router.navigate(['/auth/login']); return; }
    const userId = user.id;

    const z = this.zoneForm.value;
    const role = this.role();

    const profilePayload: Record<string, unknown> = { id: userId, role };
    if (role === 'listener') profilePayload['name'] = this.nameForm.value.name ?? null;
    const { error: profileError } = await this.supabase.client
      .from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileError) {
      const { error: profileRetryError } = await this.supabase.client
        .from('profiles').upsert({ id: userId, role }, { onConflict: 'id' });
      if (profileRetryError) {
        this.loading.set(false);
        this.error.set(`Error al crear perfil: ${profileRetryError.message}`);
        return;
      }
    }

    const roleTableMap: Record<Role, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues',
      teacher: 'teachers', rehearsal: 'rehearsal_spaces', listener: '',
    };
    const prev = this.originalRole();
    if (prev && prev !== role && roleTableMap[prev]) {
      const roleLabels: Record<string, string> = { musician: 'músico', band: 'banda', venue: 'sala', teacher: 'profesor', rehearsal: 'local de ensayo', listener: 'oyente' };
      if (!confirm(`¿Cambiar tu perfil de ${roleLabels[prev] ?? prev} a ${roleLabels[role] ?? role}? Tu perfil anterior se eliminará permanentemente.`)) {
        this.loading.set(false);
        return;
      }
      const { error: deleteRoleError } = await this.supabase.client.from(roleTableMap[prev]).delete().eq('user_id', userId);
      if (deleteRoleError) {
        this.loading.set(false);
        this.error.set('No se pudo eliminar el perfil anterior. Inténtalo de nuevo.');
        return;
      }
    }

    const genre = this.selectedGenres().join(', ');
    const instrument = this.selectedInstruments().join(', ');
    let saveError = null;

    if (role === 'musician') {
      const { error } = await this.supabase.client.from('musicians').upsert({
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, genre, instrument, level: this.selectedLevel(),
        description: z.description, contact_email: z.contactEmail,
        spotify_url: z.spotify_url, youtube_url: z.youtube_url,
        instagram_url: z.instagram_url, soundcloud_url: z.soundcloud_url,
        website_url: z.website_url,
        influences: z.influences, experience: z.experience,
        availability_days: this.selectedDays().join(','),
        availability_slots: this.selectedSlots().join(','),
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'band') {
      const { data: bandRow, error } = await this.supabase.client.from('bands').upsert({
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, genre, description: z.description,
        contact_email: z.contactEmail,
        spotify_url: z.spotify_url, youtube_url: z.youtube_url,
        instagram_url: z.instagram_url, soundcloud_url: z.soundcloud_url,
        website_url: z.website_url,
      }, { onConflict: 'user_id' }).select('id').single();
      saveError = error;
      if (!error && bandRow) {
        await this.supabase.client.from('band_members').delete().eq('band_id', bandRow.id);
        const validMembers = this.bandMembers.filter(m => m.name.trim() && m.instrument);
        if (validMembers.length > 0) {
          const { error: membersError } = await this.supabase.client.from('band_members').insert(
            validMembers.map(m => ({ band_id: bandRow.id, name: m.name.trim(), instrument: m.instrument }))
          );
          if (membersError) saveError = membersError;
        }
      }
    } else if (role === 'venue') {
      const { error } = await this.supabase.client.from('venues').upsert({
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, genres: genre, capacity: z.capacity,
        description: z.description, contact_email: z.contactEmail,
        instagram_url: z.instagram_url, website_url: z.website_url,
        phone: z.phone, address: z.address,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'teacher') {
      const { error } = await this.supabase.client.from('teachers').upsert({
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, instrument, level: this.selectedLevel(),
        hourly_rate: z.hourly_rate, experience: z.experience,
        description: z.description, contact_email: z.contactEmail,
        instagram_url: z.instagram_url, youtube_url: z.youtube_url,
        website_url: z.website_url, modality: z.modality,
        experience_years: z.experience_years,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'rehearsal') {
      const { error } = await this.supabase.client.from('rehearsal_spaces').upsert({
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, hourly_rate: z.hourly_rate, capacity: z.capacity,
        description: z.description, contact_email: z.contactEmail,
        phone: z.phone, address: z.address, website_url: z.website_url,
        instagram_url: z.instagram_url,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'listener') {
      saveError = null;
    }

    this.loading.set(false);
    if (saveError) {
      this.error.set('No se pudo guardar el perfil. Por favor, inténtalo de nuevo.');
    } else {
      localStorage.removeItem('bandyou_role');
      this.router.navigate(['/home']);
    }
  }

  goToDashboard() { this.router.navigate(['/dashboard']); }
}
