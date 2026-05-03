export const CITIES = [
  'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao',
  'Málaga', 'Zaragoza', 'Granada', 'Murcia', 'Alicante',
  'Córdoba', 'Valladolid', 'San Sebastián', 'Pamplona',
  'Las Palmas', 'Santa Cruz de Tenerife', 'Palma', 'Otra',
];

export const CITIES_WITH_ALL = ['Toda España', ...CITIES];

export const CITY_COORDS: Record<string, [number, number]> = {
  'Madrid':                  [40.4168, -3.7038],
  'Barcelona':               [41.3874,  2.1686],
  'Valencia':                [39.4699, -0.3763],
  'Sevilla':                 [37.3891, -5.9845],
  'Bilbao':                  [43.2630, -2.9350],
  'Málaga':                  [36.7213, -4.4214],
  'Zaragoza':                [41.6561, -0.8773],
  'Granada':                 [37.1773, -3.5986],
  'Murcia':                  [37.9922, -1.1307],
  'Alicante':                [38.3452, -0.4810],
  'Córdoba':                 [37.8882, -4.7794],
  'Valladolid':              [41.6523, -4.7245],
  'San Sebastián':           [43.3183, -1.9812],
  'Pamplona':                [42.8169, -1.6432],
  'Las Palmas':              [28.1235, -15.4363],
  'Santa Cruz de Tenerife':  [28.4636, -16.2518],
  'Palma':                   [39.5696,  2.6502],
  'Otra':                    [40.2000, -3.5000],
};
