import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { avatarColor } from '../../../core/utils/display.utils';

@Component({
  selector: 'app-musician-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, IconComponent],
  templateUrl: './musician-profile.component.html',
})
export class MusicianProfileComponent implements OnInit {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  musician = signal<any>(null);
  loading = signal(true);
  isFav = signal(false);
  avatarError = signal(false);
  currentUserId = signal<string | null>(null);
  favLoading = signal(false);
  sending = signal(false);
  msgError = signal<string | null>(null);
  linkShared = signal(false);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    try {
      const [{ data }, { data: { session } }] = await Promise.all([
        this.supabase.client.from('musicians').select('*').eq('id', id).maybeSingle(),
        this.supabase.auth.getSession(),
      ]);
      this.musician.set(data);
      if (data) {
        this.seo.setProfile(data.name, 'musician', data.city, data.description, data.avatar_url, undefined, data.instrument);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: data.name,
          description: data.bio || data.description || '',
          image: data.avatar_url || '',
          url: `https://bandyou.es/musicians/${data.id}`,
          address: { '@type': 'PostalAddress', addressLocality: data.city || '', addressCountry: 'ES' },
        });
      }
      if (session) {
        this.currentUserId.set(session.user.id);
        // isFav runs in background — doesn't block UI
        this.favSvc.isFavorite(session.user.id, 'musician', id).then(v => this.isFav.set(v));
      }
    } catch {
      // Profile not found: musician() stays null and the template shows the empty state.
      // If it was a real network error, inform the user.
      this.toast.error('No se pudo cargar el perfil. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.favLoading.set(true);
    try {
      const musician = this.musician();
      if (!musician) return;
      const result = await this.favSvc.toggle(this.currentUserId()!, 'musician', musician.id);
      this.isFav.set(result);
    } catch {
      this.toast.error('No se pudo actualizar favoritos. Inténtalo de nuevo.');
    } finally {
      this.favLoading.set(false);
    }
  }

  async sendMessage() {
    const uid = this.currentUserId();
    const musician = this.musician();
    if (!uid) { this.router.navigate(['/auth/login']); return; }
    if (!musician) return;
    if (uid === musician.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(musician.user_id, musician.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: musician.name } });
  }

  async shareLink() {
    const musician = this.musician();
    if (!musician) return;
    const url = `${window.location.origin}/musicians/${musician.id}`;
    if (navigator.share) {
      await navigator.share({ title: musician.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

}
