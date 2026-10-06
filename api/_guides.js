// Contenido de las guías SEO servidas en /guias/<slug>.
// Los archivos que empiezan por _ en api/ no se despliegan como funciones de Vercel.
// Texto plano: sin HTML ni markdown (el renderer se encarga de escapar y maquetar).

const GUIDES = [
  {
    slug: 'como-encontrar-banda',
    title: 'Cómo encontrar banda: guía práctica para músicos',
    description: 'Cómo encontrar banda siendo músico: dónde buscar, cómo preparar tu perfil, qué escribir en el primer mensaje y cómo saber si un grupo de verdad encaja contigo.',
    h1: 'Cómo encontrar banda (y que encaje contigo)',
    answer: 'Para encontrar banda, define primero qué buscas (estilo, nivel, compromiso y si quieres hacer versiones o temas propios), prepara un perfil con audio o vídeo tuyo tocando y busca en varios frentes a la vez: anuncios de grupos que necesitan músico, locales de ensayo de tu ciudad y jams. Responde rápido, sé concreto y haz siempre un ensayo de prueba antes de comprometerte.',
    sections: [
      {
        h2: 'Antes de buscar: aclara qué quieres',
        paragraphs: [
          'La mayoría de bandas que se rompen a los tres meses no lo hacen por falta de nivel, sino porque cada miembro esperaba algo distinto. Antes de escribir a nadie, ten claras unas pocas cosas y dilas desde el principio.',
        ],
        bullets: [
          'Estilo: no hace falta encasillarse, pero sí saber si te ves más en rock, metal, pop, jazz, funk o algo concreto.',
          'Proyecto: banda de versiones para tocar en bares y fiestas, o grupo de temas propios con idea de grabar una maqueta o un EP.',
          'Compromiso: cuántos ensayos a la semana puedes asumir y si estás dispuesto a pagar tu parte del local de ensayo.',
          'Ambición: tocar por diversión, girar por tu provincia o intentar algo más serio. Ninguna opción es mejor, pero mezclarlas da problemas.',
          'Zona: hasta dónde estás dispuesto a desplazarte para ensayar cada semana.',
        ],
      },
      {
        h2: 'Prepara algo que se pueda escuchar',
        paragraphs: [
          'Una banda que busca bajista o batería recibe muchos mensajes del tipo «hola, toco desde hace años». Lo que marca la diferencia es poder escucharte en treinta segundos. No necesitas una grabación de estudio: un vídeo con el móvil tocando sobre un tema conocido, o un fragmento de un directo, vale más que cualquier currículum.',
          'Añade también tus influencias, el equipo que tienes (sobre todo si eres batería y tienes kit propio, o si tienes ampli y furgoneta), tu disponibilidad y tu zona. En BandYou puedes crear un perfil gratis de músico por provincia, instrumento y estilo, con enlaces a tu música, para que las bandas te encuentren aunque tú no les hayas escrito.',
        ],
      },
      {
        h2: 'Dónde buscar banda',
        paragraphs: [
          'Lo que mejor funciona es combinar varias vías a la vez, porque cada una llega a gente distinta.',
        ],
        bullets: [
          'Tablones de anuncios para músicos: en el tablón «Se busca» de BandYou las bandas publican que necesitan músico y los músicos que buscan banda, filtrado por provincia.',
          'Locales de ensayo: muchos tienen corcho o grupo de mensajería, y hablar con el encargado sirve, porque conoce a todas las bandas que pasan por allí.',
          'Jams y conciertos pequeños: ir a ver bandas de tu ciudad y quedarte a hablar al final sigue siendo de lo más efectivo.',
          'Escuelas de música y profesores: suelen saber qué alumnos están montando grupo.',
          'Tu círculo: avisa a compañeros de antiguas bandas, porque a menudo conocen grupos a los que les falta alguien.',
        ],
      },
      {
        h2: 'Cómo escribir a una banda',
        paragraphs: [
          'El primer mensaje decide mucho. Sé breve y facilita que te digan que sí.',
        ],
        steps: [
          'Lee bien el anuncio y comprueba que encajas en estilo, zona y disponibilidad.',
          'Preséntate en dos o tres frases: instrumento, años tocando, estilo y dónde vives.',
          'Incluye un enlace a algo tuyo tocando.',
          'Di qué disponibilidad tienes para ensayar y si tienes equipo propio.',
          'Propón algo concreto: preparar dos temas de su repertorio para un ensayo de prueba.',
        ],
      },
      {
        h2: 'El ensayo de prueba',
        paragraphs: [
          'Pide que te pasen dos o tres temas con antelación y llévalos bien preparados. En el ensayo no solo cuenta cómo tocas: también si llegas puntual, si escuchas, si aceptas indicaciones y si el ambiente es bueno. Fíjate tú también en ellos: cómo se organizan, si tienen local fijo, cómo reparten los gastos y qué planes tienen a corto plazo.',
          'Si no encaja, dilo con educación. El mundillo musical de cada ciudad es pequeño y vas a volver a cruzarte con esa gente.',
        ],
      },
      {
        h2: 'Señales de que una banda no te conviene',
        bullets: [
          'Nadie sabe decirte qué estilo hacen ni qué objetivo tienen.',
          'Te piden dinero para entrar, más allá de tu parte proporcional del local.',
          'Cambian de miembros cada pocos meses y siempre es culpa del que se fue.',
          'No hay forma de quedar a ensayar con una frecuencia mínima.',
        ],
      },
    ],
    faq: [
      { q: '¿Cómo puedo unirme a una banda si nunca he tocado en grupo?', a: 'Empieza por proyectos de versiones o jams, donde el nivel exigido suele ser más flexible. Dilo con honestidad en tu mensaje: muchas bandas prefieren a alguien con ganas y constancia antes que a alguien con mucha técnica y poco compromiso.' },
      { q: '¿Qué nivel necesito para entrar en una banda?', a: 'El suficiente para tocar los temas del grupo con soltura. Para versiones sencillas basta con un nivel intermedio; para jazz, metal técnico o proyectos de sesión se pide bastante más.' },
      { q: '¿Tengo que pagar para estar en una banda?', a: 'Lo normal es compartir gastos a partes iguales: local de ensayo, grabaciones, desplazamientos. Desconfía si te piden dinero por entrar o si los gastos no se reparten de forma clara.' },
      { q: '¿Es mejor buscar banda o montar la mía?', a: 'Si tienes temas propios y una idea clara, montar la tuya te da control. Si quieres empezar a tocar pronto, unirte a una banda ya formada suele ser más rápido.' },
      { q: '¿Cuánto se tarda en encontrar banda?', a: 'Depende mucho del instrumento y la ciudad. Baterías y bajistas suelen encontrar antes porque se buscan más; guitarristas y cantantes a menudo necesitan más paciencia y un perfil más trabajado.' },
    ],
    links: [
      { href: '/busco-banda', label: 'Anuncios de músicos que buscan banda' },
      { href: '/feed', label: 'Tablón «Se busca»' },
      { href: '/auth/register', label: 'Crea tu perfil de músico gratis' },
      { href: '/guias/como-montar-una-banda', label: 'Guía: cómo montar una banda' },
    ],
  },

  {
    slug: 'como-encontrar-musicos-para-tu-banda',
    title: 'Buscar músicos para tu banda: guía práctica',
    description: 'Cómo encontrar músicos para tu banda: dónde buscar batería, bajista o cantante, cómo redactar el anuncio y cómo organizar audiciones que de verdad funcionen.',
    h1: 'Cómo encontrar músicos para tu banda',
    answer: 'Para encontrar músicos para tu banda, publica un anuncio concreto (instrumento, estilo, zona, frecuencia de ensayo y objetivo del grupo) con un enlace a vuestra música, búscalo también de forma activa entre perfiles de músicos de tu provincia y en locales de ensayo, y filtra con una charla breve y un ensayo de prueba con temas enviados de antemano.',
    sections: [
      {
        h2: 'Define el hueco que quieres cubrir',
        paragraphs: [
          'No es lo mismo buscar «un batería» que buscar un batería para rock alternativo, con kit propio, que pueda ensayar los martes en tu ciudad y que quiera grabar un EP este año. Cuanto más concreto seas, menos tiempo perderéis todos. Piensa también en el perfil humano: si sois una banda de amigos que toca por diversión, alguien muy ambicioso puede no encajar, y al revés.',
        ],
      },
      {
        h2: 'Cómo redactar un buen anuncio',
        paragraphs: [
          'Un anuncio eficaz se lee en veinte segundos y deja claro si merece la pena escribiros.',
        ],
        bullets: [
          'Instrumento que buscáis y, si importa, voces o coros.',
          'Estilo y dos o tres bandas de referencia.',
          'Proyecto: versiones o temas propios, y qué tenéis ya hecho (maqueta, EP, bolos).',
          'Frecuencia y día de ensayo, y zona del local.',
          'Cómo se reparten los gastos.',
          'Enlace a algo vuestro: aunque sea una grabación de ensayo con el móvil.',
        ],
      },
      {
        h2: 'Dónde buscar músicos',
        paragraphs: [
          'No te quedes solo esperando respuestas: busca de forma activa. En BandYou puedes filtrar perfiles de músicos por provincia, instrumento y estilo y escribirles por mensaje directo, además de publicar tu anuncio en el tablón «Se busca», donde los músicos que buscan banda también publican el suyo.',
        ],
        bullets: [
          'Locales de ensayo: pregunta al encargado y deja un anuncio físico; allí ya está la gente que toca.',
          'Escuelas y profesores de música: los alumnos avanzados suelen buscar su primer grupo serio.',
          'Conciertos y jams de tu ciudad: si alguien te gusta tocando, habla con él al acabar.',
          'Antiguos compañeros: un músico que no está libre a menudo conoce a otro que sí.',
        ],
      },
      {
        h2: 'Batería y bajista: los más buscados',
        paragraphs: [
          'En casi todas las ciudades hay más guitarristas que baterías y bajistas, así que estos perfiles reciben muchas propuestas. Para destacar, cuida especialmente el anuncio, responde rápido y ofrece facilidades: local con batería ya montada, horarios estables o un proyecto con objetivos claros. Si el batería tiene que cargar su kit a cada ensayo, que el local tenga batería compartida puede ser decisivo.',
          'Si no aparece nadie, plantéate opciones intermedias: un músico de sesión para un bolo concreto, o alguien que toque en otra banda y pueda compaginar ambas.',
        ],
      },
      {
        h2: 'Cómo hacer una audición sin perder el tiempo',
        steps: [
          'Antes de quedar, habla por mensaje o llamada para confirmar estilo, disponibilidad y expectativas.',
          'Envía dos o tres temas con al menos una semana de margen, con la estructura y el tono indicados.',
          'Haz el ensayo de prueba en vuestro local habitual y con el volumen real de la banda.',
          'Deja un rato para hablar al final: cómo trabaja, qué busca, qué espera del grupo.',
          'Si os convence, propón un periodo de prueba de unas semanas antes de cerrar nada.',
          'Responde siempre, también para decir que no. Da buena imagen a la banda.',
        ],
      },
      {
        h2: 'Errores habituales',
        bullets: [
          'Anuncios vagos tipo «busco músicos para banda» sin estilo ni zona.',
          'No tener ninguna grabación que enseñar.',
          'Exigir nivel profesional a un proyecto que ensaya una vez al mes.',
          'Dejar los temas económicos para más adelante.',
        ],
      },
    ],
    faq: [
      { q: '¿Dónde puedo encontrar un batería para mi banda?', a: 'Busca en perfiles de músicos filtrados por instrumento y provincia, en locales de ensayo de tu ciudad y en escuelas de música. Ofrecer un local con batería ya montada ayuda mucho a atraer candidatos.' },
      { q: '¿Cómo encuentro un bajista?', a: 'Igual que con la batería: anuncio concreto, búsqueda activa entre perfiles y locales, y respuesta rápida. Muchos guitarristas tocan también el bajo, así que menciona que aceptas a alguien que se esté pasando al instrumento.' },
      { q: '¿Hay que pagar a los músicos de una banda?', a: 'En una banda donde todos son miembros, no: se reparten gastos e ingresos. Si contratas a un músico de sesión para bolos o grabaciones, sí es habitual pagarle, y la tarifa varía mucho según la ciudad y la experiencia.' },
      { q: '¿Cuántos músicos debería probar antes de decidir?', a: 'No hay un número fijo, pero probar a dos o tres candidatos te da referencias para comparar. Decide más por actitud y encaje que por técnica pura.' },
      { q: '¿Qué hago si nadie responde a mi anuncio?', a: 'Revisa que sea concreto y que incluya música vuestra, amplía la zona de búsqueda y escribe tú directamente a perfiles que encajen en lugar de esperar.' },
    ],
    links: [
      { href: '/busco-musicos', label: 'Anuncios de bandas que buscan músicos' },
      { href: '/musicos', label: 'Buscar músicos por provincia e instrumento' },
      { href: '/locales-de-ensayo', label: 'Locales de ensayo cerca de ti' },
      { href: '/guias/como-encontrar-banda', label: 'Guía: cómo encontrar banda' },
    ],
  },

  {
    slug: 'local-de-ensayo-precio-y-consejos',
    title: 'Local de ensayo: precio y consejos para alquilar',
    description: 'Cuánto cuesta un local de ensayo, qué modalidades hay (por horas, compartido o fijo) y qué mirar antes de alquilar: insonorización, equipo, horarios y seguridad.',
    h1: 'Local de ensayo: cuánto cuesta y cómo elegirlo',
    answer: 'El precio de un local de ensayo depende sobre todo de la modalidad y de la ciudad: alquilar por horas suele rondar entre 8 y 20 euros la hora, y un local fijo compartido con otras bandas puede salir aproximadamente por 150 a 400 euros al mes a repartir entre el grupo. Antes de alquilar, revisa la insonorización, el equipo incluido, el acceso horario y la seguridad.',
    sections: [
      {
        h2: 'Modalidades de alquiler',
        paragraphs: [
          'Elegir bien la modalidad importa más que encontrar el local más barato. Lo que conviene depende de cuánto ensayáis y de si tenéis equipo propio.',
        ],
        bullets: [
          'Por horas: pagas solo cuando ensayas y el local suele incluir backline (batería, amplis, PA). Ideal si ensayáis poco o estáis empezando.',
          'Compartido: varias bandas se reparten un mismo local fijo por días u horarios. Es la opción más común en bandas estables.',
          'En exclusiva: el local es solo vuestro las 24 horas. Más caro, pero puedes dejar todo montado y ensayar cuando quieras.',
          'Bonos o tarifas mensuales: algunos centros ofrecen horas fijas a la semana a precio reducido.',
        ],
      },
      {
        h2: 'Cuánto cuesta un local de ensayo',
        paragraphs: [
          'No hay un precio oficial y varía mucho según la ciudad, el barrio y lo que incluye. Como orientación, el alquiler por horas suele rondar entre 8 y 20 euros la hora, más en salas grandes con buen equipo o en el centro de ciudades como Madrid o Barcelona. Un local fijo compartido suele moverse aproximadamente entre 150 y 400 euros al mes por banda, y uno en exclusiva puede superar eso con facilidad.',
          'Haz cuentas por persona y por mes. Si sois cuatro y ensayáis dos veces por semana tres horas, compara lo que os sale por horas con lo que costaría un fijo compartido: a partir de cierta frecuencia, el fijo casi siempre sale más a cuenta.',
        ],
      },
      {
        h2: 'Qué revisar antes de alquilar',
        steps: [
          'Insonorización: escucha desde fuera mientras toca otra banda y comprueba si se cuela el sonido de los locales vecinos.',
          'Equipo: qué incluye exactamente (batería con o sin platos, amplis, PA, micros) y en qué estado está.',
          'Acceso: horarios permitidos, si hay llave propia y si se puede cargar equipo cómodamente.',
          'Seguridad: alarma, cámaras, seguro del contenido y quién más tiene llave.',
          'Condiciones: fianza, permanencia mínima, qué se incluye en el precio (luz, limpieza) y cómo se avisa para dejarlo.',
          'Ubicación: aparcamiento, transporte público y distancia para todos los miembros.',
          'Ambiente: temperatura, ventilación y humedad, que afectan a la salud y al equipo.',
        ],
      },
      {
        h2: 'Cómo ahorrar en el local',
        bullets: [
          'Compartid local con otra banda de confianza y repartid días.',
          'Ensayad en horarios valle si el local tiene tarifas más baratas por la mañana o a primera hora de la tarde.',
          'Llevad los temas trabajados de casa: el local es para ensayar juntos, no para aprenderse las partes.',
          'Pactad un sistema claro de pagos dentro de la banda para que nadie adelante dinero de más.',
        ],
      },
      {
        h2: 'Dónde encontrar locales',
        paragraphs: [
          'Además de buscar en mapas y preguntar a otras bandas, en BandYou tienes un directorio de locales de ensayo por provincia, con fotos y contacto directo. Los propios locales son también un buen sitio para encontrar músicos o bandas con las que compartir gastos, porque allí está la gente que ensaya de forma regular.',
          'Visita siempre el local antes de pagar nada y, si puedes, haz una sesión suelta por horas para probar sonido y ambiente.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuánto cuesta alquilar un local de ensayo por horas?', a: 'Suele rondar entre 8 y 20 euros la hora, aunque varía según la ciudad y el equipo incluido. Las salas grandes con backline completo suelen estar en la parte alta.' },
      { q: '¿Qué es mejor, local por horas o fijo?', a: 'Por horas compensa si ensayáis poco o de forma irregular. Si ensayáis varias veces por semana o queréis dejar el equipo montado, un local fijo o compartido suele salir más barato por hora.' },
      { q: '¿Puedo ensayar con batería en casa en lugar de alquilar local?', a: 'Con batería acústica es difícil sin molestar a los vecinos, salvo que tengas una sala insonorizada. Una batería electrónica permite practicar en casa, pero para ensayar con toda la banda lo normal es usar un local.' },
      { q: '¿Qué debe incluir un local de ensayo?', a: 'Como mínimo, buena insonorización, tomas de corriente suficientes y un acceso cómodo. En los locales por horas lo habitual es que incluyan batería, amplis y equipo de voces.' },
      { q: '¿Se puede compartir un local de ensayo con otra banda?', a: 'Sí, es muy habitual. Dejad por escrito días, horarios, qué equipo se comparte y cómo se reparten los gastos para evitar malentendidos.' },
    ],
    links: [
      { href: '/locales-de-ensayo', label: 'Directorio de locales de ensayo' },
      { href: '/bandas', label: 'Bandas por provincia' },
      { href: '/guias/como-montar-una-banda', label: 'Guía: cómo montar una banda' },
    ],
  },

  {
    slug: 'como-conseguir-bolos',
    title: 'Cómo conseguir bolos para tu banda',
    description: 'Cómo conseguir bolos para tu banda: qué preparar antes de escribir a salas, cómo contactar con programadores, acuerdos habituales y cómo llenar tus conciertos.',
    h1: 'Cómo conseguir bolos y tocar en salas',
    answer: 'Para conseguir bolos necesitas un material mínimo (dos o tres temas bien grabados, fotos y un texto breve de presentación), un repertorio de al menos 40 minutos y una lista de salas y bares de tu zona que programen tu estilo. Escribe a cada programador de forma personalizada, ofrece fechas concretas, empieza por locales pequeños o compartiendo cartel y demuestra que puedes mover público.',
    sections: [
      {
        h2: 'Lo que necesitas antes de pedir fechas',
        paragraphs: [
          'Los programadores reciben muchas propuestas y dedican poco tiempo a cada una. Si no pueden escucharte en un minuto, pasan a la siguiente.',
        ],
        bullets: [
          'Música grabada: una maqueta o EP con dos o tres temas que suenen dignos. Un vídeo en directo bien grabado también sirve.',
          'Fotos de la banda con buena luz, en horizontal y vertical.',
          'Una presentación de tres o cuatro líneas: estilo, de dónde sois, referencias y lo más relevante que habéis hecho.',
          'Rider técnico sencillo: formación, equipo que lleváis y lo que necesitáis de la sala.',
          'Repertorio rodado de unos 40 a 60 minutos.',
        ],
      },
      {
        h2: 'Dónde tocar cuando estás empezando',
        paragraphs: [
          'Las salas con más aforo suelen pedir que demuestres que mueves gente. Por eso los primeros bolos casi siempre llegan de sitios más pequeños.',
        ],
        bullets: [
          'Bares con música en directo y pequeñas salas de tu barrio o ciudad.',
          'Carteles compartidos con otras bandas, que reparten público y gastos.',
          'Concursos y certámenes de bandas, municipales o de asociaciones.',
          'Fiestas de pueblo, eventos de asociaciones y ferias, sobre todo si hacéis versiones.',
          'Jams y noches de micro abierto para rodar temas delante de público.',
        ],
      },
      {
        h2: 'Cómo contactar con una sala',
        steps: [
          'Investiga qué programa la sala: estilos, días y si las bandas son locales o de gira.',
          'Busca el contacto de programación (suele estar en su web o redes) en lugar de escribir al correo general.',
          'Envía un correo breve y personalizado: quiénes sois, enlace a vuestra música, propuesta de dos o tres fechas y con qué otras bandas podríais compartir cartel.',
          'Si no responden en una o dos semanas, haz un único seguimiento educado.',
          'Cuando digan que sí, confirma por escrito horarios, prueba de sonido, condiciones económicas y quién se encarga de la promoción.',
        ],
      },
      {
        h2: 'Tipos de acuerdo habituales',
        paragraphs: [
          'En salas pequeñas lo más común es ir a taquilla: la banda se queda con un porcentaje de las entradas, a veces después de cubrir los gastos de la sala. También existe el caché fijo, más habitual en bares y fiestas, y en algunos sitios se pide alquilar la sala. Lee bien las condiciones y haz números antes de aceptar: alquilar una sala solo compensa si estás seguro de que vas a llenar.',
          'Como las condiciones cambian mucho según la ciudad y el local, pregunta a otras bandas de tu zona qué acuerdos les han ofrecido en cada sitio.',
        ],
      },
      {
        h2: 'Cómo llenar tus conciertos',
        paragraphs: [
          'Que la sala quiera repetir contigo depende sobre todo de cuánta gente traes. Anuncia la fecha con varias semanas de antelación, publica recordatorios y avisa personalmente a tu entorno. Compartir cartel con bandas que tengan público propio ayuda a todos.',
          'En BandYou puedes publicar tus conciertos para que aparezcan en la agenda de tu provincia, y cada mes puedes apuntar gratis un bolo a «La quedada de BandYou»: el día 20 a las 20:00 se sortea uno por provincia y se promociona en la portada de BandYou de esa provincia hasta el día del concierto. También tienes un directorio de salas de conciertos para localizar programadores.',
        ],
      },
    ],
    faq: [
      { q: '¿Cómo consigo mi primer concierto con mi banda?', a: 'Empieza por bares con música en directo, jams y carteles compartidos con otras bandas. Ten preparada una grabación y un repertorio de al menos 40 minutos antes de pedir fecha.' },
      { q: '¿Cuánto se cobra por un bolo?', a: 'Varía muchísimo según la ciudad, el tipo de local y si es por taquilla o caché fijo. Al empezar es habitual cobrar poco o ir a porcentaje de entradas; las bandas de versiones suelen tener más facilidad para cobrar un caché.' },
      { q: '¿Es normal pagar por tocar en una sala?', a: 'Algunas salas alquilan el espacio a las bandas, sobre todo en ciudades grandes. No es obligatorio aceptarlo: compara con otras salas que trabajen a taquilla y calcula si podrás cubrir el coste.' },
      { q: '¿Necesito un mánager para conseguir bolos?', a: 'No al principio. La mayoría de bandas emergentes gestionan sus fechas solas; un mánager o una agencia tienen sentido cuando ya hay demanda y giras que organizar.' },
      { q: '¿Cuántos temas necesito para dar un concierto?', a: 'Para un bolo completo, entre 10 y 15 temas o unos 45 a 60 minutos. En carteles compartidos a veces bastan 30 minutos.' },
    ],
    links: [
      { href: '/salas-de-conciertos', label: 'Salas de conciertos por provincia' },
      { href: '/quedada', label: 'La quedada de BandYou' },
      { href: '/conciertos', label: 'Agenda de conciertos' },
      { href: '/guias/como-montar-una-banda', label: 'Guía: cómo montar una banda' },
    ],
  },

  {
    slug: 'como-montar-una-banda',
    title: 'Cómo montar una banda de música paso a paso',
    description: 'Cómo montar una banda o formar un grupo de música paso a paso: definir el proyecto, buscar músicos, ensayar con método, grabar maqueta y dar tus primeros bolos.',
    h1: 'Cómo montar una banda paso a paso',
    answer: 'Para montar una banda, define primero el proyecto (estilo, versiones o temas propios y nivel de compromiso), reúne a los músicos que te faltan con un anuncio concreto, consigue un local de ensayo y fija una rutina semanal. Con un repertorio de unos 40 minutos y una grabación sencilla ya puedes empezar a buscar tus primeros bolos.',
    sections: [
      {
        h2: 'Paso 1: define el proyecto',
        paragraphs: [
          'Antes de buscar a nadie, decide qué banda quieres. ¿Versiones para tocar en bares y fiestas, o temas propios? ¿Qué estilo y qué bandas de referencia? ¿Cuántos ensayos a la semana? ¿Objetivo de pasarlo bien, de tocar a menudo o de grabar y girar? Escríbelo en pocas líneas: será la base de tu anuncio y evitará malentendidos más adelante.',
        ],
      },
      {
        h2: 'Paso 2: la formación',
        paragraphs: [
          'La formación clásica de rock es voz, guitarra, bajo y batería, pero no hay reglas: dúos, tríos con bajista cantante o grupos con teclados y vientos funcionan igual de bien. Lo importante es cubrir lo que pide tu estilo. Empieza por los puestos más difíciles de cubrir, que en casi todas las ciudades suelen ser batería y bajo.',
          'En BandYou puedes buscar músicos por provincia, instrumento y estilo y escribirles directamente, o publicar en el tablón «Se busca» que tu banda necesita músico. Prueba a cada candidato con un par de temas preparados antes de cerrar la formación.',
        ],
      },
      {
        h2: 'Paso 3: local de ensayo y equipo',
        paragraphs: [
          'Para empezar no hace falta un local fijo: alquilar por horas en un local con backline incluido es la forma más barata de comprobar si la banda funciona. Cuando tengáis una rutina estable, valorad compartir un local fijo con otra banda. El precio varía mucho según la ciudad, así que comparad varias opciones.',
          'Cada músico debería tener su instrumento en buen estado y lo básico para tocar en directo. El equipo grande, como PA o batería, se puede alquilar o compartir al principio.',
        ],
      },
      {
        h2: 'Paso 4: ensayar con método',
        steps: [
          'Fijad un día y una hora fijos a la semana y respetadlos.',
          'Repartid antes del ensayo los temas a trabajar para que cada uno llegue con su parte aprendida.',
          'Empezad con temas sencillos para coger confianza como grupo.',
          'Grabad los ensayos con el móvil y escuchadlos: es la forma más rápida de mejorar.',
          'Cerrad cada ensayo acordando qué toca preparar para el siguiente.',
          'Cuidad el volumen: si no os oís bien entre vosotros, bajad amplis antes de subir la voz. Un ensayo a volumen razonable cansa menos, protege los oídos y permite detectar fallos.',
        ],
      },
      {
        h2: 'Paso 5: organización y dinero',
        paragraphs: [
          'Hablar de dinero al principio evita la mayoría de peleas. Acordad cómo se reparten el local, las grabaciones y los desplazamientos, y cómo se reparte lo que se gane en bolos. Una hoja de cálculo compartida o un bote común funcionan bien.',
        ],
        bullets: [
          'Quién lleva las redes y el correo de la banda.',
          'Quién busca y negocia fechas.',
          'Cómo se toman las decisiones: por mayoría, por consenso o con alguien que lidere.',
          'Si hay temas propios, cómo se reparte la autoría.',
        ],
      },
      {
        h2: 'Paso 6: primera grabación y primeros bolos',
        paragraphs: [
          'Con unos 40 minutos de repertorio y una maqueta de dos o tres temas, ya podéis buscar bolos. Empezad por bares, jams y carteles compartidos, y publicad vuestros conciertos para que la gente de vuestra provincia los encuentre. Elegid también un nombre que no esté ya cogido: buscadlo en plataformas de streaming y redes antes de decidirlo. Para la maqueta no hace falta un estudio caro: una grabación en el local con buenos micros, o en un estudio pequeño por horas, es suficiente para enseñar a salas y programadores.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuántas personas hacen falta para formar un grupo de música?', a: 'Desde dos en adelante. La formación más habitual es de cuatro (voz, guitarra, bajo y batería), pero depende del estilo y de lo que cada uno pueda cubrir.' },
      { q: '¿Cuánto cuesta montar una banda?', a: 'Más allá de los instrumentos, el gasto principal es el local de ensayo, que varía mucho según la ciudad y la modalidad. Repartido entre los miembros suele ser asumible si empezáis alquilando por horas.' },
      { q: '¿Es mejor empezar con versiones o con temas propios?', a: 'Las versiones ayudan a coger rodaje como grupo y facilitan conseguir bolos. Muchas bandas combinan ambas cosas y van sustituyendo versiones por temas propios.' },
      { q: '¿Cómo elijo el nombre de la banda?', a: 'Busca algo fácil de recordar y de escribir, y comprueba que no lo use otra banda en plataformas de streaming y redes sociales.' },
      { q: '¿Cuánto tiempo tarda una banda en estar lista para tocar en directo?', a: 'Con ensayos semanales y músicos con algo de experiencia, unos meses suelen bastar para tener un repertorio presentable. Depende del nivel y de la constancia.' },
    ],
    links: [
      { href: '/busco-musicos', label: 'Anuncios de bandas que buscan músicos' },
      { href: '/locales-de-ensayo', label: 'Locales de ensayo por provincia' },
      { href: '/clases-de-musica', label: 'Profesores y clases de música' },
      { href: '/guias/como-conseguir-bolos', label: 'Guía: cómo conseguir bolos' },
    ],
  },
];

module.exports = { GUIDES };
