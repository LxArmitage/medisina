/**
 * Pruebas de la red que mira las fotos.
 *
 * La red está escrita a mano y optimizada para que el teléfono la aguante: el
 * lazo de 1×1 agrupa píxeles de cuatro en cuatro y el de entradas ralas se
 * salta los ceros. Cada atajo es un lugar donde un índice mal puesto da un
 * número distinto SIN ningún error — la foto se reconoce mal y nadie se entera.
 *
 * Por eso cada capa se compara contra una versión ingenua, escrita como en el
 * libro, que es lenta pero obviamente correcta.
 */

import { combinar, desempacarCabeza, probabilidades } from '../src/ia/vision/cabeza';
import type { CabezaEmpacada } from '../src/ia/vision/cabeza';
import { aBase64, desdeBase64 } from '../src/ia/vision/formato';
import { cuadroCentral, espejo } from '../src/ia/vision/imagen';
import { correr, ejecutarOp, pasos } from '../src/ia/vision/red';
import type { Mapa, Op, OpConv, OpPorCanal, Red } from '../src/ia/vision/red';

// Pseudoazar con semilla: las pruebas dan lo mismo cada vez.
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mapaAzar(alto: number, ancho: number, canales: number, r: () => number, ralo = false): Mapa {
  const datos = new Float32Array(alto * ancho * canales);
  for (let i = 0; i < datos.length; i += 1) datos[i] = ralo && r() < 0.5 ? 0 : r() * 2 - 1;
  return { alto, ancho, canales, datos };
}

function pesosAzar(n: number, r: () => number) {
  return Float32Array.from({ length: n }, () => r() - 0.5);
}

/** Convolución como en el libro: relleno SAME de TensorFlow, sin atajos. */
function convIngenua(op: OpConv, x: Mapa): Mapa {
  const { lado, paso, canalesEntrada: ci, canalesSalida: co } = op;
  const alto = Math.ceil(x.alto / paso);
  const ancho = Math.ceil(x.ancho / paso);
  const padY = Math.floor(Math.max(0, (alto - 1) * paso + lado - x.alto) / 2);
  const padX = Math.floor(Math.max(0, (ancho - 1) * paso + lado - x.ancho) / 2);
  const y = new Float32Array(alto * ancho * co);
  for (let oy = 0; oy < alto; oy += 1)
    for (let ox = 0; ox < ancho; ox += 1)
      for (let o = 0; o < co; o += 1) {
        let s = op.sesgo[o];
        for (let ky = 0; ky < lado; ky += 1)
          for (let kx = 0; kx < lado; kx += 1)
            for (let i = 0; i < ci; i += 1) {
              const iy = oy * paso + ky - padY;
              const ix = ox * paso + kx - padX;
              if (iy < 0 || ix < 0 || iy >= x.alto || ix >= x.ancho) continue;
              s += x.datos[(iy * x.ancho + ix) * ci + i] * op.pesos[((o * lado + ky) * lado + kx) * ci + i];
            }
        y[(oy * ancho + ox) * co + o] = Math.min(op.alto, Math.max(op.bajo, s));
      }
  return { alto, ancho, canales: co, datos: y };
}

function porCanalIngenua(op: OpPorCanal, x: Mapa): Mapa {
  const { lado, paso, canales: c } = op;
  const alto = Math.ceil(x.alto / paso);
  const ancho = Math.ceil(x.ancho / paso);
  const padY = Math.floor(Math.max(0, (alto - 1) * paso + lado - x.alto) / 2);
  const padX = Math.floor(Math.max(0, (ancho - 1) * paso + lado - x.ancho) / 2);
  const y = new Float32Array(alto * ancho * c);
  for (let oy = 0; oy < alto; oy += 1)
    for (let ox = 0; ox < ancho; ox += 1)
      for (let k = 0; k < c; k += 1) {
        let s = op.sesgo[k];
        for (let ky = 0; ky < lado; ky += 1)
          for (let kx = 0; kx < lado; kx += 1) {
            const iy = oy * paso + ky - padY;
            const ix = ox * paso + kx - padX;
            if (iy < 0 || ix < 0 || iy >= x.alto || ix >= x.ancho) continue;
            s += x.datos[(iy * x.ancho + ix) * c + k] * op.pesos[(ky * lado + kx) * c + k];
          }
        y[(oy * ancho + ox) * c + k] = Math.min(op.alto, Math.max(op.bajo, s));
      }
  return { alto, ancho, canales: c, datos: y };
}

function cerca(a: ArrayLike<number>, b: ArrayLike<number>, tolerancia = 1e-4): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > tolerancia) return false;
  return true;
}

// ---------------------------------------------------------------------------

describe('cada capa da lo mismo que la versión del libro', () => {
  const r = azar(7);

  it.each([
    ['1×1 densa', 1, 1, 7, 9, 5],
    ['1×1 con píxeles que no son múltiplo de 4', 1, 1, 5, 3, 6],
    ['3×3 paso 2 (la primera capa)', 3, 2, 9, 3, 8],
    ['3×3 paso 1', 3, 1, 6, 4, 5],
  ] as const)('%s', (_n, lado, paso, tam, ci, co) => {
    const x = mapaAzar(tam, tam, ci, r);
    const op: OpConv = {
      tipo: 'conv', entrada: 0, salida: 1, lado, paso, canalesEntrada: ci, canalesSalida: co,
      pesos: pesosAzar(co * lado * lado * ci, r), sesgo: pesosAzar(co, r), bajo: 0, alto: 6,
    };
    expect(cerca(ejecutarOp(op, x).datos, convIngenua(op, x).datos)).toBe(true);
  });

  it('una red con atajo da lo mismo que armarla capa por capa a mano', () => {
    // entrada → por canal → 1×1 → suma con la entrada (el atajo de la V2)
    const x = mapaAzar(6, 6, 12, r);
    const porCanal: OpPorCanal = {
      tipo: 'porCanal', entrada: 0, salida: 1, lado: 3, paso: 1, canales: 12,
      pesos: pesosAzar(9 * 12, r), sesgo: pesosAzar(12, r), bajo: 0, alto: 6,
    };
    const conv: OpConv = {
      tipo: 'conv', entrada: 1, salida: 2, lado: 1, paso: 1, canalesEntrada: 12, canalesSalida: 12,
      pesos: pesosAzar(12 * 12, r), sesgo: pesosAzar(12, r), bajo: -Infinity, alto: Infinity,
    };
    const suma: Op = { tipo: 'suma', entrada: 2, otra: 0, salida: 3, bajo: -Infinity, alto: Infinity };
    const red: Red = { lado: 6, entradaEscala: 1, entradaCero: 0, mapaEntrada: 0, mapaFinal: 3, ops: [porCanal, conv, suma] };

    const a = porCanalIngenua(porCanal, x);
    const b = convIngenua(conv, a);
    const final = Float32Array.from(b.datos, (v, i) => v + x.datos[i]);
    const promedio = new Float32Array(12);
    for (let p = 0; p < 36; p += 1) for (let k = 0; k < 12; k += 1) promedio[k] += final[p * 12 + k] / 36;

    expect(cerca(correr(red, x), promedio)).toBe(true);
  });

  it.each([
    ['paso 1', 1, 7],
    ['paso 2 con lado impar', 2, 7],
    ['paso 2 con lado par', 2, 8],
  ] as const)('por canal, %s', (_n, paso, tam) => {
    const x = mapaAzar(tam, tam, 5, r);
    const op: OpPorCanal = {
      tipo: 'porCanal', entrada: 0, salida: 1, lado: 3, paso, canales: 5,
      pesos: pesosAzar(9 * 5, r), sesgo: pesosAzar(5, r), bajo: 0, alto: 6,
    };
    expect(cerca(ejecutarOp(op, x).datos, porCanalIngenua(op, x).datos)).toBe(true);
  });

  it('la suma del atajo suma y respeta su rango', () => {
    const x = mapaAzar(4, 4, 3, r);
    const z = mapaAzar(4, 4, 3, r);
    const op: Op = { tipo: 'suma', entrada: 0, otra: 1, salida: 2, bajo: -0.5, alto: 0.5 };
    const esperado = Float32Array.from(x.datos, (v, i) => Math.min(0.5, Math.max(-0.5, v + z.datos[i])));
    expect(cerca(ejecutarOp(op, x, z).datos, esperado)).toBe(true);
  });
});

describe('la red respira mientras piensa', () => {
  it('avisa su avance de menos a más y termina igual que de un jalón', () => {
    const r = azar(3);
    const x = mapaAzar(40, 40, 16, r);
    const op: OpConv = {
      tipo: 'conv', entrada: 0, salida: 1, lado: 1, paso: 1, canalesEntrada: 16, canalesSalida: 3000,
      pesos: pesosAzar(16 * 3000, r), sesgo: pesosAzar(3000, r), bajo: 0, alto: 6,
    };
    const red: Red = { lado: 40, entradaEscala: 1, entradaCero: 0, mapaEntrada: 0, mapaFinal: 1, ops: [op] };
    const avances: number[] = [];
    const it = pasos(red, x);
    let paso = it.next();
    while (!paso.done) {
      avances.push(paso.value);
      paso = it.next();
    }
    expect(avances.length).toBeGreaterThan(3);
    expect(avances.every((a, i) => a > 0 && a < 1 && (i === 0 || a >= avances[i - 1]))).toBe(true);
    expect(cerca(paso.value, correr(red, x))).toBe(true);
  });
});

describe('los bytes viajan sin perderse', () => {
  it.each([0, 1, 2, 3, 1000, 1001, 1002])('base64 de ida y vuelta con %i bytes', (n) => {
    const r = azar(n + 1);
    const bytes = Uint8Array.from({ length: n }, () => Math.floor(r() * 256));
    expect(Array.from(desdeBase64(aBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('la foto llega a la red como debe', () => {
  it('un color parejo sigue siendo ese color, del tamaño pedido', () => {
    const ancho = 300;
    const alto = 200;
    const datos = new Uint8Array(ancho * alto * 4);
    for (let i = 0; i < datos.length; i += 4) datos.set([40, 160, 90, 255], i);
    const cuadro = cuadroCentral({ ancho, alto, datos }, 64);
    expect(cuadro.length).toBe(64 * 64 * 4);
    expect(Array.from(cuadro.slice(0, 4))).toEqual([40, 160, 90, 255]);
    expect(Array.from(cuadro.slice(-4))).toEqual([40, 160, 90, 255]);
  });

  it('recorta el centro: lo de las orillas de una foto ancha no entra', () => {
    const ancho = 300;
    const alto = 100;
    const datos = new Uint8Array(ancho * alto * 4);
    for (let y = 0; y < alto; y += 1)
      for (let x = 0; x < ancho; x += 1) datos.set(x < 100 || x >= 200 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * ancho + x) * 4);
    const cuadro = cuadroCentral({ ancho, alto, datos }, 20);
    for (let i = 0; i < cuadro.length; i += 4) expect(cuadro[i]).toBe(0);
  });

  it('el espejo voltea de izquierda a derecha', () => {
    const lado = 3;
    const img = new Uint8ClampedArray(lado * lado * 4);
    img.set([10, 20, 30, 255], 0);
    const v = espejo(img, lado);
    expect(Array.from(v.slice((lado - 1) * 4, lado * 4))).toEqual([10, 20, 30, 255]);
  });
});

describe('la última capa', () => {
  const empacada: CabezaEmpacada = {
    formato: 'medisina-cabeza-1',
    lado: 160,
    clases: ['a', 'b', 'otra'],
    dimension: 2,
    escalas: [0.1, 0.1, 0.1],
    sesgos: [0, 0, 0],
    temperatura: 1,
    bytes: aBase64(Uint8Array.from([128 + 10, 128, 128, 128 + 10, 128, 128])),
    examen: { fotos: 0, top1: 0, top3: 0, seguras: [] },
    entrenadaEn: '2026-09-24',
  };

  it('da probabilidades que suman uno y siguen a los rasgos', () => {
    const cabeza = desempacarCabeza(empacada);
    const p = probabilidades(cabeza, [3, 0]);
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(p[0]).toBeGreaterThan(p[1]);
  });

  it('con capa oculta: la ReLU apaga lo negativo antes de decidir', () => {
    const uno = 128 + 127;
    const conOculta: CabezaEmpacada = {
      formato: 'medisina-cabeza-2',
      lado: 160,
      clases: ['a', 'b', 'otra'],
      dimension: 2,
      oculta: 2,
      // La oculta copia los rasgos (identidad)…
      capa1: { escalas: [1 / 127, 1 / 127], sesgos: [0, 0], bytes: aBase64(Uint8Array.from([uno, 128, 128, uno])) },
      // …y cada clase lee una neurona; "otra" no lee ninguna.
      capa2: {
        escalas: [10 / 127, 10 / 127, 1],
        sesgos: [0, 0, 0],
        bytes: aBase64(Uint8Array.from([uno, 128, 128, uno, 128, 128])),
      },
      temperatura: 1,
      examen: { fotos: 0, top1: 0, top3: 0, seguras: [] },
      entrenadaEn: '2026-09-25',
    };
    const cabeza = desempacarCabeza(conOculta);
    const p = probabilidades(cabeza, [3, 0]);
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(p[0]).toBeGreaterThan(0.99);
    // Un rasgo negativo no resta: la neurona se apaga y nadie gana.
    const q = probabilidades(cabeza, [-3, 0]);
    q.forEach((v) => expect(v).toBeCloseTo(1 / 3, 6));
  });

  it('una capa con bytes de menos no se carga a medias', () => {
    const rota: CabezaEmpacada = { ...empacada, bytes: aBase64(Uint8Array.from([128, 128])) };
    expect(() => desempacarCabeza(rota)).toThrow();
  });

  it('con varias fotos gana la que es creíble en todas', () => {
    // La segunda foto está segurísima de "b", pero en la primera "b" es casi imposible.
    const p = combinar([
      [0.6, 0.01, 0.39],
      [0.3, 0.69, 0.01],
    ]);
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(p[0]).toBeGreaterThan(p[1]);
  });
});
