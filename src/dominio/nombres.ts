/**
 * Cómo se llama una planta, dicho de todas las formas en que la gente la
 * conoce.
 *
 * Una pitahaya es también pitaya, fruta del dragón y, en internet, "dragon
 * fruit". Si la app sólo dice "Selenicereus undatus" o uno solo de esos
 * nombres, quien la busca por otro no la reconoce aunque la tenga enfrente.
 * Por eso el nombre principal va grande y los demás siempre a la vista.
 */

import type { Especie } from './tipos';

export interface Nombres {
  /** El nombre con que se le conoce más, con mayúscula. */
  principal: string;
  /** Los otros nombres en español, sin repetir el principal. */
  otros: string[];
  /** Cómo se le dice en inglés, sin repetir los de español. */
  ingles: string[];
  cientifico: string;
}

export function nombresDe(especie: Pick<Especie, 'nombresComunes' | 'nombresIngles' | 'nombreCientifico'>): Nombres {
  const vistos = new Set<string>();
  const unico = (n: string) => {
    const k = normalizar(n);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  };
  const [primero, ...resto] = especie.nombresComunes;
  const principal = capitalizar(primero ?? especie.nombreCientifico);
  unico(principal);
  unico(especie.nombreCientifico);
  const otros = resto.filter(unico);
  const ingles = (especie.nombresIngles ?? []).filter(unico);
  return { principal, otros, ingles, cientifico: especie.nombreCientifico };
}

/**
 * Los demás nombres en una línea: "También: pitaya, fruta del dragón · En
 * inglés: dragon fruit". Vacío si no tiene otros.
 */
export function lineaDeNombres(especie: Pick<Especie, 'nombresComunes' | 'nombresIngles' | 'nombreCientifico'>): string {
  const { otros, ingles } = nombresDe(especie);
  const partes: string[] = [];
  if (otros.length > 0) partes.push(`También: ${otros.join(', ')}`);
  if (ingles.length > 0) partes.push(`En inglés: ${ingles.join(', ')}`);
  return partes.join(' · ');
}

export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
