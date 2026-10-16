/**
 * El clima del jardín y a qué escena va cada planta.
 *
 * Junta lo que ya calculó la agenda (la serie de clima de cada planta, los
 * límites de temperatura de su ficha) y se lo pasa al dominio
 * (`avisosClima.ts`). No lee nada nuevo: todo sale de los estados que la
 * pantalla ya tiene.
 */

import { avisosDeClima, pronosticoCorto } from '../dominio/avisosClima';
import type { AvisoMover, DiaPronostico, PlantaParaClima } from '../dominio/avisosClima';
import { zonaDe } from '../dominio/lugares';
import type { Zona } from '../dominio/lugares';
import type { EstadoDePlanta } from './agenda';

export interface ClimaDelJardin {
  dias: DiaPronostico[];
  avisos: AvisoMover[];
  /** Sin conexión: es el promedio de la zona, no el pronóstico real. */
  estimado: boolean;
}

export function climaDelJardin(estados: EstadoDePlanta[], hoy: Date = new Date()): ClimaDelJardin {
  // La serie más fresca: la que vino de internet, si alguna vino.
  const serie = estados.find((e) => e.serie.fuente === 'api')?.serie ?? estados[0]?.serie;
  if (!serie) return { dias: [], avisos: [], estimado: true };
  const dias = pronosticoCorto(serie, hoy, 5);
  const plantas: PlantaParaClima[] = estados.map((e) => ({
    id: e.planta.id,
    apodo: e.planta.apodo,
    exposicion: e.planta.ubicacion.exposicion,
    interior: e.planta.ubicacion.interior || e.planta.ubicacion.exposicion.startsWith('interior'),
    techado: e.planta.ubicacion.techado,
    enAgua: e.planta.contenedor.tipo === 'agua',
    perfilHidrico: e.especie.perfilHidrico,
    bandasToleradas: e.especie.bandasToleradas,
    temperaturaMinC: e.snapshot.conocimiento.temperaturaMinC,
    temperaturaMaxC: e.snapshot.conocimiento.temperaturaMaxC,
  }));
  return { dias, avisos: avisosDeClima(plantas, dias, hoy), estimado: serie.fuente === 'estimado' };
}

/**
 * En qué escena vive: las de interior en la casa, las de sombra bajo el árbol,
 * el resto en el patio. Por su luz, no por su recipiente: un esqueje en un
 * frasco de la cocina vive en la casa, no en el estanque del patio.
 */
export function escenaDe(estado: EstadoDePlanta): Zona {
  return zonaDe(estado.planta.ubicacion);
}
