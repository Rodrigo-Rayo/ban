import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

type PostType = 'musician_seeking_band' | 'band_seeking_musician' | 'event_announcement' | 'session_offer' | 'gear_sale' | 'looking_for_rehearsal' | 'collab' | 'other';

interface Post {
  id: string;
  user_id: string;
  type: PostType;
  text: string;
  city: string;
  instrument: string;
  genre: string;
  author_name: string;
  author_profile_type: string;
  author_profile_id: string;
  created_at: string;
}

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [FormsModule, CommonModule, DatePipe, RouterLink],
  templateUrl: './feed.component.html',
})
export class FeedComponent implements OnInit {
  private supabase = inject(SupabaseService);

  posts = signal<Post[]>([]);
  loading = signal(true);
  submitting = signal(false);
  showForm = signal(false);
  error = signal('');
  success = signal('');

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

  readonly cities = ['Toda España', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];
  readonly instruments = ['Guitarra', 'Bajo', 'Batería', 'Teclados', 'Voz', 'Violín', 'Trompeta', 'Saxofón', 'Piano', 'Percusión', 'Otro'];
  readonly genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk'];

  readonly postTypes: { id: PostType; label: string; emoji: string }[] = [
    { id: 'musician_seeking_band',  label: 'Músico busca banda',    emoji: '🎸' },
    { id: 'band_seeking_musician',  label: 'Banda busca músico',    emoji: '🥁' },
    { id: 'event_announcement',     label: 'Anuncia un evento',     emoji: '📅' },
    { id: 'session_offer',          label: 'Ofrezco sesión',        emoji: '🎙️' },
    { id: 'gear_sale',              label: 'Vendo equipamiento',    emoji: '🎛️' },
    { id: 'looking_for_rehearsal',  label: 'Busco local ensayo',    emoji: '🏠' },
    { id: 'collab',                 label: 'Busco colaboración',    emoji: '🤝' },
    { id: 'other',                  label: 'Otro',                  emoji: '📢' },
  ];

  filteredPosts = computed(() => {
    let list = this.posts();
    if (this.filterCity() !== 'Toda España') list = list.filter(p => p.city === this.filterCity());
    if (this.filterType()) list = list.filter(p => p.type === this.filterType());
    if (this.filterInstrument()) list = list.filter(p => p.instrument?.toLowerCase().includes(this.filterInstrument().toLowerCase()));
    return list;
  });

  async ngOnInit() {
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
    const { data } = await this.supabase.client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    this.posts.set(data || []);
    this.loading.set(false);
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
      this.error.set('No se pudo publicar. Intenta de nuevo.');
      return;
    }
    this.newPost = { type: 'musician_seeking_band', text: '', city: 'Madrid', instrument: '', genre: '' };
    this.showForm.set(false);
    this.success.set('Anuncio publicado.');
    setTimeout(() => this.success.set(''), 3000);
    await this.loadPosts();
  }

  async deletePost(id: string) {
    if (!confirm('¿Eliminar este anuncio?')) return;
    await this.supabase.client.from('posts').delete().eq('id', id);
    this.posts.update(list => list.filter(p => p.id !== id));
  }

  typeLabel(type: PostType) {
    return this.postTypes.find(t => t.id === type)?.label ?? type;
  }

  typeEmoji(type: PostType) {
    return this.postTypes.find(t => t.id === type)?.emoji ?? '📢';
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
