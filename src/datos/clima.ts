/**
 * Clima — Open-Meteo.
 *
 * Se eligió Open-Meteo porque es gratuita, no pide llave y —lo importante—
 * entrega ET₀ FAO-56 ya calculada, que es exactamente la entrada que necesita
 * el motor de balance hídrico.
 *
 * Nada de esto puede ser un requisito duro: la app tiene que funcionar sin red.
 * Por eso hay caché en SQLite y, como último recurso, una climatología mensual
 * aproximada. Cuando se usa el respaldo, se dice; no se finge precisión.
 */

import type { DiaClima } from '../dominio/tipos';

const BASE = 'https://api.open-meteo.com/v1/forecast';

const DIAS_PASADOS = 14;
const DIAS_PRONOSTICO = 7;

export interface SerieClima {
  /** Días ya ocurridos, del más antiguo al más reciente. Incluye hoy. */
  historico: DiaClima[];
  /** Días futuros, a partir de mañana. */
  pronostico: DiaClima[];
  fuente: 'api' | 'cache' | 'estimado';
  actualizadoEn: string;
}

interface RespuestaOpenMeteo {
  daily: {
    time: string[];
    et0_fao_evapotranspiration: Array<number | null>;
    precipitation_sum: Array<number | null>;
    temperature_2m_max: Array<number | null>;
    temperature_2m_min: Array<number | null>;
  };
}

// ---------------------------------------------------------------------------

/** Cuánto se espera al servicio del clima antes de seguir sin él. */
const ESPERA_MAXIMA_MS = 8000;

export async function obtenerClima(
  lat: number,
  lon: number,
  hoy: Date = new Date(),
): Promise<SerieClima> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: [
      'et0_fao_evapotranspiration',
      'precipitation_sum',
      'temperature_2m_max',
      'temperature_2m_min',
    ].join(','),
    past_days: String(DIAS_PASADOS),
    forecast_days: String(DIAS_PRONOSTICO),
    timezone: 'auto',
  });

  // Con límite: con señal mala, un fetch sin plazo puede colgarse un minuto, y
  // mientras tanto la ficha de la planta se queda cargando —sin dibujo, sin 3D
  // y sin fotos—. A los 8 s se usa la caché o el clima estimado.
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}?${params}`, { signal: control.signal });
  } finally {
    clearTimeout(reloj);
  }
  if (!respuesta.ok) {
    throw new Error(`Open-Meteo respondió ${respuesta.status}`);
  }
  const datos = (await respuesta.json()) as RespuestaOpenMeteo;
  return separarSerie(mapear(datos, hoy), hoy);
}

function mapear(datos: RespuestaOpenMeteo, hoy: Date): DiaClima[] {
  const hoyIso = aIso(hoy);
  return datos.daily.time.map((fecha, i) => ({
    fecha,
    et0Mm: datos.daily.et0_fao_evapotranspiration[i] ?? 0,
    lluviaMm: datos.daily.precipitation_sum[i] ?? 0,
    tMaxC: datos.daily.temperature_2m_max[i] ?? 0,
    tMinC: datos.daily.temperature_2m_min[i] ?? 0,
    esPronostico: fecha > hoyIso,
  }));
}

function separarSerie(dias: DiaClima[], hoy: Date): SerieClima {
  const hoyIso = aIso(hoy);
  return {
    historico: dias.filter((d) => d.fecha <= hoyIso),
    pronostico: dias.filter((d) => d.fecha > hoyIso),
    fuente: 'api',
    actualizadoEn: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Respaldo sin red
// ---------------------------------------------------------------------------

/**
 * ET₀ media diaria por mes, en mm, para dos regímenes gruesos de México.
 * Sirve para que la agenda de riego siga corriendo sin conexión; se marca
 * como `estimado` para que la interfaz pueda advertirlo.
 */
const ET0_MENSUAL: Record<'arido' | 'templado', number[]> = {
  // Noroeste árido (Sonora, Sinaloa, BC): BWh / BSh
  arido: [2.6, 3.4, 4.6, 5.8, 6.7, 7.1, 6.4, 6.0, 5.4, 4.4, 3.2, 2.5],
  // Altiplano y centro templado: Cwa / Cwb
  templado: [2.8, 3.5, 4.4, 4.9, 5.0, 4.4, 4.0, 4.0, 3.7, 3.4, 2.9, 2.6],
};

const LLUVIA_MENSUAL: Record<'arido' | 'templado', number[]> = {
  arido: [0.5, 0.3, 0.1, 0.0, 0.0, 0.2, 2.5, 3.0, 1.8, 0.6, 0.4, 0.7],
  templado: [0.4, 0.3, 0.4, 0.8, 2.0, 5.0, 5.5, 5.0, 5.2, 1.8, 0.6, 0.4],
};

export type RegimenClimatico = 'arido' | 'templado';

/** Régimen aproximado a partir de la zona Köppen capturada en la ubicación. */
export function regimenDeZona(zona?: string): RegimenClimatico {
  if (!zona) return 'templado';
  return zona.startsWith('B') ? 'arido' : 'templado';
}

/**
 * Serie sintética para cuando no hay red ni caché.
 * Es un promedio climatológico, no un pronóstico: nunca sustituye a la API,
 * sólo evita que la app se quede muda.
 */
export function climaEstimado(
  regimen: RegimenClimatico,
  hoy: Date = new Date(),
): SerieClima {
  const dias: DiaClima[] = [];
  for (let offset = -DIAS_PASADOS; offset <= DIAS_PRONOSTICO; offset += 1) {
    const fecha = new Date(hoy.getTime() + offset * 86_400_000);
    const mes = fecha.getUTCMonth();
    dias.push({
      fecha: aIso(fecha),
      et0Mm: ET0_MENSUAL[regimen][mes],
      lluviaMm: LLUVIA_MENSUAL[regimen][mes],
      tMaxC: 0,
      tMinC: 0,
      esPronostico: offset > 0,
    });
  }
  const serie = separarSerie(dias, hoy);
  return { ...serie, fuente: 'estimado' };
}

// ---------------------------------------------------------------------------
// Zonas climáticas (alimentan el prior geoclimático de Fase 2)
// ---------------------------------------------------------------------------

export const ZONAS_CLIMATICAS: Array<{ codigo: string; etiqueta: string }> = [
  { codigo: 'BWh', etiqueta: 'Desierto cálido — Hermosillo, Mexicali, La Paz' },
  { codigo: 'BSh', etiqueta: 'Estepa cálida — Culiacán, Torreón, Monterrey' },
  { codigo: 'Aw', etiqueta: 'Tropical con secas — Acapulco, Villahermosa, Mérida' },
  { codigo: 'Am', etiqueta: 'Tropical monzónico — Tuxtla, costa de Veracruz' },
  { codigo: 'Cwa', etiqueta: 'Templado subhúmedo — CDMX, Guadalajara, Puebla' },
  { codigo: 'Cwb', etiqueta: 'Templado de altura — Toluca, San Cristóbal' },
  { codigo: 'Csa', etiqueta: 'Mediterráneo — Ensenada, noroeste de BC' },
];

// ---------------------------------------------------------------------------

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
