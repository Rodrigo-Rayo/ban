import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

/** What the invite link shows before anyone signs in (band_invite_info). */
export interface BandInviteInfo {
  status: 'ok' | 'expired' | 'used' | 'invalid';
  band_id?: string;
  band_name?: string;
  band_avatar?: string | null;
  band_city?: string | null;
  band_genre?: string | null;
  member_name?: string;
  instrument?: string | null;
}

/** Why accepting failed (codes raised by accept_band_invite), or 'error' for anything else. */
export type AcceptError = 'need_musician' | 'own_band' | 'already_member' | 'used' | 'expired' | 'invalid' | 'not_signed_in' | 'error';

/** A band someone plays in ("Toca en"), from band_members.user_id. */
export interface MemberBand {
  band_id: string;
  instrument: string | null;
  bands: { id: string; name: string; avatar_url: string | null; city: string | null } | null;
}

/** Linked musician shown next to a line-up name. */
export interface LinkedMusician {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
}

const PENDING_KEY = 'bandyou_invite';
const PENDING_DAYS = 14;
const TOKEN = /^[0-9a-f]{64}$/;
const ACCEPT_ERRORS: readonly AcceptError[] = ['need_musician', 'own_band', 'already_member', 'used', 'expired', 'invalid', 'not_signed_in'];

export function isInviteToken(token: string | null | undefined): token is string {
  return !!token && TOKEN.test(token);
}

export function inviteUrl(token: string, origin: string = location.origin): string {
  return `${origin}/unirse/${token}`;
}

/**
 * The WhatsApp text. It says plainly that a MUSICIAN profile is needed: one
 * account holds one profile, and someone who signs up as a band could not join.
 */
export function inviteMessage(band: string, member: string, instrument: string | null, url: string): string {
  const who = member.trim() ? `¡Hola, ${member.trim()}! ` : '¡Hola! ';
  const as = instrument ? ` como ${instrument.toLowerCase()}` : '';
  return `${who}Te he añadido a ${band}${as} en BandYou. `
    + `Para salir en la formación con tu foto y tu perfil, entra aquí y crea tu perfil de músico `
    + `(gratis; si ya tienes uno, solo tienes que aceptar): ${url}`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Band line-up invites (supabase/2026_10_band_invites.sql): the band sends a
 * personal link per member; whoever opens it joins with their musician profile.
 */
@Injectable({ providedIn: 'root' })
export class BandInvitesService {
  private supabase = inject(SupabaseService);

  /** Link for a line-up member (the same one while it is valid), or a message to show. */
  async create(memberId: string): Promise<{ url: string } | { error: string }> {
    const { data, error } = await this.supabase.client.rpc('create_band_invite', { p_member: memberId });
    if (error || !isInviteToken(data as string)) {
      const msg = error?.message ?? '';
      if (msg.includes('already_linked')) return { error: 'Este integrante ya está unido con su perfil.' };
      if (msg.includes('too_many_invites')) return { error: 'Has enviado muchas invitaciones hoy. Prueba mañana.' };
      return { error: 'No se pudo crear la invitación. Inténtalo de nuevo.' };
    }
    return { url: inviteUrl(data as string) };
  }

  async info(token: string): Promise<BandInviteInfo | null> {
    if (!isInviteToken(token)) return { status: 'invalid' };
    const { data, error } = await this.supabase.client.rpc('band_invite_info', { p_token: token });
    if (error || !data) return null;
    return data as BandInviteInfo;
  }

  async accept(token: string): Promise<{ bandId: string } | { error: AcceptError }> {
    const { data, error } = await this.supabase.client.rpc('accept_band_invite', { p_token: token });
    if (error) {
      const code = ACCEPT_ERRORS.find(c => error.message?.includes(c));
      return { error: code ?? 'error' };
    }
    return { bandId: data as string };
  }

  async leave(bandId: string): Promise<boolean> {
    const { error } = await this.supabase.client.rpc('leave_band', { p_band: bandId });
    return !error;
  }

  /** Bands this account plays in. */
  async bandsOf(userId: string): Promise<MemberBand[]> {
    const { data } = await this.supabase.client.from('band_members')
      .select('band_id, instrument, bands(id, name, avatar_url, city)')
      .eq('user_id', userId).limit(10);
    return (data as unknown as MemberBand[] | null) ?? [];
  }

  /** Musician profiles behind linked line-up members. */
  async musiciansFor(userIds: readonly string[]): Promise<LinkedMusician[]> {
    if (!userIds.length) return [];
    const { data } = await this.supabase.client.from('musicians')
      .select('id, user_id, name, avatar_url').in('user_id', [...userIds]);
    return (data as LinkedMusician[] | null) ?? [];
  }

  // ── The invite a visitor opened, kept through sign-up and onboarding ──

  rememberPending(token: string): void {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ token, at: Date.now() })); } catch { /* storage blocked */ }
  }

  pending(now: number = Date.now()): string | null {
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') as { token?: unknown; at?: unknown } | null;
      if (!raw || typeof raw.token !== 'string' || typeof raw.at !== 'number') return null;
      if (!isInviteToken(raw.token) || now - raw.at > PENDING_DAYS * 864e5) { this.clearPending(); return null; }
      return raw.token;
    } catch {
      return null;
    }
  }

  clearPending(): void {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ }
  }
}
