import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

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
      await this.supabase.client.from('favorites').delete()
        .eq('user_id', userId).eq('entity_type', entityType).eq('entity_id', entityId);
      return false;
    }
    await this.supabase.client.from('favorites')
      .insert({ user_id: userId, entity_type: entityType, entity_id: entityId });
    return true;
  }

  async getByUser(userId: string): Promise<any[]> {
    const { data } = await this.supabase.client.from('favorites').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  }
}
