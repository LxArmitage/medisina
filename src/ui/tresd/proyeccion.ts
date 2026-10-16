/**
 * De la malla 3D a polígonos que se pueden dibujar.
 *
 * Es el "motor" del gemelo, y es chico a propósito: girar cada punto, ponerlo
 * en perspectiva, calcular cuánta luz le llega a cada cara y ordenarlas de la
 * más lejana a la más cercana (las de adelante tapan a las de atrás: el método
 * del pintor). No hay tarjeta de video de por medio, así que funciona igual en
 * el iPhone, en Android, en el navegador y en Jest.
 *
 * Para que el teléfono lo mueva con soltura, las caras vecinas que quedan del
 * mismo color se juntan en un solo trazo: un helecho de mil caras termina en
 * unos cuantos cientos de polígonos.
 */

import { hexARgb, rgbAHex } from '../../dominio/forma';
import type { TipoParte } from '../../dominio/partes';
import type { Cara, Malla, V3 } from './malla';

export interface Encuadre {
  centro: V3;
  /** Radio de la esfera que la envuelve: de él sale la distancia de la cámara. */
  radio: number;
  /** Qué tan lejos del eje vertical llega: lo que ocupa a lo ancho al girar. */
  radioHorizontal: number;
  /** Media altura. */
  medioAlto: number;
}

export interface Vista {
  /** Giro alrededor del eje vertical, en radianes. */
  giro: number;
  /** Inclinación: positivo = se ve más desde arriba. */
  inclinacion: number;
  ancho: number;
  alto: number;
}

export interface Poligono {
  /** Trazo SVG, ya en coordenadas de pantalla. */
  d: string;
  fill: string;
  opacidad: number;
  parte: TipoParte;
  indice?: number;
}

/** Un triángulo o cuadrilátero ya proyectado, para saber qué se tocó. */
export interface CaraEnPantalla {
  puntos: Array<[number, number]>;
  parte: TipoParte;
  indice?: number;
}

export interface Dibujo {
  poligonos: Poligono[];
  /** Ordenadas de atrás hacia adelante; la última que contenga el dedo es la tocada. */
  caras: CaraEnPantalla[];
}

/** La esfera que envuelve a la planta: sirve para que quepa girada como sea. */
export function encuadrar(malla: Malla): Encuadre {
  let min: V3 = [Infinity, Infinity, Infinity];
  let max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const c of malla.caras) {
    for (const p of c.p) {
      min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
      max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
    }
  }
  if (!Number.isFinite(min[0])) return { centro: [0, 0, 0], radio: 1, radioHorizontal: 1, medioAlto: 1 };
  // El eje vertical pasa por donde está plantada (x = z = 0), no por el centro
  // de la caja: así gira sobre su maceta y no "orbita".
  const centro: V3 = [0, (min[1] + max[1]) / 2, 0];
  let radio = 0;
  let radioHorizontal = 0;
  for (const c of malla.caras) {
    for (const p of c.p) {
      radio = Math.max(radio, Math.hypot(p[0], p[1] - centro[1], p[2]));
      radioHorizontal = Math.max(radioHorizontal, Math.hypot(p[0], p[2]));
    }
  }
  return {
    centro,
    radio: radio || 1,
    radioHorizontal: radioHorizontal || 1,
    medioAlto: (max[1] - min[1]) / 2 || 1,
  };
}

/** De dónde viene la luz (hacia la cámara, arriba a la izquierda). */
const LUZ: V3 = normal([-0.45, 0.75, 0.55]);
const AMBIENTE = 0.52;
const DIFUSA = 0.68;

function normal(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

const cacheColor = new Map<string, string>();

/** El color de la cara con su luz. Cuantizado para que las vecinas se junten. */
function iluminar(base: string, luz: number, brillo: number, especular: number): string {
  const nivel = Math.round(luz * 24) / 24;
  const destello = Math.round(especular * brillo * 12) / 12;
  const clave = `${base}|${nivel}|${destello}`;
  const ya = cacheColor.get(clave);
  if (ya) return ya;
  const [r, g, b] = hexARgb(base);
  const k = nivel;
  const s = destello * 150;
  const c = rgbAHex(r * k + s, g * k + s, b * k + s);
  if (cacheColor.size > 20000) cacheColor.clear();
  cacheColor.set(clave, c);
  return c;
}

/**
 * Proyecta la malla vista desde `vista`.
 *
 * Con `parteActiva`, todo lo demás se ve deslavado: así la parte de la que se
 * está hablando resalta sin moverla ni pintarla encima.
 */
export function proyectar(
  malla: Malla,
  vista: Vista,
  encuadre: Encuadre = encuadrar(malla),
  opciones: { parteActiva?: { tipo: TipoParte; indice?: number } | null; margen?: number } = {},
): Dibujo {
  const { centro, radio, radioHorizontal, medioAlto } = encuadre;
  const cg = Math.cos(vista.giro);
  const sg = Math.sin(vista.giro);
  const ci = Math.cos(vista.inclinacion);
  const si = Math.sin(vista.inclinacion);
  const margen = opciones.margen ?? 0.92;
  // La cámara, a tres radios del centro: perspectiva visible pero sin
  // deformar. El foco se calcula para que quepa a lo ancho girada como sea, y
  // a lo alto con la inclinación que tenga.
  const distancia = radio * 3;
  const cerca = distancia - radioHorizontal;
  const altoVisto = medioAlto * Math.cos(vista.inclinacion) + radioHorizontal * Math.abs(Math.sin(vista.inclinacion));
  const foco = Math.min(
    (vista.ancho * 0.5 * margen * cerca) / radioHorizontal,
    (vista.alto * 0.5 * margen * cerca) / altoVisto,
  );
  const cx = vista.ancho / 2;
  const cy = vista.alto / 2;

  const girar = (p: V3): V3 => {
    const x = p[0] - centro[0];
    const y = p[1] - centro[1];
    const z = p[2] - centro[2];
    const x1 = x * cg - z * sg;
    const z1 = x * sg + z * cg;
    // Inclinar: la cámara sube, la planta se ve desde arriba.
    const y2 = y * ci - z1 * si;
    const z2 = y * si + z1 * ci;
    return [x1, y2, z2];
  };

  interface Pendiente {
    pantalla: Array<[number, number]>;
    profundidad: number;
    fill: string;
    opacidad: number;
    parte: TipoParte;
    indice?: number;
  }
  const lista: Pendiente[] = [];
  const activa = opciones.parteActiva ?? null;

  for (const cara of malla.caras) {
    const g = cara.p.map(girar);
    const n = normalDe(g);
    // Hacia dónde está la cámara desde la cara.
    const centroCara = promedio(g);
    const aCamara = normal([-centroCara[0], -centroCara[1], distancia - centroCara[2]]);
    let nf = n;
    if (!cara.dobleCara && cara.interior) {
      // Lo sólido: la normal tiene que apuntar hacia afuera del cuerpo.
      const adentro = girar(cara.interior);
      const haciaFuera: V3 = [centroCara[0] - adentro[0], centroCara[1] - adentro[1], centroCara[2] - adentro[2]];
      if (punto(nf, haciaFuera) < 0) nf = [-nf[0], -nf[1], -nf[2]];
      // Y si mira hacia atrás, no se dibuja: la tapa lo que está enfrente.
      if (punto(nf, aCamara) < -0.02) continue;
    }
    let reves = false;
    if (cara.dobleCara && punto(nf, aCamara) < 0) {
      nf = [-nf[0], -nf[1], -nf[2]];
      reves = true;
    }
    const difusa = Math.max(0, punto(nf, LUZ));
    const medio = normal([LUZ[0] + aCamara[0], LUZ[1] + aCamara[1], LUZ[2] + aCamara[2]]);
    const especular = Math.pow(Math.max(0, punto(nf, medio)), 18);
    // El envés de una hoja es un poco más oscuro que el haz.
    const luz = (AMBIENTE + DIFUSA * difusa) * (reves ? 0.82 : 1);
    const esActiva =
      !activa || (activa.tipo === cara.parte && (activa.indice === undefined || activa.indice === cara.indice));

    const pantalla = g.map((p): [number, number] => {
      const k = foco / Math.max(0.001, distancia - p[2]);
      return [cx + p[0] * k, cy - p[1] * k];
    });
    lista.push({
      pantalla,
      profundidad: centroCara[2],
      fill: iluminar(cara.color, luz, cara.brillo, especular),
      opacidad: (cara.opacidad ?? 1) * (esActiva ? 1 : 0.28),
      parte: cara.parte,
      indice: cara.indice,
    });
  }

  lista.sort((a, b) => a.profundidad - b.profundidad);

  const poligonos: Poligono[] = [];
  const caras: CaraEnPantalla[] = [];
  let actual: Poligono | null = null;
  for (const c of lista) {
    caras.push({ puntos: c.pantalla, parte: c.parte, indice: c.indice });
    const d = trazo(c.pantalla);
    if (actual && actual.fill === c.fill && actual.opacidad === c.opacidad && actual.parte === c.parte && actual.indice === c.indice) {
      actual.d += d;
    } else {
      actual = { d, fill: c.fill, opacidad: c.opacidad, parte: c.parte, indice: c.indice };
      poligonos.push(actual);
    }
  }
  return { poligonos, caras };
}

/** Dónde cae en pantalla un punto del espacio, con la misma cámara que `proyectar`. */
export function puntoEnPantalla(p: V3, vista: Vista, encuadre: Encuadre, margen = 0.92): [number, number] {
  const { centro, radio, radioHorizontal, medioAlto } = encuadre;
  const distancia = radio * 3;
  const cerca = distancia - radioHorizontal;
  const altoVisto = medioAlto * Math.cos(vista.inclinacion) + radioHorizontal * Math.abs(Math.sin(vista.inclinacion));
  const foco = Math.min((vista.ancho * 0.5 * margen * cerca) / radioHorizontal, (vista.alto * 0.5 * margen * cerca) / altoVisto);
  const x = p[0] - centro[0];
  const y = p[1] - centro[1];
  const z = p[2] - centro[2];
  const cg = Math.cos(vista.giro);
  const sg = Math.sin(vista.giro);
  const x1 = x * cg - z * sg;
  const z1 = x * sg + z * cg;
  const y2 = y * Math.cos(vista.inclinacion) - z1 * Math.sin(vista.inclinacion);
  const z2 = y * Math.sin(vista.inclinacion) + z1 * Math.cos(vista.inclinacion);
  const k = foco / Math.max(0.001, distancia - z2);
  return [vista.ancho / 2 + x1 * k, vista.alto / 2 - y2 * k];
}

/** El punto más bajo de la malla: donde va la sombra en el piso. */
export function pieDe(malla: Malla): V3 {
  // El pie es la base del recipiente, no lo más bajo de la planta: las guías
  // de un pothos cuelgan por debajo de la maceta, y pararla en la punta de sus
  // hojas la dejaba flotando. Sin recipiente (las que flotan), lo más bajo.
  const bajo = (filtro: (c: Malla['caras'][number]) => boolean) => {
    let min = Infinity;
    for (const c of malla.caras) if (filtro(c)) for (const p of c.p) min = Math.min(min, p[1]);
    return min;
  };
  const base = [bajo((c) => c.parte === 'sustrato'), bajo((c) => c.parte === 'raiz'), bajo(() => true)].find(Number.isFinite);
  return [0, base ?? 0, 0];
}

/** La cara que está bajo el dedo: la más cercana que contenga el punto. */
export function caraEn(dibujo: Dibujo, x: number, y: number): CaraEnPantalla | null {
  for (let i = dibujo.caras.length - 1; i >= 0; i -= 1) {
    if (dentro(dibujo.caras[i].puntos, x, y)) return dibujo.caras[i];
  }
  return null;
}

function dentro(pts: Array<[number, number]>, x: number, y: number): boolean {
  let adentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) adentro = !adentro;
  }
  return adentro;
}

function trazo(pts: Array<[number, number]>): string {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) d += `L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d + 'Z';
}

function normalDe(p: V3[]): V3 {
  const a: V3 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
  const b: V3 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  let n: V3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  if (Math.hypot(n[0], n[1], n[2]) < 1e-12 && p.length > 3) {
    const c: V3 = [p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]];
    n = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
  }
  return normal(n);
}

function promedio(p: V3[]): V3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const q of p) {
    x += q[0];
    y += q[1];
    z += q[2];
  }
  return [x / p.length, y / p.length, z / p.length];
}

function punto(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
