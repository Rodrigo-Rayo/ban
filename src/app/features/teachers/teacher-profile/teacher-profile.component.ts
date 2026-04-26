import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';

@Component({
  selector: 'app-teacher-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './teacher-profile.component.html',
})
export class TeacherProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);

  teacher = signal<any>(null);
  reviews = signal<any[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);
  showReviewForm = signal(false);
  reviewRating = 5;
  reviewComment = '';
  reviewLoading = signal(false);
  myReview = signal<any>(null);
  sending = signal(false);
  msgError = signal<string | null>(null);

  get avgRating() {
    const r = this.reviews();
    if (!r.length) return null;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const [{ data: teacher }, { data: { session } }, { data: reviews }] = await Promise.all([
      this.supabase.client.from('teachers').select('*').eq('id', id!).single(),
      this.supabase.auth.getSession(),
      this.supabase.client.from('reviews').select('*').eq('entity_type', 'teacher').eq('entity_id', id!).order('created_at', { ascending: false }),
    ]);
    this.teacher.set(teacher);
    this.reviews.set(reviews || []);
    if (session) {
      this.currentUserId.set(session.user.id);
      this.myReview.set(reviews?.find((r: any) => r.user_id === session.user.id) || null);
      if (teacher) this.isFav.set(await this.favSvc.isFavorite(session.user.id, 'teacher', teacher.id));
    }
    this.loading.set(false);
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.favLoading.set(true);
    this.isFav.set(await this.favSvc.toggle(this.currentUserId()!, 'teacher', this.teacher()!.id));
    this.favLoading.set(false);
  }

  async submitReview() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.reviewLoading.set(true);
    await this.supabase.client.from('reviews').upsert({
      user_id: this.currentUserId(),
      entity_type: 'teacher',
      entity_id: this.teacher()!.id,
      rating: this.reviewRating,
      comment: this.reviewComment,
    }, { onConflict: 'user_id,entity_type,entity_id' });
    const { data } = await this.supabase.client.from('reviews').select('*').eq('entity_type', 'teacher').eq('entity_id', this.teacher()!.id).order('created_at', { ascending: false });
    this.reviews.set(data || []);
    this.myReview.set(data?.find((r: any) => r.user_id === this.currentUserId()) || null);
    this.showReviewForm.set(false);
    this.reviewLoading.set(false);
  }

  async sendMessage() {
    const session = (await this.supabase.auth.getSession()).data.session;
    if (!session) { this.router.navigate(['/auth/login']); return; }
    if (session.user.id === this.teacher()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.teacher()!.user_id, this.teacher()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.teacher()!.name } });
  }
}
