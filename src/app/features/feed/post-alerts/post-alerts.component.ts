import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ProfileGateService } from '../../../core/services/profile-gate.service';

export interface PostAlert { id: string; city: string | null; instrument: string | null }

const ALL_SPAIN = 'Toda España';
export const MAX_ALERTS = 5;

/** "Batería · Madrid", "Cualquier anuncio · toda España". */
export function alertLabel(a: Pick<PostAlert, 'city' | 'instrument'>): string {
  return `${a.instrument || 'Cualquier anuncio'} · ${a.city || 'toda España'}`;
}

/**
 * "Avísame" on Se busca: saves the current province/instrument filters as an alert
 * (post_alerts). The database notifies on each matching new post (bell). Signed-in
 * users only, and only once supabase/2026_10_lessons_alerts.sql has been run.
 */
@Component({
  selector: 'app-post-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (auth.isLoggedIn() && available()) {
      <section aria-label="Alertas de Se busca" class="flex flex-wrap items-center gap-2">
        @if (currentAlert(); as a) {
          <span class="font-mono text-[11px] font-bold uppercase text-ink-muted inline-flex items-center gap-1.5 min-h-[44px]">
            <app-icon name="bell" [size]="14"/> Te avisamos de {{ label(a) }}
          </span>
        } @else if (!canCreate()) {
          <span class="font-mono text-[11px] font-bold uppercase text-ink-muted inline-flex items-center gap-1.5 min-h-[44px]">
            <app-icon name="bell" [size]="14"/> Elige provincia o instrumento para crear una alerta
          </span>
        } @else if (alerts().length < max) {
          <button type="button" (click)="add()" [attr.aria-busy]="busy()"
            class="btn-secondary min-h-[44px] !px-3 text-xs" [class.opacity-60]="busy()">
            <app-icon name="bell" [size]="14"/> Avísame: {{ label(current()) }}
          </button>
        }
        @for (a of others(); track a.id) {
          <span class="tag inline-flex items-center gap-1 !pr-0">
            {{ label(a) }}
            <button type="button" (click)="remove(a)" class="min-h-[44px] min-w-[44px] -my-2 inline-flex items-center justify-center hover:text-primary-600"
              [attr.aria-label]="'Quitar alerta ' + label(a)">
              <app-icon name="x" [size]="12" [strokeWidth]="2.5"/>
            </button>
          </span>
        }
        @if (currentAlert(); as a) {
          <button type="button" (click)="remove(a)" class="font-mono text-[11px] font-bold uppercase underline underline-offset-4 min-h-[44px] px-1 hover:text-primary-600">
            Quitar esta alerta
          </button>
        }
      </section>
    }
  `,
})
export class PostAlertsComponent {
  /** Province filter of Se busca ('Toda España' = any). */
  readonly city = input<string>(ALL_SPAIN);
  /** Instrument filter of Se busca ('' = any). */
  readonly instrument = input<string>('');

  readonly auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private gate = inject(ProfileGateService);
  private features = inject(MediaFeaturesService);
  private toast = inject(ToastService);

  readonly available = this.features.state('postAlerts');
  readonly alerts = signal<PostAlert[]>([]);
  readonly busy = signal(false);
  readonly max = MAX_ALERTS;
  readonly label = alertLabel;

  /** The alert the current filters would create. */
  readonly current = computed(() => ({
    city: this.city() && this.city() !== ALL_SPAIN ? this.city() : null,
    instrument: this.instrument() || null,
  }));
  readonly currentAlert = computed(() => {
    const c = this.current();
    return this.alerts().find(a => (a.city ?? null) === c.city && (a.instrument ?? null) === c.instrument) ?? null;
  });
  readonly others = computed(() => this.alerts().filter(a => a !== this.currentAlert()));
  /** An alert needs a province or an instrument: "everything" would notify every post. */
  readonly canCreate = computed(() => !!(this.current().city || this.current().instrument));

  constructor() {
    effect(() => {
      if (!this.auth.isLoggedIn()) { this.alerts.set([]); return; }
      void this.features.has('postAlerts').then(ok => { if (ok) void this.load(); });
    });
  }

  private async load(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('post_alerts').select('id, city, instrument').order('created_at', { ascending: true });
    if (!error) this.alerts.set((data ?? []) as PostAlert[]);
  }

  async add(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId || this.busy() || !this.canCreate()) return;
    if (!(await this.gate.ensure())) return;
    this.busy.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('post_alerts').insert({ user_id: userId, ...this.current() })
        .select('id, city, instrument').single();
      if (error) {
        this.toast.error(error.code === '23505' ? 'Ya tienes esa alerta.'
          : error.code === 'P0001' ? `Puedes tener hasta ${MAX_ALERTS} alertas. Quita alguna primero.`
          : 'No se pudo crear la alerta. Inténtalo de nuevo.');
        return;
      }
      this.alerts.update(list => [...list, data as PostAlert]);
      this.toast.success('Listo: te avisaremos en la campana cuando se publique algo así.');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(alert: PostAlert): Promise<void> {
    const previous = this.alerts();
    this.alerts.update(list => list.filter(a => a.id !== alert.id));
    const { error } = await this.supabase.client.from('post_alerts').delete().eq('id', alert.id);
    if (error) {
      this.alerts.set(previous);
      this.toast.error('No se pudo quitar la alerta.');
    }
  }
}
