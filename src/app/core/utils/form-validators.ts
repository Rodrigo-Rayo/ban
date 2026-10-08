import { AbstractControl, ValidationErrors } from '@angular/forms';
import { mediaEmbed } from './media-embed';

/** Allows empty/null values; validates URL format and restricts to http/https when a value is present. */
export function optionalUrl(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  try {
    const parsed = new URL(control.value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { url: true };
    }
    return null;
  } catch {
    return { url: true };
  }
}

/** Allows null/empty values; validates that the value is a non-negative number when present. */
export function optionalPositiveNumber(control: AbstractControl): ValidationErrors | null {
  if (!control.value && control.value !== 0) return null;
  const n = Number(control.value);
  return isNaN(n) || n < 0 ? { positiveNumber: true } : null;
}

/** Empty, or a song/video link that can play inside a profile (YouTube video, Spotify, SoundCloud). */
export function optionalPlayableUrl(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return value.length <= 300 && mediaEmbed(value) ? null : { playable: true };
}
