/** One square per province on a 10 × 9 tile map of Spain; `code` is the old number-plate code. */
export interface SpainTile { name: string; code: string; col: number; row: number }

export const SPAIN_COLS = 10;
export const SPAIN_ROWS = 9;

const ROWS: readonly (readonly [string, string, number][])[] = [
  [['A Coruña', 'C', 0], ['Lugo', 'LU', 1], ['Asturias', 'O', 2], ['Cantabria', 'S', 3], ['Vizcaya', 'BI', 4], ['Guipúzcoa', 'SS', 5]],
  [['Pontevedra', 'PO', 0], ['Ourense', 'OU', 1], ['León', 'LE', 2], ['Palencia', 'P', 3], ['Burgos', 'BU', 4], ['Álava', 'VI', 5],
   ['Navarra', 'NA', 6], ['Huesca', 'HU', 7], ['Lleida', 'L', 8], ['Girona', 'GI', 9]],
  [['Zamora', 'ZA', 2], ['Valladolid', 'VA', 3], ['Segovia', 'SG', 4], ['Soria', 'SO', 5], ['La Rioja', 'LO', 6], ['Zaragoza', 'Z', 7],
   ['Tarragona', 'T', 8], ['Barcelona', 'B', 9]],
  [['Salamanca', 'SA', 2], ['Ávila', 'AV', 3], ['Madrid', 'M', 4], ['Guadalajara', 'GU', 5], ['Teruel', 'TE', 6], ['Castellón', 'CS', 7]],
  [['Cáceres', 'CC', 2], ['Toledo', 'TO', 4], ['Cuenca', 'CU', 5], ['Valencia', 'V', 7], ['Islas Baleares', 'PM', 9]],
  [['Badajoz', 'BA', 2], ['Ciudad Real', 'CR', 4], ['Albacete', 'AB', 5], ['Murcia', 'MU', 6], ['Alicante', 'A', 7]],
  [['Huelva', 'H', 1], ['Sevilla', 'SE', 2], ['Córdoba', 'CO', 3], ['Jaén', 'J', 4], ['Granada', 'GR', 5], ['Almería', 'AL', 6]],
  [['Cádiz', 'CA', 2], ['Málaga', 'MA', 3]],
  [['Santa Cruz de Tenerife', 'TF', 0], ['Las Palmas', 'GC', 1], ['Ceuta', 'CE', 2], ['Melilla', 'ML', 4]],
];

export const SPAIN_TILES: readonly SpainTile[] = ROWS.flatMap((cells, row) => cells.map(([name, code, col]) => ({ name, code, col, row })));
