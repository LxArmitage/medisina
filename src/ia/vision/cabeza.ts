/**
 * La última capa: de los rasgos de la foto a qué especie del catálogo es.
 *
 * La red de Google sabe VER plantas; esta capa, entrenada aquí con fotos de
 * cada especie del catálogo (`entrenamiento/vision/entrenar.ts`), sabe cuál
 * de las NUESTRAS es. Trae además la clase "otra": plantas que no están en el
 * catálogo, para poder decir "ésta no la conozco" en vez de adivinar.
 */

import { desdeBase64 } from './formato';

/** Lo que sacó en fotos que nunca vio. Se guarda para no prometer de más. */
export interface ExamenCabeza {
  fotos: number;
  top1: number;
  top3: number;
  seguras: Array<{ umbral: number; aciertos: number; cubre: number }>;
}

/** Una capa en bytes: por cada salida, sus pesos con signo (128 = cero) y su escala. */
export interface CapaEmpacada {
  escalas: number[];
  sesgos: number[];
  bytes: string;
}

/** La primera versión: una sola capa, de los rasgos directo a las clases. */
export interface CabezaEmpacada1 {
  formato: 'medisina-cabeza-1';
  /** Lado de foto con el que se entrenó. El teléfono debe mirar igual. */
  lado: number;
  /** Id de especie del catálogo, u "otra". */
  clases: string[];
  dimension: number;
  escalas: number[];
  sesgos: number[];
  /** Divide las salidas para que las probabilidades digan la verdad. */
  temperatura: number;
  bytes: string;
  examen: ExamenCabeza;
  entrenadaEn: string;
}

/**
 * La segunda: una capa oculta entre los rasgos y las clases.
 *
 * Con una sola capa, cada especie es una suma de rasgos: "hojas grandes" más
 * "verde oscuro" menos "espinas". Con la oculta aprende combinaciones —hojas
 * grandes Y con agujeros es monstera; grandes sin agujeros puede ser otra
 * cosa—, y con 57 clases eso vale 9 puntos de acierto en el examen. Cuesta
 * 700 mil multiplicaciones más por foto: nada junto a los 300 millones de la red.
 */
export interface CabezaEmpacada2 {
  formato: 'medisina-cabeza-2';
  lado: number;
  clases: string[];
  dimension: number;
  oculta: number;
  /** De los rasgos a la capa oculta. La normalización de los rasgos ya va adentro. */
  capa1: CapaEmpacada;
  /** De la capa oculta a las clases. */
  capa2: CapaEmpacada;
  temperatura: number;
  examen: ExamenCabeza;
  entrenadaEn: string;
}

export type CabezaEmpacada = CabezaEmpacada1 | CabezaEmpacada2;

interface Capa {
  entradas: number;
  salidas: number;
  /** Salida por salida: `pesos[k * entradas + i]`. */
  pesos: Float32Array;
  sesgos: Float32Array;
}

export interface Cabeza {
  lado: number;
  clases: string[];
  dimension: number;
  /** Entre una y otra va una ReLU; la última da las clases. */
  capas: Capa[];
  temperatura: number;
}

function desempacarCapa(c: CapaEmpacada, entradas: number, salidas: number): Capa {
  const bytes = desdeBase64(c.bytes);
  if (bytes.length !== entradas * salidas) throw new Error(`Capa de ${bytes.length} bytes; se esperaban ${entradas * salidas}`);
  const pesos = new Float32Array(entradas * salidas);
  for (let k = 0; k < salidas; k += 1) {
    const e = c.escalas[k];
    const base = k * entradas;
    for (let i = 0; i < entradas; i += 1) pesos[base + i] = (bytes[base + i] - 128) * e;
  }
  return { entradas, salidas, pesos, sesgos: Float32Array.from(c.sesgos) };
}

export function desempacarCabeza(c: CabezaEmpacada): Cabeza {
  const clases = c.clases.length;
  if (c.formato === 'medisina-cabeza-1') {
    const capa = desempacarCapa({ escalas: c.escalas, sesgos: c.sesgos, bytes: c.bytes }, c.dimension, clases);
    return { lado: c.lado, clases: c.clases, dimension: c.dimension, capas: [capa], temperatura: c.temperatura || 1 };
  }
  if (c.formato === 'medisina-cabeza-2') {
    return {
      lado: c.lado,
      clases: c.clases,
      dimension: c.dimension,
      capas: [desempacarCapa(c.capa1, c.dimension, c.oculta), desempacarCapa(c.capa2, c.oculta, clases)],
      temperatura: c.temperatura || 1,
    };
  }
  throw new Error(`Formato de cabeza desconocido: ${String((c as { formato?: unknown }).formato)}`);
}

function aplicar(capa: Capa, entrada: ArrayLike<number>, relu: boolean): Float32Array {
  const { entradas, salidas, pesos, sesgos } = capa;
  const salida = new Float32Array(salidas);
  for (let k = 0; k < salidas; k += 1) {
    let s = sesgos[k];
    const base = k * entradas;
    for (let i = 0; i < entradas; i += 1) s += pesos[base + i] * entrada[i];
    salida[k] = relu && s < 0 ? 0 : s;
  }
  return salida;
}

/** Probabilidad de cada clase para un vector de rasgos. */
export function probabilidades(cabeza: Cabeza, rasgos: ArrayLike<number>): number[] {
  let x: ArrayLike<number> = rasgos;
  cabeza.capas.forEach((capa, i) => {
    x = aplicar(capa, x, i < cabeza.capas.length - 1);
  });
  const z = Array.from(x, (v) => v / cabeza.temperatura);
  const mayor = Math.max(...z);
  const e = z.map((v) => Math.exp(v - mayor));
  const suma = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / suma);
}

/**
 * Junta lo que dicen varias fotos de la misma planta.
 *
 * Se suman los logaritmos: una especie tiene que ser creíble en TODAS las fotos
 * para ganar. Con un promedio simple, una foto borrosa muy convencida de algo
 * raro arrastraría el resultado.
 *
 * La suma se divide entre √n, un punto medio a propósito. Sumar sin dividir
 * trataría las fotos como independientes —y dos fotos de la misma planta no lo
 * son: dos que coinciden dirían 99 % donde lo justo es 80—. Dividir entre n (la
 * media) haría que coincidir no sumara nada. Con √n, dos fotos que dicen lo
 * mismo suben la seguridad un poco, y dos que se contradicen la bajan.
 */
export function combinar(listas: number[][]): number[] {
  if (listas.length === 0) return [];
  if (listas.length === 1) return listas[0];
  const n = listas[0].length;
  const log = new Array<number>(n).fill(0);
  const factor = 1 / Math.sqrt(listas.length);
  for (const p of listas) for (let k = 0; k < n; k += 1) log[k] += Math.log(Math.max(1e-9, p[k])) * factor;
  const mayor = Math.max(...log);
  const e = log.map((v) => Math.exp(v - mayor));
  const suma = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / suma);
}
