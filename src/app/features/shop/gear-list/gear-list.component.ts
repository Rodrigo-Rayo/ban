import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

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
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './gear-list.component.html',
})
export class GearListComponent implements OnInit {
  private supabase = inject(SupabaseService);
  auth = inject(AuthService);

  listings = signal<GearListing[]>([]);
  loading = signal(true);

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
  readonly cities = ['Toda España', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza'];

  filteredListings = computed(() => {
    let list = this.listings();
    if (this.filterCategory()) list = list.filter(l => l.category === this.filterCategory());
    if (this.filterCity() !== 'Toda España') list = list.filter(l => l.city === this.filterCity());
    if (this.filterCondition()) list = list.filter(l => l.condition === this.filterCondition());
    return list;
  });

  async ngOnInit() {
    const { data } = await this.supabase.client
      .from('gear_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);
    this.listings.set(data || []);
    this.loading.set(false);
  }

  conditionLabel(c: string) {
    return this.conditions.find(x => x.id === c)?.label ?? c;
  }

  conditionClass(c: string) {
    const map: Record<string, string> = {
      new:        'text-signal-green border-signal-green/30 bg-signal-gBg',
      like_new:   'text-signal-green border-signal-green/30 bg-signal-gBg',
      good:       'text-primary-400 border-primary-500/30 bg-primary-900',
      acceptable: 'text-ink-muted border-dark-500 bg-dark-700',
    };
    return map[c] ?? 'text-ink-muted border-dark-500 bg-dark-700';
  }

  hasFilters() {
    return this.filterCategory() || this.filterCity() !== 'Toda España' || this.filterCondition();
  }

  clearFilters() {
    this.filterCategory.set('');
    this.filterCity.set('Toda España');
    this.filterCondition.set('');
  }
}
