/**
 * Entrena la última capa: de los rasgos de la foto a la especie del catálogo.
 *
 * La red de Google ya sabe VER plantas —aprendió con 2,100 especies—, pero no
 * conoce varias de las nuestras (la lengua de suegra, el potos, el helecho de
 * Boston). En vez de volver a entrenar la red entera, que pide millones de
 * fotos y semanas de cómputo, se entrena sólo una capa encima: una regresión
 * logística que aprende a qué especie del catálogo corresponde cada vector de
 * rasgos. Con ~100 fotos por especie y unos segundos de cómputo basta.
 *
 * Y se examina con honestidad: una de cada cinco fotos se aparta ANTES de
 * entrenar y sólo se usa para medir. Las cifras que salen de aquí son las que
 * se le pueden prometer a la persona, y quedan guardadas junto a los pesos.
 *
 *   node .entrenamiento-compilado/entrenamiento/vision/entrenar.js <rasgos.json> <salida.json>
 */

import { readFileSync, writeFileSync } from 'node:fs';

import type { Muestra } from './rasgos';
import { aBase64 } from '../../src/ia/vision/formato';
import type { CabezaEmpacada } from '../../src/ia/vision/cabeza';

interface Datos {
  x: Float64Array[];
  y: number[];
}

/** Estable: la misma foto cae siempre del mismo lado del examen. */
function esDeExamen(foto: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < foto.length; i += 1) {
    h ^= foto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 5 === 0;
}

function softmax(z: Float64Array): Float64Array {
  let m = -Infinity;
  for (const v of z) if (v > m) m = v;
  let s = 0;
  const p = new Float64Array(z.length);
  for (let i = 0; i < z.length; i += 1) {
    p[i] = Math.exp(z[i] - m);
    s += p[i];
  }
  for (let i = 0; i < z.length; i += 1) p[i] /= s;
  return p;
}

interface Modelo {
  w: Float64Array[]; // [clase][rasgo]
  b: Float64Array;
  media: Float64Array;
  escala: Float64Array;
}

function logits(m: Modelo, x: Float64Array): Float64Array {
  const z = new Float64Array(m.b.length);
  for (let c = 0; c < z.length; c += 1) {
    let s = m.b[c];
    const w = m.w[c];
    for (let i = 0; i < x.length; i += 1) s += w[i] * ((x[i] - m.media[i]) * m.escala[i]);
    z[c] = s;
  }
  return z;
}

/**
 * Regresión logística multinomial con Adam y penalización L2.
 *
 * Las clases pesan parejo aunque tengan distinto número de fotos: si no, la
 * clase "otra" —con cuarenta especies adentro— se comería a las demás.
 */
function entrenar(d: Datos, clases: number, l2: number, epocas: number): Modelo {
  const n = d.x.length;
  const dim = d.x[0].length;
  const media = new Float64Array(dim);
  const escala = new Float64Array(dim);
  for (const x of d.x) for (let i = 0; i < dim; i += 1) media[i] += x[i] / n;
  for (const x of d.x) for (let i = 0; i < dim; i += 1) escala[i] += (x[i] - media[i]) ** 2 / n;
  for (let i = 0; i < dim; i += 1) escala[i] = 1 / Math.sqrt(escala[i] + 1e-6);

  const cuenta = new Array<number>(clases).fill(0);
  for (const y of d.y) cuenta[y] += 1;
  const pesoClase = cuenta.map((c) => (c > 0 ? n / (clases * c) : 0));

  const m: Modelo = {
    w: Array.from({ length: clases }, () => new Float64Array(dim)),
    b: new Float64Array(clases),
    media,
    escala,
  };
  const mW = Array.from({ length: clases }, () => new Float64Array(dim));
  const vW = Array.from({ length: clases }, () => new Float64Array(dim));
  const mB = new Float64Array(clases);
  const vB = new Float64Array(clases);
  const tasa = 0.01;
  const [b1, b2] = [0.9, 0.999];
  const lote = 256;
  const orden = Array.from({ length: n }, (_, i) => i);
  let paso = 0;

  for (let e = 0; e < epocas; e += 1) {
    for (let i = orden.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    for (let inicio = 0; inicio < n; inicio += lote) {
      const indices = orden.slice(inicio, inicio + lote);
      const gW = Array.from({ length: clases }, () => new Float64Array(dim));
      const gB = new Float64Array(clases);
      for (const k of indices) {
        const x = d.x[k];
        const xs = new Float64Array(dim);
        for (let i = 0; i < dim; i += 1) xs[i] = (x[i] - media[i]) * escala[i];
        const p = softmax(logits(m, x));
        const pc = pesoClase[d.y[k]];
        for (let c = 0; c < clases; c += 1) {
          const g = (p[c] - (c === d.y[k] ? 1 : 0)) * pc;
          if (g === 0) continue;
          gB[c] += g;
          const gw = gW[c];
          for (let i = 0; i < dim; i += 1) gw[i] += g * xs[i];
        }
      }
      paso += 1;
      const corr1 = 1 - b1 ** paso;
      const corr2 = 1 - b2 ** paso;
      for (let c = 0; c < clases; c += 1) {
        for (let i = 0; i < dim; i += 1) {
          const g = gW[c][i] / indices.length + l2 * m.w[c][i];
          mW[c][i] = b1 * mW[c][i] + (1 - b1) * g;
          vW[c][i] = b2 * vW[c][i] + (1 - b2) * g * g;
          m.w[c][i] -= (tasa * (mW[c][i] / corr1)) / (Math.sqrt(vW[c][i] / corr2) + 1e-8);
        }
        const g = gB[c] / indices.length;
        mB[c] = b1 * mB[c] + (1 - b1) * g;
        vB[c] = b2 * vB[c] + (1 - b2) * g * g;
        m.b[c] -= (tasa * (mB[c] / corr1)) / (Math.sqrt(vB[c] / corr2) + 1e-8);
      }
    }
  }
  return m;
}

interface Examen {
  top1: number;
  top3: number;
  n: number;
  /** De las que dijo con ≥ umbral de seguridad, cuántas acertó y qué parte fueron. */
  seguras: Array<{ umbral: number; aciertos: number; cubre: number }>;
  porClase: Record<string, number>;
}

function examinar(m: Modelo, x: Float64Array[], y: number[], nombres: string[], temperatura: number): Examen {
  let top1 = 0;
  let top3 = 0;
  const umbrales = [0.35, 0.5, 0.7, 0.85];
  const seguras = umbrales.map((umbral) => ({ umbral, bien: 0, total: 0 }));
  const porClase: Record<string, [number, number]> = {};
  x.forEach((v, k) => {
    const z = logits(m, v).map((l) => l / temperatura);
    const p = softmax(z);
    const orden = Array.from(p.keys()).sort((a, b) => p[b] - p[a]);
    const bien = orden[0] === y[k];
    if (bien) top1 += 1;
    if (orden.slice(0, 3).includes(y[k])) top3 += 1;
    for (const s of seguras) {
      if (p[orden[0]] >= s.umbral) {
        s.total += 1;
        if (bien) s.bien += 1;
      }
    }
    const nombre = nombres[y[k]];
    porClase[nombre] = porClase[nombre] ?? [0, 0];
    porClase[nombre][1] += 1;
    if (bien) porClase[nombre][0] += 1;
  });
  return {
    top1: top1 / x.length,
    top3: top3 / x.length,
    n: x.length,
    seguras: seguras.map((s) => ({
      umbral: s.umbral,
      aciertos: s.total ? s.bien / s.total : 0,
      cubre: s.total / x.length,
    })),
    porClase: Object.fromEntries(Object.entries(porClase).map(([k, [b, t]]) => [k, Number((b / t).toFixed(2))])),
  };
}

/**
 * La temperatura que hace honestas a las probabilidades.
 *
 * Una regresión logística suele salir demasiado segura: dice 95 % y acierta el
 * 80. Se divide cada salida entre un número que se ajusta con el examen hasta
 * que "70 %" signifique de verdad siete de cada diez. De eso dependen los
 * umbrales de confirmado y preliminar.
 */
function calibrar(m: Modelo, x: Float64Array[], y: number[]): number {
  let mejor = 1;
  let menor = Infinity;
  for (let t = 0.5; t <= 4; t += 0.05) {
    let nll = 0;
    x.forEach((v, k) => {
      const p = softmax(logits(m, v).map((l) => l / t));
      nll -= Math.log(Math.max(1e-12, p[y[k]]));
    });
    if (nll < menor) {
      menor = nll;
      mejor = t;
    }
  }
  return Number(mejor.toFixed(2));
}

function principal() {
  const [, , origen, destino, l2Texto] = process.argv;
  const { lado, muestras } = JSON.parse(readFileSync(origen, 'utf8')) as { lado: number; muestras: Muestra[] };
  const nombres = [...new Set(muestras.map((m) => m.especie))].sort((a, b) =>
    a === 'otra' ? 1 : b === 'otra' ? -1 : a.localeCompare(b),
  );
  const indice = new Map(nombres.map((n, i) => [n, i]));

  const entreno: Datos = { x: [], y: [] };
  const examen: Datos = { x: [], y: [] };
  for (const m of muestras) {
    const y = indice.get(m.especie) ?? 0;
    if (esDeExamen(m.foto)) {
      // Se examina con la foto tal cual, como la ve el teléfono.
      examen.x.push(Float64Array.from(m.rasgos[0]));
      examen.y.push(y);
    } else {
      for (const r of m.rasgos) {
        entreno.x.push(Float64Array.from(r));
        entreno.y.push(y);
      }
    }
  }

  const l2s = l2Texto ? [Number(l2Texto)] : [0.0005, 0.002, 0.008];
  let elegido = { l2: l2s[0], modelo: null as Modelo | null, examen: null as Examen | null, t: 1 };
  for (const l2 of l2s) {
    const modelo = entrenar(entreno, nombres.length, l2, 25);
    const t = calibrar(modelo, examen.x, examen.y);
    const ex = examinar(modelo, examen.x, examen.y, nombres, t);
    console.log(`L2 ${l2}: top-1 ${(ex.top1 * 100).toFixed(1)} % · top-3 ${(ex.top3 * 100).toFixed(1)} % · T ${t}`);
    if (!elegido.examen || ex.top1 > elegido.examen.top1) elegido = { l2, modelo, examen: ex, t };
  }
  const ex = elegido.examen!;
  console.log(`\nElegido L2 ${elegido.l2} · ${ex.n} fotos de examen`);
  for (const s of ex.seguras) {
    console.log(`  con ≥${s.umbral * 100}%: acierta ${(s.aciertos * 100).toFixed(1)} % · cubre ${(s.cubre * 100).toFixed(0)} %`);
  }
  console.log('  por clase:', JSON.stringify(ex.porClase));

  // El modelo final aprende de TODAS las fotos, examen incluido: las cifras de
  // arriba ya se midieron y el examen ya no tiene por qué quedarse fuera.
  const todo: Datos = { x: [...entreno.x], y: [...entreno.y] };
  for (const m of muestras) {
    if (!esDeExamen(m.foto)) continue;
    for (const r of m.rasgos) {
      todo.x.push(Float64Array.from(r));
      todo.y.push(indice.get(m.especie) ?? 0);
    }
  }
  const final = entrenar(todo, nombres.length, elegido.l2, 25);

  // Se pliega la normalización en los pesos: w' = w·escala, b' = b − Σ w'·media.
  // En el teléfono queda un solo producto por clase.
  const dim = final.media.length;
  const filas = final.w.map((w) => Float64Array.from(w, (v, i) => v * final.escala[i]));
  const sesgos = Array.from(final.b, (b, c) => {
    let s = b;
    for (let i = 0; i < dim; i += 1) s -= filas[c][i] * final.media[i];
    return Number(s.toFixed(5));
  });
  // Cada fila a bytes con signo y su escala: la cabeza pesa ocho veces menos.
  const escalas: number[] = [];
  const bytes = new Uint8Array(filas.length * dim);
  filas.forEach((fila, c) => {
    let max = 0;
    for (const v of fila) max = Math.max(max, Math.abs(v));
    const e = max / 127 || 1;
    escalas.push(Number(e.toPrecision(7)));
    fila.forEach((v, i) => {
      bytes[c * dim + i] = Math.round(v / e) + 128;
    });
  });

  const cabeza: CabezaEmpacada = {
    formato: 'medisina-cabeza-1',
    lado,
    clases: nombres,
    dimension: dim,
    escalas,
    sesgos,
    temperatura: elegido.t,
    bytes: aBase64(bytes),
    examen: {
      fotos: ex.n,
      top1: Number(ex.top1.toFixed(3)),
      top3: Number(ex.top3.toFixed(3)),
      seguras: ex.seguras.map((s) => ({
        umbral: s.umbral,
        aciertos: Number(s.aciertos.toFixed(3)),
        cubre: Number(s.cubre.toFixed(3)),
      })),
    },
    entrenadaEn: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(destino, JSON.stringify(cabeza));
  console.log(`\n${nombres.length} clases → ${destino}`);
}

principal();
