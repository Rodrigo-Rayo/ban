-- =============================================================
-- BANDYOU SEED DATA — ejecutar en Supabase SQL Editor
-- =============================================================
-- Crea 20 usuarios ficticios con perfiles variados para pruebas
-- =============================================================

DO $$
DECLARE
  u01 UUID := 'b1000000-0000-0000-0000-000000000001';
  u02 UUID := 'b1000000-0000-0000-0000-000000000002';
  u03 UUID := 'b1000000-0000-0000-0000-000000000003';
  u04 UUID := 'b1000000-0000-0000-0000-000000000004';
  u05 UUID := 'b1000000-0000-0000-0000-000000000005';
  u06 UUID := 'b1000000-0000-0000-0000-000000000006';
  u07 UUID := 'b1000000-0000-0000-0000-000000000007';
  u08 UUID := 'b1000000-0000-0000-0000-000000000008';
  u09 UUID := 'b1000000-0000-0000-0000-000000000009';
  u10 UUID := 'b1000000-0000-0000-0000-000000000010';
  u11 UUID := 'b1000000-0000-0000-0000-000000000011';
  u12 UUID := 'b1000000-0000-0000-0000-000000000012';
  u13 UUID := 'b1000000-0000-0000-0000-000000000013';
  u14 UUID := 'b1000000-0000-0000-0000-000000000014';
  u15 UUID := 'b1000000-0000-0000-0000-000000000015';
  u16 UUID := 'b1000000-0000-0000-0000-000000000016';
  u17 UUID := 'b1000000-0000-0000-0000-000000000017';
  u18 UUID := 'b1000000-0000-0000-0000-000000000018';
  u19 UUID := 'b1000000-0000-0000-0000-000000000019';
  u20 UUID := 'b1000000-0000-0000-0000-000000000020';
  band1_id UUID;
  band2_id UUID;
  band3_id UUID;
  band4_id UUID;
  venue1_id UUID;
  venue2_id UUID;
  venue3_id UUID;
BEGIN

-- ── USUARIOS EN auth.users ──────────────────────────────────
INSERT INTO auth.users (id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  (u01,'authenticated','authenticated','carlos.jimenez@bandyou.test',   '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'10 days', NOW(), '{"provider":"email"}','{}', false),
  (u02,'authenticated','authenticated','ana.rodriguez@bandyou.test',    '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'9 days',  NOW(), '{"provider":"email"}','{}', false),
  (u03,'authenticated','authenticated','david.garcia@bandyou.test',     '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'8 days',  NOW(), '{"provider":"email"}','{}', false),
  (u04,'authenticated','authenticated','laura.martinez@bandyou.test',   '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'7 days',  NOW(), '{"provider":"email"}','{}', false),
  (u05,'authenticated','authenticated','pablo.fernandez@bandyou.test',  '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'7 days',  NOW(), '{"provider":"email"}','{}', false),
  (u06,'authenticated','authenticated','sofia.lopez@bandyou.test',      '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'6 days',  NOW(), '{"provider":"email"}','{}', false),
  (u07,'authenticated','authenticated','miguel.sanchez@bandyou.test',   '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'6 days',  NOW(), '{"provider":"email"}','{}', false),
  (u08,'authenticated','authenticated','elena.torres@bandyou.test',     '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'5 days',  NOW(), '{"provider":"email"}','{}', false),
  (u09,'authenticated','authenticated','javier.ruiz@bandyou.test',      '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'5 days',  NOW(), '{"provider":"email"}','{}', false),
  (u10,'authenticated','authenticated','marta.diaz@bandyou.test',       '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'4 days',  NOW(), '{"provider":"email"}','{}', false),
  (u11,'authenticated','authenticated','diego.moreno@bandyou.test',     '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'4 days',  NOW(), '{"provider":"email"}','{}', false),
  (u12,'authenticated','authenticated','lucia.alvarez@bandyou.test',    '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'3 days',  NOW(), '{"provider":"email"}','{}', false),
  (u13,'authenticated','authenticated','andres.romero@bandyou.test',    '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'3 days',  NOW(), '{"provider":"email"}','{}', false),
  (u14,'authenticated','authenticated','isabel.navarro@bandyou.test',   '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'2 days',  NOW(), '{"provider":"email"}','{}', false),
  (u15,'authenticated','authenticated','raul.gutierrez@bandyou.test',   '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'2 days',  NOW(), '{"provider":"email"}','{}', false),
  (u16,'authenticated','authenticated','carmen.molina@bandyou.test',    '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'2 days',  NOW(), '{"provider":"email"}','{}', false),
  (u17,'authenticated','authenticated','victor.castillo@bandyou.test',  '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'1 day',   NOW(), '{"provider":"email"}','{}', false),
  (u18,'authenticated','authenticated','nuria.vega@bandyou.test',       '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'1 day',   NOW(), '{"provider":"email"}','{}', false),
  (u19,'authenticated','authenticated','sala.roxy@bandyou.test',        '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'1 day',   NOW(), '{"provider":"email"}','{}', false),
  (u20,'authenticated','authenticated','ensayo.central@bandyou.test',   '$2a$10$zSEEDbseedbandy0uu0000000000000000000000000000000000000', NOW(), NOW()-INTERVAL'12 hours',NOW(), '{"provider":"email"}','{}', false)
ON CONFLICT (id) DO NOTHING;


-- ── MÚSICOS ─────────────────────────────────────────────────
INSERT INTO musicians (user_id, name, city, instrument, genre, level, description, contact_email, availability_days, created_at)
VALUES
  (u01, 'Carlos Jiménez',  'Madrid',    'Guitarra',   'Rock',       'profesional', 'Guitarrista eléctrico con 15 años de experiencia en bandas de rock y metal. Busco proyecto serio.',         'carlos.jimenez@bandyou.test', ARRAY['Lunes','Miércoles','Viernes'], NOW()-INTERVAL'10 days'),
  (u02, 'Ana Rodríguez',   'Madrid',    'Voz',        'Pop',        'profesional', 'Vocalista con formación en conservatorio. Estilo pop-rock con mucho feeling. Disponible para directos.',      'ana.rodriguez@bandyou.test',  ARRAY['Martes','Jueves','Sábado'],   NOW()-INTERVAL'9 days'),
  (u03, 'David García',    'Barcelona', 'Bajo',       'Jazz',       'avanzado',    'Bajista jazzero formado en ESMUC. Busco grupo de jazz moderno o fusión para actuar en directo.',             'david.garcia@bandyou.test',   ARRAY['Lunes','Jueves'],             NOW()-INTERVAL'8 days'),
  (u04, 'Laura Martínez',  'Sevilla',   'Batería',    'Flamenco',   'avanzado',    'Baterista con base en flamenco y jazz. Llevo 10 años tocando en grupos de flamenco-fusión en Sevilla.',      'laura.martinez@bandyou.test', ARRAY['Miércoles','Sábado','Domingo'],NOW()-INTERVAL'7 days'),
  (u05, 'Pablo Fernández', 'Valencia',  'Teclados',   'Electrónica','avanzado',    'Tecladista y productor electrónico. Mezclo influencias de house, techno y jazz para proyectos alternativos.','pablo.fernandez@bandyou.test',ARRAY['Viernes','Sábado'],           NOW()-INTERVAL'7 days'),
  (u06, 'Sofía López',     'Bilbao',    'Guitarra',   'Indie',      'intermedio',  'Guitarrista indie-pop buscando banda con ganas de hacer conciertos y grabar demos. Influencias: Superchunk, Pavement.','sofia.lopez@bandyou.test',ARRAY['Lunes','Miércoles','Sábado'],NOW()-INTERVAL'6 days'),
  (u07, 'Miguel Sánchez',  'Madrid',    'Saxofón',    'Jazz',       'profesional', 'Saxofonista profesional. He tocado con orquestas y combos de jazz en Madrid y Lisboa. Busco nuevos proyectos.','miguel.sanchez@bandyou.test',ARRAY['Martes','Jueves','Viernes'], NOW()-INTERVAL'6 days'),
  (u08, 'Elena Torres',    'Barcelona', 'Violín',     'Clásico',    'profesional', 'Violinista clásica dispuesta a explorar fusiones con pop, flamenco o bandas de cámara contemporáneas.',      'elena.torres@bandyou.test',   ARRAY['Lunes','Miércoles','Viernes'], NOW()-INTERVAL'5 days'),
  (u09, 'Javier Ruiz',     'Málaga',    'Guitarra',   'Blues',      'avanzado',    'Guitarra blues y rock sureño. 8 años tocando en bares y festivales de Málaga y Andalucía. Busco banda.',     'javier.ruiz@bandyou.test',    ARRAY['Jueves','Viernes','Sábado'],  NOW()-INTERVAL'5 days'),
  (u10, 'Marta Díaz',      'Madrid',    'Percusión',  'Funk',       'avanzado',    'Percusionista funk-latina. Congas, cajón y batería. Busco grupo para directos en Madrid capital.',           'marta.diaz@bandyou.test',     ARRAY['Miércoles','Sábado','Domingo'],NOW()-INTERVAL'4 days')
ON CONFLICT (user_id) DO NOTHING;


-- ── BANDAS ──────────────────────────────────────────────────
INSERT INTO bands (user_id, name, city, genre, description, contact_email, created_at)
VALUES
  (u11, 'Los Despistados',     'Madrid',    'Rock',       'Banda de rock alternativo madrileño formada en 2018. Influencias: Pixies, Dinosaur Jr. Buscamos batería.', 'losdespistados@bandyou.test',  NOW()-INTERVAL'4 days'),
  (u12, 'Sal y Cuerdas',       'Sevilla',   'Flamenco',   'Fusión flamenca contemporánea con elementos de jazz y electrónica. Actuamos en festivales y teatros.',     'salycuerdas@bandyou.test',     NOW()-INTERVAL'3 days'),
  (u13, 'Neón Fantasma',       'Barcelona', 'Electrónica','Proyecto electro-pop barcelonés. Synth-pop con letras en castellano. Buscamos vocalista femenina.',         'neonfantasma@bandyou.test',    NOW()-INTERVAL'3 days'),
  (u14, 'Bruma y Acero',       'Bilbao',    'Metal',      'Metal progresivo vasco. Influencias: Tool, Opeth, Mastodon. Llevamos 5 años juntos, 2 EPs publicados.',    'brumayacero@bandyou.test',     NOW()-INTERVAL'2 days')
ON CONFLICT (user_id) DO NOTHING;

SELECT id INTO band1_id FROM bands WHERE user_id = u11 LIMIT 1;
SELECT id INTO band2_id FROM bands WHERE user_id = u12 LIMIT 1;
SELECT id INTO band3_id FROM bands WHERE user_id = u13 LIMIT 1;
SELECT id INTO band4_id FROM bands WHERE user_id = u14 LIMIT 1;


-- ── VACANTES DE BANDAS ───────────────────────────────────────
INSERT INTO band_vacancies (band_id, instrument, genre, description, open, created_at)
VALUES
  (band1_id, 'Batería',   'Rock',       'Buscamos batería con experiencia en rock alternativo. Ensayamos en Lavapiés los lunes.',     true, NOW()-INTERVAL'3 days'),
  (band3_id, 'Voz',       'Electrónica','Buscamos vocalista para proyecto synth-pop. Buena imagen y ganas de actuar en festivales.', true, NOW()-INTERVAL'2 days'),
  (band4_id, 'Guitarra',  'Metal',      'Segunda guitarra para banda de metal prog. Necesitas técnica y poder ensayar en Bilbao.',    true, NOW()-INTERVAL'1 day')
ON CONFLICT DO NOTHING;


-- ── SALAS / VENUES ──────────────────────────────────────────
INSERT INTO venues (user_id, name, city, capacity, genres, description, contact_email, address, created_at)
VALUES
  (u15, 'Sala Caracol',    'Madrid',    300, ARRAY['Rock','Indie','Metal'],  'Sala clásica de Madrid en Carabanchel. Escenario, sonido profesional y equipo de luces. Aforo 300 personas.', 'sala.caracol@bandyou.test',  'Calle Bernardo del Carpio, 17, Madrid',    NOW()-INTERVAL'2 days'),
  (u16, 'La 2 de Apolo',   'Barcelona', 800, ARRAY['Electrónica','Pop','Indie'],'Sala de referencia en Barcelona para electrónica y pop alternativo. Programación semanal.',                'la2deapolo@bandyou.test',    'Carrer de la Nou de la Rambla, 113, Barcelona', NOW()-INTERVAL'2 days'),
  (u19, 'Sala Roxy',       'Sevilla',   150, ARRAY['Rock','Blues','Flamenco'], 'Sala íntima en el Casco Antiguo de Sevilla. Perfecta para directos de rock, blues y fusión flamenca.',      'sala.roxy@bandyou.test',     'Calle Betis, 23, Sevilla',                  NOW()-INTERVAL'1 day')
ON CONFLICT (user_id) DO NOTHING;

SELECT id INTO venue1_id FROM venues WHERE user_id = u15 LIMIT 1;
SELECT id INTO venue2_id FROM venues WHERE user_id = u16 LIMIT 1;
SELECT id INTO venue3_id FROM venues WHERE user_id = u19 LIMIT 1;


-- ── PROFESORES ──────────────────────────────────────────────
INSERT INTO teachers (user_id, name, city, instrument, level, hourly_rate, description, contact_email, modality, experience_years, created_at)
VALUES
  (u17, 'Víctor Castillo', 'Madrid',    'Guitarra',   'profesional', 40, 'Guitarrista y profesor con 12 años de experiencia. Imparto clases de guitarra eléctrica y acústica para todos los niveles.', 'victor.castillo@bandyou.test', 'presencial', 12, NOW()-INTERVAL'1 day'),
  (u18, 'Nuria Vega',      'Barcelona', 'Piano',      'profesional', 35, 'Pianista titulada por el Conservatori Superior de Barcelona. Clases de piano clásico, jazz y composición para adultos y niños.','nuria.vega@bandyou.test',      'online',     15, NOW()-INTERVAL'1 day')
ON CONFLICT (user_id) DO NOTHING;


-- ── LOCALES DE ENSAYO ────────────────────────────────────────
INSERT INTO rehearsal_spaces (user_id, name, city, capacity, hourly_rate, description, contact_email, address, created_at)
VALUES
  (u20, 'Estudios Central', 'Madrid',    10, 12, '5 salas de ensayo insonorizadas en el centro de Madrid. Batería, amplificadores y PA incluidos. Parking disponible.', 'ensayo.central@bandyou.test', 'Calle Gran Vía, 45, Madrid',      NOW()-INTERVAL'12 hours')
ON CONFLICT (user_id) DO NOTHING;


-- ── EVENTOS ─────────────────────────────────────────────────
INSERT INTO events (user_id, title, venue, city, date, time, genre, description, contact_email, created_at)
VALUES
  (u11, 'Los Despistados en Caracol',  'Sala Caracol',    'Madrid',    (NOW()+INTERVAL'5 days')::date,  '21:00', 'Rock',       'Concierto de presentación del nuevo single. Entrada libre hasta completar aforo.',     'losdespistados@bandyou.test', NOW()-INTERVAL'2 days'),
  (u12, 'Sal y Cuerdas — Flamenco Vivo','La Peña Flamenca','Sevilla',  (NOW()+INTERVAL'8 days')::date,  '22:00', 'Flamenco',   'Noche de fusión flamenca con elementos de jazz modal. Aforo limitado, reserva ya.',   'salycuerdas@bandyou.test',    NOW()-INTERVAL'1 day'),
  (u13, 'Neón Fantasma + DJ Set',      'La 2 de Apolo',   'Barcelona', (NOW()+INTERVAL'10 days')::date, '23:00', 'Electrónica','Noche electro-pop en La 2 de Apolo. Neón Fantasma + DJ invitado. Entradas: 10€.',     'neonfantasma@bandyou.test',   NOW()-INTERVAL'1 day'),
  (u07, 'Jazz en el Centro',           'Café Central',    'Madrid',    (NOW()+INTERVAL'3 days')::date,  '20:30', 'Jazz',       'Sesión de jazz en Café Central con Miguel Sánchez y su cuarteto. Entrada: 8€.',       'miguel.sanchez@bandyou.test', NOW()-INTERVAL'3 days'),
  (u14, 'Bruma y Acero — Metal Fest',  'Sala Azkena',     'Bilbao',    (NOW()+INTERVAL'14 days')::date, '20:00', 'Metal',      'Metal progresivo en Bilbao. Bruma y Acero cierra el cartel del Metal Fest Bizkai.',   'brumayacero@bandyou.test',    NOW()-INTERVAL'4 hours')
ON CONFLICT DO NOTHING;


-- ── ANUNCIOS / POSTS ────────────────────────────────────────
INSERT INTO posts (user_id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at)
SELECT u01, 'musician_seeking_band',  'Guitarrista eléctrico con 15 años de experiencia busca banda de rock alternativo en Madrid. Influencias Pixies, QOTSA. Disponible lunes, miércoles y viernes.',
       'Madrid', 'Guitarra', 'Carlos Jiménez', 'musician', m.id, NOW()-INTERVAL'6 days'
FROM musicians m WHERE m.user_id = u01 LIMIT 1;

INSERT INTO posts (user_id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at)
SELECT u11,'band_seeking_musician',   'Los Despistados buscan batería. Somos banda de rock alternativo con 4 años de rodaje. Ensayamos en Lavapiés. Buscamos alguien con experiencia y buen rollo.',
       'Madrid', 'Batería', 'Los Despistados', 'band', b.id, NOW()-INTERVAL'3 days'
FROM bands b WHERE b.user_id = u11 LIMIT 1;

INSERT INTO posts (user_id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at)
SELECT u03,'musician_seeking_band',   'Bajista de jazz busca grupo para tocar estándares y composiciones propias. Formado en ESMUC, disponible lunes y jueves en Barcelona.',
       'Barcelona', 'Bajo', 'David García', 'musician', m.id, NOW()-INTERVAL'2 days'
FROM musicians m WHERE m.user_id = u03 LIMIT 1;

INSERT INTO posts (user_id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at)
SELECT u07,'session_offer',           'Saxofonista profesional disponible para sesiones de grabación y directos en Madrid. Jazz, funk, pop. Presupuesto sin compromiso.',
       'Madrid', 'Saxofón', 'Miguel Sánchez', 'musician', m.id, NOW()-INTERVAL'1 day'
FROM musicians m WHERE m.user_id = u07 LIMIT 1;

INSERT INTO posts (user_id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at)
SELECT u06,'musician_seeking_band',   'Guitarrista indie busca proyecto en Bilbao. Me gusta hacer cosas originales, nada de covers. Disponible fines de semana.',
       'Bilbao', 'Guitarra', 'Sofía López', 'musician', m.id, NOW()-INTERVAL'5 hours'
FROM musicians m WHERE m.user_id = u06 LIMIT 1;


-- ── EQUIPO EN VENTA ─────────────────────────────────────────
INSERT INTO gear_listings (user_id, title, price, condition, category, city, description, status, created_at)
VALUES
  (u01, 'Fender Stratocaster Player Series',       650,  'bueno',         'Guitarras',       'Madrid',    'Strat Player 2021 en azul oceano. Pastillas Alnico V originales. Algún pequeño rasguño en el cuerpo, nada relevante. Con funda.', 'active', NOW()-INTERVAL'5 days'),
  (u03, 'Bajo Fender Jazz Bass MIM',               480,  'muy bueno',     'Bajos',           'Barcelona', 'Jazz Bass Mexico 2019. Trastes perfectos, electrónica original impecable. Cambié las clavijas a Hipshot. Con estuche rígido.',    'active', NOW()-INTERVAL'4 days'),
  (u05, 'Roland Juno-DS61 Sintetizador',           420,  'como nuevo',    'Teclados',        'Valencia',  'Comprado hace 1 año para un proyecto que no cuajó. En perfecto estado, apenas usado. Incluye adaptador y soporte K&M.',          'active', NOW()-INTERVAL'3 days'),
  (u04, 'Zildjian A Custom 14" HiHat',             180,  'bueno',         'Percusión',       'Sevilla',   'Platos Zildjian A Custom 14 pulgadas. Buen sonido, alguna pequeña mancha de aceite pero funcionando perfectamente.',              'active', NOW()-INTERVAL'2 days'),
  (u07, 'Micrófono Shure SM7B',                    320,  'bueno',         'Micrófonos',      'Madrid',    'SM7B usado en home studio durante 2 años. Perfecto para voz, podcast o grabación. Incluye soporte y cable XLR de calidad.',       'active', NOW()-INTERVAL'1 day'),
  (u08, 'Amplificador Marshall DSL20CR Combo',     550,  'muy bueno',     'Amplificadores',  'Barcelona', 'Marshall DSL20 combo impecable. Lo he usado poco, está como nuevo. Potencia conmutable 20W/5W. Sin golpes ni problemas.',         'active', NOW()-INTERVAL'8 hours')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Seed data inserted successfully!';
END $$;
