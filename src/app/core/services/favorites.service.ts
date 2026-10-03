import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { NotificationsService } from './notifications.service';
import { Favorite } from '../models';
import { favoriteNoticeTitle } from '../utils/notification-copy';

/** Profile kinds whose owner hears about a new favorite, and the table that holds the owner. */
const OWNER_TABLES: Readonly<Record<string, string>> = {
  musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal_spaces',
};

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private supabase = inject(SupabaseService);
  private notifSvc = inject(NotificationsService);

  async isFavorite(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('favorites').select('id')
      .eq('user_id', userId).eq('entity_type', entityType).eq('entity_id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
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
      .upsert(
        { user_id: userId, entity_type: entityType, entity_id: entityId },
        { onConflict: 'user_id,entity_type,entity_id', ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);
    // Best effort and not awaited: the favorite is saved whatever happens to the notice.
    this.notifyOwner(userId, entityType, entityId).catch(() => undefined);
    return true;
  }

  /** Tells the profile owner someone saved their profile. Never on remove, never to yourself. */
  private async notifyOwner(userId: string, entityType: string, entityId: string): Promise<void> {
    if (!Object.prototype.hasOwnProperty.call(OWNER_TABLES, entityType)) return;
    const { data: owner } = await this.supabase.client
      .from(OWNER_TABLES[entityType]).select('user_id').eq('id', entityId).maybeSingle();
    const ownerId = (owner as { user_id?: string | null } | null)?.user_id;
    if (!ownerId || ownerId === userId) return;
    const { data: name } = await this.supabase.client.rpc('get_profile_name', { p_user_id: userId });
    await this.notifSvc.create(ownerId, 'favorite', favoriteNoticeTitle(name as string | null), undefined, entityType, entityId);
  }

  async getByUser(userId: string): Promise<Favorite[]> {
    const { data, error } = await this.supabase.client.from('favorites').select('id,user_id,entity_type,entity_id,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data || [];
  }
}
