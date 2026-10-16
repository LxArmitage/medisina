/**
 * Cómo se ve la planta en la foto del escaneo: su verde, su segundo color y
 * su proporción.
 *
 * Es la mitad del gemelo que no sale del catálogo. La especie dice "espadas con
 * bandas"; la foto dice de qué verde son TUS espadas, si tienen el borde
 * amarillo, y si tu planta es alta y angosta o baja y abierta. Con eso el
 * gemelo deja de ser una lengua de suegra cualquiera.
 *
 * QUÉ NO HACE. No separa la planta del fondo con precisión de laboratorio: se
 * queda con los píxeles que tienen color de planta (verdes, verde-azulados de
 * las suculentas, amarillo-verdosos) y descarta lo gris, lo muy oscuro y lo
 * muy blanco. Si en la foto hay poca planta, no inventa: devuelve `null` y el
 * gemelo usa los colores de su especie.
 *
 * Puro, sobre un arreglo de píxeles: se prueba con imágenes sintéticas.
 */

import { rgbAHex } from './forma';
import type { Imagen } from './vision';

export interface MedidaDeFoto {
  hoja: string;
  hojaOscura: string;
  acento?: string;
  /** Alto entre ancho de la silueta. */
  proporcion: number;
  /** Qué parte de la foto es planta, 0-1. */
  cobertura: number;
}

/** Menos de esto de la foto con color de planta, y mejor no opinar. */
const COBERTURA_MINIMA = 0.04;

/** Si el píxel tiene color de hoja. */
export function esVegetal(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturacion = max === 0 ? 0 : (max - min) / max;
  if (max < 35 || saturacion < 0.12) return false;
  if (min > 225) return false;
  // Verde que domina al rojo; admite el verde-azulado de agaves y echeverias
  // (verde y azul parejos, por encima del rojo) y el verde-amarillo de una
  // planta con sed, pero no el café de la tierra ni el terracota de la maceta.
  const verdeSobreRojo = g > r * 1.04;
  const verdeAzulado = g >= r && b > r * 1.05 && Math.abs(g - b) < 45;
  return verdeSobreRojo || verdeAzulado;
}

export function medirPlanta(img: Imagen): MedidaDeFoto | null {
  const { ancho, alto, datos } = img;
  if (!(ancho > 0 && alto > 0) || datos.length < ancho * alto * 4) return null;

  const muestras: Array<[number, number, number, number]> = [];
  let x0 = ancho;
  let x1 = -1;
  let y0 = alto;
  let y1 = -1;
  // Filas y columnas con planta: para la silueta, sin que un píxel suelto la estire.
  const porFila = new Array<number>(alto).fill(0);
  const porColumna = new Array<number>(ancho).fill(0);

  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      const i = (y * ancho + x) * 4;
      const r = datos[i];
      const g = datos[i + 1];
      const b = datos[i + 2];
      if (!esVegetal(r, g, b)) continue;
      porFila[y] += 1;
      porColumna[x] += 1;
      muestras.push([r, g, b, 0.299 * r + 0.587 * g + 0.114 * b]);
    }
  }

  const cobertura = muestras.length / (ancho * alto);
  if (cobertura < COBERTURA_MINIMA) return null;

  const umbralFila = Math.max(1, ancho * 0.02);
  const umbralColumna = Math.max(1, alto * 0.02);
  porFila.forEach((n, y) => {
    if (n >= umbralFila) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  });
  porColumna.forEach((n, x) => {
    if (n >= umbralColumna) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  });
  const proporcion = x1 >= x0 && y1 >= y0 ? (y1 - y0 + 1) / (x1 - x0 + 1) : 1;

  // Por brillo: el tercio oscuro es la sombra de la hoja; el tramo medio-alto,
  // su color. Medianas, no promedios: un reflejo o una mancha no los mueven.
  muestras.sort((a, b) => a[3] - b[3]);
  const tramo = (desde: number, hasta: number) => mediana(muestras.slice(Math.floor(desde * muestras.length), Math.max(Math.floor(desde * muestras.length) + 1, Math.floor(hasta * muestras.length))));
  const oscuro = tramo(0.1, 0.4);
  const medio = tramo(0.45, 0.8);

  // Segundo color: dos grupos por color (no por brillo). Si el menor es
  // grande y bien distinto, es un patrón de la hoja: bandas, bordes, variegado.
  const acento = segundoColor(muestras);

  return {
    hoja: rgbAHex(medio[0], medio[1], medio[2]),
    hojaOscura: rgbAHex(oscuro[0], oscuro[1], oscuro[2]),
    acento: acento ? rgbAHex(acento[0], acento[1], acento[2]) : undefined,
    proporcion: Math.round(proporcion * 100) / 100,
    cobertura: Math.round(cobertura * 100) / 100,
  };
}

function mediana(lista: Array<[number, number, number, number]>): [number, number, number] {
  if (lista.length === 0) return [90, 140, 80];
  const canal = (k: number) => {
    const v = lista.map((m) => m[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  return [canal(0), canal(1), canal(2)];
}

/**
 * K-medias con dos grupos, sobre el color con el brillo quitado (cromaticidad):
 * así una hoja con sombra no cuenta como "dos colores", pero una con borde
 * amarillo sí.
 */
function segundoColor(muestras: Array<[number, number, number, number]>): [number, number, number] | null {
  const paso = Math.max(1, Math.floor(muestras.length / 1500));
  const puntos: Array<[number, number, number]> = [];
  const crudos: Array<[number, number, number]> = [];
  for (let i = 0; i < muestras.length; i += paso) {
    const [r, g, b] = muestras[i];
    const s = r + g + b || 1;
    puntos.push([r / s, g / s, b / s]);
    crudos.push([r, g, b]);
  }
  if (puntos.length < 20) return null;

  let c1 = puntos[0];
  let c2 = puntos[puntos.length - 1];
  let asignacion: number[] = [];
  for (let vuelta = 0; vuelta < 8; vuelta += 1) {
    asignacion = puntos.map((p) => (dist(p, c1) <= dist(p, c2) ? 0 : 1));
    const nuevo = (k: number): [number, number, number] => {
      const del = puntos.filter((_, i) => asignacion[i] === k);
      if (del.length === 0) return k === 0 ? c1 : c2;
      return [promedio(del, 0), promedio(del, 1), promedio(del, 2)];
    };
    c1 = nuevo(0);
    c2 = nuevo(1);
  }
  const n2 = asignacion.filter((a) => a === 1).length;
  const n1 = asignacion.length - n2;
  const menor = n1 < n2 ? 0 : 1;
  const fraccion = Math.min(n1, n2) / asignacion.length;
  if (fraccion < 0.12 || dist(c1, c2) < 0.045) return null;

  const delMenor = crudos.filter((_, i) => asignacion[i] === menor);
  return [promedio(delMenor, 0), promedio(delMenor, 1), promedio(delMenor, 2)].map(Math.round) as [number, number, number];
}

function dist(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function promedio(lista: Array<[number, number, number]>, k: number): number {
  let s = 0;
  for (const p of lista) s += p[k];
  return s / Math.max(1, lista.length);
}
