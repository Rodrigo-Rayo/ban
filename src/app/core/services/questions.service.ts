import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ProfileGateService, PROFILE_REQUIRED_MESSAGE } from './profile-gate.service';

/** A question of the month (supabase/2026_11_pregunta.sql). Future ones are not readable. */
export interface Question {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  starters: string[];
  opens_at: string;
  closes_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_avatar: string | null;
  author_profile_type: string | null;
  author_profile_id: string | null;
  author_role: string | null;
  author_city: string | null;
}

/** Same limit as the CHECK in the SQL. */
export const MAX_ANSWER_LENGTH = 280;
const QUESTION_COLUMNS = 'id, slug, title, intro, starters, opens_at, closes_at';
const ANSWER_COLUMNS = 'id, question_id, user_id, text, created_at, updated_at, author_name, author_avatar, author_profile_type, author_profile_id, author_role, author_city';
export const ANSWER_PAGE = 60;
const QUESTIONS_TTL = 5 * 60_000;

export interface AnswerPage {
  rows: Answer[];
  /** Only on the first page. */
  total: number | null;
}
/** PostgREST / Postgres codes for "the SQL has not been run yet". */
const NOT_THERE = ['PGRST202', '42883', '42P01', 'PGRST205'];

export function isOpen(q: Pick<Question, 'opens_at' | 'closes_at'>, now = Date.now()): boolean {
  return Date.parse(q.opens_at) <= now && now < Date.parse(q.closes_at);
}

/** Whole days left until the question closes (0 on its last day). */
export function daysLeft(q: Pick<Question, 'closes_at'>, now = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(q.closes_at) - now) / 864e5));
}

/** "Quedan 12 días", "Último día". */
export function deadlineLabel(q: Pick<Question, 'closes_at'>, now = Date.now()): string {
  const d = daysLeft(q, now);
  return d === 0 ? 'Último día' : d === 1 ? 'Queda 1 día' : `Quedan ${d} días`;
}

/** "noviembre 2026" from the opening date. */
export function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-ES', { month: 'long' })} ${d.getFullYear()}`;
}

/**
 * La pregunta del mes: the questions, their answers (public) and the signed-in person's
 * own answer (one per question, editable while it is open). Until the SQL runs,
 * `questions` answers null and the section hides.
 */
@Injectable({ providedIn: 'root' })
export class QuestionsService {
  private supabase = inject(SupabaseService);
  private gate = inject(ProfileGateService);
  private missing = false;
  private cache: { at: number; list: Promise<Question[] | null> } | null = null;

  /** Opened questions, newest first; null when the feature is not available. Kept a few minutes. */
  questions(): Promise<Question[] | null> {
    if (this.cache && Date.now() - this.cache.at < QUESTIONS_TTL) return this.cache.list;
    const list = this.readQuestions();
    this.cache = { at: Date.now(), list };
    // A failed read is not kept: the next page asks again.
    void list.then(l => { if (!l && this.cache?.list === list) this.cache = null; });
    return list;
  }

  private async readQuestions(): Promise<Question[] | null> {
    if (this.missing) return null;
    try {
      const { data, error } = await this.supabase.client.from('questions').select(QUESTION_COLUMNS)
        .order('opens_at', { ascending: false }).limit(48);
      if (error) {
        if (NOT_THERE.includes(error.code)) this.missing = true;
        return null;
      }
      return ((data ?? []) as Question[]).map(q => ({ ...q, starters: q.starters ?? [] }));
    } catch {
      return null;
    }
  }

  /**
   * Newest first. The first page also brings the total (one request); `before` (a created_at)
   * reads the next page. Null when it could not be read.
   */
  async answers(questionId: string, before?: string): Promise<AnswerPage | null> {
    try {
      let q = this.supabase.client.from('question_answers')
        .select(ANSWER_COLUMNS, before ? undefined : { count: 'exact' })
        .eq('question_id', questionId);
      if (before) q = q.lt('created_at', before);
      const { data, error, count } = await q.order('created_at', { ascending: false }).limit(ANSWER_PAGE);
      if (error) return null;
      const rows = (data as Answer[] | null) ?? [];
      return { rows, total: count ?? null };
    } catch {
      return null;
    }
  }

  async mine(questionId: string, userId: string): Promise<Answer | null> {
    try {
      const { data } = await this.supabase.client.from('question_answers').select(ANSWER_COLUMNS)
        .eq('question_id', questionId).eq('user_id', userId).maybeSingle();
      return (data as Answer | null) ?? null;
    } catch {
      return null;
    }
  }

  /** Writes or rewrites the person's answer. Returns the saved answer or an error message. */
  async save(questionId: string, text: string, existingId?: string): Promise<Answer | string> {
    const clean = text.trim();
    if (!clean) return 'Escribe algo antes de publicar.';
    if (clean.length > MAX_ANSWER_LENGTH) return `Máximo ${MAX_ANSWER_LENGTH} caracteres.`;
    if (!(await this.gate.ensure({ toast: false }))) return PROFILE_REQUIRED_MESSAGE;
    const table = this.supabase.client.from('question_answers');
    const { data, error } = existingId
      ? await table.update({ text: clean }).eq('id', existingId).select(ANSWER_COLUMNS).single()
      : await table.insert({ question_id: questionId, text: clean }).select(ANSWER_COLUMNS).single();
    if (!error && data) return data as Answer;
    if (error?.hint === 'closed') return 'Esta pregunta ya está cerrada.';
    if (error?.code === '23505') return 'Ya habías respondido: recarga la página para editar tu respuesta.';
    return 'No se pudo publicar la respuesta. Inténtalo otra vez.';
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await this.supabase.client.from('question_answers').delete().eq('id', id);
    return !error;
  }
}
