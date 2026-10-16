/**
 * El mapa del patio: dónde va cada cosa en el mundo.
 *
 * El patio es una escena lateral que se recorre de izquierda a derecha, como un
 * juego de plataformas: adentro de la casa, bajo el árbol, bajo la pérgola, al
 * sol, y el estanque. Cada zona es una banda de luz real —la misma con la que se
 * calcula el riego—, así que la planta aparece donde de verdad vive.
 *
 * Este archivo es sólo números: anchos, posiciones, la ruta que camina la sina.
 * Está separado del dibujo por la misma razón que `tresd/malla.ts`: lo que pone una
 * planta fuera de la pantalla o encima de otra es una cuenta, y una cuenta se
 * puede probar sin teléfono.
 *
 * Todo es determinista. La posición de cada planta sale de su id, no del azar:
 * tu lengua de suegra está siempre en el mismo sitio, y un patio donde las
 * macetas se cambian de lugar cada vez que entras no se siente como un lugar.
 */

import type { BandaLuz } from '../dominio/tipos';

// ---------------------------------------------------------------------------
// Medidas del mundo, en puntos
// ---------------------------------------------------------------------------

/** Alto de la escena. */
export const ALTO_MUNDO = 430;
/** Donde el cielo se junta con el suelo. */
export const HORIZONTE = 262;
/** Base de las macetas de la fila de atrás. */
export const SUELO_FONDO = 318;
/** Base de las macetas de la fila de adelante. */
export const SUELO_FRENTE = 372;
/** Donde camina la sina: delante de todo. */
export const CAMINO = 396;

/** Margen a cada lado del mundo. */
const MARGEN = 20;
/** Ancho mínimo de una zona: cabe su escenografía aunque tenga una planta. */
const ZONA_MINIMA = 250;
/** Espacio por planta dentro de su zona. */
const PASO = 118;
/** Tamaño base de una planta en la fila de adelante. */
export const TAMANO_PLANTA = 124;

/** Velocidad de la sina caminando, en puntos por segundo. */
const VELOCIDAD_SINA = 58;
/** Cuánto se detiene junto a cada planta. */
const ESPERA_SINA = 2400;

// ---------------------------------------------------------------------------
// Zonas
// ---------------------------------------------------------------------------

export type ClaveZona = 'interior' | 'sombra' | 'semisombra' | 'sol' | 'agua';

/** Orden de izquierda a derecha: de la casa hacia afuera, y el agua al final. */
export const ORDEN_ZONAS: ClaveZona[] = ['interior', 'sombra', 'semisombra', 'sol', 'agua'];

export const NOMBRE_ZONA: Record<ClaveZona, string> = {
  interior: 'Adentro',
  sombra: 'Bajo el árbol',
  semisombra: 'La pérgola',
  sol: 'Al sol',
  agua: 'El estanque',
};

/**
 * La zona de una planta.
 *
 * El frasco manda sobre la luz: un esqueje en agua se cuida por el agua, esté
 * donde esté.
 */
export function zonaPara(contenedor: 'maceta' | 'suelo' | 'agua', exposicion: BandaLuz): ClaveZona {
  if (contenedor === 'agua') return 'agua';
  if (exposicion === 'sol_pleno') return 'sol';
  if (exposicion === 'semisol') return 'semisombra';
  if (exposicion === 'sombra') return 'sombra';
  return 'interior';
}

// ---------------------------------------------------------------------------
// El mundo
// ---------------------------------------------------------------------------

export interface HabitanteEntrada {
  id: string;
  zona: ClaveZona;
  /** Pide que hagas algo hoy. La sina va primero a éstas. */
  pideAtencion: boolean;
  /** 0 = lo más urgente. Sirve para ordenar a quién visita primero. */
  urgencia: number;
  /**
   * Donde la acomodó la persona arrastrándola: su lugar en la fila de su zona
   * y si va atrás o adelante. Sin esto, se reparten solas.
   */
  acomodo?: { orden: number; atras: boolean };
}

export interface Region {
  zona: ClaveZona;
  x: number;
  ancho: number;
  cuantas: number;
}

export interface Sitio {
  id: string;
  zona: ClaveZona;
  /** Centro de la maceta, en x del mundo. */
  x: number;
  /** Donde apoya la maceta, en y del mundo. */
  base: number;
  /** 0.82 atrás, 1 adelante. Da la profundidad sin 3D. */
  escala: number;
  /** 0 a 1. Desfasa el mecido para que no se muevan todas al compás. */
  fase: number;
}

export interface Parada {
  /** A dónde camina. */
  x: number;
  /** Cuánto tarda en llegar desde la parada anterior, en ms. */
  caminar: number;
  /** Cuánto se queda ahí, en ms. */
  esperar: number;
  /** Hacia dónde mira mientras camina: 1 derecha, -1 izquierda. */
  mira: 1 | -1;
  /** La planta que visita, si visita una. */
  visita?: string;
}

export interface Mundo {
  ancho: number;
  alto: number;
  regiones: Region[];
  /** Ordenados de atrás hacia adelante: así se dibujan y las de adelante tapan. */
  sitios: Sitio[];
  /** La vuelta que da la sina. Se repite para siempre. */
  ruta: Parada[];
  /** Donde empieza la sina, antes de la primera parada. */
  inicioSina: number;
}

export function armarMundo(habitantes: HabitanteEntrada[], anchoVista: number): Mundo {
  const vista = Number.isFinite(anchoVista) && anchoVista > 0 ? anchoVista : 360;

  // 1. Qué zonas hay y cuánto mide cada una.
  const porZona = new Map<ClaveZona, HabitanteEntrada[]>();
  for (const h of habitantes) {
    const lista = porZona.get(h.zona) ?? [];
    lista.push(h);
    porZona.set(h.zona, lista);
  }

  const presentes = ORDEN_ZONAS.filter((z) => (porZona.get(z)?.length ?? 0) > 0);
  const anchosBase = presentes.map((z) => Math.max(ZONA_MINIMA, 60 + (porZona.get(z)?.length ?? 0) * PASO));
  const suma = anchosBase.reduce((a, b) => a + b, 0);

  // Si todo cabe en la pantalla, se estira para llenarla: un mundo más chico
  // que la ventana deja un hueco de cielo a la derecha y se ve roto.
  const disponible = vista - MARGEN * 2;
  const factor = suma > 0 && suma < disponible ? disponible / suma : 1;

  const regiones: Region[] = [];
  let cursor = MARGEN;
  presentes.forEach((zona, i) => {
    const ancho = Math.round(anchosBase[i] * factor);
    regiones.push({ zona, x: cursor, ancho, cuantas: porZona.get(zona)?.length ?? 0 });
    cursor += ancho;
  });

  const ancho = Math.max(vista, Math.round(cursor + MARGEN));

  // 2. Dónde va cada planta dentro de su zona.
  const sitios: Sitio[] = [];
  for (const region of regiones) {
    // Estable dentro de la zona: primero el orden que eligió la persona; las
    // que nunca acomodó, detrás y por id, no por como llegaron.
    const lista = [...(porZona.get(region.zona) ?? [])].sort(
      (a, b) =>
        (a.acomodo?.orden ?? Number.MAX_SAFE_INTEGER) - (b.acomodo?.orden ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    );
    const n = lista.length;
    const util = region.ancho - 56;
    lista.forEach((h, i) => {
      const hash = hashDe(h.id);
      // Con varias, alternan fila de atrás y de adelante: así caben más sin
      // encimarse y el patio tiene fondo.
      const atras = h.acomodo ? h.acomodo.atras : n > 1 && i % 2 === 1;
      // Repartidas con aire a los lados: con dos plantas, una a cada extremo
      // del mundo se ven perdidas; a un tercio y dos tercios, acompañadas.
      const t = (i + 1) / (n + 1);
      const desvio = (hash.a - 0.5) * 14;
      sitios.push({
        id: h.id,
        zona: region.zona,
        x: redondear(region.x + 28 + util * t + desvio),
        base: atras ? SUELO_FONDO + hash.b * 10 : SUELO_FRENTE - hash.b * 8,
        escala: atras ? 0.82 : 1,
        fase: hash.c,
      });
    });
  }
  sitios.sort((a, b) => a.base - b.base);

  // 3. La ruta de la sina.
  const { ruta, inicio } = armarRuta(habitantes, sitios, ancho);

  return { ancho, alto: ALTO_MUNDO, regiones, sitios, ruta, inicioSina: inicio };
}

/**
 * La vuelta de la sina por el patio.
 *
 * Primero visita a las que piden algo, de la más urgente a la menos: es la
 * forma de señalar sin flechas. Si nadie pide nada, pasea por todas. Se para
 * AL LADO de cada planta, no encima, para no taparla.
 */
function armarRuta(
  habitantes: HabitanteEntrada[],
  sitios: Sitio[],
  ancho: number,
): { ruta: Parada[]; inicio: number } {
  if (sitios.length === 0) return { ruta: [], inicio: ancho / 2 };

  const porId = new Map(sitios.map((s) => [s.id, s]));
  const urgentes = habitantes
    .filter((h) => h.pideAtencion && porId.has(h.id))
    .sort((a, b) => a.urgencia - b.urgencia || a.id.localeCompare(b.id));
  const orden = (urgentes.length > 0 ? urgentes.map((h) => h.id) : [...sitios].sort((a, b) => a.x - b.x).map((s) => s.id));

  const junto = (id: string) => {
    const s = porId.get(id);
    // Lo bastante al lado para no tapar la maceta ni el letrero con su nombre.
    return s ? acotarX(s.x - 72, ancho) : ancho / 2;
  };

  const inicio = acotarX(junto(orden[0]) - 70, ancho);
  const ruta: Parada[] = [];
  let desde = inicio;

  const agregar = (x: number, visita?: string) => {
    const distancia = Math.abs(x - desde);
    ruta.push({
      x: redondear(x),
      caminar: Math.max(300, Math.round((distancia / VELOCIDAD_SINA) * 1000)),
      esperar: ESPERA_SINA,
      mira: x >= desde ? 1 : -1,
      visita,
    });
    desde = x;
  };

  for (const id of orden) agregar(junto(id), id);
  // Vuelve a donde empezó, para que la repetición no dé un salto.
  agregar(inicio);

  return { ruta, inicio: redondear(inicio) };
}

/** Lo que dura una vuelta completa de la sina, en ms. */
export function duracionRuta(ruta: Parada[]): number {
  'worklet';
  let total = 0;
  for (let i = 0; i < ruta.length; i += 1) total += ruta[i].caminar + ruta[i].esperar;
  return total;
}

export interface PosicionSina {
  x: number;
  /** true mientras camina; parada, no brinca. */
  andando: boolean;
  mira: 1 | -1;
  /** Pasos dados en el tramo actual. Sirve para el brinquito de cada paso. */
  pasos: number;
}

/** Largo de un paso de la sina, en puntos. */
const LARGO_PASO = 15;

/**
 * Dónde está la sina a los `t` ms de su vuelta.
 *
 * Es una función del tiempo y no una cadena de animaciones por una razón:
 * con un solo reloj, la posición, hacia dónde mira y el brinco de cada paso
 * salen de la misma cuenta y no se pueden desfasar. Con tres animaciones en
 * paralelo, a la vuelta veinte la sina ya caminaba de espaldas.
 *
 * Corre en el hilo de la interfaz (de ahí el 'worklet'), cuadro por cuadro.
 */
export function posicionSina(ruta: Parada[], inicio: number, t: number): PosicionSina {
  'worklet';
  const total = duracionRuta(ruta);
  if (ruta.length === 0 || !(total > 0) || !Number.isFinite(t)) {
    return { x: Number.isFinite(inicio) ? inicio : 0, andando: false, mira: 1, pasos: 0 };
  }

  let resto = ((t % total) + total) % total;
  let desde = inicio;
  let mira: 1 | -1 = 1;

  for (let i = 0; i < ruta.length; i += 1) {
    const p = ruta[i];
    mira = p.mira;
    if (resto < p.caminar) {
      const u = resto / p.caminar;
      // Arranca y frena suave: nadie camina a velocidad constante desde parado.
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const x = desde + (p.x - desde) * e;
      return { x, andando: true, mira, pasos: Math.abs(x - desde) / LARGO_PASO };
    }
    resto -= p.caminar;
    if (resto < p.esperar) {
      // Parada junto a una planta, la mira: siempre queda a su derecha.
      return { x: p.x, andando: false, mira: p.visita ? 1 : mira, pasos: 0 };
    }
    resto -= p.esperar;
    desde = p.x;
  }

  return { x: inicio, andando: false, mira, pasos: 0 };
}

// ---------------------------------------------------------------------------

function acotarX(x: number, ancho: number): number {
  return Math.max(24, Math.min(ancho - 24, Number.isFinite(x) ? x : ancho / 2));
}

function redondear(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

/** Tres números estables entre 0 y 1 a partir del id. */
function hashDe(id: string): { a: number; b: number; c: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return {
    a: (Math.abs(h) % 1000) / 1000,
    b: (Math.abs(Math.imul(h, 31)) % 1000) / 1000,
    c: (Math.abs(Math.imul(h, 97)) % 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Cielo
// ---------------------------------------------------------------------------

export type Momento = 'amanecer' | 'dia' | 'atardecer' | 'noche';

/** La hora del teléfono, en cuatro momentos. */
export function momentoDelDia(hoy = new Date()): Momento {
  const h = hoy.getHours();
  if (h < 6) return 'noche';
  if (h < 9) return 'amanecer';
  if (h < 18) return 'dia';
  if (h < 20) return 'atardecer';
  return 'noche';
}

/**
 * Dónde está el sol —o la luna— en el cielo, de 0 a 1 en cada eje.
 *
 * Sale por la izquierda a las seis y se mete por la derecha a las ocho de la
 * noche; la luna hace lo mismo de noche. No es astronomía: es que el patio de
 * las siete de la tarde no se vea igual que el del mediodía.
 */
export function astro(hoy = new Date()): { x: number; y: number; esSol: boolean } {
  const horas = hoy.getHours() + hoy.getMinutes() / 60;
  const esSol = horas >= 6 && horas < 20;
  const t = esSol ? (horas - 6) / 14 : ((horas + 24 - 20) % 24) / 10;
  const avance = Math.max(0, Math.min(1, t));
  return {
    x: 0.08 + avance * 0.84,
    // Arco: alto a la mitad, bajo en las orillas.
    y: 0.72 - Math.sin(avance * Math.PI) * 0.58,
    esSol,
  };
}
