import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ProfileGateService, PROFILE_REQUIRED_MESSAGE } from './profile-gate.service';

/** What a comment thread hangs from: a Se busca post or an Agenda event. */
export type CommentTargetType = 'post' | 'event';

export interface CommentTarget {
  type: CommentTargetType;
  id: string;
}

export interface AppComment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  author_profile_type: string | null;
  author_profile_id: string | null;
}

/** Same limit as the CHECK in supabase/2026_10_comments.sql (which also allows 10 comments / 10 min). */
export const MAX_COMMENT_LENGTH = 500;
const COMMENT_COLUMNS = 'id, user_id, text, created_at, author_name, author_avatar, author_profile_type, author_profile_id';
const COMMENT_LIMIT = 300;
/** PostgREST / Postgres codes for "supabase/2026_10_comments.sql has not been run yet". */
const NOT_THERE = ['PGRST202', '42883', '42P01', 'PGRST205'];

/**
 * Comments on posts and events (supabase/2026_10_comments.sql). Members read them;
 * anyone can read the count. Until the SQL runs `count` answers null and the UI hides.
 */
@Injectable({ providedIn: 'root' })
export class CommentsService {
  private supabase = inject(SupabaseService);
  private gate = inject(ProfileGateService);
  /** Set once the database says the feature is missing, so no page keeps asking. */
  private missing = false;

  private column(target: CommentTarget): 'post_id' | 'event_id' {
    return target.type === 'post' ? 'post_id' : 'event_id';
  }

  /** Number of comments, or null when comments are not available. */
  async count(target: CommentTarget): Promise<number | null> {
    if (this.missing) return null;
    try {
      const args = target.type === 'post' ? { p_post: target.id } : { p_event: target.id };
      const { data, error } = await this.supabase.client.rpc('comment_count', args);
      if (error) {
        if (NOT_THERE.includes(error.code)) this.missing = true;
        return null;
      }
      return typeof data === 'number' ? data : 0;
    } catch {
      return null;
    }
  }

  /** Oldest first, like a conversation. Signed-in users only (RLS). Null when it could not be read. */
  async list(target: CommentTarget): Promise<AppComment[] | null> {
    try {
      const { data, error } = await this.supabase.client.from('comments').select(COMMENT_COLUMNS)
        .eq(this.column(target), target.id).order('created_at').limit(COMMENT_LIMIT);
      return error ? null : (data as AppComment[] | null) ?? [];
    } catch {
      return null;
    }
  }

  /** Returns an error message, or null when it worked. */
  async add(target: CommentTarget, text: string): Promise<string | null> {
    const clean = text.trim();
    if (!clean) return 'Escribe algo antes de publicar.';
    if (clean.length > MAX_COMMENT_LENGTH) return `Máximo ${MAX_COMMENT_LENGTH} caracteres.`;
    if (!(await this.gate.ensure({ toast: false }))) return PROFILE_REQUIRED_MESSAGE;
    const { error } = await this.supabase.client.from('comments').insert({ [this.column(target)]: target.id, text: clean });
    if (!error) return null;
    return error.hint === 'rate_limit' ? error.message : 'No se pudo publicar el comentario.';
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await this.supabase.client.from('comments').delete().eq('id', id);
    return !error;
  }
}
