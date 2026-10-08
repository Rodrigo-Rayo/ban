import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { Post } from '../../../core/models';

/** Someone the author talked to after posting: a possible Salvabolos. */
export interface SaverCandidate { userId: string; name: string }

interface ConversationRow {
  user1_id: string; user2_id: string; user1_name: string | null; user2_name: string | null;
}

/** People the author has chatted with since the post went up, newest first, one row each. */
export function saverCandidates(rows: ConversationRow[], me: string): SaverCandidate[] {
  const seen = new Set<string>();
  return rows.flatMap(r => {
    const mine = r.user1_id === me;
    const userId = mine ? r.user2_id : r.user1_id;
    const name = (mine ? r.user2_name : r.user1_name)?.trim() || 'Sin nombre';
    if (userId === me || seen.has(userId)) return [];
    seen.add(userId);
    return [{ userId, name }];
  });
}

/**
 * Salvabolos on a gig post: shows who saved the gig, and lets the author say who it
 * was (someone they messaged since posting). The database checks everything again.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-gig-saved',
  template: `
    @if (saverName(); as name) {
      <section aria-label="Salvabolos" class="border-2 border-ink bg-poster-yellow px-4 py-3">
        <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink">Salvabolos</p>
        <p class="font-display text-2xl uppercase leading-tight text-ink [overflow-wrap:anywhere]">Bolo salvado por {{ name }}</p>
      </section>
    } @else if (isOwner() && loaded()) {
      <section aria-labelledby="gig-saved-title" class="border-2 border-ink/30 px-4 py-3">
        <h2 id="gig-saved-title" class="font-display text-xl uppercase leading-tight text-ink">¿Te salvaron el bolo?</h2>
        <p class="text-sm text-ink-muted mt-1">Dale la medalla Salvabolos a quien tocó con vosotros. Saldrá en su perfil.</p>
        @if (!picking()) {
          <button type="button" (click)="openPicker()" class="btn-secondary min-h-[44px] mt-3">Elegir quién fue</button>
        } @else if (pickerLoading()) {
          <p class="text-sm text-ink-muted mt-3" role="status">Cargando tus conversaciones…</p>
        } @else if (candidates().length === 0) {
          <p class="text-sm text-ink mt-3">Aún no has hablado con nadie desde que publicaste el anuncio. Cuando alguien te escriba, podrás elegirlo aquí.</p>
        } @else {
          <ul class="mt-3 flex flex-col gap-2">
            @for (c of candidates(); track c.userId) {
              <li>
                <button type="button" (click)="give(c)" [disabled]="saving()"
                  class="btn-ghost min-h-[44px] w-full justify-between disabled:opacity-50">
                  <span class="truncate">{{ c.name }}</span><span aria-hidden="true">→</span>
                </button>
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
})
export class GigSavedComponent {
  readonly post = input.required<Post>();
  readonly isOwner = input(false);
  readonly me = input<string | null>(null);

  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly saverName = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly picking = signal(false);
  readonly saving = signal(false);
  readonly pickerLoading = signal(false);
  readonly candidates = signal<SaverCandidate[]>([]);

  constructor() {
    effect(() => { void this.load(this.post().id); });
  }

  private async load(postId: string) {
    this.loaded.set(false);
    this.saverName.set(null);
    this.picking.set(false);
    this.candidates.set([]);
    const { data, error } = await this.supabase.client.from('gig_saves')
      .select('saver_name').eq('post_id', postId).maybeSingle();
    if (postId !== this.post().id) return; // navigated to another post meanwhile
    if (!error) this.saverName.set((data as { saver_name: string | null } | null)?.saver_name?.trim() || (data ? 'un músico' : null));
    this.loaded.set(!error);
  }

  async openPicker() {
    const me = this.me();
    const post = this.post();
    if (!me) return;
    this.picking.set(true);
    this.pickerLoading.set(true);
    const { data, error } = await this.supabase.client.from('conversations')
      .select('user1_id, user2_id, user1_name, user2_name')
      .or(`user1_id.eq.${me},user2_id.eq.${me}`)
      .gte('last_message_at', post.created_at)
      .order('last_message_at', { ascending: false })
      .limit(20);
    if (post.id !== this.post().id) return; // navigated to another post meanwhile
    this.pickerLoading.set(false);
    if (error) { this.toast.error('No se pudieron cargar tus conversaciones.'); this.picking.set(false); return; }
    this.candidates.set(saverCandidates((data ?? []) as ConversationRow[], me));
  }

  async give(c: SaverCandidate) {
    const postId = this.post().id;
    const ok = await this.confirm.ask({
      title: `¿${c.name} os salvó el bolo?`,
      message: 'Le daremos la medalla Salvabolos y le avisaremos. No se puede cambiar después.',
      confirmLabel: 'Sí, dar la medalla',
    });
    if (!ok || postId !== this.post().id) return;
    this.saving.set(true);
    const { error } = await this.supabase.client.rpc('mark_gig_saved', { p_post_id: postId, p_saver: c.userId });
    this.saving.set(false);
    if (postId !== this.post().id) return;
    if (error) { this.toast.error(error.code === 'P0001' ? error.message : 'No se pudo guardar. Inténtalo de nuevo.'); return; }
    this.saverName.set(c.name);
    this.toast.success(`¡Hecho! ${c.name} ya tiene su medalla Salvabolos.`);
  }
}
