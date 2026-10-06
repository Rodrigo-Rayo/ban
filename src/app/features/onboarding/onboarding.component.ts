import { Component, ElementRef, HostListener, inject, signal, computed, viewChild, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { SeoService } from '../../core/services/seo.service';
import { RegistrationStateService } from '../../core/services/registration-state.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CITIES } from '../../core/constants/cities';
import { GENRES, INSTRUMENTS } from '../../core/constants/music.constants';
import { optionalUrl, optionalPositiveNumber } from '../../core/utils/form-validators';
import { LEGAL_INFO } from '../legal/legal-info';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { ProfilePhotosComponent } from '../../shared/components/profile-photos/profile-photos.component';

export type Role = 'musician' | 'band' | 'venue' | 'teacher' | 'rehearsal' | 'listener';

/** Optional numeric inputs hold '' until touched; numeric columns reject ''. */
function toNumberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

@Component({
    selector: 'app-onboarding',
    imports: [ReactiveFormsModule, FormsModule, CommonModule, IconComponent, RouterLink, ProfilePhotosComponent],
    templateUrl: './onboarding.component.html'
})
export class OnboardingComponent implements OnInit {
  readonly minAge = LEGAL_INFO.minAge;
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private registrationState = inject(RegistrationStateService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private seo = inject(SeoService);

  step = signal(0);
  role = signal<Role>('musician');
  originalRole = signal<Role | null>(null);
  loading = signal(false);
  error = signal('');
  isEditing = signal(false);
  /** No acceptance recorded yet (e.g. Google sign-in): the notice by the submit button applies. */
  needsConsent = signal(false);
  pendingConfirmation = signal(false);
  pendingEmail = signal('');
  /** Photos picked on the last step of a new profile; uploaded once the profile row exists. */
  private photos = viewChild(ProfilePhotosComponent);
  /** Validation message for chip-based steps (instruments / genres). */
  stepError = signal('');

  selectedInstruments = signal<string[]>([]);
  selectedGenres = signal<string[]>([]);
  selectedLevel = signal<string>('');

  bandMembers: { name: string; instrument: string }[] = [];
  selectedDays = signal<string[]>([]);
  selectedSlots = signal<string[]>([]);
  /** Bands: "Disponibles para bolos". Days/slots above double as rehearsal days. */
  openToGigs = signal(false);
  /** Musician: "También doy clases" (musicians.gives_lessons, once it exists). */
  givesLessons = signal(false);
  private features = inject(MediaFeaturesService);
  /** Band availability fields exist in the live DB (see MediaFeaturesService). */
  readonly bandAvailability = this.features.state('bandAvailability');
  readonly canGiveLessons = this.features.state('giveLessons');
  /** Musicians, bands and teachers got a phone column with supabase/2026_10_private_contact.sql. */
  readonly contactPhoneAvailable = this.features.state('profileContact');

  readonly DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  readonly DAYS_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  readonly DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  readonly SLOTS = ['mañanas', 'tardes', 'noches'];

  roles: { id: Role; label: string; icon: string; desc: string; separator?: boolean }[] = [
    { id: 'musician',  label: 'Músico',         icon: 'music',      desc: 'Toco solo o busco banda' },
    { id: 'band',      label: 'Banda',           icon: 'mic',        desc: 'Buscamos miembros o bolos' },
    { id: 'venue',     label: 'Sala',            icon: 'building',   desc: 'Programo conciertos' },
    { id: 'teacher',   label: 'Profesor',        icon: 'book-open',  desc: 'Doy clases de música' },
    { id: 'rehearsal', label: 'Local',           icon: 'headphones', desc: 'Alquilo espacio' },
    { id: 'listener',  label: 'Soy del público', icon: 'heart',      desc: 'Descubro artistas y eventos', separator: true },
  ];

  readonly roleIds: readonly Role[] = this.roles.map(r => r.id);
  readonly instruments = INSTRUMENTS;
  readonly genres = GENRES;
  levels = [
    { id: 'principiante', label: 'Principiante', desc: 'Empezando el camino' },
    { id: 'aficionado',   label: 'Aficionado',   desc: 'Toco en casa y jams' },
    { id: 'semi-pro',     label: 'Semi-pro',     desc: 'Bolos y sesiones esporádicas' },
    { id: 'pro',          label: 'Profesional',  desc: 'Vivo de la música' },
    { id: 'experto',      label: 'Experto',      desc: 'Sesionista / maestro' },
  ];
  readonly levelIds: readonly string[] = this.levels.map(l => l.id);
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
  /** Roles whose display name is a person's name (vs an organisation). */
  isPersonRole      = computed(() => ['musician', 'teacher', 'listener'].includes(this.role()));
  hasInstrumentStep = computed(() => this.role() === 'musician' || this.role() === 'teacher');
  /** Copy for the genre step shown to non-instrument roles (band, venue, rehearsal, listener). */
  genreCopy = computed(() => {
    switch (this.role()) {
      case 'band':      return { verb: 'tocáis', hint: 'Hasta 5 géneros que definen a la banda.' };
      case 'rehearsal': return { verb: 'se ensayan en tu local', hint: 'Hasta 5 géneros que encajan con tu local.' };
      case 'listener':  return { verb: 'te gustan', hint: 'Hasta 5 géneros para recomendarte artistas y eventos.' };
      default:          return { verb: 'programas', hint: 'Hasta 5 géneros que definen tu espacio.' };
    }
  });
  /** Final button copy: the account already exists, so we never say "Crear cuenta" here. */
  submitLabel     = computed(() => (this.isEditing() ? 'Guardar cambios' : 'Crear perfil'));
  submitBusyLabel = computed(() => (this.isEditing() ? 'Guardando…' : 'Creando perfil…'));
  totalSteps        = computed(() => {
    if (this.isListener()) return 2;
    return this.hasInstrumentStep() ? 6 : 4;
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
  addMember() {
    this.bandMembers = [...this.bandMembers, { name: '', instrument: '' }];
    // Move focus into the newly added row so keyboard users can type straight away.
    setTimeout(() => {
      const inputs = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-member-name]');
      inputs[inputs.length - 1]?.focus();
    });
  }
  removeMember(i: number) { this.bandMembers = this.bandMembers.filter((_, idx) => idx !== i); }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.step() > 0 && (this.nameForm.dirty || this.zoneForm.dirty) && !this.loading()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  next() {
    this.stepError.set('');
    this.step.update(s => s + 1);
    this.focusStepHeading();
  }
  back() {
    this.stepError.set('');
    // Editing starts at the name step: there is nothing before it but leaving.
    if (this.isEditing() && this.step() <= 1) { this.goToDashboard(); return; }
    this.step.update(s => Math.max(0, s - 1));
    this.focusStepHeading();
  }

  /** Explicit, opt-in way back to the role step while editing. */
  changeRole() {
    this.stepError.set('');
    this.step.set(0);
    this.focusStepHeading();
  }

  /** After a step change, move focus to the new step's heading (WCAG 2.4.3). */
  private focusStepHeading() {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('#onb-step-heading')?.focus());
  }

  /** Advance from a chip step, or explain why we can't. */
  tryNext(canProceed: boolean, message: string) {
    if (!canProceed) {
      this.stepError.set(message);
      return;
    }
    this.next();
  }

  nameInvalid(): boolean {
    const c = this.nameForm.get('name');
    return !!c && c.invalid && c.touched;
  }

  zInvalid(name: string): boolean {
    const c = this.zoneForm.get(name);
    return !!c && c.invalid && c.touched;
  }

  nextFromName() {
    if (this.nameForm.invalid) {
      this.nameForm.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('#onb-name')?.focus();
      return;
    }
    if (this.isListener()) { this.onSubmit(); return; }
    this.next();
  }

  /** Final step: surface validation errors instead of a dead disabled button. */
  submitZone() {
    if (this.zoneForm.invalid) {
      this.zoneForm.markAllAsTouched();
      const firstInvalid = this.host.nativeElement
        .querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid');
      if (firstInvalid) { firstInvalid.focus(); return; }
      // Invalid control not rendered for this role: it is irrelevant here, so carry on.
    }
    this.onSubmit();
  }

  selectRole = (id: string) => this.role.set(id as Role);
  selectLevel = (id: string) => this.selectedLevel.set(id);

  /** Roving-tabindex arrow-key handling for custom radiogroups (APG radio pattern). */
  onRadioKeydown(event: KeyboardEvent, ids: readonly string[], current: string, select: (id: string) => void) {
    const delta: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    const cur = Math.max(0, ids.indexOf(current));
    let idx: number;
    if (event.key in delta) idx = (cur + delta[event.key] + ids.length) % ids.length;
    else if (event.key === 'Home') idx = 0;
    else if (event.key === 'End') idx = ids.length - 1;
    else return;
    event.preventDefault();
    select(ids[idx]);
    const radios = (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]');
    radios[idx]?.focus();
  }

  canProceedStep2() {
    if (this.hasInstrumentStep()) return this.selectedInstruments().length > 0;
    return true;
  }
  canProceedStep3() {
    return this.selectedGenres().length > 0;
  }

  async ngOnInit() {
    void this.features.has('bandAvailability');
    void this.features.has('giveLessons');
    void this.features.has('profileContact');
    // Read stored role synchronously before any async operations so later
    // Supabase responses never race-overwrite a role the user already picked.
    const VALID_ROLES: Role[] = ['musician', 'band', 'venue', 'teacher', 'rehearsal', 'listener'];
    const stored = localStorage.getItem('bandyou_role');
    if (stored && VALID_ROLES.includes(stored as Role)) {
      this.role.set(stored as Role);
    }

    try {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      if (!this.registrationState.hasPending) {
        this.router.navigate(['/auth/register']);
        return;
      }

      // Sign up immediately so email confirmation can be sent before the user fills the form
      const email = this.registrationState.email;
      // The register page states that signing up accepts the Terms and confirms the
      // minimum age; store that acceptance on the auth user as evidence.
      const { data, error } = await this.supabase.signUpWithEmail(email, this.registrationState.password, {
        terms_version: LEGAL_INFO.version,
        terms_accepted_at: new Date().toISOString(),
        age_confirmed: true,
      });
      this.registrationState.clear();

      if (error) {
        this.error.set('Error al crear la cuenta. Inténtalo de nuevo.');
        return;
      }

      // With email confirmation on, signing up an existing email returns no
      // error but a user without identities — no email will ever arrive.
      if (data.user && data.user.identities?.length === 0) {
        this.error.set('Ya existe una cuenta con este email. Inicia sesión o recupera tu contraseña.');
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

    this.needsConsent.set(!user.user_metadata?.['terms_accepted_at']);

    const [
      { data: musicianData, error: e1 },
      { data: bandData,     error: e2 },
      { data: venueData,    error: e3 },
      { data: teacherData,  error: e4 },
      { data: rehearsalData, error: e5 },
    ] = await Promise.all([
      this.supabase.client.from('musicians').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('bands').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('venues').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('teachers').select('*').eq('user_id', user.id).maybeSingle(),
      this.supabase.client.from('rehearsal_spaces').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    if (e1 || e2 || e3 || e4 || e5) {
      this.error.set('Error al cargar tu perfil. Por favor recarga la página.');
      return;
    }

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
        this.startEditing();
        if (profileRow.name) this.nameForm.patchValue({ name: profileRow.name });
      }
    }

    if (found) {
      const { data, role } = found;
      this.role.set(role);
      this.originalRole.set(role);
      this.startEditing();
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
      if (role === 'musician') this.givesLessons.set(!!data.gives_lessons);
      if (role === 'band') {
        if (data.rehearsal_days)  this.selectedDays.set(data.rehearsal_days.split(',').filter(Boolean));
        if (data.rehearsal_slots) this.selectedSlots.set(data.rehearsal_slots.split(',').filter(Boolean));
        this.openToGigs.set(!!data.open_to_gigs);
        const { data: members } = await this.supabase.client
          .from('band_members').select('name,instrument').eq('band_id', data.id);
        if (members) this.bandMembers = members.map((m: { name: string; instrument: string | null }) => ({ name: m.name, instrument: m.instrument ?? '' }));
      }
      if (role === 'musician') {
        if (data.availability_days)  this.selectedDays.set(data.availability_days.split(',').filter(Boolean));
        if (data.availability_slots) this.selectedSlots.set(data.availability_slots.split(',').filter(Boolean));
      }
    }
    } catch {
      this.error.set('Error al cargar tu perfil. Recarga la página.');
    }
  }

  /** Editing skips the role step (changing type stays one click away). */
  private startEditing() {
    this.isEditing.set(true);
    this.step.set(1);
    this.seo.set({ title: 'Editar perfil' });
  }

  async onSubmit() {
    this.loading.set(true);
    this.error.set('');
    try {

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }
    const userId = user.id;

    const z = this.zoneForm.value;
    const role = this.role();

    const roleTableMap: Record<Role, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues',
      teacher: 'teachers', rehearsal: 'rehearsal_spaces', listener: '',
    };
    // Ask before writing anything, so cancelling leaves the account untouched.
    const prev = this.originalRole();
    const isRoleChange = !!prev && prev !== role && !!roleTableMap[prev];
    if (isRoleChange) {
      const roleLabels: Record<string, string> = { musician: 'músico', band: 'banda', venue: 'sala', teacher: 'profesor', rehearsal: 'local', listener: 'oyente' };
      if (!(await this.confirm.ask({
        title: `¿Cambiar tu perfil de ${roleLabels[prev] ?? prev} a ${roleLabels[role] ?? role}?`,
        message: 'Tu perfil anterior se eliminará para siempre.',
        confirmLabel: 'Cambiar perfil', danger: true,
      }))) {
        return;
      }
    }

    const profilePayload: Record<string, unknown> = { id: userId, role };
    if (role === 'listener') profilePayload['name'] = this.nameForm.value.name ?? null;
    const { error: profileError } = await this.supabase.client
      .from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileError) {
      const { error: profileRetryError } = await this.supabase.client
        .from('profiles').upsert({ id: userId, role }, { onConflict: 'id' });
      if (profileRetryError) {
        this.error.set('No se pudo crear tu perfil. Inténtalo de nuevo.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    const genre = this.selectedGenres().join(', ');
    const instrument = this.selectedInstruments().join(', ');
    let saveError = null;

    if (role === 'musician') {
      const { error } = await this.supabase.client.from('musicians').upsert({
        ...(this.contactPhoneAvailable() ? { phone: z.phone || null } : {}),
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, genre, instrument, level: this.selectedLevel(),
        description: z.description, contact_email: z.contactEmail,
        spotify_url: z.spotify_url, youtube_url: z.youtube_url,
        instagram_url: z.instagram_url, soundcloud_url: z.soundcloud_url,
        website_url: z.website_url,
        influences: z.influences, experience: z.experience,
        availability_days: this.selectedDays().join(','),
        availability_slots: this.selectedSlots().join(','),
        ...(this.canGiveLessons() ? { gives_lessons: this.givesLessons() } : {}),
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'band') {
      const { data: bandRow, error } = await this.supabase.client.from('bands').upsert({
        ...(this.contactPhoneAvailable() ? { phone: z.phone || null } : {}),
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, genre, description: z.description,
        contact_email: z.contactEmail,
        spotify_url: z.spotify_url, youtube_url: z.youtube_url,
        instagram_url: z.instagram_url, soundcloud_url: z.soundcloud_url,
        website_url: z.website_url,
        ...(this.bandAvailability() ? {
          rehearsal_days: this.selectedDays().join(','),
          rehearsal_slots: this.selectedSlots().join(','),
          open_to_gigs: this.openToGigs(),
        } : {}),
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
        city: z.city, genres: genre, capacity: toNumberOrNull(z.capacity),
        description: z.description, contact_email: z.contactEmail,
        instagram_url: z.instagram_url, website_url: z.website_url,
        phone: z.phone, address: z.address,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'teacher') {
      const { error } = await this.supabase.client.from('teachers').upsert({
        ...(this.contactPhoneAvailable() ? { phone: z.phone || null } : {}),
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, instrument, level: this.selectedLevel(),
        hourly_rate: toNumberOrNull(z.hourly_rate), experience: z.experience,
        description: z.description, contact_email: z.contactEmail,
        instagram_url: z.instagram_url, youtube_url: z.youtube_url,
        website_url: z.website_url, modality: z.modality,
        experience_years: toNumberOrNull(z.experience_years),
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'rehearsal') {
      const { error } = await this.supabase.client.from('rehearsal_spaces').upsert({
        user_id: userId, name: this.nameForm.value.name,
        city: z.city, hourly_rate: toNumberOrNull(z.hourly_rate), capacity: toNumberOrNull(z.capacity),
        description: z.description, contact_email: z.contactEmail,
        phone: z.phone, address: z.address, website_url: z.website_url,
        instagram_url: z.instagram_url,
      }, { onConflict: 'user_id' });
      saveError = error;
    } else if (role === 'listener') {
      saveError = null;
    }

      if (!saveError && isRoleChange && prev) {
        const { error: deleteRoleError } = await this.supabase.client.from(roleTableMap[prev]).delete().eq('user_id', userId);
        if (deleteRoleError) saveError = deleteRoleError;
      }

      if (saveError) {
        this.error.set('No se pudo guardar el perfil. Por favor, inténtalo de nuevo.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        if (this.needsConsent()) {
          // Creating the profile accepts the Terms (notice by the button). Best effort:
          // the profile is saved; a failed metadata write must not block entry.
          await this.supabase.auth.updateUser({ data: {
            terms_version: LEGAL_INFO.version,
            terms_accepted_at: new Date().toISOString(),
            age_confirmed: true,
          } }).catch(() => undefined);
        }
        if (!this.isEditing()) await this.photos()?.save(userId);
        localStorage.removeItem('bandyou_role');
        if (this.isEditing()) {
          this.toast.success('Perfil actualizado.');
          this.router.navigate(['/dashboard']);
        } else {
          this.toast.success('Perfil creado.');
          // The panel shows the new profile (photo included) and is where it is managed from.
          // Listeners have no photo to add and go straight to the front page.
          this.router.navigate([role === 'listener' ? '/home' : '/dashboard']);
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  goToDashboard() { this.router.navigate(['/dashboard']); }
}
