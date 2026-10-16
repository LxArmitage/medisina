/**
 * Cómo viaja la red dentro de la app.
 *
 * Los pesos van como bytes (0–255) con su escala, igual que en el modelo
 * cuantizado del que salen: pesan la cuarta parte que en números de 32 bits.
 * Se desempacan una sola vez, al primer escaneo, a números normales.
 *
 * Todo cabe en un JSON con los bytes en base64. No es lo más compacto, pero
 * se carga igual en el teléfono, en el navegador y en Jest, sin tocar el
 * sistema de archivos — y un archivo menos que puede faltar es una falla
 * menos.
 */

import type { Op, Red } from './red';

export interface OpEmpacada {
  tipo: 'conv' | 'porCanal' | 'suma';
  entrada: number;
  salida: number;
  /** Sólo en la suma: el otro sumando. */
  otra?: number;
  lado?: number;
  paso?: number;
  /** conv: canales de entrada y salida. porCanal: `canalesSalida` son sus canales. */
  canalesEntrada?: number;
  canalesSalida?: number;
  /** El rango de la salida: activación incluida. */
  bajo: number;
  alto: number;
  /** Una escala y un cero por canal de salida, o uno solo para toda la capa. */
  escala?: number[];
  cero?: number[];
  /** Dónde empiezan sus pesos en los bytes, y cuántos son. */
  desde?: number;
  cuantos?: number;
  sesgo?: number[];
}

export interface RedEmpacada {
  formato: 'medisina-red-2';
  origen: string;
  lado: number;
  entradaEscala: number;
  entradaCero: number;
  mapaEntrada: number;
  mapaFinal: number;
  ops: OpEmpacada[];
  /** Todos los pesos, en base64. */
  bytes: string;
}

/** La red, desempacada de un jalón. Para el entrenamiento y las pruebas. */
export function desempacarRed(empacada: RedEmpacada, lado = empacada.lado): Red {
  const it = desempacarPorPartes(empacada, lado);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

/**
 * La red, desempacada por partes.
 *
 * Son dos millones de pesos: en el teléfono pasarlos de bytes a números tarda
 * un par de segundos. De un jalón congelaría la pantalla justo después de la
 * primera foto; por partes, cada `yield` es un respiro.
 */
export function* desempacarPorPartes(empacada: RedEmpacada, lado = empacada.lado): Generator<void, Red, void> {
  if (empacada.formato !== 'medisina-red-2') {
    throw new Error(`Formato de red desconocido: ${String(empacada.formato)}`);
  }
  const bytes = yield* desdeBase64PorPartes(empacada.bytes);

  const ops: Op[] = [];
  for (const o of empacada.ops) {
    // JSON no guarda ±Infinity (los escribe como null): sin rango es sin tope.
    const bajo = typeof o.bajo === 'number' ? o.bajo : -Infinity;
    const alto = typeof o.alto === 'number' ? o.alto : Infinity;
    if (o.tipo === 'suma') {
      ops.push({ tipo: 'suma', entrada: o.entrada, salida: o.salida, otra: o.otra ?? -1, bajo, alto });
      continue;
    }
    const cuantos = o.cuantos ?? 0;
    const desde = o.desde ?? 0;
    const escala = o.escala ?? [1];
    const cero = o.cero ?? [0];
    const canales = o.canalesSalida ?? 1;
    const pesos = new Float32Array(cuantos);

    // Una escala por canal de salida, o una para toda la capa. El canal de
    // salida es la dimensión de afuera en conv y la de adentro en porCanal;
    // los lazos van por canal para no dividir en cada peso.
    if (escala.length <= 1) {
      const s = escala[0] ?? 1;
      const z = cero[0] ?? 0;
      for (let i = 0; i < cuantos; i += 1) pesos[i] = (bytes[desde + i] - z) * s;
    } else if (o.tipo === 'conv') {
      const bloque = cuantos / canales;
      for (let c = 0; c < canales; c += 1) {
        const s = escala[c];
        const z = cero[c];
        const inicio = c * bloque;
        for (let i = inicio; i < inicio + bloque; i += 1) pesos[i] = (bytes[desde + i] - z) * s;
      }
    } else {
      for (let base = 0; base < cuantos; base += canales) {
        for (let c = 0; c < canales; c += 1) pesos[base + c] = (bytes[desde + base + c] - cero[c]) * escala[c];
      }
    }

    const sesgo = Float32Array.from(o.sesgo ?? []);
    const comun = { entrada: o.entrada, salida: o.salida, lado: o.lado ?? 1, paso: o.paso ?? 1, bajo, alto, pesos, sesgo };
    ops.push(
      o.tipo === 'conv'
        ? { tipo: 'conv', ...comun, canalesEntrada: o.canalesEntrada ?? 1, canalesSalida: canales }
        : { tipo: 'porCanal', ...comun, canales },
    );
    yield;
  }

  return {
    lado,
    entradaEscala: empacada.entradaEscala,
    entradaCero: empacada.entradaCero,
    mapaEntrada: empacada.mapaEntrada,
    mapaFinal: empacada.mapaFinal,
    ops,
  };
}

// ---------------------------------------------------------------------------
// Base64 sin `Buffer` ni `atob`: Hermes no trae el primero y el segundo no
// está en todas las versiones. De cuatro en cuatro caracteres y con tabla,
// porque son millones.
// ---------------------------------------------------------------------------

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const TABLA = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < ABC.length; i += 1) t[ABC.charCodeAt(i)] = i;
  return t;
})();

function valor(texto: string, i: number): number {
  const c = texto.charCodeAt(i);
  return c < 256 ? TABLA[c] : -1;
}

/** Base64 "limpio": sin espacios ni saltos, relleno sólo al final. Es el de nuestros archivos. */
function esLimpio(texto: string): boolean {
  return texto.length % 4 === 0 && !/[^A-Za-z0-9+/=]/.test(texto) && !/=[^=]/.test(texto);
}

function bytesDe(texto: string): number {
  let relleno = 0;
  if (texto.endsWith('==')) relleno = 2;
  else if (texto.endsWith('=')) relleno = 1;
  return (texto.length / 4) * 3 - relleno;
}

/** Decodifica los caracteres [inicio, fin) —múltiplo de 4— a partir del byte `j`. */
function decodificarTramo(texto: string, inicio: number, fin: number, salida: Uint8Array, j: number) {
  for (let i = inicio; i < fin; i += 4) {
    const a = valor(texto, i);
    const b = valor(texto, i + 1);
    const c = valor(texto, i + 2);
    const d = valor(texto, i + 3);
    salida[j] = (a << 2) | (b >> 4);
    if (c >= 0) salida[j + 1] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) salida[j + 2] = ((c & 3) << 6) | d;
    j += 3;
  }
}

export function desdeBase64(texto: string): Uint8Array {
  if (!esLimpio(texto)) return desdeBase64Lento(texto);
  const salida = new Uint8Array(bytesDe(texto));
  decodificarTramo(texto, 0, texto.length, salida, 0);
  return salida;
}

/** Para textos con espacios o saltos de línea: ignora todo lo que no sea base64. */
function desdeBase64Lento(texto: string): Uint8Array {
  const bytes: number[] = [];
  let acumulado = 0;
  let bits = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const v = valor(texto, i);
    if (v < 0) continue;
    acumulado = ((acumulado << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulado >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** Decodifica por partes: un `yield` cada tanto. Para no congelar la pantalla. */
function* desdeBase64PorPartes(texto: string): Generator<void, Uint8Array, void> {
  if (!esLimpio(texto)) return desdeBase64Lento(texto);
  const salida = new Uint8Array(bytesDe(texto));
  const TROZO = 400_000; // múltiplo de 4: cada 4 caracteres son 3 bytes
  for (let i = 0; i < texto.length; i += TROZO) {
    decodificarTramo(texto, i, Math.min(texto.length, i + TROZO), salida, (i / 4) * 3);
    yield;
  }
  return salida;
}

export function aBase64(bytes: Uint8Array): string {
  let salida = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    salida += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63] + ABC[(n >> 6) & 63] + ABC[n & 63];
  }
  const resto = bytes.length - i;
  if (resto === 1) {
    const n = bytes[i] << 16;
    salida += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63] + '==';
  } else if (resto === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    salida += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63] + ABC[(n >> 6) & 63] + '=';
  }
  return salida;
}
