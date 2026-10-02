import { ChangeDetectionStrategy, Component, signal, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { Post, PostType } from '../../../core/models';
import { avatarColor, timeAgo } from '../../../core/utils/display.utils';

const POST_COLUMNS = 'id, user_id, type, text, city, instrument, genre, author_name, author_profile_type, author_profile_id, created_at';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-post-detail',
    imports: [RouterLink, IconComponent],
    templateUrl: './post-detail.component.html'
})
export class PostDetailComponent implements OnInit {
  readonly avatarColor = avatarColor;
  readonly timeAgo = timeAgo;

  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messages = inject(MessagesService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  auth = inject(AuthService);

  post = signal<Post | null>(null);
  loading = signal(true);
  contacting = signal(false);
  deleting = signal(false);
  currentUser = signal<any>(null);

  readonly postTypes: { id: PostType; label: string; icon: string }[] = [
    { id: 'musician_seeking_band', label: 'Músico busca banda',   icon: 'music'          },
    { id: 'band_seeking_musician', label: 'Banda busca músico',   icon: 'mic'            },
    { id: 'event_announcement',    label: 'Anuncia un evento',    icon: 'calendar'       },
    { id: 'session_offer',         label: 'Ofrezco sesión',       icon: 'mic'            },
    { id: 'gear_sale',             label: 'Vendo equipamiento',   icon: 'shopping-cart'  },
    { id: 'looking_for_rehearsal', label: 'Busco local ensayo',   icon: 'headphones'     },
    { id: 'collab',                label: 'Busco colaboración',   icon: 'users'          },
    { id: 'other',                 label: 'Otro',                 icon: 'newspaper'      },
  ];

  async ngOnInit() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const [{ data: { user } }, { data, error }] = await Promise.all([
        this.supabase.auth.getUser(),
        this.supabase.client.from('posts').select(POST_COLUMNS).eq('id', id!).maybeSingle(),
      ]);
      this.currentUser.set(user);
      if (error) { this.toast.error('No se pudo cargar el anuncio.'); return; }
      this.post.set(data);
      if (data) {
        const typeInfo = this.postTypes.find(t => t.id === data.type);
        const label = typeInfo?.label ?? 'Anuncio';
        const desc = data.text?.slice(0, 155) ?? `${label} — BandYou`;
        this.seo.set({ title: `${label} · ${data.author_name}`, description: desc, type: 'article' });
      } else {
        this.seo.setNotFound();
      }
    } catch {
      this.toast.error('No se pudo cargar el anuncio. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  readonly isOwner = computed(() => this.currentUser()?.id === this.post()?.user_id);

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

  async deletePost() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (!confirm('¿Eliminar este anuncio?')) return;
    this.deleting.set(true);
    const { error } = await this.supabase.client.from('posts').delete().eq('id', this.post()!.id);
    this.deleting.set(false);
    if (error) { this.toast.error('No se pudo eliminar.'); return; }
    this.toast.success('Anuncio eliminado.');
    this.router.navigate(['/feed']);
  }

  private readonly postTypeMap = new Map(this.postTypes.map(t => [t.id, t]));

  typeLabel(type: PostType) { return this.postTypeMap.get(type)?.label ?? 'Anuncio'; }
  /** Poster stamp per post type. */
  typeStamp(type: PostType): string {
    const map: Record<string, string> = {
      musician_seeking_band: 'tag-accent',
      band_seeking_musician: 'tag-red',
      event_announcement: 'tag !bg-night !text-poster-paper',
      session_offer: 'tag-green',
      looking_for_rehearsal: 'tag',
      collab: 'tag !bg-primary-900',
    };
    return map[type] ?? 'tag';
  }

  typeIcon(type: PostType)  { return this.postTypeMap.get(type)?.icon  ?? 'newspaper'; }


}
