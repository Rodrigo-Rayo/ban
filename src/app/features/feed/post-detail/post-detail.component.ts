import { ReportLinkComponent } from '../../../shared/components/report-link/report-link.component';
import { ChangeDetectionStrategy, Component, DestroyRef, signal, computed, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { Post, PostType } from '../../../core/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ConfirmService } from '../../../core/services/confirm.service';
import { avatarSrc, timeAgo } from '../../../core/utils/display.utils';
import { askLabel, askStampClass } from '../../../core/utils/se-busca';
import { fetchProfileAvatar, initialOf } from '../../inbox/profile-avatar';

const POST_COLUMNS = 'id, user_id, type, text, city, instrument, genre, author_name, author_profile_type, author_profile_id, created_at';
const RELATED_LIMIT = 4;

/** Stamp variant that stays legible on the ink poster block: yellow = busca, paper = ofrece. */
export function heroStampFor(type: PostType): string {
  return askStampClass(type) === 'tag-accent' ? 'tag-accent' : 'tag';
}

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-post-detail',
    imports: [ReportLinkComponent, RouterLink, IconComponent],
    templateUrl: './post-detail.component.html'
})
export class PostDetailComponent implements OnInit {
  readonly timeAgo = timeAgo;
  readonly askLabelFor = (p: Pick<Post, 'type' | 'instrument'>) => askLabel(p.type, p.instrument);
  readonly stampFor = askStampClass;
  readonly heroStampFor = heroStampFor;
  readonly avatarSrc = avatarSrc;
  readonly initialOf = initialOf;

  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messages = inject(MessagesService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private destroyRef = inject(DestroyRef);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);

  post = signal<Post | null>(null);
  loading = signal(true);
  contacting = signal(false);
  deleting = signal(false);
  linkCopied = signal(false);
  related = signal<Post[]>([]);
  authorAvatar = signal<string | null>(null);
  currentUser = signal<any>(null);

  ngOnInit() {
    // The same component instance is reused when jumping between related posts.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      void this.load(params.get('id'));
    });
  }

  private async load(id: string | null) {
    this.loading.set(true);
    this.post.set(null);
    this.related.set([]);
    this.authorAvatar.set(null);
    try {
      const [{ data: { user } }, { data, error }] = await Promise.all([
        this.supabase.auth.getUser(),
        this.supabase.client.from('posts').select(POST_COLUMNS).eq('id', id!).maybeSingle(),
      ]);
      this.currentUser.set(user);
      if (error) { this.toast.error('No se pudo cargar el anuncio.'); return; }
      this.post.set(data);
      if (data) {
        const label = askLabel(data.type, data.instrument);
        const desc = data.text?.slice(0, 155) ?? `${label} — BandYou`;
        this.seo.set({ title: `${label} · ${data.author_name}`, description: desc, type: 'article' });
        void this.loadRelated(data);
        void fetchProfileAvatar(this.supabase, data.user_id).then(url => this.authorAvatar.set(url));
      } else {
        this.seo.setNotFound();
      }
    } catch {
      this.toast.error('No se pudo cargar el anuncio. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  readonly isOwner = computed(() => !!this.currentUser() && this.currentUser()?.id === this.post()?.user_id);

  readonly profileRoute = computed((): string[] | null => {
    const p = this.post();
    if (!p?.author_profile_id || !p?.author_profile_type) return null;
    const map: Record<string, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues',
      teacher: 'teachers', rehearsal: 'rehearsal',
    };
    const seg = map[p.author_profile_type];
    return seg ? [`/${seg}`, p.author_profile_id] : null;
  });

  readonly askLabel = computed(() => { const p = this.post(); return p ? askLabel(p.type, p.instrument) : ''; });

  /** "GUITARRA · MADRID" strip under the poster. */
  readonly posterLine = computed(() => {
    const p = this.post();
    return p ? [p.instrument, p.city, p.genre].filter(Boolean).join(' · ') : '';
  });

  /**
   * Data-sheet rows not already on the poster: instrument and city live in the red
   * strip and the date at the top, so only the style is left (one datum, one place).
   */
  readonly sheet = computed((): { label: string; value: string }[] => {
    const p = this.post();
    if (!p) return [];
    return [{ label: 'Estilo', value: p.genre }]
      .filter((r): r is { label: string; value: string } => !!r.value);
  });

  /** Same-type posts first, then same-city ones; never the current post. Hides itself on error. */
  async loadRelated(current: Post) {
    try {
      const base = () => this.supabase.client.from('posts').select(POST_COLUMNS)
        .neq('id', current.id).order('created_at', { ascending: false });
      const { data: sameType, error } = await base().eq('type', current.type).limit(RELATED_LIMIT);
      if (error) { this.related.set([]); return; }
      let list = (sameType ?? []).filter((p: Post) => p.id !== current.id);
      if (list.length < RELATED_LIMIT && current.city) {
        const { data: sameCity, error: cityError } = await base().eq('city', current.city).limit(RELATED_LIMIT * 2);
        if (!cityError) {
          const seen = new Set(list.map((p: Post) => p.id));
          const extra = (sameCity ?? []).filter((p: Post) => p.id !== current.id && !seen.has(p.id));
          list = [...list, ...extra];
        }
      }
      this.related.set(list.slice(0, RELATED_LIMIT));
    } catch {
      this.related.set([]); // non-critical
    }
  }

  async contactAuthor() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (this.contacting()) return;
    this.contacting.set(true);
    const p = this.post()!;
    const result = await this.messages.getOrCreateConversation(p.user_id, p.author_name ?? undefined);
    this.contacting.set(false);
    if (!result || 'error' in result) {
      this.toast.error((result as any)?.error ?? 'No se pudo abrir el chat.');
      return;
    }
    this.router.navigate(['/inbox', result.id]);
  }

  /** Web Share API when available, clipboard otherwise. */
  async sharePost() {
    const p = this.post();
    if (!p) return;
    const url = window.location.href;
    const title = `${askLabel(p.type, p.instrument)} · ${p.author_name ?? 'Se busca'}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: p.text.slice(0, 120), url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return; // user closed the sheet
        // any other failure: fall through to the clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      this.toast.success('Enlace copiado.');
      setTimeout(() => this.linkCopied.set(false), 2500);
    } catch {
      this.toast.error('No se pudo copiar el enlace.');
    }
  }

  async deletePost() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    const ok = await this.confirm.ask({
      title: '¿Eliminar este anuncio?',
      message: 'Dejará de aparecer en Se busca.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    const { error } = await this.supabase.client.from('posts').delete().eq('id', this.post()!.id);
    this.deleting.set(false);
    if (error) { this.toast.error('No se pudo eliminar.'); return; }
    this.toast.success('Anuncio eliminado.');
    this.router.navigate(['/feed']);
  }

  /** One quiet line for a related row: instrument (when not in the stamp) · genre · city. */
  metaLine(p: Post): string {
    const instrumentInStamp = p.type === 'band_seeking_musician' && !!p.instrument;
    return [instrumentInStamp ? null : p.instrument, p.genre, p.city].filter(Boolean).join(' · ');
  }
}
