/**
 * Servicio de agenda — pega el dominio con los datos.
 *
 * Es el único lugar donde se mezclan red, caché y cálculo. El dominio
 * (`src/dominio`) se mantiene puro a propósito para poder probarlo sin nada de
 * esto alrededor.
 */

import { climaEstimado, obtenerClima, regimenDeZona } from '../datos/clima';
import type { SerieClima } from '../datos/clima';
import {
  guardarClimaEnCache,
  leerClimaDeCache,
  listarEventos,
  ultimoDiagnostico,
} from '../datos/db';
import { buscarEspecie } from '../dominio/catalogo';
import { recomendarRiego, simularBalance } from '../dominio/balanceHidrico';
import type { EstadoHidrico, Recomendacion } from '../dominio/balanceHidrico';
import { construirSnapshot, vozDeterminista } from '../dominio/gemelo';
import type { SnapshotGemelo } from '../dominio/gemelo';
import type { Especie, Evento, Planta } from '../dominio/tipos';
import { ciudadDeLaCuenta } from './cuenta';

/** Coordenadas por defecto (Culiacán) cuando ni la planta ni la cuenta tienen ubicación. */
const LAT_POR_DEFECTO = 24.81;
const LON_POR_DEFECTO = -107.39;

const VIGENCIA_CACHE_MS = 6 * 60 * 60 * 1000; // 6 horas

// ---------------------------------------------------------------------------

function claveClima(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/**
 * Clima para una planta, con degradación explícita:
 * API → caché reciente → caché vieja → climatología estimada.
 *
 * Nunca lanza: una app de jardín no puede quedarse en blanco porque se cayó
 * el wifi.
 */
export async function climaParaPlanta(planta: Planta): Promise<SerieClima> {
  // Sin coordenadas propias, las de la ciudad de la cuenta; sin cuenta, Culiacán.
  const ciudad = planta.ubicacion.lat === undefined ? await ciudadDeLaCuenta() : undefined;
  const lat = planta.ubicacion.lat ?? ciudad?.lat ?? LAT_POR_DEFECTO;
  const lon = planta.ubicacion.lon ?? ciudad?.lon ?? LON_POR_DEFECTO;
  const clave = claveClima(lat, lon);

  const cache = await leerClimaDeCache(clave).catch(() => null);
  const cacheVigente =
    cache && Date.now() - new Date(cache.actualizadoEn).getTime() < VIGENCIA_CACHE_MS;
  if (cacheVigente) return cache;

  try {
    const serie = await obtenerClima(lat, lon);
    await guardarClimaEnCache(clave, serie).catch(() => undefined);
    return serie;
  } catch {
    if (cache) return cache;
    return climaEstimado(regimenDeZona(ciudad?.zona ?? planta.ubicacion.zonaClimatica));
  }
}

// ---------------------------------------------------------------------------

export interface EstadoDePlanta {
  planta: Planta;
  especie: Especie;
  eventos: Evento[];
  serie: SerieClima;
  /** La simulación día a día, no sólo hoy. La racha y el perfil viven de esto. */
  estados: EstadoHidrico[];
  estadoHoy: EstadoHidrico;
  recomendacion: Recomendacion;
  snapshot: SnapshotGemelo;
  /** Frase en primera persona, generada sin LLM. */
  voz: string;
}

export async function estadoDePlanta(planta: Planta): Promise<EstadoDePlanta | null> {
  const especie = buscarEspecie(planta.especieId);
  if (!especie) return null;

  const [eventos, serie, diagnostico] = await Promise.all([
    listarEventos(planta.id),
    climaParaPlanta(planta),
    ultimoDiagnostico(planta.id).catch(() => null),
  ]);

  const estados = simularBalance({
    planta,
    especie,
    eventos,
    clima: serie.historico,
  });
  const estadoHoy = estados[estados.length - 1];

  const ultimoRiego = eventos
    .filter((e) => e.tipo === 'riego')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  const ultimoCambio = eventos
    .filter((e) => e.tipo === 'cambio_agua')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const diasDesdeCambioAgua = ultimoCambio
    ? Math.floor((Date.now() - new Date(ultimoCambio.fecha).getTime()) / 86_400_000)
    : null;

  const recomendacion = recomendarRiego({
    planta,
    especie,
    estadoHoy,
    pronostico: serie.pronostico,
    ultimoRiego: ultimoRiego?.fecha,
    diasDesdeCambioAgua,
  });

  const climaHoy = serie.historico[serie.historico.length - 1];
  const snapshot = construirSnapshot({
    planta,
    especie,
    estadoHoy,
    recomendacion,
    eventos,
    clima: climaHoy ? { hoy: climaHoy, pronostico: serie.pronostico } : undefined,
    diagnostico: diagnostico ?? undefined,
  });

  return {
    planta,
    especie,
    eventos,
    serie,
    estados,
    estadoHoy,
    recomendacion,
    snapshot,
    voz: vozDeterminista(snapshot),
  };
}

// ---------------------------------------------------------------------------

const ORDEN_URGENCIA = { alta: 0, media: 1, baja: 2, ninguna: 3 } as const;

/**
 * Agenda de hoy: qué tocar y qué dejar en paz, ordenado por urgencia.
 * Las plantas sin nada pendiente también vienen, al final: ver que no hay
 * nada que hacer es información.
 */
export async function agendaDeHoy(plantas: Planta[]): Promise<EstadoDePlanta[]> {
  const resultados = await Promise.all(plantas.map((planta) => estadoDePlanta(planta)));
  return resultados
    .filter((r): r is EstadoDePlanta => r !== null)
    .sort((a, b) => {
      const porUrgencia =
        ORDEN_URGENCIA[a.recomendacion.urgencia] - ORDEN_URGENCIA[b.recomendacion.urgencia];
      if (porUrgencia !== 0) return porUrgencia;
      return a.estadoHoy.fraccionDisponible - b.estadoHoy.fraccionDisponible;
    });
}

/** Cuántas plantas piden acción hoy. Alimenta el encabezado de la pantalla. */
export function contarPendientes(estados: EstadoDePlanta[]): number {
  return estados.filter(
    (e) =>
      e.recomendacion.accion === 'regar' ||
      e.recomendacion.accion === 'suspender_riego' ||
      e.recomendacion.accion === 'cambiar_agua',
  ).length;
}
