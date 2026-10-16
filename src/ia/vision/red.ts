/**
 * La red que mira las fotos, corriendo en JavaScript puro.
 *
 * POR QUÉ EN JAVASCRIPT Y NO CON UNA LIBRERÍA NATIVA. La app corre en Expo Go,
 * donde no se puede agregar código nativo: nada de TensorFlow Lite ni de Core
 * ML. Lo que sí hay en todos lados —teléfono, navegador y Jest— es JavaScript.
 * Una MobileNet son sólo cuatro operaciones (convolución, convolución por
 * canal, suma y promedio), así que se pueden escribir a mano y correr sin
 * internet, sin llave y sin costo.
 *
 * El precio es la velocidad: el teléfono no compila este código a máquina, lo
 * interpreta. Por eso la red trabaja a la resolución más chica que todavía
 * reconoce bien y el cálculo se entrega en pedazos (`pasos`), para que la
 * pantalla no se congele mientras piensa.
 *
 * Este archivo no sabe de dónde salieron los pesos ni qué significan las
 * salidas: recibe una red ya armada y una imagen, y devuelve un vector. Qué
 * planta es lo decide `reconocer.ts`.
 */

/**
 * Las operaciones leen y escriben mapas por número. Una MobileNet V2 no es
 * una fila de capas: cada bloque suma su entrada a su salida (el "atajo"),
 * así que hay que poder volver a un mapa de tres operaciones atrás.
 *
 * Cada salida se recorta a un rango. Es la activación (ReLU6 es recortar a
 * 0–6), pero sale del modelo y no de un nombre: en un modelo cuantizado la
 * activación viene escondida en el rango de cada salida, y respetarlo es lo
 * que hace que esta red dé lo mismo que la original.
 */
interface Nudo {
  entrada: number;
  salida: number;
  bajo: number;
  alto: number;
}

export interface OpConv extends Nudo {
  tipo: 'conv';
  /** Lado del filtro: 1 o 3 en una MobileNet. */
  lado: number;
  paso: number;
  canalesEntrada: number;
  canalesSalida: number;
  /** [salida][ky][kx][entrada], como los guarda TensorFlow Lite. */
  pesos: Float32Array;
  sesgo: Float32Array;
  /** Vistas de cada fila de `pesos`; se arman la primera vez (ver `filasDe`). */
  filas?: Float32Array[];
}

export interface OpPorCanal extends Nudo {
  tipo: 'porCanal';
  lado: number;
  paso: number;
  canales: number;
  /** [ky][kx][canal]. */
  pesos: Float32Array;
  sesgo: Float32Array;
}

export interface OpSuma extends Nudo {
  tipo: 'suma';
  /** El otro sumando; `entrada` es el primero. */
  otra: number;
}

export type Op = OpConv | OpPorCanal | OpSuma;

export interface Red {
  /** Lado de la imagen que espera la primera capa. */
  lado: number;
  /** Cómo pasar un byte de color (0–255) al número que espera la red. */
  entradaEscala: number;
  entradaCero: number;
  /** Número del mapa donde entra la imagen. */
  mapaEntrada: number;
  /** Número del mapa que se promedia al final. */
  mapaFinal: number;
  ops: Op[];
}

/** Un mapa de rasgos: alto × ancho × canales, en ese orden (HWC). */
export interface Mapa {
  alto: number;
  ancho: number;
  canales: number;
  datos: Float32Array;
}

/**
 * Cuánto trabajo se hace entre dos respiros, en multiplicaciones.
 *
 * Millón y medio: en el teléfono son unas cinco centésimas de segundo. Menos
 * haría más lenta la cuenta total; más, y se nota el tirón en la pantalla.
 */
const TRABAJO_POR_PASO = 1_500_000;

/**
 * La imagen a la entrada de la red.
 *
 * Recibe los píxeles RGBA de `lado` × `lado` y los convierte a los números que
 * la red aprendió a leer.
 */
export function prepararEntrada(red: Red, rgba: ArrayLike<number>, lado: number): Mapa {
  const datos = new Float32Array(lado * lado * 3);
  for (let p = 0, q = 0; p < lado * lado; p += 1, q += 4) {
    datos[p * 3] = (rgba[q] - red.entradaCero) * red.entradaEscala;
    datos[p * 3 + 1] = (rgba[q + 1] - red.entradaCero) * red.entradaEscala;
    datos[p * 3 + 2] = (rgba[q + 2] - red.entradaCero) * red.entradaEscala;
  }
  return { alto: lado, ancho: lado, canales: 3, datos };
}

/**
 * La red completa, en pasos.
 *
 * Es un generador: cada `yield` es un buen momento para soltar el hilo y dejar
 * que la pantalla respire. Da el avance de 0 a 1 y al final devuelve el
 * promedio del último mapa: el vector de rasgos de la foto.
 */
export function* pasos(red: Red, entrada: Mapa): Generator<number, Float32Array, void> {
  const mapas = new Map<number, Mapa>([[red.mapaEntrada, entrada]]);

  // Cuántas veces se va a leer cada mapa, para soltarlo en cuanto ya no hace
  // falta. Una red a 224 px pasa por mapas de 112×112×96: guardarlos todos
  // son decenas de megas que el teléfono no tiene por qué cargar.
  const lecturas = new Map<number, number>();
  const leer = (id: number) => lecturas.set(id, (lecturas.get(id) ?? 0) + 1);
  for (const op of red.ops) {
    leer(op.entrada);
    if (op.tipo === 'suma') leer(op.otra);
  }
  leer(red.mapaFinal);

  const total = costoTotal(red, entrada) || 1;
  let hecho = 0;

  for (const op of red.ops) {
    const ent = mapas.get(op.entrada);
    if (!ent) throw new Error(`Falta el mapa ${op.entrada}`);

    let sal: Mapa;
    if (op.tipo === 'suma') {
      const otra = mapas.get(op.otra);
      if (!otra) throw new Error(`Falta el mapa ${op.otra}`);
      sal = { ...ent, datos: new Float32Array(ent.datos.length) };
      for (let i = 0; i < sal.datos.length; i += 1) {
        sal.datos[i] = recortar(ent.datos[i] + otra.datos[i], op.bajo, op.alto);
      }
      soltar(mapas, lecturas, op.otra);
    } else {
      sal = mapaDeSalida(op, ent);
      const trabajo = op.tipo === 'conv' ? convolucion(op, ent, sal) : porCanal(op, ent, sal);
      for (const hechoAqui of trabajo) yield Math.min(0.999, (hecho + hechoAqui) / total);
      hecho += costo(op, ent);
    }
    soltar(mapas, lecturas, op.entrada);
    mapas.set(op.salida, sal);
  }

  const final = mapas.get(red.mapaFinal);
  if (!final) throw new Error('La red no llegó al mapa final.');
  return promedioGlobal(final);
}

/** La red de un jalón, sin respiros. Para el entrenamiento y las pruebas. */
export function correr(red: Red, entrada: Mapa): Float32Array {
  const it = pasos(red, entrada);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

/**
 * Una sola operación, de un jalón, devolviendo el mapa entero. La red no la
 * usa (va en pasos); existe para que las pruebas comparen capa por capa.
 */
export function ejecutarOp(op: Op, ent: Mapa, otra?: Mapa): Mapa {
  if (op.tipo === 'suma') {
    const datos = new Float32Array(ent.datos.length);
    const b = otra?.datos ?? new Float32Array(ent.datos.length);
    for (let i = 0; i < datos.length; i += 1) datos[i] = recortar(ent.datos[i] + b[i], op.bajo, op.alto);
    return { ...ent, datos };
  }
  const sal = mapaDeSalida(op, ent);
  const trabajo = op.tipo === 'conv' ? convolucion(op, ent, sal) : porCanal(op, ent, sal);
  for (let r = trabajo.next(); !r.done; r = trabajo.next()) {
    // sin respiros
  }
  return sal;
}

function soltar(mapas: Map<number, Mapa>, lecturas: Map<number, number>, id: number) {
  const quedan = (lecturas.get(id) ?? 0) - 1;
  lecturas.set(id, quedan);
  if (quedan <= 0) mapas.delete(id);
}

/** Multiplicaciones de toda la red para una entrada de este tamaño. */
export function costoTotal(red: Red, entrada: { alto: number; ancho: number }): number {
  const formas = new Map<number, { alto: number; ancho: number }>([[red.mapaEntrada, entrada]]);
  let total = 0;
  for (const op of red.ops) {
    const f = formas.get(op.entrada) ?? entrada;
    if (op.tipo === 'suma') {
      formas.set(op.salida, f);
      continue;
    }
    total += costo(op, f);
    formas.set(op.salida, { alto: Math.ceil(f.alto / op.paso), ancho: Math.ceil(f.ancho / op.paso) });
  }
  return total;
}

// ---------------------------------------------------------------------------
// Capas
// ---------------------------------------------------------------------------

/**
 * Relleno "SAME" de TensorFlow: la salida mide techo(entrada / paso), y lo que
 * sobra se reparte con el pedazo más grande abajo y a la derecha.
 */
function relleno(entrada: number, lado: number, paso: number): { salida: number; antes: number } {
  const salida = Math.ceil(entrada / paso);
  const total = Math.max(0, (salida - 1) * paso + lado - entrada);
  return { salida, antes: Math.floor(total / 2) };
}

function mapaDeSalida(op: OpConv | OpPorCanal, mapa: Mapa): Mapa {
  const alto = relleno(mapa.alto, op.lado, op.paso).salida;
  const ancho = relleno(mapa.ancho, op.lado, op.paso).salida;
  const canales = op.tipo === 'conv' ? op.canalesSalida : op.canales;
  return { alto, ancho, canales, datos: new Float32Array(alto * ancho * canales) };
}

function costo(op: OpConv | OpPorCanal, mapa: { alto: number; ancho: number }): number {
  const pixeles = Math.ceil(mapa.alto / op.paso) * Math.ceil(mapa.ancho / op.paso);
  const porPixel =
    op.tipo === 'conv'
      ? op.lado * op.lado * op.canalesEntrada * op.canalesSalida
      : op.lado * op.lado * op.canales;
  return pixeles * porPixel;
}

function recortar(x: number, bajo: number, alto: number): number {
  return x < bajo ? bajo : x > alto ? alto : x;
}

/**
 * Convolución normal. Casi todo el tiempo de la red se va aquí, en las de 1×1,
 * así que ese caso tiene su propio lazo.
 */
function* convolucion(op: OpConv, ent: Mapa, sal: Mapa): Generator<number, void, void> {
  if (op.lado === 1 && op.paso === 1) yield* unoPorUno(op, ent, sal);
  else yield* conParche(op, ent, sal);
}

/**
 * Las filas de pesos de cada salida, como vistas del arreglo grande.
 *
 * En el teléfono (Hermes) leer `fila[i]` sale más barato que `pesos[base + i]`:
 * es una suma menos por multiplicación, y aquí se hacen cientos de millones.
 * Crear una vista cuesta unos microsegundos, así que se crean una sola vez por
 * capa y se guardan.
 */
function filasDe(op: OpConv): Float32Array[] {
  if (!op.filas) {
    const largo = op.lado * op.lado * op.canalesEntrada;
    op.filas = Array.from({ length: op.canalesSalida }, (_, o) => op.pesos.subarray(o * largo, (o + 1) * largo));
  }
  return op.filas;
}

/**
 * 1×1: cuatro píxeles a la vez contra la misma fila de pesos.
 *
 * El teléfono interpreta este código, y ahí lo que cuesta no es multiplicar
 * sino cada instrucción alrededor: leer el peso, calcular índices. Leyendo
 * cada peso una vez para cuatro píxeles, y con los cuatro píxeles como vistas
 * (sin sumar índices en el lazo de adentro), sale 30 % más rápido medido en
 * Hermes. Las vistas de píxeles sí se crean en cada grupo: cuestan, pero se
 * reparten entre miles de multiplicaciones.
 */
function* unoPorUno(op: OpConv, ent: Mapa, sal: Mapa): Generator<number, void, void> {
  const { canalesEntrada: ci, canalesSalida: co, sesgo, bajo, alto } = op;
  const filas = filasDe(op);
  const x = ent.datos;
  const y = sal.datos;
  const pixeles = ent.alto * ent.ancho;
  const porGrupo = 4 * ci * co;
  let acumulado = 0;
  let hecho = 0;
  let p = 0;

  for (; p + 3 < pixeles; p += 4) {
    const b0 = p * ci;
    const x0 = x.subarray(b0, b0 + ci);
    const x1 = x.subarray(b0 + ci, b0 + 2 * ci);
    const x2 = x.subarray(b0 + 2 * ci, b0 + 3 * ci);
    const x3 = x.subarray(b0 + 3 * ci, b0 + 4 * ci);
    const d0 = p * co;
    const d1 = d0 + co;
    const d2 = d1 + co;
    const d3 = d2 + co;
    for (let o = 0; o < co; o += 1) {
      const f = filas[o];
      let s0 = sesgo[o];
      let s1 = s0;
      let s2 = s0;
      let s3 = s0;
      for (let i = 0; i < ci; i += 1) {
        const w = f[i];
        s0 += x0[i] * w;
        s1 += x1[i] * w;
        s2 += x2[i] * w;
        s3 += x3[i] * w;
      }
      // El recorte va escrito aquí y no en una función: son millones de
      // llamadas, y en el teléfono cada llamada cuesta.
      y[d0 + o] = s0 < bajo ? bajo : s0 > alto ? alto : s0;
      y[d1 + o] = s1 < bajo ? bajo : s1 > alto ? alto : s1;
      y[d2 + o] = s2 < bajo ? bajo : s2 > alto ? alto : s2;
      y[d3 + o] = s3 < bajo ? bajo : s3 > alto ? alto : s3;
    }
    acumulado += porGrupo;
    hecho += porGrupo;
    if (acumulado >= TRABAJO_POR_PASO) {
      acumulado = 0;
      yield hecho;
    }
  }

  // Los que sobran cuando los píxeles no son múltiplo de cuatro.
  for (; p < pixeles; p += 1) {
    const xp = x.subarray(p * ci, (p + 1) * ci);
    const d = p * co;
    for (let o = 0; o < co; o += 1) {
      const f = filas[o];
      let s = sesgo[o];
      for (let i = 0; i < ci; i += 1) s += xp[i] * f[i];
      y[d + o] = s < bajo ? bajo : s > alto ? alto : s;
    }
  }
}

/**
 * Convolución con filtro grande (en una MobileNet, sólo la primera capa: 3×3
 * sobre la foto).
 *
 * Por cada píxel se juntan primero los valores que ve el filtro en un parche
 * corto —con ceros donde se sale de la imagen— y luego cada salida es un solo
 * producto contra su fila de pesos. Así el lazo de adentro no pregunta en
 * cada paso si se salió de la orilla.
 */
function* conParche(op: OpConv, ent: Mapa, sal: Mapa): Generator<number, void, void> {
  const { lado, paso, canalesEntrada: ci, canalesSalida: co, sesgo, bajo, alto } = op;
  const filas = filasDe(op);
  const x = ent.datos;
  const y = sal.datos;
  const largo = lado * lado * ci;
  const parche = new Float32Array(largo);
  const { antes: arriba } = relleno(ent.alto, lado, paso);
  const { antes: izquierda } = relleno(ent.ancho, lado, paso);
  const porRenglon = sal.ancho * largo * co;
  let acumulado = 0;
  let hecho = 0;

  for (let oy = 0; oy < sal.alto; oy += 1) {
    for (let ox = 0; ox < sal.ancho; ox += 1) {
      let j = 0;
      for (let ky = 0; ky < lado; ky += 1) {
        const iy = oy * paso + ky - arriba;
        for (let kx = 0; kx < lado; kx += 1) {
          const ix = ox * paso + kx - izquierda;
          const dentro = iy >= 0 && iy < ent.alto && ix >= 0 && ix < ent.ancho;
          const base = (iy * ent.ancho + ix) * ci;
          for (let i = 0; i < ci; i += 1) {
            parche[j] = dentro ? x[base + i] : 0;
            j += 1;
          }
        }
      }
      const d = (oy * sal.ancho + ox) * co;
      for (let o = 0; o < co; o += 1) {
        const f = filas[o];
        let s = sesgo[o];
        for (let k = 0; k < largo; k += 1) s += parche[k] * f[k];
        y[d + o] = s < bajo ? bajo : s > alto ? alto : s;
      }
    }
    acumulado += porRenglon;
    hecho += porRenglon;
    if (acumulado >= TRABAJO_POR_PASO) {
      acumulado = 0;
      yield hecho;
    }
  }
}

/**
 * Convolución por canal (depthwise): cada canal con su propio filtro de 3×3.
 *
 * Los píxeles de adentro —casi todos— van por un camino sin preguntas: los
 * nueve vecinos de golpe, con los índices calculados una vez por píxel. En
 * Hermes eso duplica la velocidad frente a recorrer el filtro con lazos. La
 * orilla, que es poca, va por el camino general.
 */
function* porCanal(op: OpPorCanal, ent: Mapa, sal: Mapa): Generator<number, void, void> {
  const { lado, paso, canales: c, pesos, sesgo, bajo, alto } = op;
  const x = ent.datos;
  const y = sal.datos;
  const { antes: arriba } = relleno(ent.alto, lado, paso);
  const { antes: izquierda } = relleno(ent.ancho, lado, paso);
  const fila = ent.ancho * c;
  const porRenglon = sal.ancho * lado * lado * c;
  const nueve = lado === 3;
  // Una vista por posición del filtro: nueve por capa, no por píxel.
  const w = Array.from({ length: lado * lado }, (_, t) => pesos.subarray(t * c, (t + 1) * c));
  const [w0, w1, w2, w3, w4, w5, w6, w7, w8] = nueve ? w : [];
  const c2 = 2 * c;
  let acumulado = 0;
  let hecho = 0;

  for (let oy = 0; oy < sal.alto; oy += 1) {
    const iy0 = oy * paso - arriba;
    for (let ox = 0; ox < sal.ancho; ox += 1) {
      const ix0 = ox * paso - izquierda;
      const destino = (oy * sal.ancho + ox) * c;

      if (nueve && iy0 >= 0 && iy0 + 2 < ent.alto && ix0 >= 0 && ix0 + 2 < ent.ancho) {
        const a = (iy0 * ent.ancho + ix0) * c;
        const b = a + fila;
        const e = b + fila;
        for (let k = 0; k < c; k += 1) {
          const ak = a + k;
          const bk = b + k;
          const ek = e + k;
          const s =
            sesgo[k] +
            x[ak] * w0[k] +
            x[ak + c] * w1[k] +
            x[ak + c2] * w2[k] +
            x[bk] * w3[k] +
            x[bk + c] * w4[k] +
            x[bk + c2] * w5[k] +
            x[ek] * w6[k] +
            x[ek + c] * w7[k] +
            x[ek + c2] * w8[k];
          y[destino + k] = s < bajo ? bajo : s > alto ? alto : s;
        }
        continue;
      }

      for (let k = 0; k < c; k += 1) y[destino + k] = sesgo[k];
      for (let ky = 0; ky < lado; ky += 1) {
        const iy = iy0 + ky;
        if (iy < 0 || iy >= ent.alto) continue;
        for (let kx = 0; kx < lado; kx += 1) {
          const ix = ix0 + kx;
          if (ix < 0 || ix >= ent.ancho) continue;
          const base = (iy * ent.ancho + ix) * c;
          const wt = w[ky * lado + kx];
          for (let k = 0; k < c; k += 1) y[destino + k] += x[base + k] * wt[k];
        }
      }
      for (let k = 0; k < c; k += 1) {
        const s = y[destino + k];
        y[destino + k] = s < bajo ? bajo : s > alto ? alto : s;
      }
    }
    acumulado += porRenglon;
    hecho += porRenglon;
    if (acumulado >= TRABAJO_POR_PASO) {
      acumulado = 0;
      yield hecho;
    }
  }
}

/**
 * El promedio de cada canal sobre toda la imagen.
 *
 * La MobileNet original promedia un cuadro fijo de 7×7, que sólo cuadra con
 * fotos de 224. El promedio global da lo mismo a 224 y además funciona a
 * cualquier tamaño, que es lo que permite correrla más chica en el teléfono.
 */
export function promedioGlobal(mapa: Mapa): Float32Array {
  const salida = new Float32Array(mapa.canales);
  const pixeles = mapa.alto * mapa.ancho;
  for (let p = 0; p < pixeles; p += 1) {
    const base = p * mapa.canales;
    for (let k = 0; k < mapa.canales; k += 1) salida[k] += mapa.datos[base + k];
  }
  for (let k = 0; k < mapa.canales; k += 1) salida[k] /= pixeles;
  return salida;
}
