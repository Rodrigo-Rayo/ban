/**
 * Single source of truth for the identity data shown on every legal page
 * (Aviso legal, Privacidad, Términos, Cookies).
 *
 * IMPORTANT — BEFORE LAUNCH: every value wrapped in [CORCHETES] is a
 * placeholder that the owner MUST replace with real, verified data
 * (LSSI-CE art. 10, RGPD art. 13). Never ship with placeholders.
 */
export const LEGAL_INFO = {
  /** Nombre y apellidos (persona física) o razón social. De momento solo la marca: poner el titular real antes de cobrar (LSSI art. 10, RGPD art. 13). */
  ownerName: 'BandYou',
  /** NIF / CIF del titular. Vacío = no se muestra; LSSI art. 10 lo exige. */
  nif: '',
  /** Domicilio (calle, número, CP, municipio, provincia). Vacío = no se muestra; LSSI art. 10 lo exige, rellenar en cuanto haya una dirección publicable. */
  address: '',
  /**
   * Datos registrales (Registro Mercantil: tomo, folio, hoja, inscripción).
   * Si el titular es persona física no inscrita, sustituir por
   * "No inscrito en registro público".
   */
  registry: 'Persona física no inscrita en el Registro Mercantil',
  website: 'https://bandyou.es',
  /** Buzón general / legal y punto de contacto único DSA (arts. 11 y 12). Verificar que existe. */
  legalEmail: 'legal@bandyou.es',
  /** Buzón para ejercicio de derechos RGPD. Verificar que existe. */
  privacyEmail: 'privacidad@bandyou.es',
  /** Plazo de retención de copias de seguridad en Supabase (según plan contratado). */
  backupRetention: '7 días',
  /** Edad mínima para registrarse (LOPDGDD art. 7). */
  minAge: 14,
  /** Fecha visible de última actualización de los textos legales. */
  updated: '1 de octubre de 2026',
  /** Versión de los textos legales aceptados en el registro (guardar junto al consentimiento). */
  version: '2026-10-01',
} as const;
