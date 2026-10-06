import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Mi panel → "Avisarme por email de mensajes nuevos" (notification_prefs.email_messages,
 * default on). Hidden until supabase/2026_10_email_notifications.sql has been run.
 */
@Component({
  selector: 'app-email-prefs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (available() && loaded()) {
      <section aria-labelledby="email-prefs-title" class="mt-8 border-t-2 border-ink pt-4">
        <h2 id="email-prefs-title" class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink mb-2">Avisos por email</h2>
        <label class="flex items-start gap-3 min-h-[44px] text-sm text-ink cursor-pointer">
          <input type="checkbox" class="w-5 h-5 mt-0.5 accent-primary-500 flex-shrink-0"
                 [checked]="emailMessages()" [disabled]="saving()" (change)="save($any($event.target).checked)"/>
          <span>
            <strong>Avisarme por email de mensajes nuevos</strong>
            <span class="block text-ink-muted text-xs mt-0.5">Si alguien te escribe y no lo lees en 10 minutos. Como mucho un email por conversación cada 12 horas.</span>
          </span>
        </label>
      </section>
    }
  `,
})
export class EmailPrefsComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private features = inject(MediaFeaturesService);
  private toast = inject(ToastService);

  readonly available = this.features.state('emailPrefs');
  readonly loaded = signal(false);
  readonly emailMessages = signal(true);
  readonly saving = signal(false);

  async ngOnInit(): Promise<void> {
    if (!(await this.features.has('emailPrefs'))) return;
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const { data, error } = await this.supabase.client
      .from('notification_prefs').select('email_messages').eq('user_id', userId).maybeSingle();
    if (error) return;
    this.emailMessages.set(data?.email_messages ?? true);
    this.loaded.set(true);
  }

  async save(on: boolean): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const previous = this.emailMessages();
    this.emailMessages.set(on);
    this.saving.set(true);
    const { error } = await this.supabase.client
      .from('notification_prefs')
      .upsert({ user_id: userId, email_messages: on, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    this.saving.set(false);
    if (error) {
      this.emailMessages.set(previous);
      this.toast.error('No se pudo guardar. Inténtalo de nuevo.');
      return;
    }
    this.toast.success(on ? 'Te avisaremos por email de los mensajes nuevos.' : 'Ya no te enviaremos emails de mensajes.');
  }
}
