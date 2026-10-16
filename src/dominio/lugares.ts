/**
 * Dónde vive cada planta: patio, casa o sombra, y el rincón dentro de cada uno.
 *
 * La app guarda la luz con cinco bandas (`BandaLuz`), que es lo que necesita el
 * balance de agua. La persona no piensa así: piensa "la tengo en el patio, al
 * sol" o "en la sala, junto a la ventana". Este archivo traduce entre las dos
 * cosas, en los dos sentidos, para que escanear, mover de zona y la escena de
 * Hoy hablen del mismo lugar.
 *
 * Mover una planta NO es cosmético: cambia su luz, y con la luz cambia cuánta
 * agua gasta. Por eso `veredictoMudanza` dice, antes de moverla, si ahí va a
 * estar bien — con la misma regla que usa el resto de la app (sus bandas
 * toleradas).
 */

import type { Destino } from './avisosClima';
import { etiquetaBanda } from './compatibilidad';
import { BANDAS_LUZ } from './tipos';
import type { BandaLuz, Especie, Ubicacion } from './tipos';

/** Las tres zonas que se ven en Hoy. */
export type Zona = 'patio' | 'casa' | 'sombra';

/** El rincón exacto: la zona y cuánta luz hay ahí. */
export type Lugar = 'patio_sol' | 'patio_medio' | 'sombra' | 'casa_ventana' | 'casa_adentro';

export interface InfoLugar {
  lugar: Lugar;
  zona: Zona;
  titulo: string;
  detalle: string;
  /** Para frases: "ya vive en el patio, al sol". */
  donde: string;
  exposicion: BandaLuz;
}

export const LUGARES: InfoLugar[] = [
  { lugar: 'patio_sol', zona: 'patio', titulo: 'Patio, al sol', detalle: 'Sol directo casi todo el día', donde: 'en el patio, al sol', exposicion: 'sol_pleno' },
  { lugar: 'patio_medio', zona: 'patio', titulo: 'Patio, medio sol', detalle: 'Sol de mañana o tarde, y sombra el resto', donde: 'en el patio, a medio sol', exposicion: 'semisol' },
  { lugar: 'sombra', zona: 'sombra', titulo: 'A la sombra', detalle: 'Bajo un árbol, un techo o un toldo; luz sin sol directo', donde: 'a la sombra', exposicion: 'sombra' },
  { lugar: 'casa_ventana', zona: 'casa', titulo: 'En casa, junto a la ventana', detalle: 'Mucha luz, poco o nada de sol directo', donde: 'en casa, junto a la ventana', exposicion: 'interior_luminoso' },
  { lugar: 'casa_adentro', zona: 'casa', titulo: 'En casa, lejos de la ventana', detalle: 'Un pasillo, un baño, un rincón de la sala', donde: 'en casa, lejos de la ventana', exposicion: 'interior_bajo' },
];

export const ZONAS: Array<{ zona: Zona; titulo: string }> = [
  { zona: 'patio', titulo: 'Patio' },
  { zona: 'casa', titulo: 'Casa' },
  { zona: 'sombra', titulo: 'Sombra' },
];

export function infoLugar(lugar: Lugar): InfoLugar {
  return LUGARES.find((l) => l.lugar === lugar) ?? LUGARES[1];
}

/** En qué rincón está, según su luz. */
export function lugarDe(ubicacion: Pick<Ubicacion, 'exposicion'>): Lugar {
  return LUGARES.find((l) => l.exposicion === ubicacion.exposicion)?.lugar ?? 'patio_medio';
}

export function zonaDe(ubicacion: Pick<Ubicacion, 'exposicion'>): Zona {
  return infoLugar(lugarDe(ubicacion)).zona;
}

/**
 * La ubicación nueva al llevarla a otro rincón.
 *
 * Se conserva lo que no cambia con mudarla (la ciudad, las coordenadas, el
 * clima de la zona). Adentro siempre hay techo; afuera se conserva el techo que
 * tenía si seguía afuera, y si viene de adentro se asume que no: la mayoría de
 * los patios reciben la lluvia.
 */
export function ubicacionEn(lugar: Lugar, anterior: Ubicacion): Ubicacion {
  const info = infoLugar(lugar);
  const adentro = info.zona === 'casa';
  const veniaDeAdentro = anterior.interior || anterior.exposicion.startsWith('interior');
  return {
    ...anterior,
    exposicion: info.exposicion,
    interior: adentro,
    techado: adentro ? true : veniaDeAdentro ? false : anterior.techado,
  };
}

/**
 * Al soltarla en una zona sin decir el rincón: el que mejor le queda a esa
 * especie dentro de esa zona.
 */
export function mejorLugarEn(zona: Zona, especie: Pick<Especie, 'bandasToleradas'>): Lugar {
  const opciones = LUGARES.filter((l) => l.zona === zona);
  for (const banda of especie.bandasToleradas) {
    const hit = opciones.find((l) => l.exposicion === banda);
    if (hit) return hit.lugar;
  }
  // Ninguno de esa zona le queda: el que tenga la luz más parecida a su ideal.
  const ideal = BANDAS_LUZ.indexOf(especie.bandasToleradas[0] ?? 'semisol');
  return [...opciones].sort(
    (a, b) => Math.abs(BANDAS_LUZ.indexOf(a.exposicion) - ideal) - Math.abs(BANDAS_LUZ.indexOf(b.exposicion) - ideal),
  )[0].lugar;
}

export type NivelMudanza = 'ideal' | 'aguanta' | 'mal';

export interface VeredictoMudanza {
  nivel: NivelMudanza;
  /** Una frase, para decir antes de moverla. */
  texto: string;
}

/**
 * Si ahí va a estar bien.
 *
 * `ideal` si es su primera banda; `aguanta` si la tolera; `mal` si no, y en
 * ese caso se dice qué le va a pasar: con más luz de la que aguanta se quema,
 * con menos se estira y pierde color.
 */
export function veredictoMudanza(especie: Pick<Especie, 'bandasToleradas'>, lugar: Lugar, apodo = 'Ella'): VeredictoMudanza {
  const destino = infoLugar(lugar).exposicion;
  const ideal = especie.bandasToleradas[0];
  if (destino === ideal) return { nivel: 'ideal', texto: `Es su lugar ideal: ${etiquetaBanda(destino)}.` };
  if (especie.bandasToleradas.includes(destino)) {
    return { nivel: 'aguanta', texto: `Ahí la aguanta, aunque prefiere ${etiquetaBanda(ideal)}.` };
  }
  // BANDAS_LUZ va de más a menos luz.
  const indices = especie.bandasToleradas.map((b) => BANDAS_LUZ.indexOf(b));
  const masLuzQueAguanta = Math.min(...indices);
  if (BANDAS_LUZ.indexOf(destino) < masLuzQueAguanta) {
    return {
      nivel: 'mal',
      texto: `${apodo} no aguanta tanta luz: se le pueden quemar las hojas. Si es por unos días, que sea con sombra a mediodía.`,
    };
  }
  return {
    nivel: 'mal',
    texto: `A ${apodo.toLowerCase() === 'ella' ? 'ella' : apodo} le va a faltar luz: se estira, pierde color y deja de crecer. Mejor ${etiquetaBanda(ideal)}.`,
  };
}

/**
 * A dónde llevarla cuando el clima lo pide (`avisosClima.ts`).
 *
 * `null` para la lluvia: ahí no cambia de zona, sólo se pone bajo techo.
 */
export function lugarParaAviso(
  destino: Destino,
  especie: Pick<Especie, 'bandasToleradas'>,
): Lugar | null {
  if (destino === 'techo') return null;
  if (destino === 'sombra') return 'sombra';
  if (destino === 'adentro') return 'casa_ventana';
  const ideal = especie.bandasToleradas[0];
  return LUGARES.find((l) => l.exposicion === ideal)?.lugar ?? 'patio_medio';
}
