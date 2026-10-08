import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Challenge, ChallengeEntry } from '../../core/utils/reto';

const CHALLENGE_COLS = 'id, slug, title, brief, reference_url, entries_until, votes_until';
const ENTRY_COLS = 'id, challenge_id, user_id, url, caption, author_name, author_profile_type, author_profile_id, votes, created_at';
/** A closed challenge keeps showing its winner this long before the page goes quiet. */
const SHOW_CLOSED_DAYS = 30;

export interface NewEntry {
  url: string;
  caption: string | null;
}

/** Reto del mes data. Every rule (deadlines, one entry, one vote, no self-vote) is enforced by the database. */
@Injectable({ providedIn: 'root' })
export class RetoService {
  private supabase = inject(SupabaseService);

  /** The running challenge, or the last one while its winner is still news. */
  async current(): Promise<Challenge | null> {
    const since = new Date(Date.now() - SHOW_CLOSED_DAYS * 86400000).toISOString();
    const { data, error } = await this.supabase.client.from('challenges').select(CHALLENGE_COLS)
      .gte('votes_until', since).order('votes_until', { ascending: true }).limit(5);
    if (error) throw error;
    const list = (data ?? []) as Challenge[];
    const now = new Date().toISOString();
    // The earliest one still open; else the most recently closed.
    return list.find(c => c.votes_until > now) ?? list.at(-1) ?? null;
  }

  async entries(challengeId: string): Promise<ChallengeEntry[]> {
    const { data, error } = await this.supabase.client.from('challenge_entries').select(ENTRY_COLS)
      .eq('challenge_id', challengeId).order('votes', { ascending: false }).limit(200);
    if (error) throw error;
    return (data ?? []) as ChallengeEntry[];
  }

  /** The entry this user voted for in the challenge, if any. */
  async myVote(challengeId: string, userId: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.from('challenge_votes').select('entry_id')
      .eq('challenge_id', challengeId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return (data as { entry_id: string } | null)?.entry_id ?? null;
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

  /** Votes for `entryId`, replacing any earlier vote in the same challenge (one transaction). */
  async vote(entryId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('challenge_vote', { p_entry_id: entryId });
    if (error) throw error;
  }

  async unvote(challengeId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('challenge_unvote', { p_challenge_id: challengeId });
    if (error) throw error;
  }
}
