/** "¿Qué músico de banda eres?": the eight results and the gig day that leads to them. */

export type TypeId = 'met' | 'chi' | 'lab' | 'age' | 'fab' | 'peg' | 'com' | 'pue';

export interface MusicianType {
  name: string;
  tag: string;
  desc: string;
  /** Three tongue-in-cheek stats, 0–100. */
  stats: readonly (readonly [string, number])[];
  power: string;
  weak: string;
  quote: string;
  fits: TypeId;
  /** null: clashes with nobody (that is the joke). */
  clash: TypeId | null;
  reward: string;
}

export const TYPES: Readonly<Record<TypeId, MusicianType>> = {
  met: {
    name: 'El metrónomo', tag: 'Si tú vas, la banda va.',
    desc: 'Llegas el primero, montas el primero y eres quien sabe a qué velocidad va de verdad cada tema. Sin ti, la banda acelera en el estribillo y nadie se da cuenta.',
    stats: [['Puntualidad', 97], ['Paciencia con quien acelera', 12], ['Veces que dices «más lento»', 88]],
    power: 'Pones orden sin decir una palabra.', weak: 'Una jam libre te da sudores fríos.',
    quote: '«Desde arriba. Cuatro, y…»', fits: 'chi', clash: 'com', reward: 'Una caña, a la hora acordada',
  },
  chi: {
    name: 'La chispa', tag: 'Nadie mira el móvil cuando estás en el escenario.',
    desc: 'Contigo el bolo empieza en el escenario y acaba en la barra. Convences a la sala, al técnico y a quien está en la puerta. Si el público se aburre, es que aún no has salido.',
    stats: [['Carisma', 98], ['Respeto por el setlist', 23], ['Ganas de bajar a cantar entre la gente', 91]],
    power: 'Conviertes un martes con 12 personas en una fiesta.', weak: 'Ensayar el mismo tema seis veces te apaga.',
    quote: '«¡Esta no la sabéis, pero la vais a cantar!»', fits: 'met', clash: 'pue', reward: 'Aplausos. Y una caña',
  },
  lab: {
    name: 'El laboratorio', tag: 'Llevas un jack de repuesto. Y otro por si acaso.',
    desc: 'Tu mochila parece la trastienda de una tienda de música. Sabes qué pedal hace ese sonido y por qué zumba el ampli. Cuando algo falla, todo el mundo te mira.',
    stats: [['Cables en la mochila', 94], ['Sueldo gastado en pedales', 87], ['Veces que dices «lo arreglo en un momento»', 90]],
    power: 'Salvas el bolo con un destornillador.', weak: 'Tu prueba de sonido dura lo que el concierto de otros.',
    quote: '«Esperad, que pruebo una cosa.»', fits: 'fab', clash: 'age', reward: 'Un pedal. Bueno, otro',
  },
  age: {
    name: 'La agenda', tag: 'Gracias a ti, esta banda existe fuera del grupo de WhatsApp.',
    desc: 'Cierras fechas, reservas el local, llevas las cuentas y recuerdas quién debe 5 euros del último bolo. Nadie lo dice, pero sin ti no habría segundo concierto.',
    stats: [['Hojas de cálculo abiertas', 96], ['Mensajes sin respuesta reenviados', 89], ['Bolos cerrados por ti', 92]],
    power: 'Conviertes «a ver si tocamos algún día» en una fecha.', weak: 'Te cuesta soltar el móvil en el ensayo.',
    quote: '«Confirmad, porfa, que tengo que contestar a la sala.»', fits: 'fab', clash: 'lab', reward: 'Que alguien conteste al primer mensaje',
  },
  fab: {
    name: 'La fábrica de temas', tag: 'Tienes 40 notas de voz y todas son un hit.',
    desc: 'Las ideas te llegan en la ducha, en el metro y a las tres de la mañana. Traes un tema nuevo a cada ensayo, aunque el anterior aún no esté terminado.',
    stats: [['Notas de voz en el móvil', 99], ['Temas terminados', 34], ['Veces que dices «tengo una idea»', 95]],
    power: 'Nunca os quedáis sin repertorio.', weak: 'Terminar un tema te aburre más que empezar otro.',
    quote: '«Escuchad esto. Es solo una idea, pero…»', fits: 'age', clash: 'pue', reward: 'Que alguien escuche el audio entero',
  },
  peg: {
    name: 'El pegamento', tag: 'Sin ti, esta banda se habría separado en el segundo ensayo.',
    desc: 'Calmas los ánimos, traes buen rollo y sabes cuándo toca pedir pizza. Puede que no seas quien más brilla, pero eres la razón de que sigáis juntos.',
    stats: [['Buen rollo', 99], ['Discusiones evitadas', 93], ['Memes enviados al grupo', 88]],
    power: 'Haces que la gente quiera volver al local.', weak: 'Te cuesta decir «esto no suena bien».',
    quote: '«Venga, una más y vamos a por algo.»', fits: 'pue', clash: null, reward: 'La última porción de pizza',
  },
  com: {
    name: 'El comodín', tag: 'Nunca tocas un tema igual dos veces. Y siempre suena bien.',
    desc: 'Se rompe una cuerda, se olvida una letra o se va la luz, y tú improvisas como si estuviera ensayado. Eres el seguro de vida de cualquier bolo.',
    stats: [['Capacidad de improvisar', 97], ['Veces que tocas lo ensayado', 18], ['Desastres salvados', 94]],
    power: 'Conviertes un error en el mejor momento de la noche.', weak: 'Repetir algo dos veces te parece un castigo.',
    quote: '«Tranquilos, seguidme.»', fits: 'lab', clash: 'met', reward: 'Una jam hasta las tantas',
  },
  pue: {
    name: 'Otra vez desde el puente', tag: 'Lo tocamos hasta que salga perfecto.',
    desc: 'Oyes el fallo que nadie más ha notado y no paras hasta que el tema sale redondo. Gracias a ti, la banda suena mejor en directo que en el local.',
    stats: [['Oído para los fallos', 98], ['Repeticiones por ensayo', 95], ['Ganas de dar un tema por terminado', 21]],
    power: 'Nadie suena tan sólido como tu banda.', weak: '«Está bien así» no existe en tu vocabulario.',
    quote: '«Otra vez. Desde el puente.»', fits: 'peg', clash: 'chi', reward: 'Un ensayo de cuatro horas',
  },
};

export const TYPE_IDS = Object.keys(TYPES) as TypeId[];

/** [image key in /instruments, label]. */
export const TEST_INSTRUMENTS: readonly (readonly [string, string])[] = [
  ['guitarra', 'Guitarra'], ['bajo', 'Bajo'], ['bateria', 'Batería'], ['voz', 'Voz'],
  ['teclados', 'Teclados'], ['saxofon', 'Viento'], ['violin', 'Cuerda'], ['otro', 'Otro'],
];

/** [text, types it scores, reaction shown after picking it]. */
export type Answer = readonly [string, readonly TypeId[], string];

export interface Question {
  time: string;
  scene: string;
  q: string;
  a: readonly Answer[];
  /** Answer against the clock; `timeout` is shown when time runs out. */
  urgent?: boolean;
  timeout?: string;
}

export const URGENT_MS = 6000;

export const QUESTIONS: readonly Question[] = [
  { time: '18:00', scene: 'Prueba de sonido', q: 'El técnico dice «en cinco minutos estáis». Tú…', a: [
    ['Llevo media hora con todo montado y afinado.', ['met', 'pue'], 'El técnico te adora. El resto de la banda, un poco menos.'],
    ['Estoy probando un pedal que me llegó ayer.', ['lab'], 'Nadie sabe qué hace. Pero suena increíble.'],
    ['Ya me sé el nombre del técnico, el de la camarera y el de su perro.', ['peg', 'chi'], 'Contactos en la sala: +3.'],
    ['Repaso el setlist y a qué hora cobramos.', ['age'], 'Alguien tiene que hacerlo. Y siempre eres tú.'] ] },
  { time: '18:40', scene: 'En la furgo', q: '¿Qué suena camino de la sala?', a: [
    ['Una maqueta que grabé anoche con el móvil.', ['fab'], 'Cuatro minutos de intro. Y es la versión corta.'],
    ['Nada. Estoy repasando el set en la cabeza.', ['pue', 'met'], 'El tema 6 tiene un cambio raro. Lo sabes.'],
    ['Karaoke a pleno pulmón.', ['chi'], 'Guarda algo de voz para luego, anda.'],
    ['Lo que diga el resto. Yo conduzco.', ['peg', 'age'], 'Y llegáis a la hora gracias a ti.'] ] },
  { time: '20:50', scene: 'Camerino', q: 'Faltan diez minutos y se rompe una cuerda. O un parche. Tú…', a: [
    ['Saco el repuesto. Llevo de todo, hasta un jack de seis metros.', ['lab'], 'Tu mochila pesa como un ampli. Hoy ha valido la pena.'],
    ['Cinta americana y fe.', ['com'], 'No lo vuelvas a hacer. Pero ha quedado bien.'],
    ['Estaba en mi lista de cosas que pueden pasar.', ['age', 'pue'], 'Tienes una lista para todo, ¿verdad?'],
    ['Respiro hondo y calmo al resto.', ['peg'], 'La banda entera te debe una caña.'] ] },
  { time: '21:15', scene: '¡Rápido!', urgent: true, q: 'Se va la luz en mitad del segundo tema.', timeout: 'Te has quedado en blanco. Como en tu primer bolo.', a: [
    ['«¡Cantad vosotros!», al público.', ['chi'], 'Y la sala entera canta el estribillo. Piel de gallina.'],
    ['Sigo marcando el tempo para cuando vuelva.', ['met'], 'Vuelve la luz y entráis justo a tiempo. Ni un segundo tarde.'],
    ['Seguimos en acústico como si nada.', ['com'], 'La gente cree que estaba preparado.'],
    ['Busco el cuadro eléctrico con la linterna del móvil.', ['lab', 'age'], 'Encuentras el diferencial antes que el dueño de la sala.'] ] },
  { time: '21:40', scene: 'Bis', q: 'Alguien del público grita «¡Otra!».', a: [
    ['Una que no hemos ensayado nunca. ¿Qué puede salir mal?', ['com', 'fab'], 'Ha salido bien. Nadie sabe cómo.'],
    ['La tocamos, y bajo a cantarla entre la gente.', ['chi'], 'El técnico ya no sabe dónde estás.'],
    ['Solo si estaba en el setlist.', ['pue', 'met'], 'Estaba. Lo comprobaste tres veces.'],
    ['Miro al resto a ver qué opinan.', ['peg'], 'Democracia hasta en el bis.'] ] },
  { time: '23:30', scene: 'Fin del bolo', q: 'Lo primero que haces al bajar del escenario:', a: [
    ['Cobrar y repartir, al céntimo.', ['age'], 'Te sobran 40 céntimos. Vas a preguntar de quién son.'],
    ['Apuntar qué ha fallado en el tema 4.', ['pue'], 'Nadie lo notó. Tú sí.'],
    ['Cerrar el bar con gente que acabo de conocer.', ['chi', 'peg'], 'Mañana tendrás 12 seguidores nuevos y algo de resaca.'],
    ['Grabar una nota de voz: se me ha ocurrido un riff.', ['fab'], 'Es la número 41.'] ] },
  { time: 'Día siguiente', scene: 'Grupo de WhatsApp', q: 'En el grupo de la banda, tú eres quien manda…', a: [
    ['«Ensayo el martes a las 20:00. Confirmad, porfa».', ['age'], 'Dos «ok», un audio y tres en visto.'],
    ['Un audio de cuatro minutos que empieza con «escuchad esto».', ['fab'], 'Lo has mandado a las 3:12 de la mañana.'],
    ['La foto de un pedal y un «¿lo pillo?».', ['lab'], 'Ya lo habías pillado.'],
    ['Memes. Muchos memes.', ['peg'], 'El grupo sigue vivo gracias a ti.'] ] },
  { time: 'Martes', scene: 'Ensayo', q: 'Alguien se equivoca por quinta vez en el mismo sitio.', a: [
    ['«Otra vez desde el puente.»', ['pue'], 'Y otra. Y otra. Hasta que salga.'],
    ['Convierto el error en parte del tema.', ['com'], 'Ahora es lo mejor de la canción.'],
    ['Cuento «un, dos, tres, cuatro» y seguimos.', ['met'], 'Sin drama. Con tempo.'],
    ['Propongo pedir pizza. Así no se puede.', ['peg'], 'Media hora después, sale a la primera.'] ] },
  { time: 'Siempre', scene: 'Tu pesadilla', q: '¿Qué es lo peor que te puede pasar en un bolo?', a: [
    ['Que alguien acelere en el estribillo.', ['met'], 'Lo has sentido en el pecho solo de leerlo.'],
    ['Tocar para nadie.', ['chi'], 'Para ti, tres personas ya son público.'],
    ['Perder el móvil con todas las maquetas.', ['fab'], 'Haz copia de seguridad. Hoy.'],
    ['Llegar y que la sala no tenga ampli.', ['lab', 'com'], 'Tranquilidad: tú llevas uno en el maletero.'] ] },
];
