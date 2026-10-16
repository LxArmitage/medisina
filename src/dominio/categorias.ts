/**
 * Cómo se agrupan las plantas para curiosear: frutales, de flor, cactus, de
 * interior, de cocina. No es botánica, es cómo las piensa quien las tiene:
 * el jitomate da fruto, pero se piensa como verdura.
 */

import { conocimientoDe } from './conocimiento';
import { formaDe } from './forma';
import type { Especie } from './tipos';

export type Categoria = 'todas' | 'suculentas' | 'interior' | 'flor' | 'frutales' | 'cocina';

/** Las de huerto dan fruto, pero van con las de cocina. */
const DE_HUERTO = new Set(['solanum-lycopersicum', 'capsicum-annuum']);

export function enCategoria(especie: Especie, categoria: Categoria): boolean {
  if (categoria === 'todas') return true;
  const forma = formaDe(especie.id);
  const comestible = conocimientoDe(especie).toxicidad.personas === 'comestible';
  const frutal = comestible && !!forma.fruto && !DE_HUERTO.has(especie.id);
  switch (categoria) {
    case 'suculentas':
      return especie.familiaFuncional === 'cactacea_suculenta';
    case 'interior':
      return especie.bandasToleradas.some((b) => b.startsWith('interior'));
    case 'flor':
      return !!forma.flor && especie.fenologia.some((v) => v.fenomeno === 'floracion') && !frutal;
    case 'frutales':
      return frutal;
    case 'cocina':
      return comestible && !frutal;
  }
}
