import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-gear-detail',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './gear-detail.component.html',
})
export class GearDetailComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  auth = inject(AuthService);

  listing = signal<any>(null);
  loading = signal(true);
  currentImageIdx = signal(0);
  currentUser = signal<any>(null);
  deleting = signal(false);

  readonly conditionLabels: Record<string, string> = {
    new: 'Nuevo', like_new: 'Como nuevo', good: 'Bueno', acceptable: 'Aceptable',
  };

  readonly conditionClasses: Record<string, string> = {
    new:        'text-signal-green border-signal-green/30 bg-signal-gBg',
    like_new:   'text-signal-green border-signal-green/30 bg-signal-gBg',
    good:       'text-primary-400 border-primary-500/30 bg-primary-900',
    acceptable: 'text-ink-muted border-dark-500 bg-dark-700',
  };

  async ngOnInit() {
    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUser.set(user);

    const id = this.route.snapshot.paramMap.get('id');
    const { data } = await this.supabase.client
      .from('gear_listings').select('*').eq('id', id).single();
    this.listing.set(data);
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
    if (!confirm('¿Marcar como vendido? El anuncio dejará de aparecer en la tienda.')) return;
    await this.supabase.client.from('gear_listings').update({ status: 'sold' }).eq('id', this.listing().id);
    this.listing.update(l => ({ ...l, status: 'sold' }));
  }

  async deleteListing() {
    if (!confirm('¿Eliminar este anuncio? Esta acción no se puede deshacer.')) return;
    this.deleting.set(true);
    await this.supabase.client.from('gear_listings').delete().eq('id', this.listing().id);
    this.router.navigate(['/shop']);
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
