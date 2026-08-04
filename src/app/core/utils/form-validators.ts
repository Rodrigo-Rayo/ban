import { AbstractControl, ValidationErrors } from '@angular/forms';

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
