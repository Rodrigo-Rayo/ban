import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { CITIES_WITH_ALL } from '../../../core/constants/cities';
import { IconComponent } from '../../../shared/components/icon/icon.component';

export interface GearListing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  city: string;
  images: string[];
  status: string;
  seller_name: string;
  seller_profile_type: string;
  seller_profile_id: string;
  created_at: string;
}

@Component({
  selector: 'app-gear-list',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, IconComponent],
  templateUrl: './gear-list.component.html',
})
export class GearListComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);
  auth = inject(AuthService);

  listings = signal<GearListing[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  hasMore = signal(true);
  private readonly PAGE_SIZE = 24;

  filterCategory = signal('');
  filterCity = signal('Toda España');
  filterCondition = signal('');

  readonly categories = ['Guitarras', 'Bajos', 'Batería', 'Teclados', 'Amplificadores', 'Efectos', 'PA/Sonido', 'Accesorios', 'Otro'];
  readonly conditions = [
    { id: 'new',       label: 'Nuevo' },
    { id: 'like_new',  label: 'Como nuevo' },
    { id: 'good',      label: 'Bueno' },
    { id: 'acceptable', label: 'Aceptable' },
  ];
  readonly cities = CITIES_WITH_ALL;

  async ngOnInit() {
    this.seo.set({ title: 'Tienda', description: 'Compra y vende instrumentos, amplificadores y equipamiento musical de segunda mano entre músicos en España.' });
    await this.loadListings();
  }

  private readonly LISTING_COLS = 'id,user_id,title,price,category,condition,city,images,status,seller_name,seller_profile_type,seller_profile_id,created_at';

  loadError = signal(false);

  async loadListings() {
    this.loading.set(true);
    this.loadError.set(false);
    let q = this.supabase.client.from('gear_listings').select(this.LISTING_COLS).eq('status', 'active');
    if (this.filterCategory()) q = q.eq('category', this.filterCategory());
    if (this.filterCity() !== 'Toda España') q = q.eq('city', this.filterCity());
    if (this.filterCondition()) q = q.eq('condition', this.filterCondition());
    const { data, error } = await q.order('created_at', { ascending: false }).limit(this.PAGE_SIZE);
    if (error) { this.loadError.set(true); }
    else {
      this.listings.set((data || []) as GearListing[]);
      this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
    }
    this.loading.set(false);
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const last = this.listings().at(-1);
    let q = this.supabase.client.from('gear_listings').select(this.LISTING_COLS)
      .eq('status', 'active')
      .lt('created_at', last?.created_at ?? new Date().toISOString());
    if (this.filterCategory()) q = q.eq('category', this.filterCategory());
    if (this.filterCity() !== 'Toda España') q = q.eq('city', this.filterCity());
    if (this.filterCondition()) q = q.eq('condition', this.filterCondition());
    const { data } = await q.order('created_at', { ascending: false }).limit(this.PAGE_SIZE);
    this.listings.update(l => [...l, ...(data || []) as GearListing[]]);
    this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
    this.loadingMore.set(false);
  }

  private readonly conditionLabelMap = new Map(this.conditions.map(x => [x.id, x.label]));

  conditionLabel(c: string) {
    return this.conditionLabelMap.get(c) ?? c;
  }

  conditionClass(c: string) {
    const map: Record<string, string> = {
      new:        'text-signal-green border-signal-green/30 bg-signal-gBg',
      like_new:   'text-signal-green border-signal-green/30 bg-signal-gBg',
      good:       'text-primary-400 border-primary-500/30 bg-primary-900',
      acceptable: 'text-ink-muted border-dark-600 bg-dark-700',
    };
    return map[c] ?? 'text-ink-muted border-dark-600 bg-dark-700';
  }

  hasFilters() {
    return this.filterCategory() || this.filterCity() !== 'Toda España' || this.filterCondition();
  }

  async clearFilters() {
    this.filterCategory.set('');
    this.filterCity.set('Toda España');
    this.filterCondition.set('');
    await this.loadListings();
  }
}
