/**
 * Ciudades de México, para saber de dónde es el clima.
 *
 * Hasta ahora todas las plantas usaban el clima de Culiacán, vivieras donde
 * vivieras: el pronóstico, la lluvia y los avisos de calor eran de otra ciudad.
 * Con esta lista, al crear la cuenta se elige la ciudad (o se toma del GPS y se
 * busca la más cercana) y todo el clima sale de ahí.
 *
 * Va en el código y no en internet a propósito: elegir tu ciudad no puede
 * depender de tener señal. La zona es la clasificación Köppen aproximada, que
 * es lo que usa el clima estimado cuando no hay conexión.
 */

export interface Ciudad {
  nombre: string;
  estado: string;
  lat: number;
  lon: number;
  /** Köppen: BWh, BSh, Aw, Am, Cwa, Cwb, Csa. */
  zona: string;
}

export const CIUDADES: Ciudad[] = [
  { nombre: 'Ciudad de México', estado: 'CDMX', lat: 19.43, lon: -99.13, zona: 'Cwa' },
  { nombre: 'Guadalajara', estado: 'Jalisco', lat: 20.67, lon: -103.35, zona: 'Cwa' },
  { nombre: 'Monterrey', estado: 'Nuevo León', lat: 25.69, lon: -100.32, zona: 'BSh' },
  { nombre: 'Puebla', estado: 'Puebla', lat: 19.04, lon: -98.21, zona: 'Cwa' },
  { nombre: 'Tijuana', estado: 'Baja California', lat: 32.51, lon: -117.04, zona: 'Csa' },
  { nombre: 'León', estado: 'Guanajuato', lat: 21.12, lon: -101.68, zona: 'BSh' },
  { nombre: 'Ciudad Juárez', estado: 'Chihuahua', lat: 31.69, lon: -106.42, zona: 'BWh' },
  { nombre: 'Mérida', estado: 'Yucatán', lat: 20.97, lon: -89.62, zona: 'Aw' },
  { nombre: 'San Luis Potosí', estado: 'San Luis Potosí', lat: 22.15, lon: -100.98, zona: 'BSh' },
  { nombre: 'Aguascalientes', estado: 'Aguascalientes', lat: 21.88, lon: -102.29, zona: 'BSh' },
  { nombre: 'Hermosillo', estado: 'Sonora', lat: 29.07, lon: -110.96, zona: 'BWh' },
  { nombre: 'Saltillo', estado: 'Coahuila', lat: 25.42, lon: -101.0, zona: 'BSh' },
  { nombre: 'Mexicali', estado: 'Baja California', lat: 32.62, lon: -115.45, zona: 'BWh' },
  { nombre: 'Culiacán', estado: 'Sinaloa', lat: 24.81, lon: -107.39, zona: 'BSh' },
  { nombre: 'Mazatlán', estado: 'Sinaloa', lat: 23.25, lon: -106.41, zona: 'Aw' },
  { nombre: 'Los Mochis', estado: 'Sinaloa', lat: 25.79, lon: -108.99, zona: 'BWh' },
  { nombre: 'Guasave', estado: 'Sinaloa', lat: 25.57, lon: -108.47, zona: 'BWh' },
  { nombre: 'Querétaro', estado: 'Querétaro', lat: 20.59, lon: -100.39, zona: 'BSh' },
  { nombre: 'Chihuahua', estado: 'Chihuahua', lat: 28.63, lon: -106.07, zona: 'BSh' },
  { nombre: 'Morelia', estado: 'Michoacán', lat: 19.7, lon: -101.19, zona: 'Cwa' },
  { nombre: 'Uruapan', estado: 'Michoacán', lat: 19.42, lon: -102.06, zona: 'Cwa' },
  { nombre: 'Toluca', estado: 'Estado de México', lat: 19.28, lon: -99.66, zona: 'Cwb' },
  { nombre: 'Cancún', estado: 'Quintana Roo', lat: 21.16, lon: -86.85, zona: 'Aw' },
  { nombre: 'Playa del Carmen', estado: 'Quintana Roo', lat: 20.63, lon: -87.07, zona: 'Aw' },
  { nombre: 'Chetumal', estado: 'Quintana Roo', lat: 18.5, lon: -88.3, zona: 'Aw' },
  { nombre: 'Acapulco', estado: 'Guerrero', lat: 16.85, lon: -99.82, zona: 'Aw' },
  { nombre: 'Veracruz', estado: 'Veracruz', lat: 19.17, lon: -96.13, zona: 'Aw' },
  { nombre: 'Xalapa', estado: 'Veracruz', lat: 19.54, lon: -96.91, zona: 'Cwa' },
  { nombre: 'Villahermosa', estado: 'Tabasco', lat: 17.99, lon: -92.93, zona: 'Am' },
  { nombre: 'Tuxtla Gutiérrez', estado: 'Chiapas', lat: 16.75, lon: -93.12, zona: 'Am' },
  { nombre: 'San Cristóbal de las Casas', estado: 'Chiapas', lat: 16.74, lon: -92.64, zona: 'Cwb' },
  { nombre: 'Oaxaca', estado: 'Oaxaca', lat: 17.07, lon: -96.72, zona: 'Cwa' },
  { nombre: 'Durango', estado: 'Durango', lat: 24.02, lon: -104.66, zona: 'BSh' },
  { nombre: 'Torreón', estado: 'Coahuila', lat: 25.54, lon: -103.41, zona: 'BSh' },
  { nombre: 'Tepic', estado: 'Nayarit', lat: 21.5, lon: -104.89, zona: 'Cwa' },
  { nombre: 'Puerto Vallarta', estado: 'Jalisco', lat: 20.65, lon: -105.23, zona: 'Aw' },
  { nombre: 'Colima', estado: 'Colima', lat: 19.24, lon: -103.72, zona: 'Aw' },
  { nombre: 'Cuernavaca', estado: 'Morelos', lat: 18.92, lon: -99.23, zona: 'Aw' },
  { nombre: 'Pachuca', estado: 'Hidalgo', lat: 20.1, lon: -98.76, zona: 'Cwb' },
  { nombre: 'Tlaxcala', estado: 'Tlaxcala', lat: 19.32, lon: -98.24, zona: 'Cwb' },
  { nombre: 'Campeche', estado: 'Campeche', lat: 19.85, lon: -90.53, zona: 'Aw' },
  { nombre: 'La Paz', estado: 'Baja California Sur', lat: 24.14, lon: -110.31, zona: 'BWh' },
  { nombre: 'Los Cabos', estado: 'Baja California Sur', lat: 22.89, lon: -109.91, zona: 'BWh' },
  { nombre: 'Ensenada', estado: 'Baja California', lat: 31.87, lon: -116.6, zona: 'Csa' },
  { nombre: 'Zacatecas', estado: 'Zacatecas', lat: 22.77, lon: -102.58, zona: 'BSh' },
  { nombre: 'Tampico', estado: 'Tamaulipas', lat: 22.25, lon: -97.86, zona: 'Aw' },
  { nombre: 'Reynosa', estado: 'Tamaulipas', lat: 26.09, lon: -98.28, zona: 'BSh' },
  { nombre: 'Ciudad Victoria', estado: 'Tamaulipas', lat: 23.74, lon: -99.15, zona: 'BSh' },
  { nombre: 'Nuevo Laredo', estado: 'Tamaulipas', lat: 27.48, lon: -99.52, zona: 'BSh' },
  { nombre: 'Ciudad Obregón', estado: 'Sonora', lat: 27.49, lon: -109.94, zona: 'BWh' },
  { nombre: 'Guanajuato', estado: 'Guanajuato', lat: 21.02, lon: -101.26, zona: 'BSh' },
  { nombre: 'Irapuato', estado: 'Guanajuato', lat: 20.68, lon: -101.35, zona: 'BSh' },
  { nombre: 'Celaya', estado: 'Guanajuato', lat: 20.52, lon: -100.81, zona: 'BSh' },
  { nombre: 'Tehuacán', estado: 'Puebla', lat: 18.46, lon: -97.39, zona: 'BSh' },
  { nombre: 'Monclova', estado: 'Coahuila', lat: 26.91, lon: -101.42, zona: 'BSh' },
];

function sinAcentos(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Por nombre o estado, sin acentos. Sin texto, las más grandes (el orden de la lista). */
export function buscarCiudades(texto: string, maximo = 8): Ciudad[] {
  const t = sinAcentos(texto);
  if (!t) return CIUDADES.slice(0, maximo);
  const empieza = CIUDADES.filter((c) => sinAcentos(c.nombre).startsWith(t));
  const contiene = CIUDADES.filter(
    (c) => !empieza.includes(c) && (sinAcentos(c.nombre).includes(t) || sinAcentos(c.estado).includes(t)),
  );
  return [...empieza, ...contiene].slice(0, maximo);
}

/** Distancia en km sobre la esfera. */
export function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** La ciudad de la lista más cercana a unas coordenadas (las del GPS). */
export function ciudadMasCercana(punto: { lat: number; lon: number }): { ciudad: Ciudad; km: number } {
  let mejor = CIUDADES[0];
  let menor = Infinity;
  for (const c of CIUDADES) {
    const d = distanciaKm(punto, c);
    if (d < menor) {
      menor = d;
      mejor = c;
    }
  }
  return { ciudad: mejor, km: menor };
}
