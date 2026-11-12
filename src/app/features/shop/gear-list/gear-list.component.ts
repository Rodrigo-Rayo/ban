import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { ALL_PLACES, PLACE_FILTER_GROUPS, whereCity } from '../../../core/utils/place';
import { PlaceFilterComponent } from '../../../shared/components/place-filter/place-filter.component';
import { GEAR_CONDITIONS, gearConditionValues } from '../../../core/constants/gear';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { GearCardComponent } from '../gear-card/gear-card.component';

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
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-gear-list',
    imports: [RouterLink, CommonModule, FormsModule, IconComponent, GearCardComponent, PlaceFilterComponent],
    templateUrl: './gear-list.component.html'
})
export class GearListComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
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
  readonly conditions = GEAR_CONDITIONS;

  async ngOnInit() {
    this.seo.set({ title: 'Tienda', description: 'Compra y vende instrumentos, amplificadores y equipamiento musical de segunda mano entre músicos en España.' });
    const qp = this.route.snapshot.queryParamMap;
    const city = qp.get('ciudad');
    if (city && PLACE_FILTER_GROUPS.some(g => g.options.some(o => o.value === city))) this.filterCity.set(city);
    const cat = qp.get('categoria');
    if (cat && this.categories.includes(cat)) this.filterCategory.set(cat);
    const cond = qp.get('estado');
    if (cond && this.conditions.some(c => c.id === cond)) this.filterCondition.set(cond);
    await this.loadListings();
  }

  private readonly LISTING_COLS = 'id,user_id,title,price,category,condition,city,images,status,seller_name,seller_profile_type,seller_profile_id,created_at';

  loadError = signal(false);

  /** Filters live in the URL (?ciudad=&categoria=&estado=) so the view can be shared and survives reload. */
  async applyFilters() {
    const queryParams = {
      ciudad: this.filterCity() !== ALL_PLACES ? this.filterCity() : null,
      categoria: this.filterCategory() || null,
      estado: this.filterCondition() || null,
    };
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    await this.loadListings();
  }

  async loadListings() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      let q = this.supabase.client.from('gear_listings').select(this.LISTING_COLS).eq('status', 'active');
      if (this.filterCategory()) q = q.eq('category', this.filterCategory());
      q = whereCity(q, this.filterCity());
      if (this.filterCondition()) q = q.in('condition', gearConditionValues(this.filterCondition()));
      const { data, error } = await q.order('created_at', { ascending: false }).limit(this.PAGE_SIZE);
      if (error) { this.loadError.set(true); }
      else {
        this.listings.set((data || []) as GearListing[]);
        this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    try {
      const last = this.listings().at(-1);
      let q = this.supabase.client.from('gear_listings').select(this.LISTING_COLS)
        .eq('status', 'active')
        .lt('created_at', last?.created_at ?? new Date().toISOString());
      if (this.filterCategory()) q = q.eq('category', this.filterCategory());
      q = whereCity(q, this.filterCity());
      if (this.filterCondition()) q = q.in('condition', gearConditionValues(this.filterCondition()));
      const { data } = await q.order('created_at', { ascending: false }).limit(this.PAGE_SIZE);
      this.listings.update(l => [...l, ...(data || []) as GearListing[]]);
      this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
    } finally {
      this.loadingMore.set(false);
    }
  }

  hasFilters() {
    return this.filterCategory() || this.filterCity() !== ALL_PLACES || this.filterCondition();
  }

  async clearFilters() {
    this.filterCategory.set('');
    this.filterCity.set(ALL_PLACES);
    this.filterCondition.set('');
    await this.applyFilters();
  }
}
