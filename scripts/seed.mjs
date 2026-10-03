const URL = 'https://yxaurffzwtqsckfmnzdj.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXVyZmZ6d3Rxc2NrZm1uemRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTE2ODIsImV4cCI6MjA5MjI4NzY4Mn0.GUbfyBpaP8W_LFIT9IfMjuszgw-J87ANhOAJY8Tpj1E';

const headers = {
  'Content-Type': 'application/json',
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Prefer': 'return=representation',
};

async function insert(table, rows) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  const data = await res.json();
  if (!res.ok || data?.code) {
    console.error(`❌ ${table}:`, data?.message || data);
  } else {
    console.log(`✅ ${table}: ${data.length} registros insertados`);
  }
}

// ── Tablas SIN RLS (o con policy pública) ───────────────────────────────────
// musicians y bands — insertamos para descubrir columnas reales

await insert('musicians', [
  { name: 'Carlos Ruiz',      instrument: 'Guitarra',  genre: 'Rock',        city: 'Madrid',    available: true,  description: 'Guitarrista con 12 años de experiencia en bandas de rock y blues. Disponible para directos y grabaciones.' },
  { name: 'Laura Sánchez',    instrument: 'Piano',     genre: 'Jazz',        city: 'Barcelona', available: true,  description: 'Pianista de jazz formada en el Conservatorio Superior de Barcelona. Busco proyectos de fusión y sesiones.' },
  { name: 'Miguel Torres',    instrument: 'Bajo',      genre: 'Funk',        city: 'Valencia',  available: false, description: 'Bajista con amplia trayectoria en la escena funk y R&B valenciana. En gira hasta octubre.' },
  { name: 'Ana García',       instrument: 'Voz',       genre: 'Pop',         city: 'Sevilla',   available: true,  description: 'Cantante con formación en técnica vocal clásica y pop contemporáneo. Lista para colaboraciones.' },
  { name: 'Pablo Martínez',   instrument: 'Batería',   genre: 'Rock',        city: 'Madrid',    available: true,  description: 'Batería de rock y metal con estudio propio en Madrid. Sesiones de grabación y directo.' },
  { name: 'Elena López',      instrument: 'Violín',    genre: 'Clásica',     city: 'Barcelona', available: false, description: 'Violinista de orquesta con pasión por la fusión entre clásica y música contemporánea.' },
  { name: 'Javier Rodríguez', instrument: 'Guitarra',  genre: 'Flamenco',    city: 'Sevilla',   available: true,  description: 'Guitarrista flamenco con actuaciones internacionales. Disponible para tablaos y festivales.' },
  { name: 'Sofía Hernández',  instrument: 'Teclados',  genre: 'Electrónica', city: 'Madrid',    available: true,  description: 'Productora y teclista de electrónica y synthpop. Busco proyectos de live act.' },
  { name: 'Diego Fernández',  instrument: 'Trompeta',  genre: 'Jazz',        city: 'Bilbao',    available: false, description: 'Trompetista de jazz y big band. Formado en Berklee Valencia.' },
  { name: 'Marta Jiménez',    instrument: 'Voz',       genre: 'Indie',       city: 'Valencia',  available: true,  description: 'Cantante indie con influencias del folk y el dream pop. Busco banda estable.' },
  { name: 'Rubén Alonso',     instrument: 'Guitarra',  genre: 'Blues',       city: 'Madrid',    available: true,  description: 'Guitarra slide y blues desde hace 8 años. Disponible para jams y proyectos.' },
  { name: 'Cristina Morales', instrument: 'Saxofón',   genre: 'Jazz',        city: 'Barcelona', available: true,  description: 'Saxofonista de jazz y latin jazz. Abierta a nuevos proyectos.' },
]);

await insert('bands', [
  { name: 'Los Relojes Rotos', genre: 'Rock',        city: 'Madrid',    description: 'Banda de rock alternativo con 3 años de trayectoria. Hemos tocado en Sala El Sol y La Riviera.' },
  { name: 'Blue Note Quartet', genre: 'Jazz',        city: 'Barcelona', description: 'Cuarteto de jazz estándar. Tocamos regularmente en los principales clubes de Barcelona.' },
  { name: 'Noche Sin Luna',    genre: 'Indie',       city: 'Valencia',  description: 'Trío indie con sonido cercano al shoegaze y el post-punk. Tenemos EP publicado.' },
  { name: 'La Marea',          genre: 'Flamenco',    city: 'Sevilla',   description: 'Grupo de flamenco fusión con influencias del jazz. Actuamos en festivales nacionales.' },
  { name: 'Voltage',           genre: 'Electrónica', city: 'Madrid',    description: 'Dúo de música electrónica con directo elaborado. Síntesis analógica y samplers.' },
  { name: 'Trío Sin Nombre',   genre: 'Jazz',        city: 'Bilbao',    description: 'Trío de jazz moderno con influencias del ECM. Ensayamos dos veces por semana.' },
]);

// ── Tablas CON RLS → generamos SQL para pegar en Supabase ───────────────────
const d = (days) => {
  const date = new Date('2026-04-21');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const events = [
  { title: 'Noche de Jazz en Sala Clamores',  venue: 'Sala Clamores',           city: 'Madrid',    date: d(3),  time: '21:00', genre: 'Jazz',        price: '8€',     description: 'Una velada de jazz estándar con el trío de Carlos Blanco.' },
  { title: 'Rock en el Palau',                venue: 'Palau de la Música',      city: 'Barcelona', date: d(5),  time: '20:30', genre: 'Rock',        price: '15€',    description: 'Festival de rock independiente con 4 bandas en cartel.' },
  { title: 'Concierto Acústico en el Carmen', venue: 'Café El Carmen',          city: 'Valencia',  date: d(7),  time: '20:00', genre: 'Indie',       price: 'Gratis', description: 'Sesión acústica de Noche Sin Luna.' },
  { title: 'Festival Flamenco de Primavera',  venue: 'Teatro de la Maestranza', city: 'Sevilla',   date: d(10), time: '19:00', genre: 'Flamenco',    price: '20€',    description: 'La Marea presenta su nuevo espectáculo.' },
  { title: 'Blues Night at The Hobbit',       venue: 'The Hobbit Club',         city: 'Bilbao',    date: d(12), time: '22:00', genre: 'Blues',       price: '5€',     description: 'Jam session de blues abierta a todos.' },
  { title: 'Electrónica Underground',         venue: 'Sala Arena',              city: 'Madrid',    date: d(18), time: '23:00', genre: 'Electrónica', price: '12€',    description: 'Voltage presenta su nuevo live act.' },
  { title: 'Clásicos del Jazz en el Jamboree',venue: 'Jazz Club Jamboree',      city: 'Barcelona', date: d(21), time: '21:30', genre: 'Jazz',        price: '10€',    description: 'Blue Note Quartet interpreta estándares del jazz.' },
];

const teachers = [
  { name: 'Carlos Blanco', instrument: 'Guitarra', city: 'Madrid',    hourly_rate: 25, description: 'Clases de guitarra para todos los niveles. Teoría musical aplicada.' },
  { name: 'Isabel Moreno', instrument: 'Piano',    city: 'Barcelona', hourly_rate: 30, description: 'Profesora de piano: clásico, jazz y pop. Niños desde 6 años y adultos.' },
  { name: 'Ramón Díaz',    instrument: 'Batería',  city: 'Madrid',    hourly_rate: 22, description: 'Rock, jazz y percusión latinoamericana. Estudio propio.' },
  { name: 'Carmen Vega',   instrument: 'Voz',      city: 'Sevilla',   hourly_rate: 35, description: 'Técnica vocal para pop, rock y flamenco. Conservatorio Superior.' },
  { name: 'Tomás Ruiz',    instrument: 'Bajo',     city: 'Valencia',  hourly_rate: 20, description: 'Fundamentos, lectura de partituras, slap y técnicas avanzadas.' },
  { name: 'Nuria Castro',  instrument: 'Violín',   city: 'Barcelona', hourly_rate: 28, description: 'Clásica desde iniciación hasta preparación de conservatorio.' },
];

const rehearsal_spaces = [
  { name: 'Sala Ensayo Centro', city: 'Madrid',    hourly_rate: 15, capacity: 5, description: 'Local insonorizado en el centro. Batería, amplificadores y PA incluidos.' },
  { name: 'El Garaje Musical',  city: 'Barcelona', hourly_rate: 12, capacity: 6, description: 'Espacio en Gràcia con tres salas equipadas. Mensualidades disponibles.' },
  { name: 'Estudios La Nave',   city: 'Valencia',  hourly_rate: 10, capacity: 8, description: 'Nave industrial reconvertida. 4 salas con aislamiento profesional.' },
  { name: 'Sala Rock Sur',      city: 'Sevilla',   hourly_rate: 8,  capacity: 5, description: 'Especializada en rock y metal. Backline completo y buen precio.' },
  { name: 'Studio Norte',       city: 'Bilbao',    hourly_rate: 14, capacity: 4, description: 'Dos salas compactas para grupos de hasta 4 músicos.' },
];

function toSQL(table, rows) {
  const cols = Object.keys(rows[0]);
  const vals = rows.map(r =>
    `(${cols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'number') return v;
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ')})`
  ).join(',\n  ');
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n  ${vals};`;
}

console.log('\n📋 Copia y ejecuta este SQL en: Supabase → SQL Editor\n');
console.log('-- Deshabilita RLS temporalmente, inserta y vuelve a activar\n');
console.log(toSQL('events', events));
console.log('\n' + toSQL('teachers', teachers));
console.log('\n' + toSQL('rehearsal_spaces', rehearsal_spaces));
