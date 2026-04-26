import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';

@Component({
  selector: 'app-musician-profile',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './musician-profile.component.html',
})
export class MusicianProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);

  musician = signal<any>(null);
  loading = signal(true);
  isFav = signal(false);
  currentUserId = signal<string | null>(null);
  favLoading = signal(false);
  sending = signal(false);
  msgError = signal<string | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const [{ data }, { data: { session } }] = await Promise.all([
      this.supabase.client.from('musicians').select('*').eq('id', id!).single(),
      this.supabase.auth.getSession(),
    ]);
    this.musician.set(data);
    if (session) {
      this.currentUserId.set(session.user.id);
      this.isFav.set(await this.favSvc.isFavorite(session.user.id, 'musician', id!));
    }
    this.loading.set(false);
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.favLoading.set(true);
    const result = await this.favSvc.toggle(this.currentUserId()!, 'musician', this.musician()!.id);
    this.isFav.set(result);
    this.favLoading.set(false);
  }

  async sendMessage() {
    const { data } = await this.supabase.auth.getSession();
    const session = data.session;
    if (!session) { this.router.navigate(['/auth/login']); return; }
    if (session.user.id === this.musician()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.musician()!.user_id, this.musician()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.musician()!.name } });
  }
}
