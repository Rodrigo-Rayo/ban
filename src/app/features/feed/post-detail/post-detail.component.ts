import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { Post, PostType } from '../../../core/models';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, IconComponent],
  templateUrl: './post-detail.component.html',
})
export class PostDetailComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messages = inject(MessagesService);
  private toast = inject(ToastService);
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
    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUser.set(user);

    const id = this.route.snapshot.paramMap.get('id');
    const { data } = await this.supabase.client
      .from('posts').select('*').eq('id', id).maybeSingle();
    this.post.set(data);
    this.loading.set(false);
  }

  get isOwner() {
    return this.currentUser()?.id === this.post()?.user_id;
  }

  profileRoute(): string[] | null {
    const p = this.post();
    if (!p?.author_profile_id || !p?.author_profile_type) return null;
    const map: Record<string, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues',
      teacher: 'teachers', rehearsal: 'rehearsal',
    };
    const seg = map[p.author_profile_type];
    return seg ? [`/${seg}`, p.author_profile_id] : null;
  }

  async contactAuthor() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (this.contacting()) return;
    this.contacting.set(true);
    const p = this.post()!;
    const result = await this.messages.getOrCreateConversation(p.user_id, p.author_name);
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

  typeLabel(type: PostType) {
    return this.postTypes.find(t => t.id === type)?.label ?? 'Anuncio';
  }

  typeIcon(type: PostType) {
    return this.postTypes.find(t => t.id === type)?.icon ?? 'newspaper';
  }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  }

  private readonly AVATAR_COLORS = [
    '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
  ];

  avatarColor(name: string): string {
    const code = name?.charCodeAt(0) ?? 65;
    return this.AVATAR_COLORS[code % this.AVATAR_COLORS.length];
  }
}
