import { SITE_URL } from '../../../core/services/seo.service';

/** Visible copy and JSON-LD come from the same source, so the FAQ schema always matches the page. */
export const PRACTICE_TIPS: readonly { title: string; text: string }[] = [
  { title: 'Empieza lento', text: 'Pon el pasaje a un tempo al que te salga limpio tres veces seguidas. La velocidad llega sola; los errores también, si los repites.' },
  { title: 'Sube de 4 en 4', text: 'Cuando lo tengas, sube 4 BPM y repite. Si fallas, vuelve al tempo anterior. Apunta el BPM de cada día para ver cuánto avanzas.' },
  { title: 'Subdivide', text: 'A tempos lentos usa corcheas o semicorcheas: el clic entre pulsos te obliga a repartir bien las notas y no correr.' },
  { title: 'Quita el acento', text: 'Sin el acento del primer tiempo tienes que llevar tú la cuenta del compás. Es un buen paso antes de ensayar con la banda.' },
  { title: 'Clic en 2 y 4', text: 'Para swing, funk o pop, pon el metrónomo a la mitad del tempo y siente cada clic como el tiempo 2 y el 4 (el golpe de caja).' },
];

export const FAQS: readonly { q: string; a: string }[] = [
  {
    q: '¿Funciona con la pantalla bloqueada?',
    a: 'Deja esta página abierta. Mientras suena, el metrónomo mantiene la pantalla encendida en los navegadores que lo permiten, y sigue sonando aunque cambies de pestaña. Si bloqueas el móvil, el sistema puede pausar el audio del navegador (sobre todo en iPhone): al volver, pulsa Empezar otra vez.',
  },
  {
    q: '¿Qué compás elijo?',
    a: 'La mayoría de canciones de rock, pop y funk van en 4/4. Los valses y muchas baladas, en 3/4. El 6/8 y el 12/8 se sienten en grupos de tres (blues lento, baladas, música irlandesa); el 7/8 aquí se agrupa 2+2+3. En los compases de x/8 cada clic es una corchea.',
  },
  {
    q: '¿Cómo saco los BPM de una canción?',
    a: 'Pon la canción y pulsa «Marcar tempo» (o la tecla T) al ritmo del pulso, al menos cuatro o cinco veces. El metrónomo calcula la media de tus últimos toques, descarta los que se desvían y se pone a ese tempo.',
  },
  {
    q: '¿Es gratis?',
    a: 'Sí. Es gratis, sin anuncios y sin registrarte. Funciona en el navegador del móvil y del ordenador, y recuerda tu último tempo y compás.',
  },
];

export function metronomeJsonLd(): object {
  const url = `${SITE_URL}/metronomo`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Metrónomo online de BandYou',
        url,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Cualquiera (navegador web)',
        inLanguage: 'es-ES',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        description: 'Metrónomo online gratis: de 30 a 300 BPM, compases 2/4 a 12/8, subdivisiones, acento y marcar tempo.',
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}
