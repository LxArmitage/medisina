/**
 * Dónde acomodó cada planta la persona, dentro de su zona.
 *
 * Arrastrar una planta seleccionada y soltarla en la misma escena la cambia de
 * lugar: más a la izquierda, entre otras dos, atrás o adelante. Es la parte
 * de "este patio es mío": nadie acomoda sus macetas como las acomodaría una
 * computadora. Se guarda en el teléfono, junto a los demás ajustes.
 */

import { guardarAjuste, leerAjuste } from '../datos/db';

const CLAVE = 'patio:acomodo';

export interface Acomodo {
  /** Su lugar en la fila de su zona: 0 es el primero de la izquierda. */
  orden: number;
  /** Fila de atrás (más chica, al fondo) o de adelante. */
  atras: boolean;
}

export type Acomodos = Record<string, Acomodo>;

export async function leerAcomodos(): Promise<Acomodos> {
  const crudo = await leerAjuste(CLAVE).catch(() => null);
  if (!crudo) return {};
  try {
    const datos = JSON.parse(crudo) as unknown;
    if (!datos || typeof datos !== 'object') return {};
    const limpio: Acomodos = {};
    for (const [id, a] of Object.entries(datos as Record<string, unknown>)) {
      const v = a as Partial<Acomodo>;
      if (typeof v?.orden === 'number' && Number.isFinite(v.orden) && typeof v.atras === 'boolean') {
        limpio[id] = { orden: v.orden, atras: v.atras };
      }
    }
    return limpio;
  } catch {
    return {};
  }
}

/** Guarda los cambios sobre lo que ya había. */
export async function guardarAcomodos(cambios: Acomodos): Promise<Acomodos> {
  const todos = { ...(await leerAcomodos()), ...cambios };
  await guardarAjuste(CLAVE, JSON.stringify(todos));
  return todos;
}

/**
 * El nuevo orden de una zona al soltar una planta en `x`.
 *
 * `fila` son las plantas de la zona tal como se ven, de izquierda a derecha,
 * con la que se arrastra incluida. Devuelve el acomodo de TODAS: así, una vez
 * que la persona acomoda una, las demás quedan fijas donde las vio y no
 * brincan de lugar.
 */
export function reacomodar(
  fila: Array<{ id: string; x: number; atras: boolean }>,
  movida: string,
  x: number,
  atras: boolean,
): Acomodos {
  const resto = fila.filter((p) => p.id !== movida).sort((a, b) => a.x - b.x);
  let i = resto.findIndex((p) => x < p.x);
  if (i < 0) i = resto.length;
  const nueva = [...resto.slice(0, i), { id: movida, x, atras }, ...resto.slice(i)];
  const salida: Acomodos = {};
  nueva.forEach((p, orden) => {
    salida[p.id] = { orden, atras: p.id === movida ? atras : p.atras };
  });
  return salida;
}
