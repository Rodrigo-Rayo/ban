import { ChangeDetectionStrategy, Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import type { User } from '@supabase/supabase-js';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { GearListing } from '../../../core/models';

const GEAR_COLUMNS = 'id, user_id, title, description, price, category, condition, city, images, status, seller_name, seller_profile_type, seller_profile_id';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-gear-detail',
    imports: [RouterLink, CommonModule, IconComponent],
    templateUrl: './gear-detail.component.html'
})
export class GearDetailComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private messages = inject(MessagesService);
  auth = inject(AuthService);

  listing = signal<GearListing | null>(null);
  loading = signal(true);
  currentImageIdx = signal(0);
  currentUser = signal<User | null>(null);
  deleting = signal(false);
  contacting = signal(false);

  readonly conditionLabels: Record<string, string> = {
    new: 'Nuevo', like_new: 'Como nuevo', good: 'Bueno', acceptable: 'Aceptable',
  };

  readonly conditionClasses: Record<string, string> = {
    new:        'tag-accent',
    like_new:   'tag-green',
    good:       'tag',
    acceptable: 'tag',
  };

  async ngOnInit() {
    try {
      const [{ data: { user } }, listingResult] = await Promise.all([
        this.supabase.auth.getUser(),
        this.supabase.client.from('gear_listings').select(GEAR_COLUMNS)
          .eq('id', this.route.snapshot.paramMap.get('id')!).maybeSingle(),
      ]);
      this.currentUser.set(user);
      const { data, error } = listingResult;
      if (error) { this.toast.error('No se pudo cargar el anuncio. Recarga la página.'); return; }
      this.listing.set(data as GearListing | null);
      if (data) {
        this.seo.setListing(data.title, data.price, data.city, undefined, data.images?.[0]);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: data.title,
          description: data.description || '',
          image: data.images?.[0] || '',
          url: `https://bandyou.es/shop/${data.id}`,
          offers: {
            '@type': 'Offer',
            price: data.price,
            priceCurrency: 'EUR',
            availability: data.status === 'active'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
            itemCondition: data.condition === 'new'
              ? 'https://schema.org/NewCondition'
              : 'https://schema.org/UsedCondition',
            seller: { '@type': 'Person', name: data.seller_name || '' },
          },
        });
      } else {
        this.seo.setNotFound();
      }
    } catch {
      this.toast.error('No se pudo cargar el anuncio. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
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
    try {
      const { error } = await this.supabase.client.from('gear_listings').update({ status: 'sold' }).eq('id', this.listing()!.id).eq('user_id', this.currentUser()!.id);
      if (error) { this.toast.error('No se pudo actualizar el anuncio.'); return; }
      this.listing.update(l => l ? { ...l, status: 'sold' as const } : l);
      this.toast.success('Anuncio marcado como vendido.');
    } catch {
      this.toast.error('No se pudo actualizar el anuncio.');
    }
  }

  async deleteListing() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (!confirm('¿Eliminar este anuncio? Esta acción no se puede deshacer.')) return;
    this.deleting.set(true);
    try {
      const { error } = await this.supabase.client.from('gear_listings').delete().eq('id', this.listing()!.id).eq('user_id', this.currentUser()!.id);
      if (error) { this.toast.error('No se pudo eliminar el anuncio.'); return; }
      this.toast.success('Anuncio eliminado.');
      this.router.navigate(['/shop']);
    } catch {
      this.toast.error('No se pudo eliminar el anuncio.');
    } finally {
      this.deleting.set(false);
    }
  }

  async contactSeller() {
    if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
    if (this.contacting()) return;
    this.contacting.set(true);
    const l = this.listing();
    if (!l) { this.contacting.set(false); return; }
    const result = await this.messages.getOrCreateConversation(l.user_id, l.seller_name ?? undefined);
    this.contacting.set(false);
    if (!result || 'error' in result) {
      this.toast.error('error' in (result ?? {}) ? (result as { error: string }).error : 'No se pudo abrir el chat.');
      return;
    }
    this.router.navigate(['/inbox', result.id]);
  }

  prevImage() {
    const len = this.listing()?.images?.length ?? 0;
    if (len === 0) return;
    this.currentImageIdx.update(i => (i - 1 + len) % len);
  }

  nextImage() {
    const len = this.listing()?.images?.length ?? 0;
    if (len === 0) return;
    this.currentImageIdx.update(i => (i + 1) % len);
  }
}
