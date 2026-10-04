import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';

export type ContactTable = 'musicians' | 'bands' | 'venues' | 'teachers' | 'rehearsal_spaces';

/** Tables that had `phone` before supabase/2026_10_private_contact.sql. */
const ALWAYS_HAS_PHONE: readonly ContactTable[] = ['venues', 'rehearsal_spaces'];

/**
 * Spanish mobile (6xx / 7xx, optional +34) → wa.me link; anything else → null.
 * Landlines and foreign numbers only get the tel: link.
 */
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '').replace(/^\+?34/, '').replace(/^0034/, '');
  return /^[67]\d{8}$/.test(digits) ? `https://wa.me/34${digits}` : null;
}

/**
 * Optional public contact of a profile (email / phone). Only signed-in users see
 * it — the database does not even hand these columns to anonymous visitors —
 * so everyone else gets "Inicia sesión para ver el contacto", and only when the
 * profile actually has one (`has_contact`).
 */
@Component({
  selector: 'app-profile-contact',
  imports: [RouterLink],
  template: `
    @if (email() || phone()) {
      <dl class="border-b border-ink/15" aria-label="Contacto">
        @if (phone(); as p) {
          <div class="flex items-center justify-between gap-4 py-2 border-b border-ink/15 last:border-b-0 min-h-[44px]">
            <dt class="font-mono text-xs font-bold uppercase tracking-wide text-ink-muted">Teléfono</dt>
            <dd class="text-sm font-bold text-ink text-right min-w-0 flex flex-wrap items-center justify-end gap-x-3 [overflow-wrap:anywhere]">
              <a [href]="'tel:' + p" class="underline decoration-2 underline-offset-4 hover:text-primary-600 inline-flex items-center min-h-[44px]">{{ p }}</a>
              @if (whatsapp(); as wa) {
                <a [href]="wa" target="_blank" rel="noopener noreferrer"
                   class="underline decoration-2 underline-offset-4 hover:text-primary-600 inline-flex items-center min-h-[44px]">WhatsApp</a>
              }
            </dd>
          </div>
        }
        @if (email(); as e) {
          <div class="flex items-center justify-between gap-4 py-2 border-b border-ink/15 last:border-b-0 min-h-[44px]">
            <dt class="font-mono text-xs font-bold uppercase tracking-wide text-ink-muted">Email</dt>
            <dd class="text-sm font-bold text-ink text-right min-w-0 [overflow-wrap:anywhere]">
              <a [href]="'mailto:' + e" class="underline decoration-2 underline-offset-4 hover:text-primary-600 inline-flex items-center min-h-[44px]">{{ e }}</a>
            </dd>
          </div>
        }
      </dl>
    } @else if (hiddenContact()) {
      <p class="flex items-center justify-between gap-4 py-2 border-b border-ink/15 min-h-[44px]">
        <span class="font-mono text-xs font-bold uppercase tracking-wide text-ink-muted">Contacto</span>
        <a routerLink="/auth/login" class="text-sm font-bold text-ink underline decoration-2 underline-offset-4 hover:text-primary-600 inline-flex items-center min-h-[44px] text-right">
          Inicia sesión para ver el email y el teléfono
        </a>
      </p>
    }
  `,
})
export class ProfileContactComponent {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private features = inject(MediaFeaturesService);

  readonly table = input.required<ContactTable>();
  readonly profileId = input.required<string>();

  readonly email = signal<string | null>(null);
  readonly phone = signal<string | null>(null);
  /** Logged out and the profile has a contact the visitor cannot see yet. */
  readonly hiddenContact = signal(false);
  readonly whatsapp = computed(() => whatsappLink(this.phone()));

  constructor() {
    effect(() => {
      const table = this.table();
      const id = this.profileId();
      const loggedIn = this.auth.isLoggedIn();
      void this.load(table, id, loggedIn);
    });
  }

  private async load(table: ContactTable, id: string, loggedIn: boolean): Promise<void> {
    this.email.set(null);
    this.phone.set(null);
    this.hiddenContact.set(false);
    // Until the SQL runs there is no has_contact and the old tables have no phone.
    const migrated = await this.features.has('profileContact');
    try {
      if (loggedIn) {
        const withPhone = migrated || ALWAYS_HAS_PHONE.includes(table);
        const { data } = await this.supabase.client.from(table)
          .select(withPhone ? 'contact_email, phone' : 'contact_email').eq('id', id).maybeSingle();
        const row = data as { contact_email?: string | null; phone?: string | null } | null;
        this.email.set(row?.contact_email?.trim() || null);
        this.phone.set(row?.phone?.trim() || null);
      } else if (migrated) {
        const { data } = await this.supabase.client.from(table).select('has_contact').eq('id', id).maybeSingle();
        this.hiddenContact.set(!!(data as { has_contact?: boolean } | null)?.has_contact);
      }
    } catch { /* non-critical: the contact block just stays hidden */ }
  }
}
