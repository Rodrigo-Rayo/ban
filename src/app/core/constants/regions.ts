/**
 * Provinces, states or departments of the Spanish-speaking countries outside Spain, for profiles and ads.
 * Built from country-region-data (MIT, ISO 3166-2) with hand fixes: Puerto Rico's municipalities, the
 * Dominican Republic's provinces, accents and the names people actually use. Spain keeps CITIES (cities.ts).
 * Names are written as people use them there; update by hand if a country renames a region.
 */
export interface Country {
  code: string;
  name: string;
  /** What a region is called there: Provincia, Estado, Departamento… */
  division: string;
  regions: readonly string[];
}

export const COUNTRIES: readonly Country[] = [
  { code: 'AR', name: 'Argentina', division: 'Provincia', regions: [
    'Buenos Aires (provincia)', 'Catamarca', 'Chaco', 'Chubut', 'Ciudad de Buenos Aires', 'Córdoba', 'Corrientes',
    'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
    'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego',
    'Tucumán',
  ] },
  { code: 'BO', name: 'Bolivia', division: 'Departamento', regions: [
    'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija',
  ] },
  { code: 'CL', name: 'Chile', division: 'Región', regions: [
    'Antofagasta', 'Arica y Parinacota', 'Atacama', 'Aysén', 'Biobío', 'Coquimbo', 'La Araucanía', 'Los Lagos',
    'Los Ríos', 'Magallanes', 'Maule', 'Ñuble', 'O\'Higgins', 'Región Metropolitana', 'Tarapacá', 'Valparaíso',
  ] },
  { code: 'CO', name: 'Colombia', division: 'Departamento', regions: [
    'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare',
    'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
    'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
    'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
  ] },
  { code: 'CR', name: 'Costa Rica', division: 'Provincia', regions: [
    'Alajuela', 'Cartago', 'Guanacaste', 'Heredia', 'Limón', 'Puntarenas', 'San José',
  ] },
  { code: 'CU', name: 'Cuba', division: 'Provincia', regions: [
    'Artemisa', 'Camagüey', 'Ciego de Ávila', 'Cienfuegos', 'Granma', 'Guantánamo', 'Holguín',
    'Isla de la Juventud', 'La Habana', 'Las Tunas', 'Matanzas', 'Mayabeque', 'Pinar del Río', 'Sancti Spíritus',
    'Santiago de Cuba', 'Villa Clara',
  ] },
  { code: 'EC', name: 'Ecuador', division: 'Provincia', regions: [
    'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas',
    'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha',
    'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
  ] },
  { code: 'SV', name: 'El Salvador', division: 'Departamento', regions: [
    'Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión', 'Morazán',
    'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután',
  ] },
  { code: 'GT', name: 'Guatemala', division: 'Departamento', regions: [
    'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 'Escuintla', 'Guatemala',
    'Huehuetenango', 'Izabal', 'Jalapa', 'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu',
    'Sacatepéquez', 'San Marcos', 'Santa Rosa', 'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa',
  ] },
  { code: 'GQ', name: 'Guinea Ecuatorial', division: 'Provincia', regions: [
    'Annobón', 'Bioko Norte', 'Bioko Sur', 'Centro Sur', 'Kié-Ntem', 'Litoral', 'Wele-Nzas',
  ] },
  { code: 'HN', name: 'Honduras', division: 'Departamento', regions: [
    'Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés', 'El Paraíso', 'Francisco Morazán',
    'Gracias a Dios', 'Intibucá', 'Islas de la Bahía', 'La Paz', 'Lempira', 'Ocotepeque', 'Olancho',
    'Santa Bárbara', 'Valle', 'Yoro',
  ] },
  { code: 'MX', name: 'México', division: 'Estado', regions: [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
    'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
    'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo',
    'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
    'Zacatecas',
  ] },
  { code: 'NI', name: 'Nicaragua', division: 'Departamento', regions: [
    'Boaco', 'Carazo', 'Chinandega', 'Chontales', 'Costa Caribe Norte', 'Costa Caribe Sur', 'Estelí', 'Granada',
    'Jinotega', 'León', 'Madriz', 'Managua', 'Masaya', 'Matagalpa', 'Nueva Segovia', 'Río San Juan', 'Rivas',
  ] },
  { code: 'PA', name: 'Panamá', division: 'Provincia', regions: [
    'Bocas del Toro', 'Chiriquí', 'Coclé', 'Colón', 'Darién', 'Emberá-Wounaan', 'Guna Yala', 'Herrera',
    'Los Santos', 'Ngäbe-Buglé', 'Panamá', 'Panamá Oeste', 'Veraguas',
  ] },
  { code: 'PY', name: 'Paraguay', division: 'Departamento', regions: [
    'Alto Paraguay', 'Alto Paraná', 'Amambay', 'Asunción', 'Boquerón', 'Caaguazú', 'Caazapá', 'Canindeyú',
    'Central', 'Concepción', 'Cordillera', 'Guairá', 'Itapúa', 'Misiones', 'Ñeembucú', 'Paraguarí',
    'Presidente Hayes', 'San Pedro',
  ] },
  { code: 'PE', name: 'Perú', division: 'Región', regions: [
    'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica',
    'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima Metropolitana', 'Lima Provincias', 'Loreto',
    'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
  ] },
  { code: 'PR', name: 'Puerto Rico', division: 'Municipio', regions: [
    'Adjuntas', 'Aguada', 'Aguadilla', 'Aguas Buenas', 'Aibonito', 'Añasco', 'Arecibo', 'Arroyo', 'Barceloneta',
    'Barranquitas', 'Bayamón', 'Cabo Rojo', 'Caguas', 'Camuy', 'Canóvanas', 'Carolina', 'Cataño', 'Cayey', 'Ceiba',
    'Ciales', 'Cidra', 'Coamo', 'Comerío', 'Corozal', 'Culebra', 'Dorado', 'Fajardo', 'Florida', 'Guánica',
    'Guayama', 'Guayanilla', 'Guaynabo', 'Gurabo', 'Hatillo', 'Hormigueros', 'Humacao', 'Isabela', 'Jayuya',
    'Juana Díaz', 'Juncos', 'Lajas', 'Lares', 'Las Marías', 'Las Piedras', 'Loíza', 'Luquillo', 'Manatí',
    'Maricao', 'Maunabo', 'Mayagüez', 'Moca', 'Morovis', 'Naguabo', 'Naranjito', 'Orocovis', 'Patillas',
    'Peñuelas', 'Ponce', 'Quebradillas', 'Rincón', 'Río Grande', 'Sabana Grande', 'Salinas', 'San Germán',
    'San Juan', 'San Lorenzo', 'San Sebastián', 'Santa Isabel', 'Toa Alta', 'Toa Baja', 'Trujillo Alto', 'Utuado',
    'Vega Alta', 'Vega Baja', 'Vieques', 'Villalba', 'Yabucoa', 'Yauco',
  ] },
  { code: 'DO', name: 'República Dominicana', division: 'Provincia', regions: [
    'Azua', 'Bahoruco', 'Barahona', 'Dajabón', 'Distrito Nacional', 'Duarte', 'El Seibo', 'Elías Piña',
    'Espaillat', 'Hato Mayor', 'Hermanas Mirabal', 'Independencia', 'La Altagracia', 'La Romana', 'La Vega',
    'María Trinidad Sánchez', 'Monseñor Nouel', 'Monte Cristi', 'Monte Plata', 'Pedernales', 'Peravia',
    'Puerto Plata', 'Samaná', 'San Cristóbal', 'San José de Ocoa', 'San Juan', 'San Pedro de Macorís',
    'Sánchez Ramírez', 'Santiago', 'Santiago Rodríguez', 'Santo Domingo', 'Valverde',
  ] },
  { code: 'UY', name: 'Uruguay', division: 'Departamento', regions: [
    'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida', 'Lavalleja', 'Maldonado',
    'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha', 'Salto', 'San José', 'Soriano', 'Tacuarembó',
    'Treinta y Tres',
  ] },
  { code: 'VE', name: 'Venezuela', division: 'Estado', regions: [
    'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro',
    'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta',
    'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
  ] },
];
