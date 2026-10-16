/**
 * Morfología del gemelo visual.
 *
 * Traduce el estado real de una planta a los parámetros con los que se dibuja.
 * Es la pieza que vuelve visible al gemelo digital: la postura de la planta en
 * pantalla *es* el dato, no una ilustración decorativa.
 *
 * El detalle que más importa: una planta ahogada también se cae. El exceso de
 * riego mata más plantas de casa que el olvido, y con un solo lenguaje visual
 * —la caída— no se distinguiría de la sed. Por eso la caída va acompañada
 * siempre de una señal que dice cuál de las dos es.
 *
 * Como todo en `src/dominio`, es puro: se prueba sin dibujar nada.
 */

import type { EstadoHidrico } from './balanceHidrico';
import type { EventoEsperado } from './fenologia';
import type { Especie, FamiliaFuncional, MedidasObservadas } from './tipos';

// ---------------------------------------------------------------------------

/** Cómo se construye el cuerpo de la planta al dibujarla. */
export type Arquetipo =
  | 'cactacea' // columnas verticales
  | 'roseta' // hojas rígidas desde el centro
  | 'fronda' // helecho: hojas plumosas y arqueadas
  | 'trepadora' // hojas grandes acorazonadas sobre un tallo
  | 'arbol' // tronco con copa
  | 'arbusto' // ramas múltiples desde la base
  | 'flotante'; // hojas sobre agua

/** Qué le está pasando. Acompaña a la caída para que no sea ambigua. */
export type Senal = 'ninguna' | 'sed' | 'ahogo';

export interface Morfologia {
  arquetipo: Arquetipo;

  /** Altura del cuerpo, 0-1 sobre el alto del lienzo. Crece con la edad. */
  altura: number;
  /**
   * Qué tan hecha está, de 0 (recién nacida) a 1 (adulta). No es cuánto mide
   * el dibujo: es su estructura. Un limonero joven es una vara con una copa
   * chica; uno hecho tiene tronco grueso, ramas que se abren en más ramas y
   * fruta. Sale de su altura contra la de su especie adulta.
   */
  desarrollo: number;
  /** Cuántas hojas, brazos o frondas dibujar. */
  elementos: number;

  /**
   * Caída de las hojas. 0 = erguida y turgente, 1 = colapsada.
   * Sube tanto por sequía como por encharcamiento.
   */
  caida: number;
  /** Apertura del abanico de hojas, en grados desde la vertical. */
  apertura: number;

  /** 0-1. Satura el verde y define cuánta vida transmite. */
  vigor: number;
  verde: string;
  verdeOscuro: string;

  /** Ornamentos que sólo aparecen si la fenología los justifica. */
  brotes: number;
  flores: number;
  frutos: number;
  colorFlor: string;

  senal: Senal;
}

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------

/**
 * Verde pleno de una planta sana, y los colores de las que no lo están.
 *
 * Son deliberadamente saturados: en una pantalla de teléfono, a la luz del
 * patio, un verde apagado y un verde sano se ven igual. La diferencia entre
 * "está bien" y "se está muriendo" tiene que leerse de un vistazo.
 */
const VERDE_SANO = '#2FBF63';
const VERDE_SANO_OSCURO = '#17954A';
const VERDE_SED = '#D9A21B'; // amarillea fuerte
const VERDE_SED_OSCURO = '#A87A0E';
const VERDE_AHOGO = '#3FA8C4'; // se va al azul: agua de más
const VERDE_AHOGO_OSCURO = '#2A7E99';

/** Color de flor por familia. Es lo único puramente estético del módulo. */
const COLOR_FLOR: Record<FamiliaFuncional, string> = {
  cactacea_suculenta: '#FFE9A3', // flor nocturna, pálida pero luminosa
  arborea: '#FFF6E0',
  arbustiva: '#F0453C',
  herbacea: '#FFF2C4',
  trepadora: '#FBEFD2',
  acuatica: '#FFD447',
  palmera: '#F5E7BE',
  helecho: '#7FE3A0', // no florece: se usa para los báculos
};

const ARQUETIPO_POR_FAMILIA: Record<FamiliaFuncional, Arquetipo> = {
  cactacea_suculenta: 'cactacea',
  arborea: 'arbol',
  arbustiva: 'arbusto',
  herbacea: 'roseta',
  trepadora: 'trepadora',
  acuatica: 'flotante',
  palmera: 'fronda',
  helecho: 'fronda',
};

// ---------------------------------------------------------------------------
// Caída por nivel hídrico
// ---------------------------------------------------------------------------

/**
 * Cuánto se vence la planta según su nivel.
 *
 * El encharcamiento provoca una caída alta a propósito: la raíz podrida no
 * puede subir agua, así que la planta se marchita *aunque le sobre*. Es la
 * confusión clásica que hace que la gente riegue todavía más.
 */
const CAIDA_POR_NIVEL: Record<EstadoHidrico['nivel'], number> = {
  critico: 0.92,
  seco: 0.55,
  optimo: 0.08,
  humedo: 0.12,
  encharcado: 0.7,
};

const VIGOR_POR_NIVEL: Record<EstadoHidrico['nivel'], number> = {
  critico: 0.1,
  seco: 0.45,
  optimo: 1,
  humedo: 0.9,
  encharcado: 0.35,
};

// ---------------------------------------------------------------------------

export interface EntradaMorfologia {
  especie: Especie;
  estado: EstadoHidrico;
  /** Fenología vigente; sólo se dibujan ornamentos de lo que está en curso. */
  fenologia?: EventoEsperado[];
  /**
   * Meses desde que llegó a casa. Con eso se estima su altura cuando nadie la
   * ha medido (ver `alturaEstimadaCm`).
   */
  edadMeses?: number;
  /** Lo que la persona midió al escanear. Manda sobre la estimación por edad. */
  medidas?: MedidasObservadas;
}

export function calcularMorfologia(entrada: EntradaMorfologia): Morfologia {
  const { especie, estado } = entrada;
  const edadMeses = entrada.edadMeses ?? 0;
  const fenologia = entrada.fenologia ?? [];

  const arquetipo = ARQUETIPO_POR_FAMILIA[especie.familiaFuncional];
  const vigor = VIGOR_POR_NIVEL[estado.nivel];

  const senal: Senal =
    estado.nivel === 'encharcado'
      ? 'ahogo'
      : estado.nivel === 'seco' || estado.nivel === 'critico'
        ? 'sed'
        : 'ninguna';

  const caida = redondear(
    Math.min(1, CAIDA_POR_NIVEL[estado.nivel] * rigidezDe(arquetipo, especie)),
    2,
  );

  // Medida observada antes que estimación: si la persona se tomó la molestia de
  // medir su planta, el dibujo tiene que ser el de SU planta, no el de una
  // planta promedio de esa edad. Sin medida, la estimación es en centímetros
  // y de SU especie: un limonero recién comprado no mide lo que una echeveria.
  const madurez = Math.min(1, edadMeses / 36);
  const alturaCm = entrada.medidas?.alturaCm ?? alturaEstimadaCm(especie, edadMeses);
  const altura = alturaRelativa(alturaCm);
  const desarrollo = desarrolloDe(especie, alturaCm);
  const elementos =
    entrada.medidas?.elementos !== undefined
      ? Math.max(1, Math.min(14, Math.round(entrada.medidas.elementos)))
      : Math.max(3, Math.round(3 + 7 * madurez));

  const enCurso = (fenomeno: EventoEsperado['fenomeno']): boolean =>
    fenologia.some((evento) => evento.fenomeno === fenomeno && evento.enCurso);

  // Una planta en crisis no gasta energía en flores. Si está sufriendo, los
  // ornamentos se reducen aunque el calendario diga que es temporada. Y una
  // muy joven todavía no: un arbolito de un palmo no da limones.
  const puedeOrnamentar = vigor > 0.4;
  const puedeFlorecer = desarrollo >= DESARROLLO_PARA_FLOR;
  const puedeFrutear = desarrollo >= DESARROLLO_PARA_FRUTO;

  return {
    arquetipo,
    altura,
    desarrollo,
    elementos,
    caida,
    apertura: aperturaPara(arquetipo),
    vigor,
    verde: colorVerde(senal, vigor),
    verdeOscuro: colorVerdeOscuro(senal, vigor),
    brotes: enCurso('brote') && puedeOrnamentar ? Math.max(1, Math.round(elementos / 4)) : 0,
    flores:
      enCurso('floracion') && puedeOrnamentar && puedeFlorecer
        ? Math.max(1, Math.round((elementos / 3) * (0.6 + desarrollo)))
        : 0,
    frutos:
      enCurso('fructificacion') && puedeOrnamentar && puedeFrutear
        ? Math.max(1, Math.round((elementos / 5) * (0.5 + desarrollo * 1.5)))
        : 0,
    colorFlor: COLOR_FLOR[especie.familiaFuncional],
    senal,
  };
}

// ---------------------------------------------------------------------------

/**
 * Cuánto resiste antes de vencerse.
 *
 * Depende de dos cosas distintas y hay que separarlas: la estructura (un tronco
 * no se dobla como una fronda) y la suculencia (una planta que almacena agua
 * aguanta la sequía erguida — es literalmente para lo que sirve el tejido
 * suculento).
 *
 * Meterlas en un solo número por arquetipo trataba igual a una sansevieria y a
 * una albahaca, que son casos opuestos aunque ambas sean herbáceas: la primera
 * se mantiene tiesa, la segunda se desploma en un día.
 */
function rigidezDe(arquetipo: Arquetipo, especie: Especie): number {
  const estructural: Record<Arquetipo, number> = {
    cactacea: 0.25,
    roseta: 0.9,
    fronda: 1,
    trepadora: 1,
    arbol: 0.8,
    arbusto: 0.95,
    flotante: 0.6,
  };

  const suculencia: Record<Especie['perfilHidrico'], number> = {
    xerico: 0.5,
    bajo: 0.8,
    medio: 1,
    alto: 1.1,
    acuatico: 0.9,
  };

  return estructural[arquetipo] * suculencia[especie.perfilHidrico];
}

/** Por debajo de esto, todavía no florece: es una plántula. */
const DESARROLLO_PARA_FLOR = 0.22;
/** Fruta pide más: la planta tiene que poder cargarla. */
const DESARROLLO_PARA_FRUTO = 0.3;

/**
 * Lo que mide cuando llega a casa, si nadie lo dijo: lo que suele venderse en
 * un vivero. Una quinta parte de su altura adulta, entre 4 cm (una suculenta
 * chiquita) y 70 cm (un arbolito en bolsa).
 */
export function alturaInicialCm(especie: Pick<Especie, 'alturaMaximaCm'>): number {
  return Math.round(Math.max(4, Math.min(70, especie.alturaMaximaCm * 0.2)));
}

/**
 * Cuánto crece en `meses`, desde `alturaCm`.
 *
 * Es logístico, no lineal: una planta no crece 30 cm al año para siempre. El
 * factor `(1 - h/max)` la va frenando conforme se acerca a su tamaño adulto,
 * que es como crecen de verdad.
 */
export function crecerCm(
  especie: Pick<Especie, 'alturaMaximaCm' | 'crecimientoCmPorAno'>,
  alturaCm: number,
  meses: number,
): number {
  const max = especie.alturaMaximaCm;
  const porMes = especie.crecimientoCmPorAno / 12;
  let altura = Math.max(1, Math.min(alturaCm, max));
  for (let m = 0; m < meses; m += 1) altura += porMes * Math.max(0, 1 - altura / max);
  return altura;
}

/** Su altura por edad, cuando no se ha medido: la de vivero más lo que ha crecido. */
export function alturaEstimadaCm(
  especie: Pick<Especie, 'alturaMaximaCm' | 'crecimientoCmPorAno'>,
  edadMeses: number,
): number {
  const meses = Math.max(0, Math.min(600, Number.isFinite(edadMeses) ? Math.round(edadMeses) : 0));
  return Math.round(crecerCm(especie, alturaInicialCm(especie), meses));
}

/**
 * Qué tan hecha está, 0-1, por su altura contra la adulta.
 *
 * Con raíz cuadrada: los primeros centímetros cambian mucho la estructura (de
 * vara a arbolito) y los últimos, poco (de árbol a árbol un poco más grande).
 */
export function desarrolloDe(especie: Pick<Especie, 'alturaMaximaCm'>, alturaCm: number): number {
  const max = Math.max(1, especie.alturaMaximaCm);
  const f = Math.max(0, Math.min(1, (Number.isFinite(alturaCm) ? alturaCm : 0) / max));
  return redondear(Math.sqrt(f), 2);
}

/**
 * Centímetros a altura relativa del lienzo.
 *
 * La escala es logarítmica porque la percepción de tamaño lo es: la diferencia
 * entre 10 y 30 cm salta a la vista, la que hay entre 180 y 200 no.
 */
export function alturaRelativa(cm: number): number {
  const acotado = Math.max(3, Math.min(250, cm));
  const t = (Math.log(acotado) - Math.log(3)) / (Math.log(250) - Math.log(3));
  return redondear(0.4 + 0.55 * t, 2);
}

function aperturaPara(arquetipo: Arquetipo): number {
  return {
    cactacea: 12,
    roseta: 62,
    fronda: 54,
    trepadora: 46,
    arbol: 40,
    arbusto: 50,
    flotante: 80,
  }[arquetipo];
}

function colorVerde(senal: Senal, vigor: number): string {
  const destino = senal === 'ahogo' ? VERDE_AHOGO : senal === 'sed' ? VERDE_SED : VERDE_SANO;
  return mezclar(destino, VERDE_SANO, vigor);
}

function colorVerdeOscuro(senal: Senal, vigor: number): string {
  const destino =
    senal === 'ahogo' ? VERDE_AHOGO_OSCURO : senal === 'sed' ? VERDE_SED_OSCURO : VERDE_SANO_OSCURO;
  return mezclar(destino, VERDE_SANO_OSCURO, vigor);
}

/** Mezcla dos colores hexadecimales. `proporcion` 0 = todo `a`, 1 = todo `b`. */
export function mezclar(a: string, b: string, proporcion: number): string {
  const p = Math.max(0, Math.min(1, proporcion));
  const ca = aRgb(a);
  const cb = aRgb(b);
  const canal = (x: number, y: number) => Math.round(x + (y - x) * p);
  return aHex(canal(ca[0], cb[0]), canal(ca[1], cb[1]), canal(ca[2], cb[2]));
}

function aRgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  return [
    parseInt(limpio.slice(0, 2), 16),
    parseInt(limpio.slice(2, 4), 16),
    parseInt(limpio.slice(4, 6), 16),
  ];
}

function aHex(r: number, g: number, b: number): string {
  const dos = (n: number) => n.toString(16).padStart(2, '0');
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}

function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

// ---------------------------------------------------------------------------

/** Texto corto para lectores de pantalla y para la etiqueta bajo el gemelo. */
export function describirMorfologia(morfologia: Morfologia): string {
  if (morfologia.senal === 'ahogo') {
    return 'Caída por exceso de agua: la raíz no está pudiendo beber.';
  }
  if (morfologia.senal === 'sed') {
    return morfologia.caida > 0.5
      ? 'Marchita por falta de agua.'
      : 'Empezando a perder turgencia por sed.';
  }
  if (morfologia.flores > 0) return 'Sana y en floración.';
  if (morfologia.brotes > 0) return 'Sana y echando brotes nuevos.';
  return 'Erguida y sana.';
}
