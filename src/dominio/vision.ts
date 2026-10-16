/**
 * Medir una semilla en una foto.
 *
 * QUÉ SE PUEDE Y QUÉ NO. Reconocer "esto es una semilla de limonero" en una
 * foto no se puede: son milímetros de color liso y las de familias enteras se
 * ven iguales. Pero MEDIRLA sí — y medirla es justo lo que la clave necesita.
 * Color, proporción y, si hay una moneda al lado, tamaño en milímetros. Tres
 * datos duros en vez de tres preguntas que la gente contesta a ojo.
 *
 * O sea: la foto no adivina la especie, la mide. Y con las medidas, la clave
 * descarta. Eso es honesto y además funciona mejor que pedirle a alguien que
 * calcule "2 a 5 mm" sin una regla enfrente.
 *
 * Todo lo de aquí son funciones puras sobre un arreglo de píxeles, así que se
 * prueba con imágenes sintéticas en Jest — sin cámara, sin dispositivo.
 */

import type { Color, Forma, Tamano } from './semillas';

export interface Imagen {
  ancho: number;
  alto: number;
  /** RGBA, cuatro bytes por píxel. */
  datos: Uint8ClampedArray | Uint8Array;
}

export interface Mancha {
  /** Cuántos píxeles la forman. */
  area: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Promedio de color de la mancha. */
  r: number;
  g: number;
  b: number;
}

export function anchoDe(m: Mancha): number {
  return m.x1 - m.x0 + 1;
}

export function altoDe(m: Mancha): number {
  return m.y1 - m.y0 + 1;
}

/** Qué tan llena está su caja. Un disco llena ~0.79; una rama, mucho menos. */
export function llenadoDe(m: Mancha): number {
  return m.area / Math.max(1, anchoDe(m) * altoDe(m));
}

/** Largo contra ancho, siempre ≥ 1. */
export function alargamientoDe(m: Mancha): number {
  const a = anchoDe(m);
  const b = altoDe(m);
  return Math.max(a, b) / Math.max(1, Math.min(a, b));
}

// ---------------------------------------------------------------------------
// Separar los objetos del fondo
// ---------------------------------------------------------------------------

/**
 * Cuánto tiene que separarse un píxel del fondo para contar como objeto.
 *
 * Bajo de más y la sombra de la semilla cuenta como semilla; alto de más y una
 * semilla clara sobre papel blanco desaparece. 46 sobre 255 aguanta las dos
 * cosas en fotos de teléfono con luz de casa.
 */
const DISTANCIA_AL_FONDO = 46;

/** Manchas más chicas que esto son polvo o ruido del sensor. */
const AREA_MINIMA = 40;

/**
 * El color del fondo, tomado del marco de la foto.
 *
 * Se usa la mediana y no el promedio: si una esquina agarró una sombra o un
 * dedo, el promedio se va y la mediana no.
 */
export function colorDelFondo(img: Imagen): [number, number, number] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const borde = Math.max(2, Math.round(Math.min(img.ancho, img.alto) * 0.06));

  for (let y = 0; y < img.alto; y += 1) {
    for (let x = 0; x < img.ancho; x += 1) {
      const enElMarco =
        x < borde || y < borde || x >= img.ancho - borde || y >= img.alto - borde;
      if (!enElMarco) continue;
      const i = (y * img.ancho + x) * 4;
      rs.push(img.datos[i]);
      gs.push(img.datos[i + 1]);
      bs.push(img.datos[i + 2]);
    }
  }

  return [mediana(rs), mediana(gs), mediana(bs)];
}

/**
 * Las manchas que hay sobre el fondo, de mayor a menor.
 *
 * El recorrido es iterativo y con una pila propia: una imagen de 200×200 llena
 * de objeto desborda la pila de llamadas si se hace recursivo, y eso en el
 * teléfono se ve como un cierre de la app sin explicación.
 */
export function buscarManchas(img: Imagen, maximo = 6): Mancha[] {
  const [fr, fg, fb] = colorDelFondo(img);
  const total = img.ancho * img.alto;
  const visto = new Uint8Array(total);
  const manchas: Mancha[] = [];
  const pila: number[] = [];

  const esObjeto = (p: number): boolean => {
    const i = p * 4;
    const d =
      Math.abs(img.datos[i] - fr) +
      Math.abs(img.datos[i + 1] - fg) +
      Math.abs(img.datos[i + 2] - fb);
    return d > DISTANCIA_AL_FONDO;
  };

  for (let inicio = 0; inicio < total; inicio += 1) {
    if (visto[inicio] || !esObjeto(inicio)) continue;

    let area = 0;
    let x0 = img.ancho;
    let y0 = img.alto;
    let x1 = 0;
    let y1 = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;

    pila.length = 0;
    pila.push(inicio);
    visto[inicio] = 1;

    while (pila.length > 0) {
      const p = pila.pop() as number;
      const x = p % img.ancho;
      const y = (p - x) / img.ancho;

      area += 1;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      const i = p * 4;
      sr += img.datos[i];
      sg += img.datos[i + 1];
      sb += img.datos[i + 2];

      // Cuatro vecinos, no ocho: con ocho, dos objetos que se tocan por una
      // esquina se funden en uno y la moneda se traga la semilla.
      if (x > 0) empujar(p - 1);
      if (x < img.ancho - 1) empujar(p + 1);
      if (y > 0) empujar(p - img.ancho);
      if (y < img.alto - 1) empujar(p + img.ancho);
    }

    if (area >= AREA_MINIMA) {
      manchas.push({
        area,
        x0,
        y0,
        x1,
        y1,
        r: Math.round(sr / area),
        g: Math.round(sg / area),
        b: Math.round(sb / area),
      });
    }

    function empujar(vecino: number): void {
      if (visto[vecino] || !esObjeto(vecino)) return;
      visto[vecino] = 1;
      pila.push(vecino);
    }
  }

  return manchas.sort((a, b) => b.area - a.area).slice(0, maximo);
}

// ---------------------------------------------------------------------------
// De manchas a rasgos
// ---------------------------------------------------------------------------

export interface Medicion {
  /** Rasgos que se pudieron leer de la foto. Los que no, quedan sin poner. */
  color?: Color;
  forma?: Forma;
  tamano?: Tamano;
  /** Largo estimado en milímetros, si había referencia. */
  largoMm?: number;
  /** Qué se hizo, en palabras. Va a pantalla: el usuario tiene que poder corregir. */
  notas: string[];
  /** Falso cuando ni siquiera se encontró algo que medir. */
  sirvio: boolean;
}

/** Diámetro real de las monedas mexicanas, en milímetros. */
export const MONEDAS: Array<{ valor: string; etiqueta: string; mm: number }> = [
  { valor: '1', etiqueta: '1 peso', mm: 21 },
  { valor: '2', etiqueta: '2 pesos', mm: 23 },
  { valor: '5', etiqueta: '5 pesos', mm: 25.5 },
  { valor: '10', etiqueta: '10 pesos', mm: 28 },
];

export interface OpcionesMedicion {
  /** Diámetro en mm de la moneda que se puso al lado, si se puso alguna. */
  monedaMm?: number;
}

/**
 * Mide la semilla de la foto.
 *
 * Con moneda: la mancha más redonda y grande es la moneda, y de ahí sale la
 * escala. Sin moneda: se leen color y forma, y el tamaño se queda sin poner —
 * que es mejor que estimarlo, porque una foto sin referencia no tiene escala y
 * cualquier número sería inventado.
 */
export function medirSemilla(img: Imagen, opciones: OpcionesMedicion = {}): Medicion {
  const manchas = buscarManchas(img);
  const notas: string[] = [];

  if (manchas.length === 0) {
    return {
      notas: ['No encontré nada sobre el fondo. Ponla sobre papel liso y con buena luz.'],
      sirvio: false,
    };
  }

  let semilla = manchas[0];
  let escalaMmPorPx: number | undefined;

  if (opciones.monedaMm && manchas.length >= 2) {
    // La moneda es redonda y llena su caja; la semilla casi nunca. Entre las
    // dos manchas grandes, la más circular es la moneda.
    const candidatas = manchas.slice(0, 3);
    const moneda = [...candidatas].sort(
      (a, b) => circularidad(b) * b.area - circularidad(a) * a.area,
    )[0];
    const otras = candidatas.filter((m) => m !== moneda);
    if (otras.length > 0) {
      semilla = otras.sort((a, b) => b.area - a.area)[0];
      const diametroPx = (anchoDe(moneda) + altoDe(moneda)) / 2;
      escalaMmPorPx = opciones.monedaMm / diametroPx;
      notas.push(`Escala tomada de la moneda: ${opciones.monedaMm} mm.`);
    } else {
      notas.push('No distinguí la moneda de la semilla. El tamaño lo pongo tú.');
    }
  } else if (opciones.monedaMm) {
    notas.push('Sólo encontré un objeto. Si pusiste moneda, sepárala más de la semilla.');
  } else {
    notas.push('Sin moneda no hay escala, así que el tamaño lo eliges tú.');
  }

  const color = colorDeMancha(semilla);
  const forma = formaDeMancha(semilla);
  notas.push(`La veo ${etiquetaForma(forma)} y de color ${color}.`);

  let tamano: Tamano | undefined;
  let largoMm: number | undefined;
  if (escalaMmPorPx) {
    largoMm = Math.round(Math.max(anchoDe(semilla), altoDe(semilla)) * escalaMmPorPx * 10) / 10;
    tamano = tamanoDe(largoMm);
    notas.push(`Mide unos ${largoMm} mm de largo.`);
  }

  return { color, forma, tamano, largoMm, notas, sirvio: true };
}

/** 1 = círculo perfecto. Se compara el área con la de su círculo envolvente. */
function circularidad(m: Mancha): number {
  const d = Math.max(anchoDe(m), altoDe(m));
  const areaCirculo = Math.PI * (d / 2) ** 2;
  const cuadratura = Math.min(anchoDe(m), altoDe(m)) / d;
  return (m.area / areaCirculo) * cuadratura;
}

export function tamanoDe(largoMm: number): Tamano {
  if (largoMm < 2) return 'diminuta';
  if (largoMm < 5) return 'chica';
  if (largoMm < 10) return 'mediana';
  return 'grande';
}

/**
 * La forma, con lo que una foto plana puede decir.
 *
 * Nota honesta: "aplanada" no se puede distinguir de "redonda" en una sola foto
 * de frente — un disco visto de cara es un círculo. Por eso la forma se ofrece
 * como propuesta y se deja corregir, en vez de darla por buena.
 */
export function formaDeMancha(m: Mancha): Forma {
  const alargamiento = alargamientoDe(m);
  const llenado = llenadoDe(m);

  if (llenado < 0.55) return 'irregular';
  if (alargamiento >= 2.1) return 'alargada';
  if (alargamiento >= 1.35) return 'de_gota';
  return 'redonda';
}

/**
 * El color, en las cinco casillas de la clave.
 *
 * Se decide por calidez antes que por claridad, y ese orden importa. Una moneda
 * y una semilla color crema tienen brillo parecido, pero la moneda es neutra o
 * fría y la crema tira a amarillo. Mirando sólo el brillo, la moneda salía
 * "clara" — y "clara" en la clave significa crema, no plateado.
 */
export function colorDeMancha(m: Mancha): Color {
  const { r, g, b } = m;
  const luz = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;

  if (luz < 62) return 'negra';
  if (g > r + 12 && g > b + 12) return 'verde';

  const calida = r - b > 14;
  if (calida) return luz > 150 ? 'clara' : 'cafe';
  return luz > 205 ? 'clara' : 'gris';
}

function etiquetaForma(forma: Forma): string {
  return {
    redonda: 'redonda',
    alargada: 'alargada',
    aplanada: 'aplanada',
    de_gota: 'de gota',
    con_ala: 'con ala',
    irregular: 'irregular',
  }[forma];
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 255;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.floor(orden.length / 2)];
}
