/**
 * El gemelo en 3D, como un montón de caras.
 *
 * POR QUÉ NO ES WEBGL. El 3D con three.js sobre expo-gl nunca terminó de
 * cargar en el iPhone: son cinco librerías encadenadas, con módulos nativos, y
 * cualquiera que no encaje deja el lienzo en blanco sin decir por qué. Esto es
 * geometría pura: puntos en el espacio agrupados en caras. `proyeccion.ts` las
 * gira, las pone en perspectiva y las ilumina, y el dibujo final son polígonos
 * de SVG — lo mismo que ya dibujaba el gemelo plano, que siempre funcionó en el
 * teléfono. Y como es pura, se prueba en Jest igual que el resto del dominio.
 *
 * CÓMO SE ARMA. La especie da la forma (`dominio/forma.ts`): una lengua de
 * suegra son espadas casi verticales con bandas; un potos, guías que caen por
 * la orilla con hojas de corazón; una sina, columnas con costillas. El estado
 * de hoy (`Morfologia`) dobla las hojas —una planta con sed se vence— y cambia
 * el color. Y lo que se midió en la foto del escaneo pone SU verde.
 *
 * Todo es determinista: la misma planta sale igual cada vez (la "semilla" es
 * su id), porque un gemelo que cambia de forma al abrirlo no se siente como un
 * gemelo.
 *
 * Ejes: y hacia arriba; la tierra de la maceta está en y = 0.
 */

import type { EstiloMaceta } from '../../dominio/decoracion';
import type { FormaEspecie, Apariencia, TipoFlor } from '../../dominio/forma';
import { mezclar } from '../../dominio/forma';
import type { Morfologia } from '../../dominio/morfologia';
import type { TipoParte } from '../../dominio/partes';

export type V3 = [number, number, number];

export interface Cara {
  /** 3 o 4 vértices. */
  p: V3[];
  /** Color antes de la luz. */
  color: string;
  parte: TipoParte;
  indice?: number;
  /** Hojas y pétalos se ven por los dos lados; lo sólido (maceta, tallos), no. */
  dobleCara: boolean;
  /** Para lo sólido: un punto de adentro, para saber hacia dónde mira la cara. */
  interior?: V3;
  /** 0 mate, 1 muy brillante. */
  brillo: number;
  opacidad?: number;
  /** La maceta o el frasco: no crece con la planta (ver `crecerMalla`). */
  fija?: boolean;
}

export interface Malla {
  caras: Cara[];
}

export type Recipiente = 'maceta' | 'suelo' | 'agua';

export interface EntradaMalla {
  forma: FormaEspecie;
  morfologia: Pick<Morfologia, 'altura' | 'elementos' | 'caida' | 'brotes' | 'flores' | 'frutos'> &
    Partial<Pick<Morfologia, 'desarrollo'>>;
  apariencia: Apariencia;
  recipiente: Recipiente;
  /** Enturbia el agua del frasco. */
  diasSinCambioAgua?: number | null;
  /** `bajo` para el patio (muchas plantas chiquitas), `alto` para la ficha. */
  detalle: 'bajo' | 'alto';
  /** Hace única a cada planta: su id. */
  semilla: string;
  /** Color de la maceta, según su material. */
  colorMaceta?: string;
  /** La maceta que eligió la persona (talavera, rosa mexicano…). Manda sobre el material. */
  estiloMaceta?: EstiloMaceta;
}

// ---------------------------------------------------------------------------
// Vectores
// ---------------------------------------------------------------------------

const suma = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const resta = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const por = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const punto = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unitario(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0];
}
const ARRIBA: V3 = [0, 1, 0];
const ABAJO: V3 = [0, -1, 0];

/** Una dirección a partir de su ángulo desde la vertical y su rumbo. */
function direccion(inclinacion: number, azimut: number): V3 {
  return [Math.sin(inclinacion) * Math.cos(azimut), Math.cos(inclinacion), Math.sin(inclinacion) * Math.sin(azimut)];
}

/** Un vector cualquiera perpendicular a `a`. */
function perpendicular(a: V3): V3 {
  const otro: V3 = Math.abs(a[1]) < 0.9 ? ARRIBA : [1, 0, 0];
  return unitario(cruz(a, otro));
}

/** Azar con semilla: la misma planta, la misma forma. */
function azar(semilla: string) {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i += 1) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

interface OpcionesHoja {
  base: V3;
  /** Hacia dónde sale. */
  dir: V3;
  /** Hacia dónde se dobla conforme crece (abajo para una hoja que se vence). */
  doblar: V3;
  /** Cuánto se dobla, 0-1. */
  curva: number;
  largo: number;
  ancho: number;
  /** Ancho relativo a lo largo de la hoja (0 base, 1 punta). */
  perfil: (t: number) => number;
  /** Altura del canal: positivo levanta las orillas (sábila). */
  pliegue: number;
  segmentos: number;
  /** Color de cada tramo: t a lo largo, u de −1 (orilla) a 1 (otra orilla). */
  color: (t: number, u: number) => string;
  parte: TipoParte;
  indice?: number;
  brillo: number;
  /** Giro de la hoja sobre su eje, de la base a la punta, en radianes. */
  torsion?: number;
  /** Para bordes de otro color: cortes transversales en 5 puntos, no en 3. */
  conBordes?: boolean;
  /**
   * Posiciones del corte transversal, de una orilla (1) a la otra (−1). Más
   * columnas permiten hojas anchas con cortes, como la monstera.
   */
  cortes?: number[];
  /** Tramos que no se dibujan: las hendiduras y huecos de la monstera. */
  hueco?: (t: number, u: number) => boolean;
  /** Dirección de "arriba" de la hoja, si no se quiere la de siempre. */
  ladoInicial?: V3;
}

/**
 * Una hoja (o pétalo): una cinta que sigue una curva, con su vena al centro.
 *
 * El corte transversal no es plano: la vena va más baja que las orillas (o al
 * revés), y eso es lo que hace que se vea como hoja y no como papel.
 */
function hoja(o: OpcionesHoja, salida: Cara[]) {
  const n = Math.max(2, o.segmentos);
  const paso = o.largo / n;
  const doblar = unitario(o.doblar);
  const ladoBase = o.ladoInicial ?? perpendicular(o.dir);

  const posiciones = o.cortes ?? (o.conBordes ? [1, 0.72, 0, -0.72, -1] : [1, 0, -1]);
  const cortes: V3[][] = [];
  let p = o.base;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const d = unitario(suma(o.dir, por(doblar, o.curva * 2.2 * Math.pow(t, 1.5))));
    let s = unitario(resta(ladoBase, por(d, punto(ladoBase, d))));
    if (o.torsion) {
      const g = o.torsion * t;
      s = unitario(suma(por(s, Math.cos(g)), por(cruz(d, s), Math.sin(g))));
    }
    const u = cruz(s, d);
    const w = (o.ancho * Math.max(0, o.perfil(t))) / 2;
    const alza = por(u, o.pliegue * w);
    // Cada punto del corte, con la orilla más alzada que la vena: un canal.
    cortes.push(posiciones.map((v) => suma(suma(p, por(s, w * v)), por(alza, Math.abs(v)))));
    p = suma(p, por(d, paso));
  }

  const ancho = cortes[0].length;
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / n;
    for (let j = 0; j < ancho - 1; j += 1) {
      const u = (posiciones[j] + posiciones[j + 1]) / 2;
      if (o.hueco?.(t, u)) continue;
      const caraP: V3[] = [cortes[i][j], cortes[i][j + 1], cortes[i + 1][j + 1], cortes[i + 1][j]];
      if (areaCasiNula(caraP)) continue;
      salida.push({
        p: caraP,
        color: o.color(t, u),
        parte: o.parte,
        indice: o.indice,
        dobleCara: true,
        brillo: o.brillo,
      });
    }
  }
}

function areaCasiNula(p: V3[]): boolean {
  const a = cruz(resta(p[1], p[0]), resta(p[2], p[0]));
  const b = p.length > 3 ? cruz(resta(p[2], p[0]), resta(p[3], p[0])) : [0, 0, 0];
  return Math.hypot(a[0], a[1], a[2]) + Math.hypot(b[0], b[1], b[2]) < 1e-7;
}

/**
 * Un cuerpo de revolución: se da el perfil (radio a cada altura) y se gira
 * alrededor de un eje. De aquí salen la maceta, el frasco, los tallos, los
 * troncos y los frutos.
 */
function torno(
  centro: V3,
  eje: V3,
  perfil: Array<[number, number]>,
  lados: number,
  color: (t: number, k: number) => string,
  parte: TipoParte,
  brillo: number,
  salida: Cara[],
  opciones: { opacidad?: number; dobleCara?: boolean; indice?: number } = {},
) {
  const a = unitario(eje);
  const e1 = perpendicular(a);
  const e2 = cruz(a, e1);
  const anillos = perfil.map(([h, r]) =>
    Array.from({ length: lados }, (_, k) => {
      const th = (k / lados) * Math.PI * 2;
      return suma(suma(centro, por(a, h)), suma(por(e1, Math.cos(th) * r), por(e2, Math.sin(th) * r)));
    }),
  );
  for (let i = 0; i < anillos.length - 1; i += 1) {
    const hMedia = (perfil[i][0] + perfil[i + 1][0]) / 2;
    const interior = suma(centro, por(a, hMedia));
    for (let k = 0; k < lados; k += 1) {
      const k2 = (k + 1) % lados;
      const p: V3[] = [anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]];
      if (areaCasiNula(p)) continue;
      salida.push({
        p,
        color: color(i / Math.max(1, anillos.length - 2), k),
        parte,
        indice: opciones.indice,
        dobleCara: opciones.dobleCara ?? false,
        interior: opciones.dobleCara ? undefined : interior,
        brillo,
        opacidad: opciones.opacidad,
      });
    }
  }
}

/** Un tubo que sigue una línea: tallos, guías, ramas, raíces. */
function tubo(
  puntos: V3[],
  radio: (t: number) => number,
  lados: number,
  color: string,
  parte: TipoParte,
  salida: Cara[],
  indice?: number,
) {
  if (puntos.length < 2) return;
  const anillos: V3[][] = [];
  let lado = perpendicular(unitario(resta(puntos[1], puntos[0])));
  puntos.forEach((q, i) => {
    const d = unitario(resta(puntos[Math.min(i + 1, puntos.length - 1)], puntos[Math.max(0, i - 1)]));
    lado = unitario(resta(lado, por(d, punto(lado, d))));
    const otro = cruz(d, lado);
    const r = radio(i / (puntos.length - 1));
    anillos.push(
      Array.from({ length: lados }, (_, k) => {
        const th = (k / lados) * Math.PI * 2;
        return suma(q, suma(por(lado, Math.cos(th) * r), por(otro, Math.sin(th) * r)));
      }),
    );
  });
  for (let i = 0; i < anillos.length - 1; i += 1) {
    const interior = por(suma(puntos[i], puntos[i + 1]), 0.5);
    for (let k = 0; k < lados; k += 1) {
      const k2 = (k + 1) % lados;
      salida.push({
        p: [anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]],
        color,
        parte,
        indice,
        dobleCara: false,
        interior,
        brillo: 0.15,
      });
    }
  }
}

/** Una curva suave de 3 puntos de control, muestreada. */
function curva(a: V3, b: V3, c: V3, n: number): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return suma(suma(por(a, u * u), por(b, 2 * u * t)), por(c, t * t));
  });
}

/** Una esfera chica (fruto, botón, centro de flor), con su perfil. */
function bola(
  c: V3,
  r: number,
  color: string,
  parte: TipoParte,
  salida: Cara[],
  alargar = 1,
  eje: V3 = ARRIBA,
  brillo = 0.5,
  indice?: number,
) {
  const perfil: Array<[number, number]> = [];
  const n = 5;
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI;
    perfil.push([-Math.cos(a) * r * alargar, Math.max(0.0001, Math.sin(a) * r)]);
  }
  torno(c, eje, perfil, 8, () => color, parte, brillo, salida, { indice });
}

// ---------------------------------------------------------------------------
// Perfiles de hoja
// ---------------------------------------------------------------------------

/**
 * Seno que nunca baja de cero. En la punta de la hoja `sin(π)` da, por
 * redondeo, un negativo diminuto, y elevarlo a una potencia fraccionaria da
 * NaN — que en el teléfono tumba la pantalla. Pasó con el espatifilo.
 */
const sen = (x: number) => Math.max(0, Math.sin(x));

const PERFILES: Record<string, (t: number) => number> = {
  // Ancha a la mitad, punta afilada, base casi del mismo ancho: la sansevieria.
  espada: (t) => Math.pow(1 - Math.pow(t, 3.5), 0.8) * (0.72 + 0.28 * sen(Math.PI * Math.min(1, t * 1.4))),
  cinta: (t) => (1 - t * t) * (0.55 + 0.45 * sen(Math.PI * Math.min(1, t * 1.6))),
  // Pecíolo delgado y luego la lámina: espatifilo, ficus, chile, aguacate.
  lanceolada: (t) => (t < 0.18 ? 0.08 : Math.pow(sen((Math.PI * (t - 0.18)) / 0.82), 0.75)),
  ovalada: (t) => (t < 0.1 ? 0.12 : Math.pow(sen((Math.PI * (t - 0.1)) / 0.9), 0.55)),
  // Lóbulos anchos junto al pecíolo y punta aguda.
  corazon: (t) => Math.pow(sen(Math.PI * (0.16 + 0.84 * t)), 0.62) * (1.05 - 0.2 * t),
  aguja: (t) => (1 - t) * 0.9 + 0.1,
  // Gruesa en la base y afilada: sábila, agave, echeveria.
  penca: (t) => Math.pow(1 - t, 0.85),
  foliolo: (t) => Math.pow(sen(Math.PI * t), 0.6),
  // Ancha arriba, redonda, con una cintura a media hoja: el ficus lira.
  violin: (t) =>
    t < 0.08
      ? 0.1
      : Math.pow(sen((Math.PI * (t - 0.08)) / 0.92), 0.32) * (0.6 + 0.4 * t) * (1 - 0.17 * Math.exp(-Math.pow((t - 0.42) / 0.1, 2))),
  // Larga, de lados casi paralelos y puntas romas: plátano, ave del paraíso.
  remo: (t) => Math.pow(sen(Math.PI * t), 0.28),
  // Cada lóbulo de la hoja del papayo.
  palmeada: (t) => Math.pow(sen(Math.PI * t), 0.6) * (1 - 0.25 * t),
};

// ---------------------------------------------------------------------------
// El armado
// ---------------------------------------------------------------------------

/** Altura de la planta en el espacio de la escena, a partir de la morfología. */
function alturaDe(m: EntradaMalla['morfologia']): number {
  // Hasta 2.5: las que cuelgan crecen alargando sus guías (ver `proyeccion.ts`).
  const a = Number.isFinite(m.altura) ? Math.max(0.2, Math.min(2.5, m.altura)) : 0.6;
  return 0.45 + a * 1.25;
}

export function armarMalla(e: EntradaMalla): Malla {
  const caras: Cara[] = [];
  const r = azar(e.semilla + e.forma.porte);
  const H = alturaDe(e.morfologia);
  const seg = e.detalle === 'alto' ? 1 : 0.6;
  const ctx: Contexto = { e, r, H, seg, caras };

  switch (e.forma.porte) {
    case 'roseta':
      roseta(ctx);
      break;
    case 'columnas':
      columnas(ctx);
      break;
    case 'pencas':
      pencas(ctx);
      break;
    case 'mata':
      mata(ctx);
      break;
    case 'arbusto':
      arbusto(ctx);
      break;
    case 'arbol':
      arbol(ctx);
      break;
    case 'trepadora':
      trepadora(ctx);
      break;
    case 'monstera':
      monstera(ctx);
      break;
    case 'fronda':
      fronda(ctx);
      break;
    case 'zz':
      zz(ctx);
      break;
    case 'palma':
      palma(ctx);
      break;
    case 'colgante':
      colgante(ctx);
      break;
    case 'flotante':
      flotante(ctx);
      break;
    case 'bola':
      bolas(ctx);
      break;
    case 'cana':
      cana(ctx);
      break;
    case 'poste':
      poste(ctx);
      break;
    case 'remos':
      remos(ctx);
      break;
    case 'papayo':
      papayo(ctx);
      break;
    case 'vara':
      vara(ctx);
      break;
    case 'sombrillas':
      sombrillas(ctx);
      break;
  }
  // La maceta va al final y a la medida: una echeveria chiquita en una maceta
  // de limonero se ve perdida. Las que cuelgan por la orilla (potos, cola de
  // burro) ya están pensadas para la maceta de siempre.
  const cuelga = e.forma.porte === 'trepadora' || e.forma.porte === 'colgante';
  let radioPlanta = 0;
  for (const c of caras) for (const p of c.p) if (p[1] > 0.02) radioPlanta = Math.max(radioPlanta, Math.hypot(p[0], p[2]));
  // Un cactus de bola o una echeveria viven en maceta chica: en una de
  // limonero se ven perdidos.
  const chiquita = e.forma.porte === 'bola' || (e.forma.porte === 'roseta' && e.forma.hoja.tipo === 'penca' && e.forma.hoja.largo < 0.5);
  const escala = cuelga ? 1 : Math.max(chiquita ? 0.55 : 0.72, Math.min(1, radioPlanta / 0.5));
  if (cuelga && e.recipiente !== 'suelo') {
    // Las hojas de las guías que corren por el piso se quedan en el piso,
    // no se meten debajo.
    const piso = e.recipiente === 'agua' ? -0.55 : -0.42;
    for (const c of caras) for (const p of c.p) if (p[1] < piso) p[1] = piso;
  }
  const inicioMaceta = caras.length;
  recipiente(ctx, escala);
  for (let i = inicioMaceta; i < caras.length; i += 1) caras[i].fija = true;
  return { caras };
}

/**
 * La planta más grande y la maceta igual: así se ve crecer.
 *
 * Se escala desde la tierra (y = 0), que es donde está plantada. Sin esto, el
 * encuadre agrandaba o achicaba la escena entera y la planta de dentro de un
 * año se veía del mismo tamaño que la de hoy.
 */
export function crecerMalla(malla: Malla, factor: number): Malla {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-3) return malla;
  return {
    caras: malla.caras.map((c) =>
      c.fija ? c : { ...c, p: c.p.map((q) => por(q, factor)), interior: c.interior ? por(c.interior, factor) : undefined },
    ),
  };
}

interface Contexto {
  e: EntradaMalla;
  r: () => number;
  H: number;
  seg: number;
  caras: Cara[];
}

/** Qué tan hecha está la planta, 0-1. Sin dato, a media vida. */
function desarrolloEn(ctx: Contexto): number {
  const d = ctx.e.morfologia.desarrollo;
  return d !== undefined && Number.isFinite(d) ? Math.max(0, Math.min(1, d)) : 0.5;
}

/** Cuántos segmentos para una hoja, según el detalle. */
function segmentos(ctx: Contexto, base: number): number {
  return Math.max(2, Math.round(base * ctx.seg));
}

/** Cuántas hojas, brazos o frondas, con tope para que el teléfono no sufra. */
function cuantos(ctx: Contexto, minimo: number, maximo: number, factor = 1): number {
  const n = Number.isFinite(ctx.e.morfologia.elementos) ? ctx.e.morfologia.elementos : 5;
  return Math.max(minimo, Math.min(maximo, Math.round(n * factor)));
}

/** Cuánto se vence la hoja: lo que trae la especie más lo que dice el estado. */
function caidaDe(ctx: Contexto): number {
  const c = Number.isFinite(ctx.e.morfologia.caida) ? ctx.e.morfologia.caida : 0;
  return Math.min(1, ctx.e.forma.hoja.arco + c * 0.9);
}

/**
 * El color de un punto de la hoja según el patrón de la especie.
 *
 * Además del patrón, dos cosas del estado: la sed tuesta la punta (los
 * últimos tramos), y en las hojas viejas —las de afuera— se nota primero el
 * agua de más.
 */
function colorHoja(ctx: Contexto, t: number, u: number, fase: number, vieja: boolean): string {
  const { apariencia: ap, forma } = ctx.e;
  const acento = ap.acento ?? ap.hoja;
  let c: string;
  switch (forma.patron) {
    case 'bandas': {
      // Bandas claras irregulares, como las de la sansevieria.
      const v = Math.sin(t * 34 + fase * 6) + 0.6 * Math.sin(t * 13 + fase * 11 + u);
      c = v > 0.7 ? mezclar(ap.hojaOscura, acento, 0.75) : v > -0.2 ? ap.hojaOscura : mezclar(ap.hojaOscura, ap.hoja, 0.55);
      break;
    }
    case 'bordes':
      c = Math.abs(u) > 0.7 ? acento : mezclar(ap.hojaOscura, ap.hoja, 0.4 + 0.6 * t);
      break;
    case 'franja':
      c = Math.abs(u) < 0.5 ? acento : ap.hoja;
      break;
    case 'manchas': {
      const v = Math.sin(t * 41 + fase * 17 + u * 5) * Math.sin(t * 23 - u * 7 + fase);
      c = v > 0.55 ? mezclar(ap.hoja, acento, 0.7) : mezclar(ap.hojaOscura, ap.hoja, 0.35 + 0.5 * t);
      break;
    }
    case 'variegado': {
      const v = Math.sin(t * 9 + fase * 13 + u * 2.5) + Math.sin(u * 4 + fase * 3);
      c = v > 0.9 ? mezclar(ap.hoja, acento, 0.75) : mezclar(ap.hojaOscura, ap.hoja, 0.45 + 0.4 * t);
      break;
    }
    default:
      c = mezclar(ap.hojaOscura, ap.hoja, 0.3 + 0.6 * t);
  }
  if (vieja) c = mezclar(c, ap.hojaVieja, 0.6);
  if (t > 0.72) c = mezclar(c, ap.punta, (t - 0.72) / 0.28);
  return c;
}

// -- Recipientes --------------------------------------------------------------

function recipiente(ctx: Contexto, escala = 1) {
  const { e, caras } = ctx;
  const k = escala;
  if (e.forma.porte === 'flotante') return; // su recipiente es el estanque (ver `flotante`)
  if (e.recipiente === 'maceta') {
    const estilo = e.estiloMaceta;
    const barro = estilo ? COLOR_MACETA[estilo] : e.colorMaceta ?? '#B8683F';
    const lados = e.detalle === 'alto' ? 18 : 12;
    // Pared de la maceta: angosta abajo, ancha arriba, y el borde grueso. La
    // de talavera lleva más anillos: su dibujo va en franjas.
    const perfil: Array<[number, number]> =
      estilo === 'talavera'
        ? [
            [0, 0.24 * k],
            [0.075 * k, 0.255 * k],
            [0.15 * k, 0.27 * k],
            [0.225 * k, 0.285 * k],
            [0.3 * k, 0.3 * k],
            [0.3 * k, 0.345 * k],
            [0.44 * k, 0.345 * k],
          ]
        : [
            [0, 0.24 * k],
            [0.3 * k, 0.3 * k],
            [0.3 * k, 0.345 * k],
            [0.44 * k, 0.345 * k],
          ];
    torno(
      [0, -0.42 * k, 0],
      ARRIBA,
      perfil,
      lados,
      (t, lado) => colorDeMaceta3d(estilo, barro, t, lado),
      'sustrato',
      estilo === 'talavera' || estilo === 'negra' ? 0.45 : 0.12,
      caras,
    );
    // La tierra: un disco un poco abajo del borde.
    tapa([0, -0.01, 0], 0.325 * k, lados, '#4A3526', 'sustrato', caras);
  } else if (e.recipiente === 'suelo') {
    tapa([0, -0.005, 0], 0.5, 14, '#6B4E36', 'sustrato', caras);
  } else {
    // Frasco de vidrio con agua. El vidrio casi transparente; el agua se
    // enturbia con los días sin cambiarla.
    const dias = e.diasSinCambioAgua ?? 0;
    const agua = mezclar('#8FC9E3', '#A89A5A', Math.min(1, Math.max(0, dias) / 14));
    torno([0, -0.55, 0], ARRIBA, [[0, 0.2], [0.6, 0.22], [0.62, 0.2]], 14, () => '#DCEFF5', 'raiz', 0.9, caras, {
      opacidad: 0.22,
      dobleCara: true,
    });
    torno([0, -0.54, 0], ARRIBA, [[0, 0.185], [0.46, 0.205]], 14, () => agua, 'raiz', 0.6, caras, {
      opacidad: 0.45,
      dobleCara: true,
    });
    // Raíces blancas colgando dentro del agua.
    for (let i = 0; i < 5; i += 1) {
      const az = (i / 5) * Math.PI * 2 + ctx.r();
      const fin: V3 = [Math.cos(az) * 0.12, -0.45 + ctx.r() * 0.1, Math.sin(az) * 0.12];
      tubo(curva([0, 0.02, 0], [Math.cos(az) * 0.05, -0.2, Math.sin(az) * 0.05], fin, 4), () => 0.008, 3, '#F2EAD8', 'raiz', caras);
    }
  }
}

const COLOR_MACETA: Record<EstiloMaceta, string> = {
  barro: '#B8683F',
  talavera: '#F3F0E6',
  blanca: '#EDE8DD',
  negra: '#3A3A38',
  rosa: '#D84A86',
  turquesa: '#2FA3A0',
  amarilla: '#E8B53A',
  concreto: '#9C9A94',
};

/**
 * El color de cada cara de la maceta. La de talavera es blanca con franjas
 * azul cobalto y un cinturón de rombos amarillos y azules, como las de
 * Puebla; la de concreto va moteada. `t` es la franja (0 abajo, 1 el borde) y
 * `lado`, la cara alrededor.
 */
function colorDeMaceta3d(estilo: EstiloMaceta | undefined, base: string, t: number, lado: number): string {
  if (estilo === 'talavera') {
    const azul = '#2F4FA0';
    const franja = Math.round(t * 5);
    if (franja === 0) return azul;
    if (franja === 1) return lado % 3 === 0 ? azul : base;
    if (franja === 2) return lado % 2 === 0 ? '#E3A62E' : azul;
    if (franja === 3) return lado % 3 === 1 ? azul : base;
    if (franja === 4) return base;
    return lado % 4 === 0 ? base : azul;
  }
  if (estilo === 'concreto') return lado % 5 === 0 ? mezclar(base, '#000000', 0.12) : lado % 7 === 3 ? mezclar(base, '#FFFFFF', 0.12) : base;
  return t > 0.5 ? mezclar(base, '#FFFFFF', estilo === 'negra' ? 0.14 : 0.08) : base;
}

/** Un disco horizontal (tierra, superficie del agua). */
function tapa(c: V3, radio: number, lados: number, color: string, parte: TipoParte, caras: Cara[], opacidad?: number) {
  for (let k = 0; k < lados; k += 1) {
    const a1 = (k / lados) * Math.PI * 2;
    const a2 = ((k + 1) / lados) * Math.PI * 2;
    caras.push({
      p: [c, [c[0] + Math.cos(a1) * radio, c[1], c[2] + Math.sin(a1) * radio], [c[0] + Math.cos(a2) * radio, c[1], c[2] + Math.sin(a2) * radio]],
      color,
      parte,
      dobleCara: true,
      brillo: opacidad ? 0.7 : 0,
      opacidad,
    });
  }
}

// -- Portes -------------------------------------------------------------------

function roseta(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const suculenta = f.hoja.tipo === 'penca';
  // Un pasto (té limón) no son siete hojas: es una mata apretada de muchas.
  const pasto = f.hoja.tipo === 'cinta' && f.hoja.ancho < 0.06;
  // Una sansevieria es una mata de varias espadas, no una sola roseta.
  const mata = f.hoja.tipo === 'espada';
  const n = pasto
    ? cuantos(ctx, 14, ctx.e.detalle === 'alto' ? 34 : 22, 3)
    : suculenta && f.hoja.largo < 0.5
      ? cuantos(ctx, 4, 22, 1.8)
      : cuantos(ctx, suculenta ? 9 : 6, 16, 1.4);
  const caida = caidaDe(ctx);
  const perfil = PERFILES[f.hoja.tipo] ?? PERFILES.ovalada;
  const oro = 2.39996;

  for (let k = 0; k < n; k += 1) {
    // k chico = hoja joven, al centro y más derecha; k grande = vieja, afuera.
    const edad = n === 1 ? 1 : k / (n - 1);
    const az = k * oro + r() * 0.4;
    const incl = (((mata ? f.hoja.inclinacion + r() * 16 : f.hoja.inclinacion * (0.55 + 0.8 * edad)) * Math.PI) / 180);
    const largo = H * f.hoja.largo * (suculenta ? 0.55 + 0.45 * edad : mata ? 0.55 + 0.45 * r() : 0.75 + 0.25 * r());
    const radioBase = suculenta ? 0.02 + 0.05 * edad : mata ? 0.02 + 0.1 * r() : 0.015 + 0.05 * r();
    const base: V3 = [Math.cos(az) * radioBase, 0, Math.sin(az) * radioBase];
    const fase = r();
    hoja(
      {
        base,
        dir: direccion(incl, az),
        doblar: ABAJO,
        curva: caida * (0.5 + 0.5 * edad),
        largo,
        ancho: largo * f.hoja.ancho,
        perfil,
        pliegue: f.hoja.pliegue,
        segmentos: segmentos(ctx, f.hoja.tipo === 'espada' ? 12 : 7),
        color: (t, u) =>
          pasto && t < 0.14 ? mezclar(e.apariencia.tallo, e.apariencia.hoja, t / 0.14) : colorHoja(ctx, t, u, fase, edad > 0.75),
        parte: 'hoja',
        indice: k,
        brillo: f.hoja.brillo,
        torsion: f.hoja.tipo === 'espada' ? (r() - 0.5) * 1.2 : pasto ? (r() - 0.5) * 0.8 : 0,
        conBordes: f.patron === 'bordes' || f.patron === 'franja',
        ladoInicial: [-Math.sin(az), 0, Math.cos(az)],
      },
      caras,
    );
  }

  // Brotes: hojas nuevas, cortas, más claras y derechas, saliendo del centro.
  const brotes = Math.min(4, Number.isFinite(e.morfologia.brotes) ? e.morfologia.brotes : 0);
  for (let b = 0; b < brotes; b += 1) {
    const az = b * 2.4 + r();
    const largo = H * f.hoja.largo * 0.28;
    hoja(
      {
        base: [Math.cos(az) * 0.03, 0, Math.sin(az) * 0.03],
        dir: direccion(0.1, az),
        doblar: ABAJO,
        curva: 0,
        largo,
        ancho: largo * f.hoja.ancho * 1.2,
        perfil,
        pliegue: f.hoja.pliegue,
        segmentos: 3,
        color: (t) => mezclar(e.apariencia.hoja, '#DDF3B8', 0.35 + 0.3 * t),
        parte: 'brote',
        indice: b,
        brillo: 0.3,
      },
      caras,
    );
  }

  if (f.flor && e.morfologia.flores > 0) {
    if (f.flor.tipo === 'mariposa') {
      // La vara de la orquídea: sube derecha y se arquea, con las flores en fila.
      const az = r() * Math.PI * 2;
      const lado: V3 = [Math.cos(az), 0, Math.sin(az)];
      const vara = curva([0, 0.02, 0], [lado[0] * 0.06, H * 1.3, lado[2] * 0.06], [lado[0] * 0.6, H * 0.95, lado[2] * 0.6], 10);
      tubo(vara, () => 0.008, 4, mezclar(e.apariencia.tallo, '#4A6A3A', 0.5), 'flor', caras, 0);
      // Las flores miran todas hacia el mismo lado, como en una vara de verdad.
      const frente = unitario(suma(cruz(ARRIBA, lado), [0, -0.1, 0]));
      const cuantas = Math.min(5, 2 + e.morfologia.flores);
      for (let i = 0; i < cuantas; i += 1) {
        const q = vara[Math.min(vara.length - 1, 4 + Math.round(i * 1.5))];
        flor(ctx, suma(q, por(frente, 0.02)), frente, i);
      }
    } else if (f.flor.tipo === 'espata') {
      for (let i = 0; i < Math.min(3, e.morfologia.flores); i += 1) {
        const az = r() * Math.PI * 2;
        const tope: V3 = [Math.cos(az) * 0.12, H * 0.72, Math.sin(az) * 0.12];
        tubo(curva([0, 0, 0], [Math.cos(az) * 0.05, H * 0.4, Math.sin(az) * 0.05], tope, 5), () => 0.012, 4, e.apariencia.tallo, 'flor', caras, i);
        flor(ctx, tope, unitario([Math.cos(az) * 0.3, 1, Math.sin(az) * 0.3]), i);
      }
    } else {
      // Vara floral por encima de la roseta: sábila, echeveria, cinta.
      const az = r() * Math.PI * 2;
      const tope: V3 = [Math.cos(az) * 0.2, H * (suculenta ? 1.1 : 0.9), Math.sin(az) * 0.2];
      tubo(curva([0, 0, 0], [Math.cos(az) * 0.05, H * 0.6, Math.sin(az) * 0.05], tope, 6), () => 0.014, 4, e.apariencia.tallo, 'flor', caras, 0);
      flor(ctx, tope, ARRIBA, 0);
    }
  }
}

function columnas(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const costillas = e.forma.costillas ?? 7;
  const n = cuantos(ctx, 1, 5, 0.6);
  const lados = costillas * 2;
  const ap = e.apariencia;
  const caida = Number.isFinite(e.morfologia.caida) ? e.morfologia.caida : 0;

  for (let c = 0; c < n; c += 1) {
    const az = c === 0 ? 0 : (c / (n - 1)) * Math.PI * 2 + r() * 0.6;
    const dist = c === 0 ? 0 : 0.1 + r() * 0.06;
    const alto = H * (c === 0 ? 1 : 0.55 + r() * 0.35);
    const radio = c === 0 ? 0.12 : 0.095;
    // Una columna con sed se arruga y se inclina un poco.
    const eje = unitario([Math.cos(az) * (c === 0 ? 0 : 0.12) + caida * 0.08, 1, Math.sin(az) * (c === 0 ? 0 : 0.12)]);
    const base: V3 = [Math.cos(az) * dist, 0, Math.sin(az) * dist];
    // El cuerpo recto y un remate redondo arriba, como una cúpula: una
    // columna de cactus no termina en punta.
    const perfil: Array<[number, number]> = [];
    const pisos = 6;
    const cuerpo = alto - radio;
    for (let i = 0; i <= pisos; i += 1) perfil.push([(i / pisos) * cuerpo, radio * (1 - caida * 0.15)]);
    for (let i = 1; i <= 4; i += 1) {
      const ang = (i / 4) * (Math.PI / 2);
      perfil.push([cuerpo + Math.sin(ang) * radio, Math.max(0.001, Math.cos(ang) * radio * (1 - caida * 0.15))]);
    }
    const a = unitario(eje);
    const e1 = perpendicular(a);
    const e2 = cruz(a, e1);
    const anillos = perfil.map(([h, rad]) =>
      Array.from({ length: lados }, (_, k) => {
        const th = (k / lados) * Math.PI * 2;
        // Costilla afuera, valle adentro.
        const rr = rad * (k % 2 === 0 ? 1 : 0.78);
        return suma(suma(base, por(a, h)), suma(por(e1, Math.cos(th) * rr), por(e2, Math.sin(th) * rr)));
      }),
    );
    for (let i = 0; i < anillos.length - 1; i += 1) {
      const interior = suma(base, por(a, (perfil[i][0] + perfil[i + 1][0]) / 2));
      for (let k = 0; k < lados; k += 1) {
        const k2 = (k + 1) % lados;
        const p: V3[] = [anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]];
        if (areaCasiNula(p)) continue;
        // La línea de espinas sobre cada costilla, más clara.
        const sobreCostilla = k % 2 === 0;
        caras.push({
          p,
          color: sobreCostilla ? mezclar(ap.hoja, ap.acento ?? ap.hoja, 0.18) : ap.hojaOscura,
          parte: 'tallo',
          indice: c,
          dobleCara: false,
          interior,
          brillo: 0.15,
        });
      }
    }
    const punta = suma(base, por(a, alto));
    if (e.morfologia.flores > 0 && c < e.morfologia.flores) flor(ctx, punta, a, c);
    if (e.morfologia.frutos > 0 && c < e.morfologia.frutos) {
      bola(suma(punta, por(e1, radio * 0.9)), e.forma.fruto?.tamano ?? 0.04, e.forma.fruto?.color ?? '#D7404A', 'fruto', caras);
    }
    if (e.morfologia.brotes > 0 && c === 0) bola(punta, 0.03, mezclar(ap.hoja, '#DFF5C8', 0.5), 'brote', caras);
  }
}

function pencas(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const n = cuantos(ctx, 4, 10, 1.1);
  const alto = H * e.forma.hoja.largo * 1.1;
  const anchoPala = alto * e.forma.hoja.ancho;
  const caida = Number.isFinite(e.morfologia.caida) ? e.morfologia.caida : 0;
  const ladoBase = r() * Math.PI * 2;
  const cola: Array<{ base: V3; dir: V3; nivel: number }> = [
    { base: [0, 0, 0], dir: [0, 1, 0], nivel: 0 },
    { base: [Math.cos(ladoBase) * 0.06, 0, Math.sin(ladoBase) * 0.06], dir: unitario([Math.cos(ladoBase) * 0.5, 1, Math.sin(ladoBase) * 0.5]), nivel: 1 },
  ];
  let hechas = 0;
  let frutos = e.morfologia.frutos;
  let flores = e.morfologia.flores;

  while (cola.length > 0 && hechas < n) {
    const { base, dir, nivel } = cola.shift()!;
    const az = r() * Math.PI * 2;
    // La cara de la pala mira hacia un lado; su "arriba" sigue la dirección.
    const normal = unitario([Math.cos(az), 0, Math.sin(az)]);
    const arriba = unitario(resta(dir, por(normal, punto(dir, normal))));
    const lado = cruz(arriba, normal);
    const centro = suma(base, por(arriba, alto * 0.5));
    const bulto = por(normal, anchoPala * 0.12);
    const lados = ctx.e.detalle === 'alto' ? 14 : 10;
    const orilla = Array.from({ length: lados }, (_, k) => {
      const th = (k / lados) * Math.PI * 2;
      return suma(centro, suma(por(lado, Math.cos(th) * anchoPala * 0.5), por(arriba, Math.sin(th) * alto * 0.5)));
    });
    // Dos caras abombadas: la pala es carnosa, no una hoja de papel.
    for (const signo of [1, -1]) {
      const c = suma(centro, por(bulto, signo));
      for (let k = 0; k < lados; k += 1) {
        const manchita = Math.sin(k * 2.7 + hechas * 1.3) > 0.6;
        caras.push({
          p: [c, orilla[k], orilla[(k + 1) % lados]],
          color: manchita ? mezclar(e.apariencia.hoja, e.apariencia.acento ?? '#E4DAB0', 0.35) : e.apariencia.hoja,
          parte: 'hoja',
          indice: hechas,
          dobleCara: true,
          brillo: 0.2,
        });
      }
    }
    hechas += 1;
    const tope = suma(base, por(arriba, alto));
    if (flores > 0 && nivel > 0) {
      flor(ctx, tope, arriba, hechas);
      flores -= 1;
    } else if (frutos > 0 && nivel > 0) {
      bola(tope, e.forma.fruto?.tamano ?? 0.05, e.forma.fruto?.color ?? '#C4406E', 'fruto', caras, 1.3);
      frutos -= 1;
    }
    // Hijas en la orilla de arriba, abiertas hacia los lados. Con sed se abren más.
    for (const s of [-1, 1]) {
      const inclina = 0.75 + caida * 0.4;
      const hija = unitario(suma(arriba, por(lado, s * inclina)));
      cola.push({ base: suma(tope, por(lado, s * anchoPala * 0.18)), dir: hija, nivel: nivel + 1 });
    }
  }
}

/** Tallos con hojas en pares: albahaca, hierbabuena, romero, cilantro, cempasúchil. */
function mata(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const aguja = f.hoja.tipo === 'aguja';
  // Una mata de verdad es tupida: albahaca, romero o cempasúchil se ven como
  // un montón de hojas, no como cuatro palitos.
  const tallos = cuantos(ctx, 5, aguja ? 12 : 11, 1.1);
  const caida = caidaDe(ctx);
  const perfil = PERFILES[f.hoja.tipo] ?? PERFILES.ovalada;
  let flores = e.morfologia.flores;
  let varas = f.varas ? 9 : 0;

  for (let k = 0; k < tallos; k += 1) {
    const az = (k / tallos) * Math.PI * 2 + r() * 0.8;
    const incl = 0.12 + r() * 0.45 + caida * 0.35 + (f.hoja.inclinacion > 65 ? 0.55 : 0);
    const largo = H * (0.7 + r() * 0.3);
    const d = direccion(incl, az);
    const puntos = curva([0, 0, 0], suma(por(d, largo * 0.5), [0, 0.02, 0]), suma(por(d, largo), [0, -caida * largo * 0.35, 0]), 5);
    tubo(puntos, (t) => 0.012 * (1 - t * 0.6), 4, e.apariencia.tallo, 'tallo', caras, k);

    const nudos = aguja ? 8 : 4;
    for (let j = 1; j <= nudos; j += 1) {
      const t = j / (nudos + 0.6);
      const i = Math.min(puntos.length - 2, Math.floor(t * (puntos.length - 1)));
      const q = suma(puntos[i], por(resta(puntos[i + 1], puntos[i]), t * (puntos.length - 1) - i));
      const tangente = unitario(resta(puntos[i + 1], puntos[i]));
      const escala = aguja ? 1.35 : 1.3 - t * 0.5;
      const porNudo = aguja ? 6 : 2;
      for (let h = 0; h < porNudo; h += 1) {
        const giro = (h / porNudo) * Math.PI * 2 + j * 1.2;
        const lado = unitario(suma(por(perpendicular(tangente), Math.cos(giro)), por(cruz(tangente, perpendicular(tangente)), Math.sin(giro))));
        const salida = unitario(suma(por(lado, 1), por(tangente, aguja ? 0.9 : 0.35)));
        const largoHoja = H * f.hoja.largo * escala;
        if (aguja) {
          // Una aguja es un triangulito: con una cara basta, y así caben cientos.
          agujita(ctx, q, salida, largoHoja, largoHoja * f.hoja.ancho, colorHoja(ctx, 0.5, 0, r(), j === 1), k * 10 + j);
          continue;
        }
        const fase = r();
        hoja(
          {
            base: q,
            dir: salida,
            doblar: ABAJO,
            curva: caida * 0.6 + 0.1,
            largo: largoHoja,
            ancho: largoHoja * f.hoja.ancho,
            perfil,
            pliegue: f.hoja.pliegue,
            segmentos: segmentos(ctx, aguja ? 2 : 4),
            color: (tt, u) => colorHoja(ctx, tt, u, fase, j === 1),
            parte: 'hoja',
            indice: k * 10 + j,
            brillo: f.hoja.brillo,
          },
          caras,
        );
      }
    }
    const punta = puntos[puntos.length - 1];
    if (f.varas && f.flor && e.morfologia.flores > 0 && varas > 0) {
      varas -= 1;
      // Cada tallo remata en una vara pelona, larga, con la espiga en la punta.
      const eje = unitario(suma(resta(punta, puntos[puntos.length - 2]), [0, 1.2, 0]));
      const fin = suma(punta, suma(por(eje, H * 0.45), [0, -caida * 0.1, 0]));
      tubo(curva(punta, suma(punta, por(eje, H * 0.22)), fin, 3), () => 0.005, 3, e.apariencia.tallo, 'flor', caras, k);
      flor(ctx, fin, unitario(resta(fin, punta)), k);
    } else if (flores > 0 && f.flor) {
      flor(ctx, punta, unitario(resta(punta, puntos[puntos.length - 2])), k);
      flores -= 1;
    } else if (e.morfologia.brotes > 0 && k < e.morfologia.brotes) {
      bola(punta, 0.025, mezclar(e.apariencia.hoja, '#E4F7CF', 0.5), 'brote', caras);
    }
  }
}

/** Arbusto leñoso: tallos que se ramifican, hojas alternas y flores en las puntas. */
function arbusto(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const des = desarrolloEn(ctx);
  // Con los años salen más tallos desde la base y se vuelven leña.
  const ramas = Math.min(7, Math.max(cuantos(ctx, 3, 6, 0.6), Math.round(3 + des * 3)));
  const grueso = 0.8 + des * 0.5;
  const caida = caidaDe(ctx);
  const perfil = PERFILES[f.hoja.tipo] ?? PERFILES.ovalada;
  // Las de brácteas (bugambilia, nochebuena) se pintan enteras de color:
  // una punta sí y otra también.
  const bracteas = f.flor?.tipo === 'bractea';
  let flores = e.morfologia.flores > 0 ? Math.min(10, Math.max(bracteas ? 8 : 2, e.morfologia.flores * (bracteas ? 3 : 1))) : 0;
  let frutos = e.morfologia.frutos;
  let n = 0;

  for (let k = 0; k < ramas; k += 1) {
    const az = (k / ramas) * Math.PI * 2 + r() * 0.7;
    const incl = 0.15 + r() * 0.35;
    const alto = H * (0.75 + r() * 0.3);
    const d = direccion(incl, az);
    const medio = suma(por(d, alto * 0.5), [0, 0, 0]);
    const tallo = curva([0, 0, 0], medio, suma(por(d, alto), [0, -caida * 0.15, 0]), 4);
    tubo(tallo, (t) => 0.016 * grueso * (1 - t * 0.5), 5, e.apariencia.tallo, 'tallo', caras, k);

    // Tres ramitas desde la mitad.
    const puntas: Array<{ pts: V3[] }> = [{ pts: tallo }];
    for (const s of [-1, 0.2, 1]) {
      const az2 = az + s * (0.6 + r() * 0.5);
      const d2 = direccion(incl + 0.35, az2);
      const fin = suma(medio, suma(por(d2, alto * 0.45), [0, -caida * 0.1, 0]));
      const pts = curva(medio, suma(medio, por(d2, alto * 0.25)), fin, 3);
      tubo(pts, () => 0.011 * grueso, 4, e.apariencia.tallo, 'tallo', caras, k);
      puntas.push({ pts });
    }

    for (const { pts } of puntas) {
      const hojas = ctx.e.detalle === 'alto' ? 7 : 5;
      for (let j = 1; j <= hojas; j += 1) {
        const t = j / (hojas + 0.3);
        const i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
        const q = suma(pts[i], por(resta(pts[i + 1], pts[i]), t * (pts.length - 1) - i));
        const tan = unitario(resta(pts[i + 1], pts[i]));
        const giro = j * 2.4 + k;
        const lado = unitario(suma(por(perpendicular(tan), Math.cos(giro)), por(cruz(tan, perpendicular(tan)), Math.sin(giro))));
        const largoHoja = H * f.hoja.largo * 1.5 * (1.05 - t * 0.3);
        const fase = r();
        hoja(
          {
            base: q,
            dir: unitario(suma(lado, por(tan, 0.4))),
            doblar: ABAJO,
            curva: caida * 0.5 + f.hoja.arco * 0.3,
            largo: largoHoja,
            ancho: largoHoja * f.hoja.ancho,
            perfil,
            pliegue: f.hoja.pliegue,
            segmentos: segmentos(ctx, 4),
            color: (tt, u) => colorHoja(ctx, tt, u, fase, j === 1),
            parte: 'hoja',
            indice: n,
            brillo: f.hoja.brillo,
          },
          caras,
        );
        n += 1;
      }
      const punta = pts[pts.length - 1];
      const eje = unitario(resta(punta, pts[pts.length - 2]));
      if (flores > 0 && f.flor) {
        flor(ctx, punta, unitario(suma(eje, [0, 0.8, 0])), n);
        flores -= 1;
      } else if (frutos > 0 && f.fruto) {
        fruto(ctx, suma(punta, [0, -0.02, 0]), n);
        frutos -= 1;
      }
    }
  }
}

/**
 * Tronco con copa: limón, ficus, aguacate, y el árbol de jade (de tronco gordo).
 *
 * Madura con los años (`desarrollo`): el tronco engruesa y la corteza se
 * vuelve gris, salen más ramas y cada una se abre en ramitas, la copa se
 * ensancha y se llena. Un limonero de vivero es una vara con tres ramas; uno
 * de cinco años, un árbol.
 */
function arbol(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const jade = f.hoja.pliegue >= 0.2;
  const perfil = PERFILES[f.hoja.tipo] ?? PERFILES.ovalada;
  const caida = caidaDe(ctx);
  const des = desarrolloEn(ctx);
  const altoTronco = H * (jade ? 0.35 : 0.42 + des * 0.08);
  const grosor = (jade ? 0.07 : 0.035) * (0.7 + des * 0.8);
  const corteza = mezclar(e.apariencia.tallo, '#5B5247', des * 0.45);
  const tronco = curva([0, 0, 0], [0.02, altoTronco * 0.5, 0], [0, altoTronco, 0.01], 3);
  tubo(tronco, (t) => grosor * (1.2 - t * 0.4), 6, corteza, 'tallo', caras, 0);

  const ramas = Math.min(7, Math.max(cuantos(ctx, 3, 6, 0.55), Math.round(3 + des * 4)));
  const secundarias = jade ? 0 : des < 0.3 ? 0 : des < 0.55 ? 1 : 2;
  const apertura = 0.9 + des * 0.35;
  // Las hojas se reparten entre todos los ramilletes con un tope: más ramas no
  // pueden significar un teléfono que se arrastra al girarla.
  const tope = jade ? 120 : ctx.e.detalle === 'alto' ? 140 : 80;
  const totalHojas = Math.round(tope * (0.55 + des * 0.45));
  const porRamillete = Math.max(6, Math.round(totalHojas / (ramas * (1 + 0.6 * secundarias))));
  let frutos = e.morfologia.frutos;
  let flores = e.morfologia.flores;
  let n = 0;

  const ramillete = (fin: V3, d: V3, rama: V3[], cuantas: number) => {
    for (let j = 0; j < cuantas; j += 1) {
      const u = r();
      const v = r();
      const th = u * Math.PI * 2;
      const ph = Math.acos(1 - 1.4 * v);
      const afuera = unitario([Math.sin(ph) * Math.cos(th) + d[0] * 0.6, Math.cos(ph) * 0.8 + 0.2, Math.sin(ph) * Math.sin(th) + d[2] * 0.6]);
      // Unas en la punta y otras repartidas por la rama: una copa, no un pompón.
      const enRama = rama[Math.min(rama.length - 1, 1 + Math.floor(r() * (rama.length - 1)))];
      const base = suma(j % 3 === 0 ? enRama : fin, por(afuera, H * 0.09 * r()));
      const largoHoja = H * f.hoja.largo * (jade ? 1.5 : 1.35) * (0.8 + 0.4 * r());
      const fase = r();
      hoja(
        {
          base,
          dir: afuera,
          doblar: ABAJO,
          curva: caida * 0.5 + f.hoja.arco * 0.3,
          largo: largoHoja,
          ancho: largoHoja * f.hoja.ancho,
          perfil,
          pliegue: f.hoja.pliegue,
          segmentos: segmentos(ctx, jade ? 3 : 4),
          color: (tt, uu) => colorHoja(ctx, tt, uu, fase, false),
          parte: 'hoja',
          indice: n,
          brillo: f.hoja.brillo,
        },
        caras,
      );
      n += 1;
    }
  };

  for (let k = 0; k < ramas; k += 1) {
    const az = (k / ramas) * Math.PI * 2 + r() * 0.5;
    const d = direccion(0.55 + r() * 0.35, az);
    const fin = suma([0, altoTronco, 0], por(d, H * (0.35 + r() * 0.12) * apertura));
    const rama = curva([0, altoTronco * (0.85 + r() * 0.1), 0], suma([0, altoTronco, 0], por(d, H * 0.15)), fin, 3);
    tubo(rama, (t) => grosor * 0.7 * (1 - t * 0.5), 5, corteza, 'tallo', caras, k + 1);

    const puntas: Array<{ fin: V3; d: V3; rama: V3[]; hojas: number }> = [{ fin, d, rama, hojas: porRamillete }];
    for (let s = 0; s < secundarias; s += 1) {
      // Desde la mitad de la rama, hacia un lado y más acostada.
      const desde = rama[Math.min(rama.length - 2, 1 + s)];
      const d2 = direccion(0.8 + r() * 0.3, az + (s === 0 ? 1 : -1) * (0.7 + r() * 0.4));
      const fin2 = suma(desde, por(d2, H * (0.2 + r() * 0.08) * apertura));
      const sub = curva(desde, suma(desde, por(d2, H * 0.08)), fin2, 3);
      tubo(sub, (t) => grosor * 0.42 * (1 - t * 0.5), 4, corteza, 'tallo', caras, k + 1);
      puntas.push({ fin: fin2, d: d2, rama: sub, hojas: Math.round(porRamillete * 0.6) });
    }

    for (const p of puntas) {
      ramillete(p.fin, p.d, p.rama, p.hojas);
      if (frutos > 0 && f.fruto) {
        fruto(ctx, suma(p.fin, [0, -H * 0.08, 0]), k);
        frutos -= 1;
      }
      if (flores > 0 && f.flor) {
        flor(ctx, suma(p.fin, por(p.d, H * 0.05)), unitario(suma(p.d, ARRIBA)), k);
        flores -= 1;
      }
    }
  }
}

/** Guías que caen por la orilla de la maceta, con hojas de corazón: potos. */
function trepadora(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const guias = cuantos(ctx, 4, 7, 0.7);
  const caida = caidaDe(ctx);
  let n = 0;

  const ponHoja = (q: V3, afuera: V3, escala: number) => {
    const largo = H * f.hoja.largo * escala;
    const fase = r();
    // Pecíolo corto y la hoja mirando hacia afuera y arriba.
    const dir = unitario(suma(afuera, [0, 0.45 - caida * 0.5, 0]));
    hoja(
      {
        base: q,
        dir,
        doblar: ABAJO,
        curva: 0.25 + caida * 0.4,
        largo,
        ancho: largo * f.hoja.ancho,
        perfil: PERFILES[f.hoja.tipo] ?? PERFILES.corazon,
        pliegue: f.hoja.pliegue,
        segmentos: segmentos(ctx, 5),
        color: (t, u) => colorHoja(ctx, t, u, fase, false),
        parte: 'hoja',
        indice: n,
        brillo: f.hoja.brillo,
      },
      caras,
    );
    n += 1;
  };

  // Unas hojas erguidas al centro.
  for (let k = 0; k < 6; k += 1) {
    const az = k * 1.9 + r();
    const q: V3 = [Math.cos(az) * 0.04, H * (0.12 + 0.1 * r()), Math.sin(az) * 0.04];
    tubo([[0, 0, 0], q], () => 0.008, 3, e.apariencia.tallo, 'tallo', caras, k);
    ponHoja(q, [Math.cos(az), 0.6, Math.sin(az)], 1);
  }

  // Y las guías: suben un poco, salen a la orilla, bajan por la maceta y
  // siguen por el piso. Antes colgaban en el aire, y la maceta parecía
  // flotar: en el patio las macetas están en el suelo.
  for (let k = 0; k < guias; k += 1) {
    const az = (k / guias) * Math.PI * 2 + r() * 0.5;
    const hacia: V3 = [Math.cos(az), 0, Math.sin(az)];
    const largo = 0.5 + r() * 0.5 + (e.recipiente === 'maceta' ? 0.2 : 0);
    const pts = guiaAlPiso(ctx, hacia, largo, r() > 0.5 ? 1 : -1);
    tubo(pts, () => 0.007, 3, e.apariencia.tallo, 'tallo', caras, k + 4);
    for (let j = 1; j < pts.length; j += 1) {
      const lado = j % 2 === 0 ? 1 : -1;
      const tan = unitario(resta(pts[j], pts[j - 1]));
      const afuera = unitario(suma(hacia, por(cruz(tan, hacia), lado * 0.8)));
      ponHoja(pts[j], afuera, 0.85 - j * 0.05);
    }
    // Flores (la flor de cera): una bola de estrellitas colgando de la guía.
    if (f.flor && k < Math.min(ctx.e.detalle === 'alto' ? 3 : 2, e.morfologia.flores)) {
      const q = pts[Math.min(pts.length - 1, 3)];
      flor(ctx, suma(q, por(hacia, 0.05)), unitario(suma(hacia, [0, -0.6, 0])), k);
    }
  }
}

/** Pecíolos largos con hojas grandes hendidas: la monstera. */
function monstera(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const hojas = cuantos(ctx, 5, 11, 1.2);
  const caida = caidaDe(ctx);
  // El mismo porte —hojas grandes en pecíolos largos desde la base— sirve al
  // anturio, al singonio y a la aglaonema; sólo la monstera va partida.
  const partida = f.hoja.tipo === 'monstera';

  for (let k = 0; k < hojas; k += 1) {
    const az = k * 2.39996 + r() * 0.5;
    // Pecíolos más parados en las jóvenes; las hojas se sostienen, no se tienden.
    const edad = hojas === 1 ? 1 : k / (hojas - 1);
    const incl = ((f.hoja.inclinacion * (0.45 + 0.8 * edad)) * Math.PI) / 180 + r() * 0.2 + caida * 0.3;
    const d = direccion(incl, az);
    const largoPeciolo = H * (partida ? 0.7 + r() * 0.3 : 0.45 + r() * 0.3) * (1.05 - 0.25 * edad);
    const fin = suma(por(d, largoPeciolo), [0, 0.05, 0]);
    tubo(curva([0, 0, 0], por(d, largoPeciolo * 0.5), fin, 4), () => 0.012, 4, e.apariencia.tallo, 'tallo', caras, k);

    // La lámina: ancha, de corazón, con las hendiduras que le dan nombre (van
    // de la orilla hacia la vena) y unos huecos junto a la vena en las hojas
    // grandes. Sin eso se lee como cualquier hoja.
    const largo = H * f.hoja.largo * (0.8 + 0.4 * r());
    const dirHoja = unitario([d[0], 0.05 - caida * 0.55 - edad * 0.2, d[2]]);
    const lado = unitario(cruz(dirHoja, ARRIBA));
    const fase = r();
    const madura = largo > H * 0.35;
    hoja(
      {
        base: fin,
        dir: dirHoja,
        doblar: ABAJO,
        curva: 0.12 + caida * 0.35,
        largo,
        ancho: largo * f.hoja.ancho,
        perfil: partida ? PERFILES.corazon : (PERFILES[f.hoja.tipo] ?? PERFILES.corazon),
        pliegue: partida ? 0.06 : f.hoja.pliegue,
        segmentos: segmentos(ctx, partida ? 10 : 7),
        cortes: partida ? [1, 0.78, 0.56, 0.36, 0.16, 0, -0.16, -0.36, -0.56, -0.78, -1] : undefined,
        conBordes: !partida && (f.patron === 'bordes' || f.patron === 'franja'),
        hueco: partida
          ? (t, u) => {
              const fila = Math.floor(t * 10);
              const hendidura = t > 0.14 && t < 0.88 && fila % 3 === 1 && Math.abs(u) > 0.46;
              const ventana = madura && t > 0.25 && t < 0.75 && fila % 3 === 0 && Math.abs(u) > 0.2 && Math.abs(u) < 0.34;
              return hendidura || ventana;
            }
          : undefined,
        color: (t, u) => colorHoja(ctx, t, u, fase, false),
        parte: 'hoja',
        indice: k,
        brillo: f.hoja.brillo,
        ladoInicial: lado,
      },
      caras,
    );
  }

  // Las flores salen de la base en su propio tallo, entre las hojas (anturio).
  if (f.flor && e.morfologia.flores > 0) {
    for (let i = 0; i < Math.min(3, e.morfologia.flores); i += 1) {
      const az = i * 2.1 + r() * 0.8;
      const d = direccion(0.3 + r() * 0.25, az);
      const fin = suma(por(d, H * (0.55 + r() * 0.15)), [0, 0.06, 0]);
      tubo(curva([0, 0, 0], por(d, H * 0.3), fin, 4), () => 0.01, 4, e.apariencia.tallo, 'flor', caras, i);
      flor(ctx, fin, unitario(suma(d, [0, 0.4, 0])), i);
    }
  }
}

/**
 * Cactus de bola (biznaga): una o varias cabezas redondas, con tubérculos
 * donde nacen las espinas y la corona de flores alrededor de la punta.
 */
function bolas(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const costillas = e.forma.costillas ?? 13;
  // Muchas costillas = una sola bola grande (asiento de suegra), no un grupito.
  const solitaria = costillas >= 18;
  const n = solitaria ? 1 : cuantos(ctx, 1, 4, 0.4);
  const lados = costillas * 2;
  const ap = e.apariencia;
  const caida = Number.isFinite(e.morfologia.caida) ? e.morfologia.caida : 0;

  for (let c = 0; c < n; c += 1) {
    const az = c === 0 ? 0 : (c / Math.max(1, n - 1)) * Math.PI * 2 + r() * 0.6;
    const dist = c === 0 ? 0 : 0.15 + r() * 0.04;
    const radio = (solitaria ? 0.22 : c === 0 ? 0.15 : 0.09 + r() * 0.03) * (0.75 + H * 0.2);
    // Con sed se arruga: más bajita y con los tubérculos más marcados.
    const alto = radio * ((solitaria ? 1.45 : 1.75) - caida * 0.35);
    const base: V3 = [Math.cos(az) * dist, 0, Math.sin(az) * dist];
    const pisos = 8;
    const anillos: V3[][] = [];
    const alturas: number[] = [];
    for (let i = 0; i <= pisos; i += 1) {
      const ang = 0.35 + (i / pisos) * (Math.PI - 0.35);
      const h = (alto * (1 - Math.cos(ang))) / (1 - Math.cos(Math.PI));
      const rad = Math.max(0.002, radio * Math.sin(ang));
      alturas.push(h);
      anillos.push(
        Array.from({ length: lados }, (_, k) => {
          const th = (k / lados) * Math.PI * 2 + (solitaria ? 0 : (i % 2) * (Math.PI / lados));
          const rr = rad * (k % 2 === 0 ? 1 : 0.84 - caida * 0.06);
          return suma(base, [Math.cos(th) * rr, h, Math.sin(th) * rr]);
        }),
      );
    }
    for (let i = 0; i < pisos; i += 1) {
      const interior = suma(base, [0, (alturas[i] + alturas[i + 1]) / 2, 0]);
      for (let k = 0; k < lados; k += 1) {
        const k2 = (k + 1) % lados;
        const p: V3[] = [anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]];
        if (areaCasiNula(p)) continue;
        // Las espinas: en la bola dorada cubren cada costilla de oro; en la
        // biznaga son puntitos blancos en la punta de cada tubérculo.
        const aureola = solitaria ? k % 2 === 0 : k % 2 === 0 && i % 2 === 1;
        const espina = ap.acento ?? '#F2EEE0';
        caras.push({
          p,
          color: aureola
            ? mezclar(ap.hoja, espina, solitaria ? 0.72 : 0.6)
            : mezclar(k % 2 === 0 ? ap.hoja : ap.hojaOscura, espina, solitaria ? 0.48 : 0.18),
          parte: 'tallo',
          indice: c,
          dobleCara: false,
          interior,
          brillo: 0.12,
        });
      }
    }
    const punta = suma(base, [0, alto, 0]);
    // La corona de lana amarilla de arriba.
    if (solitaria) bola(punta, radio * 0.22, mezclar(ap.acento ?? '#EAD9A0', '#FFFFFF', 0.25), 'tallo', caras, 0.35, ARRIBA, 0.1, c);
    if (e.morfologia.flores > 0 && c < 2) {
      // La corona: varias flores chicas alrededor de la punta, no una sola.
      const cuantas = Math.min(6, 2 + e.morfologia.flores);
      for (let j = 0; j < cuantas; j += 1) {
        const th = (j / cuantas) * Math.PI * 2 + r() * 0.3;
        const q = suma(base, [Math.cos(th) * radio * 0.55, alto * 0.93, Math.sin(th) * radio * 0.55]);
        flor(ctx, q, unitario([Math.cos(th) * 0.6, 1, Math.sin(th) * 0.6]), c * 10 + j);
      }
    }
    if (e.morfologia.frutos > 0 && c < e.morfologia.frutos) {
      bola(suma(punta, [radio * 0.4, -radio * 0.2, 0]), e.forma.fruto?.tamano ?? 0.02, e.forma.fruto?.color ?? '#D7404A', 'fruto', caras);
    }
    if (e.morfologia.brotes > 0 && c === 0) bola(suma(base, [radio * 0.9, radio * 0.3, 0]), radio * 0.3, mezclar(ap.hoja, '#DFF5C8', 0.4), 'brote', caras);
  }
}

/**
 * Tronco de caña con su penacho: palo de Brasil, galatea, hule. Una o varias
 * cañas de distinta altura; las hojas salen arriba (o a lo largo del último
 * tramo, según `reparto`).
 */
function cana(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const caida = caidaDe(ctx);
  const perfil = PERFILES[f.hoja.tipo] ?? PERFILES.lanceolada;
  const total = cuantos(ctx, 10, 28, 2.2);
  const canas = total >= 18 ? 3 : total >= 12 ? 2 : 1;
  const reparto = Math.max(0.08, Math.min(0.8, f.reparto ?? 0.15));
  const colorCana = mezclar(e.apariencia.tallo, '#7A6650', 0.55);
  // Hojas finas en penacho (dracena marginata): troncos delgados que serpentean.
  const delgada = f.hoja.ancho < 0.08 && reparto < 0.2;
  const porCana = Math.max(4, Math.round((total / canas) * (delgada ? 1.8 : 1)));

  for (let c = 0; c < canas; c += 1) {
    const az = c * 2.2 + r() * 0.5;
    const dist = canas === 1 ? 0 : 0.045 + r() * 0.02;
    const alto = H * (c === 0 ? 0.62 : 0.32 + r() * 0.22);
    const base: V3 = [Math.cos(az) * dist, 0, Math.sin(az) * dist];
    const tope: V3 = [Math.cos(az) * (dist + 0.03), alto, Math.sin(az) * (dist + 0.03)];
    const vaiven = delgada ? 0.07 * (r() - 0.5) * 2 : 0;
    const pts = curva(base, [Math.cos(az) * dist + vaiven, alto * 0.5, Math.sin(az) * dist - vaiven], tope, 6);
    tubo(pts, (t) => (delgada ? 0.016 : 0.028) * (1 - t * 0.3), 6, colorCana, 'tallo', caras, c);
    // Los anillos de la caña: las cicatrices de las hojas que ya se cayeron.
    for (let i = 1; i < 4; i += 1) {
      const q = pts[Math.min(pts.length - 1, Math.round((i / 4) * (pts.length - 1) * (1 - reparto)))];
      bola(q, 0.033, mezclar(colorCana, '#4A3A2A', 0.3), 'tallo', caras, 0.22, ARRIBA, 0.18);
    }
    for (let k = 0; k < porCana; k += 1) {
      const edad = k / Math.max(1, porCana - 1);
      const t = 1 - reparto * edad;
      const i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const q = pts[i];
      const a = k * 2.39996 + r() * 0.3;
      const incl = ((f.hoja.inclinacion * (0.45 + 0.9 * edad) + r() * 12) * Math.PI) / 180;
      const largo = H * f.hoja.largo * (0.65 + 0.35 * r()) * (0.8 + 0.2 * edad);
      const fase = r();
      hoja(
        {
          base: q,
          dir: direccion(incl, a),
          doblar: ABAJO,
          curva: Math.min(1, 0.1 + caida * (0.4 + 0.6 * edad)),
          largo,
          ancho: largo * f.hoja.ancho,
          perfil,
          pliegue: f.hoja.pliegue,
          segmentos: segmentos(ctx, 6),
          color: (tt, u) => colorHoja(ctx, tt, u, fase, edad > 0.8),
          parte: 'hoja',
          indice: c * 30 + k,
          brillo: f.hoja.brillo,
          conBordes: f.patron === 'bordes' || f.patron === 'franja',
          ladoInicial: [-Math.sin(a), 0, Math.cos(a)],
        },
        caras,
      );
    }
    if (e.morfologia.brotes > 0 && c === 0) bola(tope, 0.025, mezclar(e.apariencia.hoja, '#DDF3B8', 0.45), 'brote', caras);
  }
}

/** Helecho: frondas arqueadas llenas de foliolos. */
function fronda(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  if (f.palmera) {
    palmas(ctx);
    return;
  }
  const frondas = cuantos(ctx, 9, 15, 1.6);
  const caida = caidaDe(ctx);
  const pinas = ctx.e.detalle === 'alto' ? 14 : 8;

  for (let k = 0; k < frondas; k += 1) {
    const az = k * 2.39996 + r() * 0.4;
    // Las de adentro más paradas: un helecho es una fuente, no un tapete.
    const edad = frondas === 1 ? 1 : k / (frondas - 1);
    const incl = ((f.hoja.inclinacion * (0.45 + 0.8 * edad) + r() * 18) * Math.PI) / 180;
    const largo = H * f.hoja.largo * (0.75 + 0.35 * r());
    const d = direccion(incl, az);
    const puntos: V3[] = [];
    let q: V3 = [Math.cos(az) * 0.03, 0, Math.sin(az) * 0.03];
    for (let i = 0; i <= pinas; i += 1) {
      const t = i / pinas;
      puntos.push(q);
      const dir = unitario(suma(d, por(ABAJO, caida * 1.8 * Math.pow(t, 1.4))));
      q = suma(q, por(dir, largo / pinas));
    }
    tubo(puntos, () => 0.006, 3, e.apariencia.tallo, 'tallo', caras, k);
    const lado: V3 = [-Math.sin(az), 0, Math.cos(az)];
    for (let i = 1; i < puntos.length; i += 1) {
      const t = i / puntos.length;
      const tan = unitario(resta(puntos[i], puntos[i - 1]));
      const largoPina = largo * 0.16 * Math.sin(Math.PI * (0.12 + 0.88 * t));
      const fase = r();
      for (const s of [-1, 1]) {
        hoja(
          {
            base: puntos[i],
            dir: unitario(suma(por(lado, s), por(tan, 0.5))),
            doblar: ABAJO,
            curva: 0.15 + caida * 0.3,
            largo: largoPina,
            ancho: largoPina * 0.38,
            perfil: PERFILES.foliolo,
            pliegue: 0,
            segmentos: 2,
            color: (tt, u) => colorHoja(ctx, t * 0.8 + tt * 0.2, u, fase, k % 5 === 0 && t < 0.3),
            parte: 'hoja',
            indice: k,
            brillo: f.hoja.brillo,
          },
          caras,
        );
      }
    }
    // Báculos: las frondas nuevas enrolladas.
    if (e.morfologia.brotes > 0 && k < e.morfologia.brotes) {
      bola([Math.cos(az) * 0.05, H * 0.15, Math.sin(az) * 0.05], 0.03, mezclar(e.apariencia.hoja, '#D8F2B0', 0.5), 'brote', caras);
    }
  }
}

/** Planta ZZ: tallos erguidos con pares de folíolos brillantes. */
function zz(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const tallos = cuantos(ctx, 3, 10, 0.9);
  const caida = caidaDe(ctx);

  for (let k = 0; k < tallos; k += 1) {
    const az = k * 2.39996 + r() * 0.3;
    const incl = 0.12 + r() * 0.35 + caida * 0.35;
    const largo = H * f.hoja.largo * (0.7 + 0.35 * r());
    const d = direccion(incl, az);
    const pts = curva([0, 0, 0], por(d, largo * 0.5), suma(por(d, largo), [0, -caida * 0.2, 0]), 5);
    tubo(pts, (t) => 0.026 * (1 - t * 0.6), 5, e.apariencia.tallo, 'tallo', caras, k);
    const pares = 6;
    for (let j = 0; j < pares; j += 1) {
      const t = 0.22 + (j / pares) * 0.74;
      const i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const tan = unitario(resta(pts[i + 1], pts[i]));
      const lado = unitario(cruz(tan, ARRIBA));
      const largoF = H * 0.26 * (1.15 - t * 0.45);
      const fase = r();
      for (const s of [-1, 1]) {
        hoja(
          {
            base: pts[i],
            dir: unitario(suma(por(lado, s), por(tan, 0.6))),
            doblar: ABAJO,
            curva: 0.1 + caida * 0.3,
            largo: largoF,
            ancho: largoF * f.hoja.ancho,
            perfil: PERFILES.foliolo,
            pliegue: 0.06,
            segmentos: segmentos(ctx, 3),
            color: (tt, u) => colorHoja(ctx, tt, u, fase, false),
            parte: 'hoja',
            indice: k,
            brillo: f.hoja.brillo,
          },
          caras,
        );
      }
    }
  }
}

/** Pata de elefante: tronco de botella y un penacho de hojas largas que caen. */
function palma(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const altoTronco = H * 0.55;
  torno(
    [0, 0, 0],
    ARRIBA,
    [
      [0, 0.16],
      [altoTronco * 0.15, 0.2],
      [altoTronco * 0.35, 0.15],
      [altoTronco * 0.6, 0.07],
      [altoTronco, 0.045],
    ],
    10,
    (t) => mezclar(e.apariencia.tallo, '#5A4636', t * 0.4),
    'tallo',
    0.1,
    caras,
  );
  const hojas = cuantos(ctx, 10, 22, 2);
  const caida = caidaDe(ctx);
  for (let k = 0; k < hojas; k += 1) {
    const az = k * 2.39996 + r() * 0.3;
    const largo = H * f.hoja.largo * (0.7 + 0.4 * r());
    const fase = r();
    hoja(
      {
        base: [0, altoTronco, 0],
        dir: direccion(0.2 + r() * 0.6, az),
        doblar: ABAJO,
        curva: caida,
        largo,
        ancho: largo * f.hoja.ancho,
        perfil: PERFILES.cinta,
        pliegue: 0.05,
        segmentos: segmentos(ctx, 7),
        color: (t, u) => colorHoja(ctx, t, u, fase, false),
        parte: 'hoja',
        indice: k,
        brillo: f.hoja.brillo,
      },
      caras,
    );
  }
}

/** Cola de burro: tallos que cuelgan cubiertos de hojitas gordas. */
function colgante(ctx: Contexto) {
  const { e, r, caras } = ctx;
  const tallos = cuantos(ctx, 3, 7, 0.6);
  for (let k = 0; k < tallos; k += 1) {
    const az = (k / tallos) * Math.PI * 2 + r() * 0.5;
    const hacia: V3 = [Math.cos(az), 0, Math.sin(az)];
    const largo = 0.45 + r() * 0.45;
    const pts = guiaAlPiso(ctx, hacia, largo, r() > 0.5 ? 1 : -1);
    tubo(pts, () => 0.01, 3, e.apariencia.tallo, 'tallo', caras, k);
    // Hojitas en espiral a todo lo largo: lo que la hace "cola".
    const porTramo = ctx.e.detalle === 'alto' ? 6 : 4;
    for (let i = 1; i < pts.length; i += 1) {
      const tan = unitario(resta(pts[i], pts[i - 1]));
      const lado = perpendicular(tan);
      for (let h = 0; h < porTramo; h += 1) {
        const giro = (h / porTramo) * Math.PI * 2 + i * 0.8;
        const afuera = unitario(suma(por(lado, Math.cos(giro)), por(cruz(tan, lado), Math.sin(giro))));
        const largoH = 0.09;
        hoja(
          {
            base: pts[i],
            dir: unitario(suma(afuera, por(tan, -0.6))),
            doblar: tan,
            curva: 0.2,
            largo: largoH,
            ancho: largoH * 0.85,
            perfil: (t) => Math.pow(sen(Math.PI * t), 0.5),
            pliegue: 0.35,
            segmentos: 2,
            color: (t) => mezclar(e.apariencia.hojaOscura, e.apariencia.hoja, 0.4 + 0.6 * t),
            parte: 'hoja',
            indice: k,
            brillo: 0.25,
          },
          caras,
        );
      }
    }
  }
}

/** Nenúfar: un estanque chico con hojas redondas flotando y la flor al centro. */
function flotante(ctx: Contexto) {
  const { e, r, caras } = ctx;
  torno([0, -0.14, 0], ARRIBA, [[0, 0.46], [0.14, 0.52], [0.16, 0.55]], 16, () => '#8B8578', 'sustrato', 0.1, caras);
  tapa([0, -0.03, 0], 0.49, 16, '#3C7FA3', 'raiz', caras, 0.9);
  const hojas = cuantos(ctx, 3, 7, 0.7);
  for (let k = 0; k < hojas; k += 1) {
    const az = (k / hojas) * Math.PI * 2 + r() * 0.5;
    const dist = 0.2 + r() * 0.12;
    const c: V3 = [Math.cos(az) * dist, -0.015, Math.sin(az) * dist];
    const radio = 0.14 + r() * 0.05;
    const lados = 12;
    const muesca = r() * Math.PI * 2;
    for (let j = 0; j < lados; j += 1) {
      const a1 = muesca + 0.35 + (j / lados) * (Math.PI * 2 - 0.35);
      const a2 = muesca + 0.35 + ((j + 1) / lados) * (Math.PI * 2 - 0.35);
      caras.push({
        p: [c, [c[0] + Math.cos(a1) * radio, c[1], c[2] + Math.sin(a1) * radio], [c[0] + Math.cos(a2) * radio, c[1], c[2] + Math.sin(a2) * radio]],
        color: mezclar(e.apariencia.hojaOscura, e.apariencia.hoja, 0.4 + 0.4 * Math.sin(j)),
        parte: 'hoja',
        indice: k,
        dobleCara: true,
        brillo: 0.5,
      });
    }
  }
  if (e.morfologia.flores > 0) flor(ctx, [0.02, 0, 0.02], ARRIBA, 0);
}

/**
 * La pitahaya en su poste: tallos de tres alas que suben pegados a la madera
 * —agarrados con raíces aéreas— y, al llegar arriba, se doblan sobre la
 * cruceta y cuelgan en cascada. Así se ve en cualquier patio con pitahaya, y
 * así se reconoce: un cactus que trepa y luego "llora".
 */
function poste(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const ap = e.apariencia;
  const alas = f.costillas ?? 3;
  const des = desarrolloEn(ctx);
  const caida = Number.isFinite(e.morfologia.caida) ? e.morfologia.caida : 0;
  const altoPoste = H * 0.9;

  // El poste de madera, cuadrado, y la cruceta de arriba.
  const madera = (_t: number, k: number) => mezclar(ap.tallo, '#000000', k % 2 ? 0.14 : 0);
  torno([0, 0, 0], ARRIBA, [[0, 0.03], [altoPoste + 0.05, 0.03], [altoPoste + 0.06, 0.022]], 4, madera, 'tallo', 0.08, caras);
  torno([-0.19, altoPoste, 0], [1, 0, 0], [[0, 0.016], [0.38, 0.016]], 4, madera, 'tallo', 0.08, caras);
  torno([0, altoPoste - 0.03, -0.19], [0, 0, 1], [[0, 0.016], [0.38, 0.016]], 4, madera, 'tallo', 0.08, caras);

  const tallos = cuantos(ctx, 3, 6, 0.6);
  const grosor = 0.05 * (0.8 + 0.4 * des);
  const alcanzan = Math.max(1, Math.round(tallos * (0.4 + des * 0.5)));
  const colgantes: Array<{ pts: V3[]; afuera: V3 }> = [];

  for (let k = 0; k < tallos; k += 1) {
    const az = (k / tallos) * Math.PI * 2 + r() * 0.5;
    const llega = k < alcanzan;
    const tope = llega ? altoPoste : altoPoste * (0.3 + r() * 0.4);
    const pisos = Math.max(4, Math.round((tope / 0.1) * ctx.seg));
    const sube: V3[] = [];
    for (let j = 0; j <= pisos; j += 1) {
      const t = j / pisos;
      const a = az + t * 0.9;
      const rc = 0.07 + 0.012 * Math.sin(t * 7 + k);
      sube.push([Math.cos(a) * rc, t * tope, Math.sin(a) * rc]);
    }
    // Arriba, cada tallo se abre en dos que cuelgan hacia lados distintos:
    // eso es lo que forma la "cabellera" de la pitahaya.
    const cascada = (desde: V3, a: number, largo: number): V3[] => {
      const afuera: V3 = [Math.cos(a), 0, Math.sin(a)];
      // Primero se abre como sombrilla y luego cae: así se ve el poste debajo.
      const arco = curva(desde, suma(desde, [afuera[0] * 0.22, 0.16, afuera[2] * 0.22]), suma(desde, [afuera[0] * 0.44, 0.02, afuera[2] * 0.44]), 4);
      const fin = arco[arco.length - 1];
      const abre = 0.2 + caida * 0.06;
      const cae = curva(
        fin,
        suma(fin, [afuera[0] * 0.1, -largo * 0.45, afuera[2] * 0.1]),
        suma(fin, [afuera[0] * abre, -largo, afuera[2] * abre]),
        Math.max(3, Math.round(6 * ctx.seg)),
      );
      const colgante = [...arco.slice(1), ...cae.slice(1)];
      colgantes.push({ pts: colgante, afuera });
      return colgante;
    };
    let pts = sube;
    if (llega) {
      const a = az + 0.9;
      const cima = sube[sube.length - 1];
      // Con sed los tallos se ponen flojos y cuelgan más.
      const largo = H * (0.16 + 0.24 * des) * (0.8 + 0.4 * r()) * (1 + caida * 0.35);
      pts = [...sube, ...cascada(cima, a, largo)];
      const rama = cascada(cima, a + 1.5 + r() * 0.5, largo * (0.6 + 0.3 * r()));
      talloAlado(ctx, [cima, ...rama], (t) => grosor * 0.85 * (t > 0.97 ? 0.5 : 1), alas, 10 + k);
    }
    talloAlado(ctx, pts, (t) => grosor * (t > 0.97 ? 0.5 : 1), alas, k);
    // Raíces aéreas: hilitos cafés del tallo a la madera.
    for (let j = 2; j < sube.length - 1; j += 3) {
      const q = sube[j];
      tubo([q, [q[0] * 0.4, q[1] - 0.02, q[2] * 0.4]], () => 0.004, 3, '#A8906E', 'raiz', caras, k);
    }
  }

  // Brotes: tallitos nuevos, verde claro, que salen de la base.
  const brotes = Math.min(2, Number.isFinite(e.morfologia.brotes) ? e.morfologia.brotes : 0);
  for (let b = 0; b < brotes; b += 1) {
    const az = b * 2.6 + r();
    const pts = curva([Math.cos(az) * 0.08, 0, Math.sin(az) * 0.08], [Math.cos(az) * 0.1, H * 0.1, Math.sin(az) * 0.1], [Math.cos(az) * 0.08, H * 0.2, Math.sin(az) * 0.08], 3);
    talloAlado(ctx, pts, (t) => grosor * 0.7 * (1 - t * 0.4), alas, 20 + b, 'brote');
  }

  // Flores en las puntas que cuelgan; frutos a lo largo de la cascada.
  let flores = e.morfologia.flores;
  let frutos = e.morfologia.frutos;
  colgantes.forEach(({ pts, afuera }, i) => {
    if (flores > 0) {
      const q = pts[pts.length - 1];
      flor(ctx, q, unitario(suma(afuera, [0, -0.35, 0])), i);
      flores -= 1;
    }
    for (let j = 1; frutos > 0 && j < pts.length - 1; j += 2) {
      fruto(ctx, suma(pts[j], por(afuera, grosor * 1.2)), i);
      frutos -= 1;
    }
  });
}

/**
 * Una guía que sale del centro, pasa por la orilla, baja pegada a la maceta
 * y sigue por el piso (potos, filodendro, matalí, cola de burro). Si la guía
 * es corta se queda colgando a media maceta, como pasa de verdad.
 */
function guiaAlPiso(ctx: Contexto, hacia: V3, largo: number, giro: 1 | -1): V3[] {
  const rec = ctx.e.recipiente;
  const borde = rec === 'maceta' ? 0.38 : rec === 'agua' ? 0.24 : 0.2;
  const piso = rec === 'maceta' ? -0.41 : rec === 'agua' ? -0.54 : 0.01;
  const en = (radio: number, y: number, lateral = 0): V3 => [
    hacia[0] * radio - hacia[2] * lateral * giro,
    y,
    hacia[2] * radio + hacia[0] * lateral * giro,
  ];
  const pts = curva([0, 0.02, 0], en(borde * 0.5, 0.2), en(borde, 0.02), 3);
  const bajada = Math.max(0, 0.02 - piso);
  if (bajada < 0.05) {
    // Plantada en el suelo: la guía sale directo a rastras.
    return [...pts, ...curva(en(borde, 0.02), en(borde + largo * 0.5, piso, largo * 0.15), en(borde + largo, piso, largo * 0.05), 4).slice(1)];
  }
  const cae = Math.min(largo, bajada);
  const fin = piso + (bajada - cae);
  pts.push(...curva(en(borde + 0.02, -0.02), en(borde + 0.06, (fin - 0.02) * 0.6), en(borde + 0.1, fin + 0.012), 3).slice(1));
  const resto = largo - cae;
  if (resto > 0.06) {
    const desde = pts[pts.length - 1];
    const r0 = borde + 0.1;
    pts.push(
      ...curva(desde, en(r0 + resto * 0.35, piso + 0.012, resto * 0.3), en(r0 + resto * 0.6, piso + 0.012, resto * 0.1), Math.max(2, Math.round(resto / 0.12))).slice(1),
    );
  }
  return pts;
}

/** Una aguja (romero, lavanda): un triangulito de una cara. Así caben cientos sin que pese. */
function agujita(ctx: Contexto, base: V3, dir: V3, largo: number, ancho: number, color: string, indice: number) {
  const d = unitario(dir);
  const lado = perpendicular(d);
  ctx.caras.push({
    p: [suma(base, por(lado, ancho / 2)), suma(base, por(lado, -ancho / 2)), suma(base, por(d, largo))],
    color,
    parte: 'hoja',
    indice,
    dobleCara: true,
    brillo: ctx.e.forma.hoja.brillo,
  });
}

/**
 * Una palma (camedor, areca, cica): frondas que salen paradas, con un tramo
 * pelón de pecíolo, y foliolos largos y angostos que se abren en V. El
 * helecho se tiende como fuente; la palma se sostiene. La cica, además,
 * tiene su tronquito grueso de escamas.
 */
function palmas(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const ap = e.apariencia;
  const caida = caidaDe(ctx);
  const altoTronco = H * Math.max(0, Math.min(0.5, f.tronco ?? 0));
  if (altoTronco > 0) {
    const perfil: Array<[number, number]> = [];
    for (let i = 0; i <= 5; i += 1) perfil.push([(i / 5) * altoTronco, 0.1 - (i / 5) * 0.025]);
    torno([0, 0, 0], ARRIBA, perfil, 10, (t, k) => ((k + Math.floor(t * 8)) % 2 ? mezclar(ap.tallo, '#3A2E20', 0.25) : ap.tallo), 'tallo', 0.1, caras);
  }
  const frondas = cuantos(ctx, 6, 13, 1.1);
  const pinas = ctx.e.detalle === 'alto' ? 12 : 8;
  const pelon = 0.28;
  for (let k = 0; k < frondas; k += 1) {
    const edad = frondas === 1 ? 1 : k / (frondas - 1);
    const az = k * 2.39996 + r() * 0.4;
    const incl = ((f.hoja.inclinacion * (0.4 + 1.1 * edad) + r() * 10) * Math.PI) / 180;
    const largo = H * f.hoja.largo * (0.8 + 0.3 * r()) * (1 - 0.15 * edad);
    const d = direccion(incl, az);
    const base: V3 = [Math.cos(az) * 0.03, altoTronco, Math.sin(az) * 0.03];
    const puntos: V3[] = [];
    let q = base;
    for (let i = 0; i <= pinas; i += 1) {
      const t = i / pinas;
      puntos.push(q);
      const dir = unitario(suma(d, por(ABAJO, (0.35 + caida * 1.5) * Math.pow(t, 1.6))));
      q = suma(q, por(dir, largo / pinas));
    }
    tubo(puntos, (t) => 0.009 * (1 - t * 0.6), 3, ap.tallo, 'tallo', caras, k);
    const lado: V3 = [-Math.sin(az), 0, Math.cos(az)];
    for (let i = 1; i < puntos.length; i += 1) {
      const t = i / puntos.length;
      if (t < pelon) continue;
      const tt = (t - pelon) / (1 - pelon);
      const tan = unitario(resta(puntos[i], puntos[i - 1]));
      const largoPina = largo * 0.3 * Math.sin(Math.PI * (0.15 + 0.8 * tt));
      const fase = r();
      for (const s of [-1, 1]) {
        hoja(
          {
            base: puntos[i],
            dir: unitario(suma(suma(por(lado, s), por(tan, 0.75)), [0, 0.3, 0])),
            doblar: ABAJO,
            curva: 0.2 + caida * 0.35,
            largo: largoPina,
            ancho: largoPina * f.hoja.ancho,
            perfil: PERFILES.lanceolada,
            pliegue: 0.1,
            segmentos: 2,
            color: (u, v) => colorHoja(ctx, 0.3 + tt * 0.5 + u * 0.2, v, fase, k % 6 === 5 && tt > 0.7),
            parte: 'hoja',
            indice: k,
            brillo: f.hoja.brillo,
          },
          caras,
        );
      }
    }
    if (e.morfologia.brotes > 0 && k < e.morfologia.brotes) {
      bola(suma(base, [0, H * 0.12, 0]), 0.025, mezclar(ap.hoja, '#D8F2B0', 0.5), 'brote', caras, 1.8);
    }
  }
  // Las flores de la camedor: varitas naranjas entre las frondas.
  if (f.flor && e.morfologia.flores > 0) {
    for (let i = 0; i < Math.min(3, e.morfologia.flores); i += 1) {
      const az = i * 2.2 + r();
      const fin: V3 = [Math.cos(az) * 0.15, altoTronco + H * 0.35, Math.sin(az) * 0.15];
      tubo(curva([0, altoTronco, 0], [Math.cos(az) * 0.05, altoTronco + H * 0.2, Math.sin(az) * 0.05], fin, 3), () => 0.005, 3, ap.tallo, 'flor', caras, i);
      flor(ctx, fin, unitario([Math.cos(az), 0.6, Math.sin(az)]), i);
    }
  }
}

/**
 * Un tallo de alas que sigue una línea. El de la pitahaya tiene tres, con la
 * orilla ondulada y una aréola en cada muesca; sin las alas se leería como
 * una manguera verde.
 */
function talloAlado(ctx: Contexto, puntos: V3[], radio: (t: number) => number, alas: number, indice: number, parte: TipoParte = 'tallo') {
  const { e, caras } = ctx;
  if (puntos.length < 2) return;
  const ap = e.apariencia;
  const claro = parte === 'brote' ? mezclar(ap.hoja, '#DFF3B8', 0.4) : ap.hoja;
  const oscuro = parte === 'brote' ? mezclar(ap.hojaOscura, '#DFF3B8', 0.3) : ap.hojaOscura;
  const lados = alas * 2;
  const anillos: V3[][] = [];
  let lado = perpendicular(unitario(resta(puntos[1], puntos[0])));
  puntos.forEach((q, i) => {
    const d = unitario(resta(puntos[Math.min(i + 1, puntos.length - 1)], puntos[Math.max(0, i - 1)]));
    lado = unitario(resta(lado, por(d, punto(lado, d))));
    const otro = cruz(d, lado);
    // La orilla se abomba entre muesca y muesca.
    const rr = radio(i / (puntos.length - 1)) * (i % 2 === 0 ? 0.78 : 1);
    anillos.push(
      Array.from({ length: lados }, (_, k) => {
        const th = (k / lados) * Math.PI * 2;
        const rk = rr * (k % 2 === 0 ? 1 : 0.3);
        return suma(q, suma(por(lado, Math.cos(th) * rk), por(otro, Math.sin(th) * rk)));
      }),
    );
  });
  for (let i = 0; i < anillos.length - 1; i += 1) {
    const interior = por(suma(puntos[i], puntos[i + 1]), 0.5);
    for (let k = 0; k < lados; k += 1) {
      const k2 = (k + 1) % lados;
      const p: V3[] = [anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]];
      if (areaCasiNula(p)) continue;
      // Un lado de cada ala claro y el otro oscuro: así se leen las alas.
      const deFrente = k % 2 === 0;
      const areola = i % 2 === 0 && deFrente;
      caras.push({
        p,
        color: areola ? mezclar(claro, ap.acento ?? '#D8D0B0', 0.32) : deFrente ? claro : oscuro,
        parte,
        indice,
        dobleCara: false,
        interior,
        brillo: 0.2,
      });
    }
  }
}

/**
 * Hojas enormes como remos. El ave del paraíso las abre en abanico desde el
 * suelo, en largos pecíolos; el plátano las saca en espiral de lo alto de su
 * falso tronco, y el viento las deja rasgadas en tiras.
 */
function remos(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const ap = e.apariencia;
  const caida = caidaDe(ctx);
  const tronco = Math.max(0, Math.min(0.7, f.tronco ?? 0));
  const altoTronco = H * tronco;
  const abanico = tronco === 0;
  const n = cuantos(ctx, 4, abanico ? 11 : 8, abanico ? 1 : 0.8);

  if (!abanico) {
    // El falso tronco: vainas de hojas enrolladas, verde con vetas cafés.
    const perfil: Array<[number, number]> = [];
    for (let i = 0; i <= 6; i += 1) perfil.push([(i / 6) * altoTronco, 0.08 - (i / 6) * 0.03]);
    torno([0, 0, 0], ARRIBA, perfil, 8, (t, k) => mezclar(ap.tallo, k % 3 === 0 ? '#6A5A3A' : ap.hoja, k % 3 === 0 ? 0.4 : 0.12 + t * 0.1), 'tallo', 0.15, caras);
  }

  const plano = r() * Math.PI;
  for (let k = 0; k < n; k += 1) {
    const edad = n === 1 ? 1 : k / (n - 1);
    // El abanico: todas en un mismo plano, alternando de un lado y del otro.
    const az = abanico ? plano + (k % 2 === 0 ? 0 : Math.PI) + (r() - 0.5) * 0.3 : k * 2.39996 + r() * 0.4;
    const incl = ((f.hoja.inclinacion * (0.25 + 1.3 * edad) + r() * 6) * Math.PI) / 180 + caida * 0.35;
    const d = direccion(incl, az);
    const base: V3 = [0, altoTronco, 0];
    const largoPeciolo = abanico ? H * (0.4 + 0.15 * r()) * (0.8 + 0.2 * (1 - edad)) : H * 0.1;
    const finP = suma(base, por(d, largoPeciolo));
    tubo(curva(base, suma(base, por(d, largoPeciolo * 0.5)), finP, 3), (t) => (abanico ? 0.012 : 0.022) * (1 - t * 0.4), 4, ap.tallo, 'tallo', caras, k);

    const largo = H * f.hoja.largo * (0.8 + 0.3 * r()) * (abanico ? 1 : 0.85 + 0.25 * (1 - edad));
    const dirHoja = unitario(suma(d, [0, abanico ? 0.35 : 0.15, 0]));
    const rasgada = !abanico;
    const fase = r();
    hoja(
      {
        base: finP,
        dir: dirHoja,
        doblar: ABAJO,
        curva: Math.min(1, (abanico ? 0.04 : 0.3) + f.hoja.arco * 0.5 + caida * (0.4 + 0.4 * edad)),
        largo,
        ancho: largo * f.hoja.ancho,
        perfil: PERFILES.remo,
        pliegue: f.hoja.pliegue,
        segmentos: segmentos(ctx, rasgada ? 12 : 8),
        cortes: rasgada ? [1, 0.66, 0.33, 0, -0.33, -0.66, -1] : [1, 0.5, 0, -0.5, -1],
        hueco: rasgada
          ? (t, u) => {
              const fila = Math.floor(t * 12);
              return t > 0.2 && t < 0.95 && Math.abs(u) > 0.5 && (fila * 7 + k * 3) % 5 === 0;
            }
          : undefined,
        color: (t, u) => (Math.abs(u) < 0.2 ? mezclar(colorHoja(ctx, t, u, fase, edad > 0.85), '#E4EFC8', 0.3) : colorHoja(ctx, t, u, fase, edad > 0.85)),
        parte: 'hoja',
        indice: k,
        brillo: f.hoja.brillo,
        ladoInicial: unitario(cruz(dirHoja, ARRIBA)),
      },
      caras,
    );
  }

  // El ave del paraíso: la vara sale de entre las hojas y termina en el pájaro.
  if (f.flor && e.morfologia.flores > 0) {
    for (let i = 0; i < Math.min(3, e.morfologia.flores); i += 1) {
      const az = plano + Math.PI / 2 + (i - 1) * 0.9 + r() * 0.3;
      const alto = H * (0.62 + r() * 0.12);
      const tope: V3 = [Math.cos(az) * 0.05, alto, Math.sin(az) * 0.05];
      tubo(curva([0, 0, 0], [0, alto * 0.5, 0], tope, 4), () => 0.011, 4, ap.tallo, 'flor', caras, i);
      flor(ctx, tope, [Math.cos(az), 0, Math.sin(az)], i);
    }
  }

  // El racimo del plátano: sale de lo alto y cuelga.
  if (f.fruto?.tipo === 'racimo' && e.morfologia.frutos > 0) {
    const az = r() * Math.PI * 2;
    racimo(ctx, [0, altoTronco + 0.04, 0], [Math.cos(az), 0, Math.sin(az)], 0);
  }
}

/** El racimo de plátanos: el raquis que cuelga, las manos con sus dedos hacia arriba y la bellota. */
function racimo(ctx: Contexto, desde: V3, afuera: V3, indice: number) {
  const f = ctx.e.forma.fruto;
  if (!f) return;
  const { caras } = ctx;
  const eje = curva(desde, suma(desde, [afuera[0] * 0.24, 0.05, afuera[2] * 0.24]), suma(desde, [afuera[0] * 0.32, -0.55, afuera[2] * 0.32]), 6);
  tubo(eje, () => 0.013, 4, mezclar(ctx.e.apariencia.tallo, '#5A6A3A', 0.3), 'fruto', caras, indice);
  const manos = ctx.e.detalle === 'alto' ? 5 : 3;
  const dedos = ctx.e.detalle === 'alto' ? 7 : 5;
  const L = f.tamano * 1.6;
  for (let m = 0; m < manos; m += 1) {
    const q = eje[Math.min(eje.length - 2, 2 + m)];
    for (let d = 0; d < dedos; d += 1) {
      const th = (d / dedos) * Math.PI * 2 + m * 0.5;
      const rad: V3 = [Math.cos(th), 0, Math.sin(th)];
      const base = suma(q, por(rad, 0.018));
      const pts = curva(base, suma(base, suma(por(rad, L * 0.5), [0, L * 0.1, 0])), suma(base, suma(por(rad, L * 0.55), [0, L * 0.75, 0])), 3);
      tubo(pts, (t) => f.tamano * 0.22 * (1 - t * 0.5), 4, mezclar(f.color, '#E8D84A', m * 0.08), 'fruto', caras, indice);
    }
  }
  // La bellota: la flor macho, morada, al final del racimo.
  bola(suma(eje[eje.length - 1], [0, -0.05, 0]), 0.045, '#6E2A4E', 'flor', caras, 1.7, ARRIBA, 0.3);
}

/**
 * El papayo: un tronco derecho sin ramas, con las cicatrices de las hojas que
 * se le cayeron; arriba, la corona de hojas grandes como manos abiertas, y
 * los frutos pegados al tronco justo debajo de ellas.
 */
function papayo(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const ap = e.apariencia;
  const caida = caidaDe(ctx);
  const des = desarrolloEn(ctx);
  const altoTronco = H * (0.62 + des * 0.12);
  const perfil: Array<[number, number]> = [];
  const pisos = 10;
  for (let i = 0; i <= pisos; i += 1) perfil.push([(i / pisos) * altoTronco, 0.058 - (i / pisos) * 0.022]);
  torno([0, 0, 0], ARRIBA, perfil, 8, (t) => (Math.floor(t * 20) % 3 === 0 ? mezclar(ap.tallo, '#6A6A50', 0.3) : ap.tallo), 'tallo', 0.12, caras);

  const cima: V3 = [0, altoTronco, 0];
  const hojas = cuantos(ctx, 5, ctx.e.detalle === 'alto' ? 12 : 8, 1);
  const lobulos = ctx.e.detalle === 'alto' ? 7 : 5;
  for (let k = 0; k < hojas; k += 1) {
    const edad = hojas === 1 ? 1 : k / (hojas - 1);
    const az = k * 2.39996 + r() * 0.3;
    // Las jóvenes arriba y paradas; las viejas abajo, caídas.
    const incl = 0.45 + edad * 1.15 + caida * 0.5;
    const d = direccion(incl, az);
    const largoPeciolo = H * 0.3 * (0.8 + 0.3 * r());
    const q = suma(cima, [0, -edad * 0.06, 0]);
    const fin = suma(q, por(d, largoPeciolo));
    tubo(curva(q, suma(q, suma(por(d, largoPeciolo * 0.55), [0, 0.04, 0])), fin, 3), () => 0.008, 3, mezclar(ap.tallo, ap.hoja, 0.5), 'tallo', caras, k);
    // La lámina: lóbulos que se abren en abanico desde la punta del pecíolo.
    const afuera = unitario([d[0], 0, d[2]]);
    const normal = unitario(suma(ARRIBA, por(afuera, 0.35)));
    const lado = unitario(cruz(normal, afuera));
    const largo = H * f.hoja.largo * (0.8 + 0.3 * r());
    const fase = r();
    for (let j = 0; j < lobulos; j += 1) {
      const ang = -2.3 + (j / (lobulos - 1)) * 4.6;
      const dir = unitario(suma(suma(por(afuera, Math.cos(ang)), por(lado, Math.sin(ang))), por(normal, 0.12)));
      const l = largo * (1 - 0.3 * Math.abs(ang) / 2.3);
      hoja(
        {
          base: fin,
          dir,
          doblar: ABAJO,
          curva: 0.15 + caida * 0.5 + edad * 0.15,
          largo: l,
          ancho: l * 0.34,
          perfil: PERFILES.palmeada,
          pliegue: f.hoja.pliegue,
          segmentos: segmentos(ctx, 4),
          color: (t, u) => colorHoja(ctx, t, u, fase, edad > 0.85),
          parte: 'hoja',
          indice: k,
          brillo: f.hoja.brillo,
          ladoInicial: unitario(cruz(dir, normal)),
        },
        caras,
      );
    }
  }

  // Flores blancas en las axilas, y los frutos apretados contra el tronco.
  if (f.flor && e.morfologia.flores > 0) {
    for (let i = 0; i < Math.min(4, e.morfologia.flores + 1); i += 1) {
      const th = i * 2.1 + 0.5;
      flor(ctx, suma(cima, [Math.cos(th) * 0.05, -0.03, Math.sin(th) * 0.05]), [Math.cos(th), 0.4, Math.sin(th)], i);
    }
  }
  const frutos = e.morfologia.frutos > 0 ? Math.min(7, 2 + e.morfologia.frutos * 2) : 0;
  const T = f.fruto?.tamano ?? 0.08;
  for (let i = 0; i < frutos; i += 1) {
    const th = i * 2.2 + r() * 0.3;
    const y = altoTronco - 0.05 - Math.floor(i / 3) * T * 1.9;
    const c: V3 = [Math.cos(th) * (0.035 + T * 0.65), y - T * 0.6, Math.sin(th) * (0.035 + T * 0.65)];
    // Los de abajo maduran primero.
    const madurez = Math.min(1, Math.floor(i / 3) * 0.5 + r() * 0.3);
    bola(c, T * 0.62, mezclar('#6E9A3A', f.fruto?.color ?? '#EFA33A', madurez), 'fruto', caras, 1.5, ARRIBA, 0.45);
  }
}

/**
 * Un tallo alto con hojas grandes alternas y, arriba, una flor enorme: el
 * girasol. Con sed se desmaya entero —hojas colgando y la cabeza gacha—, que
 * es justo lo que hace uno de verdad.
 */
function vara(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const ap = e.apariencia;
  const caida = caidaDe(ctx);
  const n = cuantos(ctx, 1, 3, 0.25);
  const perfil = PERFILES[f.hoja.tipo] ?? PERFILES.corazon;
  let flores = e.morfologia.flores;

  for (let c = 0; c < n; c += 1) {
    const az = c * 2.3 + r() * 0.4;
    const dist = c === 0 ? 0 : 0.07;
    const alto = H * (c === 0 ? 0.95 : 0.6 + r() * 0.2);
    const base: V3 = [Math.cos(az) * dist, 0, Math.sin(az) * dist];
    const lean: V3 = [Math.cos(az) * (0.03 + caida * 0.08), 0, Math.sin(az) * (0.03 + caida * 0.08)];
    const tope = suma(suma(base, [0, alto, 0]), lean);
    const pts = curva(base, suma(base, [0, alto * 0.55, 0]), tope, Math.max(4, Math.round(8 * ctx.seg)));
    tubo(pts, (t) => 0.024 * (1 - t * 0.35), 5, ap.tallo, 'tallo', caras, c);

    const hojas = ctx.e.detalle === 'alto' ? 8 : 5;
    for (let j = 0; j < hojas; j += 1) {
      const t = 0.12 + (j / hojas) * 0.76;
      const i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const q = pts[i];
      const a2 = az + j * 2.4;
      const afuera: V3 = [Math.cos(a2), 0, Math.sin(a2)];
      const largoHoja = H * f.hoja.largo * (1.3 - 0.6 * t);
      const fase = r();
      hoja(
        {
          base: q,
          dir: unitario(suma(afuera, [0, 0.35 - caida * 0.6, 0])),
          doblar: ABAJO,
          curva: 0.2 + caida * 0.7,
          largo: largoHoja,
          ancho: largoHoja * f.hoja.ancho,
          perfil,
          pliegue: f.hoja.pliegue,
          segmentos: segmentos(ctx, 5),
          color: (tt, u) => colorHoja(ctx, tt, u, fase, j === 0),
          parte: 'hoja',
          indice: c * 20 + j,
          brillo: f.hoja.brillo,
          ladoInicial: [-afuera[2], 0, afuera[0]],
        },
        caras,
      );
    }

    // La cabeza mira hacia un lado (al oriente), y con sed se agacha.
    const mira = unitario([Math.cos(az + 0.6), 0.55 - caida * 0.9, Math.sin(az + 0.6)]);
    if (flores > 0 && f.flor) {
      flor(ctx, suma(tope, por(mira, 0.02)), mira, c);
      flores -= 1;
    } else {
      // El botón: una bola verde con sus brácteas.
      bola(tope, 0.04, mezclar(ap.hoja, '#9ABF5A', 0.3), 'brote', caras, 0.8, mira, 0.2);
    }
  }
}

/**
 * La pilea: un tallito derecho del que salen, en espiral, pecíolos largos con
 * hojas redondas como monedas, casi horizontales y abiertas hacia la luz.
 * Los hijitos que echa alrededor son sus brotes.
 */
function sombrillas(ctx: Contexto) {
  const { e, r, H, caras } = ctx;
  const f = e.forma;
  const ap = e.apariencia;
  const caida = caidaDe(ctx);
  const altoTallo = H * 0.36;
  const tallo = curva([0, 0, 0], [0.01, altoTallo * 0.5, 0], [0.02, altoTallo, 0.01], 4);
  tubo(tallo, (t) => 0.016 * (1 - t * 0.4), 5, ap.tallo, 'tallo', caras, 0);

  const moneda = (q: V3, az: number, t: number, escala: number, indice: number) => {
    const d = direccion(0.75 + 0.6 * (1 - t) + caida * 0.45, az);
    const largoPeciolo = H * (0.2 + 0.2 * (1 - t)) * (0.85 + 0.3 * r()) * escala;
    const fin = suma(q, por(d, largoPeciolo));
    tubo(curva(q, suma(suma(q, por(d, largoPeciolo * 0.5)), [0, 0.03, 0]), fin, 3), () => 0.004, 3, ap.tallo, 'tallo', caras, indice);
    const radio = H * f.hoja.largo * 0.5 * (0.7 + 0.5 * (1 - t)) * escala;
    const afuera = unitario([d[0], 0, d[2]]);
    const normal = unitario(suma(ARRIBA, por(afuera, 0.55 + caida * 0.6)));
    const centro = suma(fin, por(afuera, radio * 0.25));
    const lados = ctx.e.detalle === 'alto' ? 12 : 9;
    const fase = r();
    disco(
      centro,
      normal,
      radio,
      lados,
      // Más clara donde se pega el pecíolo: el puntito de la pilea.
      (j) => colorHoja(ctx, 0.35 + 0.5 * Math.abs(Math.sin(j * 0.9 + fase * 6)), 0, fase, false),
      'hoja',
      indice,
      f.hoja.brillo,
      caras,
      -0.12,
    );
    disco(suma(centro, por(normal, 0.002)), normal, radio * 0.12, 5, () => mezclar(ap.hoja, '#E8F2D0', 0.45), 'hoja', indice, 0.2, caras);
  };

  const n = cuantos(ctx, 6, 16, 1.4);
  for (let k = 0; k < n; k += 1) {
    const t = 0.25 + 0.75 * (n === 1 ? 1 : k / (n - 1));
    const i = Math.min(tallo.length - 1, Math.round(t * (tallo.length - 1)));
    moneda(tallo[i], k * 2.39996 + r() * 0.3, t, 1, k);
  }

  // Los hijitos: plantitas de tres monedas junto a la madre.
  const hijos = Math.min(3, Number.isFinite(e.morfologia.brotes) ? e.morfologia.brotes : 0);
  for (let b = 0; b < hijos; b += 1) {
    const az = b * 2.2 + r();
    const q: V3 = [Math.cos(az) * 0.16, 0, Math.sin(az) * 0.16];
    for (let h = 0; h < 3; h += 1) moneda(q, az + h * 2.1, 0.6, 0.45, 40 + b);
  }
}

/** Un disco (hoja redonda, disco del girasol): triángulos desde el centro, abombado o ahuecado. */
function disco(
  c: V3,
  normal: V3,
  radio: number,
  lados: number,
  color: (j: number) => string,
  parte: TipoParte,
  indice: number,
  brillo: number,
  caras: Cara[],
  abombado = 0,
) {
  const n = unitario(normal);
  const e1 = perpendicular(n);
  const e2 = cruz(n, e1);
  const centro = suma(c, por(n, radio * abombado));
  const borde = Array.from({ length: lados }, (_, j) => {
    const a = (j / lados) * Math.PI * 2;
    return suma(c, suma(por(e1, Math.cos(a) * radio), por(e2, Math.sin(a) * radio)));
  });
  for (let j = 0; j < lados; j += 1) {
    caras.push({ p: [centro, borde[j], borde[(j + 1) % lados]], color: color(j), parte, indice, dobleCara: true, brillo });
  }
}

/** Una estrellita plana de cinco puntas, con su centro de otro color: la flor de cera. */
function estrellita(c: V3, normal: V3, radio: number, color: string, centro: string, indice: number, caras: Cara[]) {
  const n = unitario(normal);
  const e1 = perpendicular(n);
  const e2 = cruz(n, e1);
  const en = (a: number, rr: number): V3 => suma(c, suma(por(e1, Math.cos(a) * rr), por(e2, Math.sin(a) * rr)));
  for (let j = 0; j < 5; j += 1) {
    const a = (j / 5) * Math.PI * 2;
    const punta = en(a, radio);
    const antes = en(a - Math.PI / 5, radio * 0.45);
    const despues = en(a + Math.PI / 5, radio * 0.45);
    caras.push({ p: [c, antes, punta], color, parte: 'flor', indice, dobleCara: true, brillo: 0.55 });
    caras.push({ p: [c, punta, despues], color: mezclar(color, '#FFFFFF', 0.15), parte: 'flor', indice, dobleCara: true, brillo: 0.55 });
  }
  disco(suma(c, por(n, radio * 0.06)), n, radio * 0.24, 5, () => centro, 'flor', indice, 0.5, caras);
}

// -- Flores y frutos ----------------------------------------------------------

function fruto(ctx: Contexto, c: V3, indice: number) {
  const f = ctx.e.forma.fruto;
  if (!f) return;
  if (f.tipo === 'chile') {
    torno(c, ABAJO, [[0, 0.018], [f.tamano * 0.3, 0.022], [f.tamano, 0.001]], 6, () => f.color, 'fruto', 0.6, ctx.caras, { indice });
  } else if (f.tipo === 'pera') {
    bola(suma(c, [0, -f.tamano, 0]), f.tamano * 0.75, f.color, 'fruto', ctx.caras, 1.35, ARRIBA, 0.4);
  } else if (f.tipo === 'pitahaya') {
    // Rosa, con escamas de punta verde abiertas hacia afuera: no hay otra fruta así.
    const centro = suma(c, [0, -f.tamano, 0]);
    bola(centro, f.tamano * 0.8, f.color, 'fruto', ctx.caras, 1.25, ARRIBA, 0.45);
    const escamas = ctx.e.detalle === 'alto' ? 9 : 6;
    for (let i = 0; i < escamas; i += 1) {
      const th = i * 2.39996;
      const alt = -0.65 + (i / Math.max(1, escamas - 1)) * 1.3;
      const radial: V3 = [Math.cos(th), 0, Math.sin(th)];
      const base = suma(centro, suma(por(radial, f.tamano * 0.78 * Math.sqrt(1 - alt * alt * 0.5)), [0, alt * f.tamano, 0]));
      hoja(
        {
          base,
          dir: unitario(suma(radial, [0, 0.9, 0])),
          doblar: radial,
          curva: 0.3,
          largo: f.tamano * 0.6,
          ancho: f.tamano * 0.32,
          perfil: PERFILES.penca,
          pliegue: 0.2,
          segmentos: 2,
          color: (t) => mezclar(f.color, '#8CC04A', Math.min(1, t * 1.5)),
          parte: 'fruto',
          indice,
          brillo: 0.4,
        },
        ctx.caras,
      );
    }
  } else if (f.tipo === 'racimo') {
    racimo(ctx, c, [1, 0, 0], indice);
  } else {
    bola(suma(c, [0, -f.tamano, 0]), f.tamano, f.color, 'fruto', ctx.caras, 1.1, ARRIBA, 0.6);
  }
}

/**
 * Una flor, en `c`, mirando hacia `eje`. Cada tipo con sus pétalos: la copa
 * del hibisco, las capas de la rosa, las brácteas de la nochebuena, el pompón
 * del cempasúchil…
 */
function flor(ctx: Contexto, c: V3, eje: V3, indice: number) {
  const fl = ctx.e.forma.flor;
  if (!fl) return;
  const { caras, r } = ctx;
  const a = unitario(eje);
  const e1 = perpendicular(a);
  const e2 = cruz(a, e1);
  // Un poco más grandes que en la realidad, a propósito: en una pantalla de
  // teléfono una flor a escala se pierde entre las hojas, y la flor es de lo
  // primero que la gente reconoce de su planta.
  const T = fl.tamano * 1.7 * (0.85 + 0.3 * r());

  const petalo = (ang: number, abre: number, largo: number, ancho: number, perfil: (t: number) => number, color: string, pliegue = 0.25, curvaP = 0.15) => {
    const radial = unitario(suma(por(e1, Math.cos(ang)), por(e2, Math.sin(ang))));
    const dir = unitario(suma(por(a, Math.cos(abre)), por(radial, Math.sin(abre))));
    hoja(
      {
        base: c,
        dir,
        doblar: radial,
        curva: curvaP,
        largo,
        ancho,
        perfil,
        pliegue,
        segmentos: 3,
        color: (t) => mezclar(mezclar(color, '#FFFFFF', 0.12), color, t),
        parte: 'flor',
        indice,
        brillo: 0.35,
        ladoInicial: unitario(cruz(a, radial)),
      },
      caras,
    );
  };

  const tipo: TipoFlor = fl.tipo;
  if (tipo === 'copa') {
    for (let i = 0; i < 5; i += 1) petalo((i / 5) * Math.PI * 2, 0.95, T, T * 0.85, (t) => Math.pow(sen(Math.PI * t), 0.45), fl.color, 0.2, 0.3);
    // El estambre largo del hibisco.
    tubo([c, suma(c, por(a, T * 1.1))], () => 0.005, 3, fl.centro, 'flor', caras, indice);
    bola(suma(c, por(a, T * 1.1)), T * 0.08, fl.centro, 'flor', caras);
  } else if (tipo === 'rosa') {
    const capas = [
      { n: 5, abre: 0.35, largo: 0.7 },
      { n: 5, abre: 0.75, largo: 0.9 },
      { n: 6, abre: 1.15, largo: 1 },
    ];
    capas.forEach((capa, j) => {
      for (let i = 0; i < capa.n; i += 1) {
        petalo((i / capa.n) * Math.PI * 2 + j * 0.6, capa.abre, T * capa.largo, T * 0.9, (t) => Math.pow(sen(Math.PI * t), 0.4), j === 0 ? fl.centro : fl.color, 0.45, -0.1);
      }
    });
  } else if (tipo === 'bractea') {
    if (fl.tamano >= 0.1) {
      // Nochebuena: estrella de brácteas rojas grandes.
      for (let i = 0; i < 7; i += 1) petalo((i / 7) * Math.PI * 2, 1.25, T * 1.3, T * 0.5, PERFILES.lanceolada, fl.color, 0.08, 0.2);
      bola(c, T * 0.1, fl.centro, 'flor', caras);
    } else {
      // Bugambilia: racimos de tres brácteas de papel.
      for (let g = 0; g < 3; g += 1) {
        const desp = suma(c, por(unitario(suma(por(e1, Math.cos(g * 2.1)), por(e2, Math.sin(g * 2.1)))), T * 0.6));
        for (let i = 0; i < 3; i += 1) {
          const radial = unitario(suma(por(e1, Math.cos(i * 2.1 + g)), por(e2, Math.sin(i * 2.1 + g))));
          hoja(
            {
              base: desp,
              dir: unitario(suma(a, por(radial, 0.9))),
              doblar: radial,
              curva: 0.2,
              largo: T,
              ancho: T * 0.8,
              perfil: PERFILES.ovalada,
              pliegue: 0.3,
              segmentos: 2,
              color: () => fl.color,
              parte: 'flor',
              indice,
              brillo: 0.2,
            },
            caras,
          );
        }
      }
    }
  } else if (tipo === 'estrella') {
    for (let i = 0; i < 5; i += 1) petalo((i / 5) * Math.PI * 2, 1.35, T, T * 0.45, PERFILES.foliolo, fl.color, 0.05, 0.1);
    bola(c, T * 0.18, fl.centro, 'flor', caras);
  } else if (tipo === 'pompon') {
    const anillos = [
      { n: 8, abre: 0.3 },
      { n: 10, abre: 0.85 },
      { n: 12, abre: 1.4 },
    ];
    anillos.forEach((an, j) => {
      for (let i = 0; i < an.n; i += 1) {
        petalo((i / an.n) * Math.PI * 2 + j * 0.3, an.abre, T * 0.75, T * 0.45, (t) => Math.pow(sen(Math.PI * t), 0.4), j === 0 ? fl.centro : fl.color, 0.3, 0.1);
      }
    });
  } else if (tipo === 'espata') {
    // La espata blanca, ahuecada, y el espádice al centro.
    hoja(
      {
        base: c,
        dir: a,
        doblar: e1,
        curva: 0.15,
        largo: T * 1.4,
        ancho: T * 0.9,
        perfil: PERFILES.ovalada,
        pliegue: 0.55,
        segmentos: 4,
        color: (t) => mezclar('#E8EFE0', fl.color, t),
        parte: 'flor',
        indice,
        brillo: 0.4,
        ladoInicial: e2,
      },
      caras,
    );
    tubo([suma(c, por(e1, -0.01)), suma(suma(c, por(a, T * 0.7)), por(e1, -0.01))], () => T * 0.09, 5, fl.centro, 'flor', caras, indice);
  } else if (tipo === 'mariposa') {
    // Orquídea: dos pétalos anchos, tres sépalos angostos y el labelo al centro.
    for (const ang of [Math.PI * 0.5, Math.PI * 1.5]) {
      petalo(ang, 1.45, T * 0.95, T * 1.05, (t) => Math.pow(sen(Math.PI * t), 0.5), fl.color, 0.06, 0.04);
    }
    for (const ang of [0, Math.PI * 0.82, Math.PI * 1.18]) petalo(ang, 1.45, T * 0.9, T * 0.5, PERFILES.ovalada, fl.color, 0.08, 0.04);
    petalo(Math.PI, 1.05, T * 0.5, T * 0.5, (t) => Math.pow(sen(Math.PI * t), 0.5), fl.centro, 0.5, 0.25);
    bola(c, T * 0.09, '#F4E27A', 'flor', caras);
  } else if (tipo === 'reina') {
    // La flor de la pitahaya: el tubo escamoso, una corona de sépalos largos
    // verde amarillo con la punta rojiza y, adentro, la copa blanca enorme.
    const n = ctx.e.detalle === 'alto' ? 12 : 8;
    tubo([suma(c, por(a, -T * 0.6)), c], (t) => T * (0.06 + 0.08 * t), 5, '#9FB85A', 'flor', caras, indice);
    for (let i = 0; i < n; i += 1) {
      const ang = (i / n) * Math.PI * 2 + 0.2;
      const radial = unitario(suma(por(e1, Math.cos(ang)), por(e2, Math.sin(ang))));
      hoja(
        {
          base: c,
          dir: unitario(suma(por(a, Math.cos(1.05)), por(radial, Math.sin(1.05)))),
          doblar: radial,
          curva: 0.25,
          largo: T * 0.8,
          ancho: T * 0.14,
          perfil: PERFILES.foliolo,
          pliegue: 0.1,
          segmentos: 3,
          color: (t) => mezclar('#C9D46A', '#D9687A', t * t),
          parte: 'flor',
          indice,
          brillo: 0.3,
          ladoInicial: unitario(cruz(a, radial)),
        },
        caras,
      );
    }
    for (let i = 0; i < n; i += 1) {
      petalo((i / n) * Math.PI * 2, 0.62, T * 1.0, T * 0.44, (t) => Math.pow(sen(Math.PI * t), 0.5), fl.color, 0.3, -0.05);
    }
    tubo([c, suma(c, por(a, T * 0.5))], () => T * 0.025, 4, fl.centro, 'flor', caras, indice);
    bola(suma(c, por(a, T * 0.5)), T * 0.07, fl.centro, 'flor', caras);
  } else if (tipo === 'ave') {
    // El ave del paraíso: el pico (una espata verde con orilla morada) sale de
    // lado, y de su lomo brotan la cresta naranja y la lengua azul.
    const pico = unitario([a[0], 0.12, a[2]]);
    const lado = unitario(cruz(pico, ARRIBA));
    hoja(
      {
        base: c,
        dir: pico,
        doblar: ARRIBA,
        curva: 0.1,
        largo: T * 1.7,
        ancho: T * 0.4,
        perfil: (t) => Math.pow(sen(Math.PI * (0.15 + 0.85 * t)), 0.7),
        pliegue: 0.7,
        segmentos: 4,
        color: (t, u) => mezclar('#4E7A4E', '#8A3A62', Math.min(1, Math.abs(u) * 0.6 + t * 0.4)),
        parte: 'flor',
        indice,
        brillo: 0.35,
        ladoInicial: lado,
      },
      caras,
    );
    const lomo = suma(suma(c, por(pico, T * 0.55)), [0, T * 0.08, 0]);
    for (let i = 0; i < 3; i += 1) {
      const dir = unitario(suma(suma(ARRIBA, por(pico, -0.2 + i * 0.28)), por(lado, (i - 1) * 0.28)));
      hoja(
        {
          base: lomo,
          dir,
          doblar: pico,
          curva: 0.15,
          largo: T * 1.15,
          ancho: T * 0.22,
          perfil: PERFILES.foliolo,
          pliegue: 0.15,
          segmentos: 3,
          color: (t) => mezclar(mezclar(fl.color, '#FFD27A', 0.25), fl.color, t),
          parte: 'flor',
          indice,
          brillo: 0.4,
          ladoInicial: lado,
        },
        caras,
      );
    }
    hoja(
      {
        base: lomo,
        dir: unitario(suma(por(pico, 0.9), [0, 0.6, 0])),
        doblar: ARRIBA,
        curva: 0.1,
        largo: T * 0.95,
        ancho: T * 0.12,
        perfil: PERFILES.lanceolada,
        pliegue: 0.2,
        segmentos: 3,
        color: () => fl.centro,
        parte: 'flor',
        indice,
        brillo: 0.5,
        ladoInicial: lado,
      },
      caras,
    );
  } else if (tipo === 'girasol') {
    // Brácteas verdes atrás, la corona de pétalos amarillos y el disco café.
    const rayos = ctx.e.detalle === 'alto' ? 20 : 14;
    for (let i = 0; i < 10; i += 1) petalo((i / 10) * Math.PI * 2 + 0.2, 1.8, T * 0.36, T * 0.16, PERFILES.foliolo, '#5E8A3A', 0.05, 0.1);
    for (let i = 0; i < rayos; i += 1) {
      petalo((i / rayos) * Math.PI * 2, 1.5, T * 0.8, T * 0.2, (t) => Math.pow(sen(Math.PI * t), 0.5), fl.color, 0.12, 0.08);
    }
    disco(suma(c, por(a, T * 0.03)), a, T * 0.48, 16, (j) => (j % 2 ? fl.centro : mezclar(fl.centro, '#2A1A0A', 0.3)), 'flor', indice, 0.15, caras, 0.12);
    disco(suma(c, por(a, T * 0.09)), a, T * 0.2, 10, () => mezclar(fl.centro, '#8A6A2A', 0.45), 'flor', indice, 0.2, caras);
  } else if (tipo === 'umbela') {
    // Una bola de estrellitas de cera, cada una con su centro rojo.
    const n = ctx.e.detalle === 'alto' ? 14 : 9;
    for (let i = 0; i < n; i += 1) {
      const z = 1 - ((i + 0.5) / n) * 0.9;
      const phi = i * 2.39996;
      const v = unitario(suma(por(a, z), por(suma(por(e1, Math.cos(phi)), por(e2, Math.sin(phi))), Math.sqrt(1 - z * z))));
      const q = suma(c, por(v, T * 0.55));
      tubo([c, q], () => 0.0025, 3, '#C9A0A8', 'flor', caras, indice);
      estrellita(q, v, T * 0.22, fl.color, fl.centro, indice, caras);
    }
  } else if (tipo === 'nenufar') {
    for (let i = 0; i < 8; i += 1) petalo((i / 8) * Math.PI * 2, 1.05, T, T * 0.4, PERFILES.foliolo, fl.color, 0.3, 0.05);
    for (let i = 0; i < 8; i += 1) petalo((i / 8) * Math.PI * 2 + 0.4, 0.6, T * 0.85, T * 0.35, PERFILES.foliolo, fl.color, 0.3, 0);
    bola(c, T * 0.15, fl.centro, 'flor', caras);
  } else {
    // Espiga: florecitas a lo largo de la punta. Son chiquitas: con pocas
    // caras cada una basta, y así una lavanda con veinte espigas no pesa.
    for (let i = 0; i < 6; i += 1) {
      const q = suma(suma(c, por(a, -i * T * 0.6)), por(e1, T * 0.3 * Math.cos(i * 2.2)));
      const rr = T * 0.28;
      torno(q, a, [[-rr * 1.4, 0.0001], [-rr * 0.5, rr * 0.95], [rr * 0.5, rr * 0.95], [rr * 1.4, 0.0001]], 5, () => (i % 2 ? fl.color : fl.centro), 'flor', 0.3, caras, { indice });
    }
  }
}
