import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Favorite } from '../models';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private supabase = inject(SupabaseService);

  async isFavorite(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('favorites').select('id')
      .eq('user_id', userId).eq('entity_type', entityType).eq('entity_id', entityId)
      .maybeSingle();
    return !!data;
  }

  async toggle(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const isFav = await this.isFavorite(userId, entityType, entityId);
    if (isFav) {
      const { error } = await this.supabase.client.from('favorites').delete()
        .eq('user_id', userId).eq('entity_type', entityType).eq('entity_id', entityId);
      if (error) throw new Error(error.message);
      return false;
    }
    const { error } = await this.supabase.client.from('favorites')
      .insert({ user_id: userId, entity_type: entityType, entity_id: entityId });
    if (error) throw new Error(error.message);
    return true;
  }

  async getByUser(userId: string): Promise<Favorite[]> {
    const { data } = await this.supabase.client.from('favorites').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  }
}
