import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-gear-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, IconComponent],
  templateUrl: './gear-detail.component.html',
})
export class GearDetailComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private messages = inject(MessagesService);
  auth = inject(AuthService);

  listing = signal<any>(null);
  loading = signal(true);
  currentImageIdx = signal(0);
  currentUser = signal<any>(null);
  deleting = signal(false);
  contacting = signal(false);

  readonly conditionLabels: Record<string, string> = {
    new: 'Nuevo', like_new: 'Como nuevo', good: 'Bueno', acceptable: 'Aceptable',
  };

  readonly conditionClasses: Record<string, string> = {
    new:        'text-signal-green border-signal-green/30 bg-signal-gBg',
    like_new:   'text-signal-green border-signal-green/30 bg-signal-gBg',
    good:       'text-primary-400 border-primary-500/30 bg-primary-900',
    acceptable: 'text-ink-muted border-dark-600 bg-dark-700',
  };

  async ngOnInit() {
    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUser.set(user);

    const id = this.route.snapshot.paramMap.get('id');
    const { data } = await this.supabase.client
      .from('gear_listings').select('*').eq('id', id).maybeSingle();
    this.listing.set(data);
    if (data) this.seo.setListing(data.title, data.price, data.city);
    this.loading.set(false);
  }

  get isOwner() {
    return this.currentUser()?.id === this.listing()?.user_id;
  }

  profileRoute(): string[] | null {
    const l = this.listing();
    if (!l?.seller_profile_id || !l?.seller_profile_type) return null;
    const map: Record<string, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal',
    };
    const seg = map[l.seller_profile_type];
    return seg ? [`/${seg}`, l.seller_profile_id] : null;
  }

  async markAsSold() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (!confirm('¿Marcar como vendido? El anuncio dejará de aparecer en la tienda.')) return;
    const { error } = await this.supabase.client.from('gear_listings').update({ status: 'sold' }).eq('id', this.listing().id);
    if (error) { this.toast.error('No se pudo actualizar el anuncio.'); return; }
    this.listing.update(l => ({ ...l, status: 'sold' }));
    this.toast.success('Anuncio marcado como vendido.');
  }

  async deleteListing() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (!confirm('¿Eliminar este anuncio? Esta acción no se puede deshacer.')) return;
    this.deleting.set(true);
    const { error } = await this.supabase.client.from('gear_listings').delete().eq('id', this.listing().id);
    if (error) { this.toast.error('No se pudo eliminar el anuncio.'); this.deleting.set(false); return; }
    this.toast.success('Anuncio eliminado.');
    this.router.navigate(['/shop']);
  }

  async contactSeller() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (this.contacting()) return;
    this.contacting.set(true);
    const l = this.listing();
    const result = await this.messages.getOrCreateConversation(l.user_id, l.seller_name);
    this.contacting.set(false);
    if (!result || 'error' in result) {
      this.toast.error((result as any)?.error ?? 'No se pudo abrir el chat.');
      return;
    }
    this.router.navigate(['/inbox', result.id]);
  }

  prevImage() {
    const len = this.listing()?.images?.length ?? 0;
    this.currentImageIdx.update(i => (i - 1 + len) % len);
  }

  nextImage() {
    const len = this.listing()?.images?.length ?? 0;
    this.currentImageIdx.update(i => (i + 1) % len);
  }
}
