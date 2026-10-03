import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

/** Band data shown next to a vacancy. */
export interface VacancyBand {
  id: string;
  name: string;
  city: string | null;
  genre: string | null;
  avatar_url: string | null;
}

/** An open vacancy with its band, shaped like a PostgREST `bands!inner` embed. */
export interface OpenVacancy {
  id: string;
  band_id: string;
  instrument: string;
  description: string | null;
  genre: string | null;
  created_at: string;
  bands: VacancyBand;
}

export interface OpenVacancyFilters {
  city?: string | null;
  genre?: string | null;
  instrument?: string | null;
  query?: string | null;
  /** Only vacancies created at or after this ISO timestamp. */
  since?: string | null;
  offset?: number;
  limit?: number;
}

const VACANCY_COLS = 'id, band_id, instrument, description, genre, created_at';
const BAND_COLS = 'id, name, city, genre, avatar_url';
/** Bands considered per request (the id list goes in the URL of the vacancies query). */
const MAX_BANDS = 300;

/**
 * Open band vacancies with their band. There is no FK band_vacancies.band_id → bands
 * in the live schema (see supabase/audit_2026_10_vacancies_fk.sql), so PostgREST
 * cannot embed `bands!inner(...)`; this does the join in two queries instead.
 */
@Injectable({ providedIn: 'root' })
export class VacanciesService {
  private supabase = inject(SupabaseService);

  async listOpen(filters: OpenVacancyFilters = {}): Promise<OpenVacancy[]> {
    const { city, genre, instrument, query, since, offset = 0, limit = 20 } = filters;
    const db = this.supabase.client;

    // Bands first: only vacancies of existing bands are listed, so orphans (no FK
    // cascade yet) never fill a page, and pagination stays exact.
    let bandsQ = db.from('bands').select(BAND_COLS);
    if (city) bandsQ = bandsQ.eq('city', city);
    const { data: bands, error: bandsErr } = await bandsQ.limit(MAX_BANDS);
    if (bandsErr) throw bandsErr;
    const byId = new Map((bands || []).map((b: VacancyBand) => [b.id, b]));
    if (!byId.size) return [];

    let q = db.from('band_vacancies').select(VACANCY_COLS).eq('open', true).in('band_id', [...byId.keys()]);
    if (genre) q = q.ilike('genre', `%${genre}%`);
    if (instrument) q = q.ilike('instrument', `%${instrument}%`);
    if (query) q = q.ilike('instrument', `%${query}%`);
    if (since) q = q.gte('created_at', since);
    const { data: rows, error } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return ((rows || []) as Omit<OpenVacancy, 'bands'>[])
      .filter(v => byId.has(v.band_id))
      .map(v => ({ ...v, bands: byId.get(v.band_id)! }));
  }
}
