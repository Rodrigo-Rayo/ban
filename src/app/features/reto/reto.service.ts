import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Challenge, ChallengeEntry } from '../../core/utils/reto';

const CHALLENGE_COLS = 'id, slug, title, brief, reference_url, entries_until, votes_until';
const ENTRY_COLS = 'id, challenge_id, user_id, url, caption, author_name, author_profile_type, author_profile_id, created_at';
/** A closed reto keeps showing its entries this long before the page goes quiet. */
const SHOW_CLOSED_DAYS = 30;

export interface NewEntry {
  url: string;
  caption: string | null;
}

/** Reto del mes data. Every rule (deadline, one entry per account, profile needed) is enforced by the database. */
@Injectable({ providedIn: 'root' })
export class RetoService {
  private supabase = inject(SupabaseService);

  /** The running reto, or the last one for a while after it closes. */
  async current(): Promise<Challenge | null> {
    const since = new Date(Date.now() - SHOW_CLOSED_DAYS * 86400000).toISOString();
    const { data, error } = await this.supabase.client.from('challenges').select(CHALLENGE_COLS)
      .gte('entries_until', since).order('entries_until', { ascending: true }).limit(5);
    if (error) throw error;
    const list = (data ?? []) as Challenge[];
    const now = new Date().toISOString();
    // The earliest one still open; else the most recently closed.
    return list.find(c => c.entries_until > now) ?? list.at(-1) ?? null;
  }

  async entries(challengeId: string): Promise<ChallengeEntry[]> {
    const { data, error } = await this.supabase.client.from('challenge_entries').select(ENTRY_COLS)
      .eq('challenge_id', challengeId).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return (data ?? []) as ChallengeEntry[];
  }

  async enter(challengeId: string, userId: string, e: NewEntry): Promise<void> {
    const { error } = await this.supabase.client.from('challenge_entries')
      .insert({ challenge_id: challengeId, user_id: userId, ...e });
    if (error) throw error;
  }

  async withdraw(entryId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.client.from('challenge_entries').delete().eq('id', entryId).eq('user_id', userId);
    if (error) throw error;
  }
}
