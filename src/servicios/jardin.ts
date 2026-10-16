/**
 * El jardín entero, listo para el asistente.
 *
 * Junta en un solo objeto lo que la sina necesita saber para hablar: todas las
 * plantas con su expediente, la racha, el perfil de quien cuida y su nombre.
 *
 * Está aquí y no en el dominio porque toca disco y red. El dominio recibe este
 * objeto ya armado y no sabe de dónde salió — que es lo que permite probar al
 * asistente entero sin base de datos ni dispositivo.
 */

import { leerAjuste } from '../datos/db';
import type { Jardin, PlantaEnJardin } from '../dominio/asistente';
import { construirPerfil } from '../dominio/perfil';
import type { PlantaEnRacha } from '../dominio/racha';
import { listarPlantas } from '../datos/db';
import { estadoDePlanta } from './agenda';
import { climaDelJardin } from './climaJardin';
import { rachaDe } from './racha';

/** Dónde se guarda el nombre de quien cuida. */
export const CLAVE_NOMBRE = 'usuario:nombre';
/** Si ya pasó la bienvenida. */
export const CLAVE_BIENVENIDA = 'usuario:bienvenida';

export async function cargarJardin(enfoque?: string): Promise<Jardin> {
  const plantas = await listarPlantas();
  const estados = await Promise.all(plantas.map((p) => estadoDePlanta(p)));
  const vivas = estados.filter((e): e is NonNullable<typeof e> => e !== null);

  const enJardin: PlantaEnJardin[] = vivas.map((e) => ({
    id: e.planta.id,
    apodo: e.planta.apodo,
    snapshot: e.snapshot,
    especie: e.especie,
  }));

  const paraRacha: PlantaEnRacha[] = vivas.map((e) => ({
    id: e.planta.id,
    apodo: e.planta.apodo,
    estados: e.estados,
  }));

  const nombre = (await leerAjuste(CLAVE_NOMBRE).catch(() => null)) ?? undefined;

  return {
    nombre: nombre || undefined,
    perfil: construirPerfil({ plantas: paraRacha }),
    racha: await rachaDe(vivas),
    plantas: enJardin,
    enfoque,
    // El pronóstico y los avisos de mover: para que "¿va a llover?" o "¿hay
    // que mover alguna?" se contesten con los días que vienen, no sólo hoy.
    clima: (() => {
      const c = climaDelJardin(vivas);
      return c.dias.length > 0 ? { dias: c.dias, avisos: c.avisos } : undefined;
    })(),
  };
}
