/**
 * El diario de cuidado: un renglón por día, guardado para siempre.
 *
 * POR QUÉ EXISTE. La racha se calculaba de la simulación hídrica, y la
 * simulación sólo alcanza hasta donde llega el historial de clima: catorce
 * días. O sea que la racha tenía un techo de catorce y, como la ventana se
 * desliza cada jornada, se quedaba clavada ahí. No era que no avanzara — es que
 * no tenía dónde acumularse.
 *
 * Aquí se apunta cada día cómo amanecieron las plantas, y ese apunte ya no se
 * recalcula: queda. La simulación sigue sirviendo para los últimos catorce días
 * (es más exacta, porque usa el clima real), y de ahí para atrás manda el
 * diario. Así la racha puede llegar a cien.
 *
 * Se guarda como un par clave-valor y no como tabla: son unos pocos kilobytes
 * al año y meter una tabla obligaría a migrar la base cada vez que cambie un
 * campo.
 */

import { guardarAjuste, leerAjuste } from './db';
import type { DiaDeCuidado, FalloDelDia } from '../dominio/racha';

const CLAVE = 'diario:v1';

/** Poco más de un año. Suficiente para cualquier racha y no crece sin fin. */
const DIAS_MAXIMOS = 400;

/** Forma compacta en disco: un año entero cabe en unos 20 KB. */
interface DiaGuardado {
  v: number;
  t: number;
  f: Array<{ i: string; a: string; m: FalloDelDia['motivo'] }>;
}

type Guardado = Record<string, DiaGuardado>;

// ---------------------------------------------------------------------------

export async function leerDiario(): Promise<DiaDeCuidado[]> {
  const crudo = await leerAjuste(CLAVE).catch(() => null);
  if (!crudo) return [];

  try {
    const guardado = JSON.parse(crudo) as Guardado;
    return Object.entries(guardado)
      .map(([fecha, dia]) => ({
        fecha,
        enVerde: dia.v,
        total: dia.t,
        fallos: dia.f.map((f) => ({ plantaId: f.i, apodo: f.a, motivo: f.m })),
        bueno: dia.f.length === 0,
        perdonado: false,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  } catch {
    // Un diario corrupto no puede tumbar la app. Se empieza de nuevo: lo que
    // se pierde es la racha, no el expediente de ninguna planta.
    return [];
  }
}

/**
 * Apunta los días que la simulación acaba de calcular.
 *
 * Se sobrescribe lo que ya hubiera de esos días, no se suma: la simulación es
 * la fuente buena mientras alcance, porque usa el clima que de verdad hizo.
 */
export async function apuntarEnDiario(dias: DiaDeCuidado[]): Promise<void> {
  if (dias.length === 0) return;

  const crudo = await leerAjuste(CLAVE).catch(() => null);
  let guardado: Guardado = {};
  if (crudo) {
    try {
      guardado = JSON.parse(crudo) as Guardado;
    } catch {
      guardado = {};
    }
  }

  for (const dia of dias) {
    guardado[dia.fecha] = {
      v: dia.enVerde,
      t: dia.total,
      f: dia.fallos.map((f) => ({ i: f.plantaId, a: f.apodo, m: f.motivo })),
    };
  }

  // Podar lo más viejo.
  const fechas = Object.keys(guardado).sort();
  for (const fecha of fechas.slice(0, Math.max(0, fechas.length - DIAS_MAXIMOS))) {
    delete guardado[fecha];
  }

  await guardarAjuste(CLAVE, JSON.stringify(guardado)).catch(() => undefined);
}

/** Para empezar de cero, cuando se borran todas las plantas. */
export async function borrarDiario(): Promise<void> {
  await guardarAjuste(CLAVE, '{}').catch(() => undefined);
}
