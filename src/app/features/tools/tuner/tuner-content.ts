import { SITE_URL } from '../../../core/services/seo.service';

export const TUNER_URL = `${SITE_URL}/afinador`;
export const TUNER_TITLE = 'Afinador online gratis para guitarra, bajo y ukelele';
export const TUNER_DESCRIPTION =
  'Afinador online gratis con el micrófono: guitarra, bajo de 4 y 5 cuerdas, ukelele y modo cromático. Preciso, sin instalar nada y sin grabar tu sonido.';

export interface Faq {
  q: string;
  a: string;
}

export const TUNER_FAQS: readonly Faq[] = [
  {
    q: '¿Funciona en el móvil?',
    a: 'Sí. Funciona en el navegador del móvil (Chrome en Android, Safari en iPhone) y del ordenador, sin instalar ninguna app. Solo tienes que permitir el micrófono la primera vez.',
  },
  {
    q: '¿Se graba algo de lo que toco?',
    a: 'No. El sonido se analiza en tu propio dispositivo y nunca sale de él: no se graba, no se guarda y no se envía a ningún servidor.',
  },
  {
    q: '¿Qué es el La 440?',
    a: 'Es la frecuencia de referencia de la afinación estándar: la nota La central vibra a 440 Hz. Algunas orquestas y grabaciones usan 442 Hz o 432 Hz; puedes cambiar la referencia en Ajustes, entre 415 y 466 Hz.',
  },
  {
    q: '¿Por qué no detecta la nota?',
    a: 'Toca una sola cuerda cada vez y deja que suene, acerca el instrumento al micrófono y evita ruido de fondo (otras personas, música, ventiladores). Si usas auriculares con micrófono, prueba con el micrófono del propio móvil o del portátil.',
  },
  {
    q: '¿Sirve para bajo de 5 cuerdas?',
    a: 'Sí. Elige «Bajo 5 cuerdas» y el afinador analiza una ventana de sonido más larga para captar bien el Si grave (unos 31 Hz). En móviles con altavoz pequeño ayuda tocar con fuerza y acercar el bajo.',
  },
];

export interface TuningRow {
  instrument: string;
  notesEs: string;
  notesEn: string;
}

export const TUNING_TABLE: readonly TuningRow[] = [
  { instrument: 'Guitarra (estándar)', notesEs: 'Mi2 La2 Re3 Sol3 Si3 Mi4', notesEn: 'E2 A2 D3 G3 B3 E4' },
  { instrument: 'Guitarra Drop D', notesEs: 'Re2 La2 Re3 Sol3 Si3 Mi4', notesEn: 'D2 A2 D3 G3 B3 E4' },
  { instrument: 'Bajo 4 cuerdas', notesEs: 'Mi1 La1 Re2 Sol2', notesEn: 'E1 A1 D2 G2' },
  { instrument: 'Bajo 5 cuerdas', notesEs: 'Si0 Mi1 La1 Re2 Sol2', notesEn: 'B0 E1 A1 D2 G2' },
  { instrument: 'Ukelele', notesEs: 'Sol4 Do4 Mi4 La4', notesEn: 'G4 C4 E4 A4' },
];

/** WebApplication + FAQPage structured data for /afinador. */
export function tunerJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Afinador online de BandYou',
        url: TUNER_URL,
        description: TUNER_DESCRIPTION,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Cualquiera (navegador web)',
        browserRequirements: 'Requiere micrófono y un navegador moderno',
        inLanguage: 'es-ES',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: TUNER_FAQS.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}
