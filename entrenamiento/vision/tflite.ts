/**
 * Lector mínimo de modelos TensorFlow Lite, para convertirlos al formato de
 * la app (`src/ia/vision/formato.ts`).
 *
 * Un .tflite es un FlatBuffer: tablas con un índice de campos al lado. No se
 * usa la librería oficial porque de todo el esquema sólo hacen falta seis
 * tablas, y leerlas a mano son cien líneas sin dependencias.
 *
 * Sólo entiende lo que trae una MobileNet: convolución, convolución por canal,
 * la suma de los atajos y el promedio final. Si encuentra otra cosa antes del
 * promedio, se detiene con un error en vez de convertir a medias.
 */

import type { OpEmpacada, RedEmpacada } from '../../src/ia/vision/formato';
import { aBase64 } from '../../src/ia/vision/formato';

class Lector {
  constructor(private readonly b: Buffer) {}

  u8(p: number) {
    return this.b.readUInt8(p);
  }
  i32(p: number) {
    return this.b.readInt32LE(p);
  }
  u32(p: number) {
    return this.b.readUInt32LE(p);
  }

  raiz(): number {
    return this.u32(0);
  }

  /** Posición del campo `n` de la tabla en `t`, o null si no viene. */
  campo(t: number, n: number): number | null {
    const vtabla = t - this.i32(t);
    const largoVtabla = this.b.readUInt16LE(vtabla);
    const donde = 4 + n * 2;
    if (donde >= largoVtabla) return null;
    const desp = this.b.readUInt16LE(vtabla + donde);
    return desp === 0 ? null : t + desp;
  }

  ref(p: number): number {
    return p + this.u32(p);
  }

  tabla(t: number, n: number): number | null {
    const p = this.campo(t, n);
    return p === null ? null : this.ref(p);
  }

  vector(t: number, n: number): { inicio: number; largo: number } | null {
    const p = this.campo(t, n);
    if (p === null) return null;
    const v = this.ref(p);
    return { inicio: v + 4, largo: this.u32(v) };
  }

  tablas(t: number, n: number): number[] {
    const v = this.vector(t, n);
    if (!v) return [];
    return Array.from({ length: v.largo }, (_, i) => this.ref(v.inicio + i * 4));
  }

  enteros(t: number, n: number): number[] {
    const v = this.vector(t, n);
    if (!v) return [];
    return Array.from({ length: v.largo }, (_, i) => this.i32(v.inicio + i * 4));
  }

  flotantes(t: number, n: number): number[] {
    const v = this.vector(t, n);
    if (!v) return [];
    return Array.from({ length: v.largo }, (_, i) => this.b.readFloatLE(v.inicio + i * 4));
  }

  enteros64(t: number, n: number): number[] {
    const v = this.vector(t, n);
    if (!v) return [];
    return Array.from({ length: v.largo }, (_, i) => Number(this.b.readBigInt64LE(v.inicio + i * 8)));
  }

  bytes(t: number, n: number): Buffer {
    const v = this.vector(t, n);
    if (!v) return Buffer.alloc(0);
    return this.b.subarray(v.inicio, v.inicio + v.largo);
  }

  texto(t: number, n: number): string {
    const v = this.vector(t, n);
    return v ? this.b.toString('utf8', v.inicio, v.inicio + v.largo) : '';
  }

  entero(t: number, n: number, omision = 0): number {
    const p = this.campo(t, n);
    return p === null ? omision : this.i32(p);
  }

  byte(t: number, n: number, omision = 0): number {
    const p = this.campo(t, n);
    return p === null ? omision : this.u8(p);
  }
}

// Códigos de TensorFlow Lite que hacen falta aquí.
const OP = { ADD: 0, AVERAGE_POOL_2D: 1, CONV_2D: 3, DEPTHWISE_CONV_2D: 4 } as const;
const TIPO_UINT8 = 3;
const TIPO_INT8 = 9;
const TIPO_INT32 = 2;
const RELLENO_SAME = 0;

interface Tensor {
  forma: number[];
  tipo: number;
  buffer: number;
  nombre: string;
  escala: number[];
  cero: number[];
}

/** El rango de la activación fusionada: NONE, RELU, RELU_N1_TO_1, RELU6. */
function rangoActivacion(codigo: number): [number, number] {
  if (codigo === 0) return [-Infinity, Infinity];
  if (codigo === 1) return [0, Infinity];
  if (codigo === 2) return [-1, 1];
  if (codigo === 3) return [0, 6];
  throw new Error(`Activación ${codigo} no soportada`);
}

/**
 * El rango que de verdad puede tomar una salida: el de su activación cruzado
 * con el que cabe en sus bytes. En un modelo cuantizado el ReLU6 suele venir
 * sólo en el segundo — la activación dice "ninguna" y el recorte lo hace el
 * rango —, así que ignorarlo hace que los números se disparen capa tras capa.
 */
function rangoDe(t: Tensor, activacion: [number, number]): { bajo: number; alto: number } {
  const escala = t.escala[0];
  const cero = t.cero[0] ?? 0;
  const [minimo, maximo] = t.tipo === TIPO_INT8 ? [-128, 127] : [0, 255];
  const bajo = escala ? Math.max(activacion[0], (minimo - cero) * escala) : activacion[0];
  const alto = escala ? Math.min(activacion[1], (maximo - cero) * escala) : activacion[1];
  return { bajo: Number(bajo.toPrecision(8)), alto: Number(alto.toPrecision(8)) };
}

export function convertirTflite(archivo: Buffer, origen: string): RedEmpacada {
  const l = new Lector(archivo);
  const modelo = l.raiz();
  const codigos = l.tablas(modelo, 1).map((oc) => Math.max(l.byte(oc, 0), l.entero(oc, 3)));
  const buffers = l.tablas(modelo, 4);
  const [subgrafo] = l.tablas(modelo, 2);

  const tensores: Tensor[] = l.tablas(subgrafo, 0).map((t) => {
    const q = l.tabla(t, 4);
    return {
      forma: l.enteros(t, 0),
      tipo: l.byte(t, 1),
      buffer: l.entero(t, 2),
      nombre: l.texto(t, 3),
      escala: q ? l.flotantes(q, 2) : [],
      cero: q ? l.enteros64(q, 3) : [],
    };
  });
  const datosDe = (t: Tensor) => l.bytes(buffers[t.buffer], 0);

  const [entrada] = l.enteros(subgrafo, 1).map((i) => tensores[i]);
  if (entrada.tipo !== TIPO_UINT8) throw new Error('Se esperaba una entrada de bytes (uint8).');

  const ops: OpEmpacada[] = [];
  const trozos: Buffer[] = [];
  let desde = 0;
  let mapaFinal = -1;

  for (const op of l.tablas(subgrafo, 3)) {
    const codigo = codigos[l.entero(op, 0)];
    const entradas = l.enteros(op, 1);
    const [salida] = l.enteros(op, 2);

    if (codigo === OP.AVERAGE_POOL_2D) {
      mapaFinal = entradas[0];
      break;
    }
    if (codigo === OP.ADD) {
      const opciones = l.tabla(op, 4);
      const activacion = rangoActivacion(opciones ? l.byte(opciones, 0) : 0);
      ops.push({ tipo: 'suma', entrada: entradas[0], otra: entradas[1], salida, ...rangoDe(tensores[salida], activacion) });
      continue;
    }
    if (codigo !== OP.CONV_2D && codigo !== OP.DEPTHWISE_CONV_2D) {
      throw new Error(`Operación ${codigo} antes del promedio: no es una MobileNet simple.`);
    }

    const [iEntrada, iPesos, iSesgo] = entradas;
    const pesos = tensores[iPesos];
    const sesgo = tensores[iSesgo];
    const opciones = l.tabla(op, 4);
    if (opciones === null) throw new Error('Convolución sin opciones.');

    const porCanal = codigo === OP.DEPTHWISE_CONV_2D;
    // Conv2DOptions: padding 0, stride_w 1, stride_h 2, activación 3.
    // DepthwiseConv2DOptions: padding 0, stride_w 1, stride_h 2, multiplicador 3, activación 4.
    const relleno = l.byte(opciones, 0);
    const paso = l.entero(opciones, 1, 1);
    const activacion = rangoActivacion(l.byte(opciones, porCanal ? 4 : 3));
    if (relleno !== RELLENO_SAME) throw new Error('Sólo se soporta relleno SAME.');
    if (porCanal && l.entero(opciones, 3, 1) !== 1) throw new Error('Multiplicador de canal distinto de 1.');
    if (pesos.tipo !== TIPO_UINT8 && pesos.tipo !== TIPO_INT8) throw new Error('Pesos que no son bytes.');
    if (sesgo.tipo !== TIPO_INT32) throw new Error('Sesgo que no es int32.');

    // [salida, alto, ancho, entrada] para conv; [1, alto, ancho, canales] para porCanal.
    const [a, kh, kw, b] = pesos.forma;
    if (kh !== kw) throw new Error('Filtro no cuadrado.');
    const bytesPesos = datosDe(pesos);
    // Todo se guarda como 0–255: los int8 se corren 128, y su cero con ellos.
    const crudo =
      pesos.tipo === TIPO_INT8
        ? Buffer.from(Array.from(bytesPesos, (v) => ((v << 24) >> 24) + 128))
        : Buffer.from(bytesPesos);
    const cero = pesos.tipo === TIPO_INT8 ? pesos.cero.map((z) => z + 128) : pesos.cero;

    const bytesSesgo = datosDe(sesgo);
    const valoresSesgo = Array.from({ length: bytesSesgo.length / 4 }, (_, i) => {
      const s = sesgo.escala.length > 1 ? sesgo.escala[i] : sesgo.escala[0];
      return Number((bytesSesgo.readInt32LE(i * 4) * s).toPrecision(7));
    });

    ops.push({
      tipo: porCanal ? 'porCanal' : 'conv',
      entrada: iEntrada,
      salida,
      lado: kh,
      paso,
      canalesEntrada: b,
      canalesSalida: porCanal ? b : a,
      ...rangoDe(tensores[salida], activacion),
      escala: pesos.escala.map((e) => Number(e.toPrecision(8))),
      cero,
      desde,
      cuantos: crudo.length,
      sesgo: valoresSesgo,
    });
    trozos.push(crudo);
    desde += crudo.length;
  }
  if (mapaFinal < 0) throw new Error('No encontré el promedio final.');

  return {
    formato: 'medisina-red-2',
    origen,
    lado: entrada.forma[1],
    entradaEscala: entrada.escala[0],
    entradaCero: entrada.cero[0],
    mapaEntrada: l.enteros(subgrafo, 1)[0],
    mapaFinal,
    ops,
    bytes: aBase64(new Uint8Array(Buffer.concat(trozos))),
  };
}
