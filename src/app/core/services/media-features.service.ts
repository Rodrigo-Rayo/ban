import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

/**
 * Optional columns that may not exist yet in the live DB: photos (supabase/audit_2026_10_photos.sql)
 * band availability (supabase/2026_10_provinces_band_availability.sql) and private contact
 * (supabase/2026_10_private_contact.sql: has_contact, phone on every profile table) and
 * Se busca titles (supabase/2026_10_post_title.sql), La quedada (supabase/2026_10_quedada.sql)
 * and event addresses (supabase/2026_10_event_address.sql).
 */
export type MediaFeature = 'eventImage' | 'venuePhotos' | 'rehearsalPhotos' | 'bandAvailability' | 'profileContact' | 'postTitle' | 'quedada' | 'eventAddress';

const PROBES: Record<MediaFeature, { table: string; column: string }> = {
  eventImage:      { table: 'events',           column: 'image_url' },
  venuePhotos:     { table: 'venues',           column: 'photos' },
  rehearsalPhotos: { table: 'rehearsal_spaces', column: 'photos' },
  bandAvailability: { table: 'bands',          column: 'open_to_gigs' },
  profileContact:   { table: 'musicians',      column: 'has_contact' },
  postTitle:        { table: 'posts',          column: 'title' },
  quedada:          { table: 'quedada_entries', column: 'id' },
  eventAddress:     { table: 'events',          column: 'address' },
};

/** "The SQL has not been run yet": undefined column / undefined table (Postgres or PostgREST cache). */
const NOT_THERE = ['42703', '42P01', 'PGRST204', 'PGRST205'];

/**
 * Detects, once per session, whether the photo columns exist. Until the SQL is
 * run every photo UI stays hidden and no query may name these columns (PostgREST
 * answers 400 and the page would break). A definitive answer is cached; a
 * network/other error counts as "not available" for now and is retried next time.
 */
@Injectable({ providedIn: 'root' })
export class MediaFeaturesService {
  private supabase = inject(SupabaseService);
  private pending = new Map<MediaFeature, Promise<boolean>>();
  private states: Record<MediaFeature, WritableSignal<boolean>> = {
    eventImage: signal(false),
    venuePhotos: signal(false),
    rehearsalPhotos: signal(false),
    bandAvailability: signal(false),
    profileContact: signal(false),
    postTitle: signal(false),
    quedada: signal(false),
    eventAddress: signal(false),
  };

  /** Latest known availability (false until a probe confirms it). */
  state(feature: MediaFeature): Signal<boolean> {
    return this.states[feature].asReadonly();
  }

  has(feature: MediaFeature): Promise<boolean> {
    const cached = this.pending.get(feature);
    if (cached) return cached;
    const probe = this.probe(feature);
    this.pending.set(feature, probe);
    return probe;
  }

  private async probe(feature: MediaFeature): Promise<boolean> {
    const { table, column } = PROBES[feature];
    try {
      const { error } = await this.supabase.client.from(table).select(column).limit(1);
      if (!error) {
        this.states[feature].set(true);
        return true;
      }
      if (!NOT_THERE.includes(error.code)) this.pending.delete(feature);
    } catch {
      this.pending.delete(feature);
    }
    this.states[feature].set(false);
    return false;
  }
}
