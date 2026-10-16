/**
 * Qué planta es, mirando la foto dentro del teléfono.
 *
 * Junta las tres piezas: la red de Google que sabe ver plantas (`red.ts`), la
 * capa entrenada aquí con las especies del catálogo (`cabeza.ts`) y la forma
 * de preparar la foto (`imagen.ts`). Sin internet, sin llave, sin costo.
 *
 * DOS TAMAÑOS DE FOTO. La red mira la foto a 160 px: es lo que mejor reconoce
 * (entre 56 especies, 77 de cada 100 a la primera en el examen y 90 entre las
 * tres primeras) y en un teléfono de estos años tarda unos 5 s. En uno más
 * lento eso se vuelve eterno, así que la primera vez se mide el teléfono con
 * una cuenta de prueba de unas milésimas y, si no da, se mira a 128 px: tarda
 * un tercio menos y pierde unos puntos. Cada tamaño tiene su propia última
 * capa, entrenada a ese tamaño.
 *
 * Lo que sabe y lo que no, medido en fotos que nunca vio al entrenarse, viene
 * en `EXAMEN_VISION` — se guarda con los pesos para que nadie prometa de más.
 */

import { desempacarCabeza, probabilidades } from './cabeza';
import type { Cabeza, CabezaEmpacada } from './cabeza';
import { desempacarPorPartes, desempacarRed } from './formato';
import type { RedEmpacada } from './formato';
import { cuadroCentral } from './imagen';
import type { Pixeles } from './imagen';
import { costoTotal, ejecutarOp, pasos, prepararEntrada } from './red';
import type { OpConv, Red } from './red';

// `require` y no `import`: son JSON grandes y TypeScript se pondría a inferir
// su tipo literal. La forma ya está declarada en `formato.ts` y `cabeza.ts`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CABEZA_160 = require('./cabeza-plantas.json') as CabezaEmpacada;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CABEZA_128 = require('./cabeza-plantas-128.json') as CabezaEmpacada;

/** La clase de "no es ninguna del catálogo". */
export const CLASE_OTRA = 'otra';

/** El examen del tamaño principal. Es la cifra que se le dice a la persona. */
export const EXAMEN_VISION = CABEZA_160.examen;

/** Lado con que se prepara la foto antes de mirarla: el mayor de los dos. */
export const LADO_VISION = CABEZA_160.lado;

/**
 * Hasta cuántos segundos se acepta tardar por foto a 160 px. Si el teléfono
 * haría más, se baja a 128.
 */
const SEGUNDOS_ACEPTABLES = 7;

interface Modelo {
  red: Red;
  cabezas: Record<number, Cabeza>;
}

let modelo: Modelo | null = null;
let cargando: Promise<Modelo> | null = null;
let ladoElegido: number | null = null;

function redEmpacada(): RedEmpacada {
  // Se pide hasta que hace falta: son casi 3 MB y no tienen por qué cargarse
  // al abrir la app, sólo al primer escaneo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./red-plantas.json') as RedEmpacada;
}

function cabezas(): Record<number, Cabeza> {
  return { [CABEZA_160.lado]: desempacarCabeza(CABEZA_160), [CABEZA_128.lado]: desempacarCabeza(CABEZA_128) };
}

/** La red, desempacada de un jalón. Para pruebas y entrenamiento. */
export function cargarVision(): { red: Red; cabeza: Cabeza } {
  if (!modelo) modelo = { red: desempacarRed(redEmpacada()), cabezas: cabezas() };
  return { red: modelo.red, cabeza: modelo.cabezas[CABEZA_160.lado] };
}

/**
 * La red, desempacada por partes y soltando el hilo entre una y otra.
 *
 * Son dos millones de pesos: en el teléfono tarda casi un segundo, y de un
 * jalón congelaría la pantalla justo después de la primera foto.
 */
export function prepararVision(respirar?: () => Promise<void>): Promise<Modelo> {
  if (modelo) return Promise.resolve(modelo);
  if (!cargando) {
    cargando = (async () => {
      const it = desempacarPorPartes(redEmpacada());
      for (;;) {
        const r = it.next();
        if (r.done) {
          modelo = { red: r.value, cabezas: cabezas() };
          return modelo;
        }
        if (respirar) await respirar();
      }
    })();
    // Si falla, que el siguiente intento empiece de cero.
    cargando.catch(() => {
      cargando = null;
    });
  }
  return cargando;
}

/**
 * Con qué tamaño mirar, según lo rápido que sea este teléfono.
 *
 * Se mide una vez: una convolución de prueba de dos millones de
 * multiplicaciones —la misma clase de cuenta que ocupa casi todo el tiempo de
 * la red— y con eso se estima cuánto tardaría la foto entera a 160 px.
 */
export function elegirLado(red: Red): number {
  if (ladoElegido !== null) return ladoElegido;
  const ci = 32;
  const co = 64;
  const lado = 32;
  const prueba: OpConv = {
    tipo: 'conv',
    entrada: 0,
    salida: 1,
    lado: 1,
    paso: 1,
    canalesEntrada: ci,
    canalesSalida: co,
    pesos: new Float32Array(ci * co).fill(0.01),
    sesgo: new Float32Array(co),
    bajo: 0,
    alto: 6,
  };
  const mapa = { alto: lado, ancho: lado, canales: ci, datos: new Float32Array(lado * lado * ci).fill(0.5) };
  const inicio = Date.now();
  ejecutarOp(prueba, mapa);
  const ms = Math.max(1, Date.now() - inicio);
  const porMs = (lado * lado * ci * co) / ms;
  const estimadoMs = costoTotal(red, { alto: CABEZA_160.lado, ancho: CABEZA_160.lado }) / porMs;
  ladoElegido = estimadoMs <= SEGUNDOS_ACEPTABLES * 1000 ? CABEZA_160.lado : CABEZA_128.lado;
  return ladoElegido;
}

export class Cancelado extends Error {
  constructor() {
    super('Se canceló la lectura de la foto.');
  }
}

export interface OpcionesMirar {
  /** Soltar el hilo un momento. En el teléfono, un `setTimeout(0)`. */
  respirar?: () => Promise<void>;
  alAvanzar?: (fraccion: number) => void;
  cancelado?: () => boolean;
  /** Forzar un tamaño (para pruebas). Si no, se elige según el teléfono. */
  lado?: number;
}

/**
 * La probabilidad de cada clase para una foto.
 *
 * Se entrega en pedazos: entre uno y otro suelta el hilo para que la pantalla
 * siga viva mientras la red piensa. Las clases salen en el orden de
 * `clasesVision()`, que es el mismo para los dos tamaños.
 */
export async function mirar(foto: Pixeles, opciones: OpcionesMirar = {}): Promise<number[]> {
  const { red, cabezas: todas } = await prepararVision(opciones.respirar);
  const lado = opciones.lado ?? elegirLado(red);
  const cabeza = todas[lado] ?? todas[CABEZA_160.lado];
  const cuadro = cuadroCentral(foto, cabeza.lado);
  const it = pasos(red, prepararEntrada(red, cuadro, cabeza.lado));
  for (;;) {
    const r = it.next();
    if (r.done) return probabilidades(cabeza, r.value);
    opciones.alAvanzar?.(r.value);
    if (opciones.respirar) await opciones.respirar();
    if (opciones.cancelado?.()) throw new Cancelado();
  }
}

/** Las clases del modelo, en el orden de las probabilidades. */
export function clasesVision(): string[] {
  return CABEZA_160.clases;
}

export interface Veredicto {
  /** Sólo especies del catálogo, de la más a la menos probable. */
  candidatos: Array<{ especieId: string; probabilidad: number }>;
  /** Qué tan probable es que no sea ninguna del catálogo. */
  otra: number;
}

export function veredicto(probs: number[], clases: string[] = CABEZA_160.clases): Veredicto {
  let otra = 0;
  const candidatos: Veredicto['candidatos'] = [];
  clases.forEach((clase, i) => {
    const p = Number.isFinite(probs[i]) ? probs[i] : 0;
    if (clase === CLASE_OTRA) otra = p;
    else candidatos.push({ especieId: clase, probabilidad: p });
  });
  candidatos.sort((a, b) => b.probabilidad - a.probabilidad);
  return { candidatos, otra };
}
