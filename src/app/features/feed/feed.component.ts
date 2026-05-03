import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { Post, PostType } from '../../core/models';
import { CITIES_WITH_ALL } from '../../core/constants/cities';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink, IconComponent],
  templateUrl: './feed.component.html',
})
export class FeedComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);

  posts = signal<Post[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  hasMore = signal(true);
  submitting = signal(false);
  showForm = signal(false);
  error = signal('');
  private readonly PAGE_SIZE = 20;

  filterCity = signal('Toda España');
  filterType = signal<PostType | ''>('');
  filterInstrument = signal('');

  currentUser = signal<any>(null);
  userProfile = signal<any>(null);

  newPost = {
    type: 'musician_seeking_band' as PostType,
    text: '',
    city: 'Madrid',
    instrument: '',
    genre: '',
  };

  readonly cities = CITIES_WITH_ALL;
  readonly instruments = ['Guitarra', 'Bajo', 'Batería', 'Teclados', 'Voz', 'Violín', 'Trompeta', 'Saxofón', 'Piano', 'Percusión', 'Otro'];
  readonly genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk'];

  readonly postTypes: { id: PostType; label: string; emoji: string; icon: string }[] = [
    { id: 'musician_seeking_band',  label: 'Músico busca banda',    emoji: '🎸', icon: 'music'          },
    { id: 'band_seeking_musician',  label: 'Banda busca músico',    emoji: '🥁', icon: 'mic'            },
    { id: 'event_announcement',     label: 'Anuncia un evento',     emoji: '📅', icon: 'calendar'       },
    { id: 'session_offer',          label: 'Ofrezco sesión',        emoji: '🎙️', icon: 'mic'            },
    { id: 'gear_sale',              label: 'Vendo equipamiento',    emoji: '🎛️', icon: 'shopping-cart'  },
    { id: 'looking_for_rehearsal',  label: 'Busco local ensayo',    emoji: '🏠', icon: 'headphones'     },
    { id: 'collab',                 label: 'Busco colaboración',    emoji: '🤝', icon: 'users'          },
    { id: 'other',                  label: 'Otro',                  emoji: '📢', icon: 'newspaper'      },
  ];

  filteredPosts = computed(() => {
    let list = this.posts();
    if (this.filterCity() !== 'Toda España') list = list.filter(p => p.city === this.filterCity());
    if (this.filterType()) list = list.filter(p => p.type === this.filterType());
    if (this.filterInstrument()) list = list.filter(p => p.instrument?.toLowerCase().includes(this.filterInstrument().toLowerCase()));
    return list;
  });

  async ngOnInit() {
    this.seo.set({ title: 'Tablón', description: 'Anuncios de músicos, bandas y profesionales de la música en España. Publica y encuentra colaboraciones.' });

    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUser.set(user);

    if (user) {
      const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'];
      const types = ['musician', 'band', 'venue', 'teacher', 'rehearsal'];
      for (let i = 0; i < tables.length; i++) {
        const { data } = await this.supabase.client.from(tables[i]).select('id,name').eq('user_id', user.id).maybeSingle();
        if (data) {
          this.userProfile.set({ ...data, type: types[i] });
          break;
        }
      }
    }

    await this.loadPosts();
  }

  async loadPosts() {
    this.loading.set(true);
    this.hasMore.set(true);
    const { data } = await this.supabase.client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(this.PAGE_SIZE);
    this.posts.set(data || []);
    this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
    this.loading.set(false);
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const last = this.posts().at(-1);
    const { data } = await this.supabase.client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .lt('created_at', last?.created_at ?? new Date().toISOString())
      .limit(this.PAGE_SIZE);
    this.posts.update(p => [...p, ...(data || [])]);
    this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
    this.loadingMore.set(false);
  }

  async submitPost() {
    if (!this.newPost.text.trim()) return;
    const user = this.currentUser();
    if (!user) return;

    this.submitting.set(true);
    this.error.set('');

    const profile = this.userProfile();
    const { error } = await this.supabase.client.from('posts').insert({
      user_id: user.id,
      type: this.newPost.type,
      text: this.newPost.text.trim(),
      city: this.newPost.city,
      instrument: this.newPost.instrument,
      genre: this.newPost.genre,
      author_name: profile?.name ?? user.email?.split('@')[0] ?? 'Usuario',
      author_profile_type: profile?.type ?? '',
      author_profile_id: profile?.id ?? '',
    });

    this.submitting.set(false);
    if (error) {
      this.toast.error('No se pudo publicar. Intenta de nuevo.');
      return;
    }
    this.newPost = { type: 'musician_seeking_band', text: '', city: 'Madrid', instrument: '', genre: '' };
    this.showForm.set(false);
    this.toast.success('Anuncio publicado.');
    await this.loadPosts();
  }

  async deletePost(id: string) {
    if (!confirm('¿Eliminar este anuncio?')) return;
    const { error } = await this.supabase.client.from('posts').delete().eq('id', id);
    if (error) { this.toast.error('No se pudo eliminar.'); return; }
    this.posts.update(list => list.filter(p => p.id !== id));
    this.toast.success('Anuncio eliminado.');
  }

  typeLabel(type: PostType) {
    return this.postTypes.find(t => t.id === type)?.label ?? type;
  }

  typeEmoji(type: PostType) {
    return this.postTypes.find(t => t.id === type)?.emoji ?? '📢';
  }

  typeIcon(type: PostType) {
    return this.postTypes.find(t => t.id === type)?.icon ?? 'newspaper';
  }

  private readonly AVATAR_COLORS = [
    '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
  ];

  avatarColor(name: string): string {
    const code = name?.charCodeAt(0) ?? 65;
    return this.AVATAR_COLORS[code % this.AVATAR_COLORS.length];
  }

  profileRoute(p: Post): string[] | null {
    if (!p.author_profile_id || !p.author_profile_type) return null;
    const map: Record<string, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal',
    };
    const seg = map[p.author_profile_type];
    return seg ? [`/${seg}`, p.author_profile_id] : null;
  }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  }
}
