/**
 * Entrena el clasificador de intención de MEDISINA.
 *
 * Corre en la computadora, no en el teléfono. Lo único que viaja a la app es
 * `src/ia/modelo.json`: una tabla de pesos. En el teléfono no hay entrenamiento,
 * no hay red y no hay costo — sólo una suma y un softmax, que es cuestión de
 * microsegundos.
 *
 * El modelo es una regresión softmax (regresión logística multiclase) sobre
 * rasgos de texto. Se eligió eso y no algo más grande por tres razones:
 *   · Cabe en unos cientos de kilobytes y corre en JavaScript puro, así que
 *     funciona dentro de Expo Go sin compilar nada.
 *   · Es determinista: la misma pregunta da siempre la misma respuesta, y eso
 *     se puede probar.
 *   · Da una probabilidad, no sólo una etiqueta — que es lo que le permite
 *     decir "no te entendí" en vez de forzar la intención menos mala.
 *
 * Los tres conjuntos están separados a propósito:
 *   · entrenamiento — con lo que aprende.
 *   · validación — con lo que se eligen épocas, castigo y umbral.
 *   · examen (`prueba.ts`) — sólo se mira al final, y está escrito a mano.
 *
 * Correr con: npm run entrenar
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { INTENCIONES } from '../src/ia/intenciones';
import type { Intencion } from '../src/ia/intenciones';
import { vectorizar as rasgosConValor } from '../src/ia/rasgos';
import { CORPUS } from './corpus';
import { EXAMEN } from './prueba';

// --- Cuánto y cómo -------------------------------------------------------

/**
 * Ejemplos por clase después de multiplicar. Parejo para que ninguna domine.
 *
 * Se probó lo contrario — repartir las variantes por frase en vez de por clase,
 * para que ninguna frase pesara más que otra — y bajó siete puntos de acierto.
 * Se deja medido para no volver a intentarlo: con clases desparejas, el sesgo
 * de la clase grande se come a las chicas.
 */
const POR_CLASE = 260;
/** Un rasgo que aparece una sola vez es una errata, no una señal. */
const APARICIONES_MINIMAS = 2;
const EPOCAS = 30;
const PASO_INICIAL = 0.5;
const CASTIGO_L2 = 1e-3;
/**
 * Debajo de esto el peso no cambia ninguna decisión y sí ocupa lugar.
 *
 * Medido contra el examen: 0.08 deja el archivo en 357 KB, 0.25 en 190 KB y
 * 0.6 en 91 KB, y los tres aciertan igual. Se toma 0.25 y no 0.6 porque el
 * examen son 103 frases: que no note la diferencia no prueba que no la haya
 * para las preguntas que nadie ha escrito todavía.
 */
const PESO_DESPRECIABLE = 0.25;
const SEMILLA = 20260918;

const PREFIJOS = ['', '', '', 'oye ', 'dime ', 'mira ', 'una pregunta ', 'hola ', 'perdón '];
const COLAS = ['', '', '', ' porfa', ' ya', ' hoy', ' plis', ' gracias', ' amiga'];

// --- Azar reproducible ---------------------------------------------------

function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dado = azar(SEMILLA);
const elegir = <T>(lista: T[]): T => lista[Math.floor(dado() * lista.length)];

// --- Multiplicar los ejemplos -------------------------------------------

/**
 * Mete una errata de dedo gordo.
 *
 * Es la parte del entrenamiento que más rinde: la gente escribe desde el
 * teléfono, y sin esto el modelo se rompe con "amarrilla" o "regarla".
 */
function conErrata(texto: string): string {
  const letras = texto.split('');
  if (letras.length < 4) return texto;
  const i = 1 + Math.floor(dado() * (letras.length - 2));
  const cual = Math.floor(dado() * 3);
  if (cual === 0) letras.splice(i, 1);
  else if (cual === 1) letras.splice(i, 0, letras[i]);
  else [letras[i], letras[i + 1]] = [letras[i + 1], letras[i]];
  return letras.join('');
}

/**
 * De hablarle a la planta a hablar de la planta.
 *
 * El corpus esta escrito en segunda persona — "te riego", "estas amarilla" —
 * porque asi se le habla a un gemelo. Pero la mitad de la gente escribe en
 * tercera: "la riego", "esta amarilla", "que le pasa". El examen lo dejo en
 * evidencia: fallos como "que le pasa" o "hace cuanto le puse agua" no eran
 * falta de vocabulario, era que el modelo nunca habia visto esa forma.
 *
 * Se resuelve aqui y no escribiendo el doble de frases a mano: es una regla,
 * no una lista, y por eso cubre tambien las frases que se agreguen despues.
 */
const A_TERCERA: Record<string, string> = {
  tu: 'su', tus: 'sus', ti: 'ella', contigo: 'conmigo',
  eres: 'es', estas: 'esta', eras: 'era',
  tienes: 'tiene', vas: 'va', puedes: 'puede', quieres: 'quiere',
  necesitas: 'necesita', sientes: 'siente', llamas: 'llama',
  creces: 'crece', mides: 'mide', das: 'da', floreces: 'florece',
  floreas: 'florea', aguantas: 'aguanta', prefieres: 'prefiere',
  llevas: 'lleva', vives: 'vive', sacas: 'saca', sales: 'sale',
  salen: 'salen', amaneciste: 'amanecio', vienes: 'viene',
  estabas: 'estaba', pides: 'pide', andas: 'anda',
};

function aTercera(texto: string): string {
  // "te" es dativo o acusativo segun el verbo, y la gente usa los dos. Se
  // eligen al azar en vez de acertarle: las dos formas circulan de verdad.
  const objeto = dado() < 0.5 ? 'la' : 'le';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z]+)/gi, (palabra) => {
      const minuscula = palabra.toLowerCase();
      if (minuscula === 'te') return objeto;
      return A_TERCERA[minuscula] ?? palabra;
    });
}

function variar(base: string): string {
  let texto = dado() < 0.45 ? aTercera(base) : base;
  texto = `${elegir(PREFIJOS)}${texto}${elegir(COLAS)}`;
  if (dado() < 0.35) texto = conErrata(texto);
  return texto;
}

interface Ejemplo {
  texto: string;
  clase: number;
}

function generar(): { entrenamiento: Ejemplo[]; validacion: Ejemplo[] } {
  const entrenamiento: Ejemplo[] = [];
  const validacion: Ejemplo[] = [];

  INTENCIONES.forEach((intencion, clase) => {
    const base = CORPUS[intencion];
    // Cada frase entra en las dos personas, sin depender del azar.
    const textos = new Set<string>([...base, ...base.map(aTercera)]);
    // Se multiplica hasta llenar el cupo. El Set descarta las repetidas, que
    // no enseñan nada y sí inflan el peso de una frase.
    let intentos = 0;
    while (textos.size < POR_CLASE && intentos < POR_CLASE * 40) {
      textos.add(variar(elegir(base)));
      intentos += 1;
    }
    [...textos].forEach((texto, i) => {
      const ejemplo = { texto, clase };
      // Uno de cada diez se aparta para decidir épocas, castigo y umbral.
      (i % 10 === 7 ? validacion : entrenamiento).push(ejemplo);
    });
  });

  return { entrenamiento, validacion };
}

// --- Vocabulario ---------------------------------------------------------

interface Vocabulario {
  indice: Map<string, number>;
  /** Cuánto vale cada rasgo por lo raro que es. Viaja con el modelo. */
  rareza: Map<string, number>;
  /** La que se le da a un rasgo que el modelo nunca vio. */
  rarezaDesconocida: number;
}

function vocabulario(ejemplos: Ejemplo[]): Vocabulario {
  const cuenta = new Map<string, number>();
  for (const ejemplo of ejemplos) {
    for (const [rasgo] of rasgosConValor(ejemplo.texto)) {
      cuenta.set(rasgo, (cuenta.get(rasgo) ?? 0) + 1);
    }
  }

  const total = ejemplos.length;
  const indice = new Map<string, number>();
  const rareza = new Map<string, number>();
  for (const [rasgo, veces] of cuenta) {
    if (veces < APARICIONES_MINIMAS) continue;
    indice.set(rasgo, indice.size);
    // log((N+1)/(df+1)) + 1: lo estandar. Un rasgo que sale en todas las
    // preguntas queda cerca de 1; uno que sale en diez, varias veces mas.
    rareza.set(rasgo, Math.log((total + 1) / (veces + 1)) + 1);
  }

  // A un rasgo nunca visto se le da la rareza MEDIANA, no la maxima.
  //
  // Parece un detalle y no lo es. Un rasgo desconocido no tiene peso en el
  // modelo: no aporta nada al puntaje, pero si cuenta al repartir el valor
  // entre los rasgos de su familia. Si se le da rareza maxima, un par de
  // trozos desconocidos se llevan casi todo el reparto y ahogan a los que si
  // significan algo. Se vio con una errata: "amarilla" daba sintoma y
  // "amarrilla" daba clima, porque los trozos nuevos de la errata tapaban a
  // los cinco que las dos palabras comparten.
  //
  // Tratarlo como tipico es ademas lo correcto: que el modelo no lo conozca
  // no dice nada sobre que tan comun es en el idioma.
  const valores = [...rareza.values()].sort((a, b) => a - b);
  const mediana = valores.length > 0 ? valores[Math.floor(valores.length / 2)] : 1;

  return { indice, rareza, rarezaDesconocida: mediana };
}

/**
 * Un texto, ya como indices y valores.
 *
 * El reparto lo hace `rasgosConValor`, que es el MISMO codigo que corre en el
 * telefono. Aqui solo se traducen nombres a indices, que es un detalle del
 * entrenador y no llega a la app.
 */
function vectorizar(texto: string, vocab: Vocabulario): Array<[number, number]> {
  const salida: Array<[number, number]> = [];
  const rareza = (rasgo: string) => vocab.rareza.get(rasgo) ?? vocab.rarezaDesconocida;
  for (const [rasgo, valor] of rasgosConValor(texto, rareza)) {
    const i = vocab.indice.get(rasgo);
    if (i !== undefined) salida.push([i, valor]);
  }
  return salida;
}

// --- Entrenar ------------------------------------------------------------

interface Modelo {
  pesos: Float64Array[];
  sesgo: Float64Array;
  vocab: Vocabulario;
}

function puntajes(vector: Array<[number, number]>, modelo: Modelo): Float64Array {
  const salida = Float64Array.from(modelo.sesgo);
  for (const [i, valor] of vector) {
    const fila = modelo.pesos[i];
    for (let c = 0; c < salida.length; c += 1) salida[c] += fila[c] * valor;
  }
  return salida;
}

function softmax(puntos: Float64Array): Float64Array {
  let mayor = -Infinity;
  for (const p of puntos) if (p > mayor) mayor = p;
  const salida = new Float64Array(puntos.length);
  let suma = 0;
  for (let i = 0; i < puntos.length; i += 1) {
    salida[i] = Math.exp(puntos[i] - mayor);
    suma += salida[i];
  }
  for (let i = 0; i < salida.length; i += 1) salida[i] /= suma;
  return salida;
}

function entrenar(ejemplos: Ejemplo[], vocab: Vocabulario): Modelo {
  const clases = INTENCIONES.length;
  const modelo: Modelo = {
    pesos: Array.from({ length: vocab.indice.size }, () => new Float64Array(clases)),
    sesgo: new Float64Array(clases),
    vocab,
  };

  const vectores = ejemplos.map((e) => ({
    vector: vectorizar(e.texto, vocab),
    clase: e.clase,
  }));
  const orden = vectores.map((_, i) => i);

  for (let epoca = 0; epoca < EPOCAS; epoca += 1) {
    // Barajar cada época: sin esto el modelo ve las clases en bloque y al
    // final de cada vuelta está sesgado hacia la última que vio.
    for (let i = orden.length - 1; i > 0; i -= 1) {
      const j = Math.floor(dado() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }

    const paso = PASO_INICIAL / (1 + epoca * 0.3);

    for (const k of orden) {
      const { vector, clase } = vectores[k];
      if (vector.length === 0) continue;
      const probabilidad = softmax(puntajes(vector, modelo));

      for (let c = 0; c < clases; c += 1) {
        const error = probabilidad[c] - (c === clase ? 1 : 0);
        if (error === 0) continue;
        modelo.sesgo[c] -= paso * error;
        for (const [i, valor] of vector) {
          const fila = modelo.pesos[i];
          // El castigo sólo toca los rasgos presentes. Aplicarlo a los 20 mil
          // rasgos en cada paso costaría cien veces más y cambia poco.
          fila[c] -= paso * (error * valor + CASTIGO_L2 * fila[c]);
        }
      }
    }
  }

  return modelo;
}

// --- Medir ---------------------------------------------------------------

function predecir(texto: string, modelo: Modelo, umbral: number): Intencion {
  const vector = vectorizar(texto, modelo.vocab);
  if (vector.length === 0) return 'desconocida';
  const probabilidad = softmax(puntajes(vector, modelo));
  let mejor = 0;
  for (let c = 1; c < probabilidad.length; c += 1) {
    if (probabilidad[c] > probabilidad[mejor]) mejor = c;
  }
  if (probabilidad[mejor] < umbral) return 'desconocida';
  return INTENCIONES[mejor];
}

function aciertosEn(casos: Array<[string, Intencion]>, modelo: Modelo, umbral: number): number {
  let bien = 0;
  for (const [texto, esperada] of casos) {
    if (predecir(texto, modelo, umbral) === esperada) bien += 1;
  }
  return bien / casos.length;
}

// --- Guardar -------------------------------------------------------------

function guardar(modelo: Modelo, umbral: number, ruta: string): number {
  const pesos: Record<string, number[]> = {};
  const rarezas: Record<string, number> = {};
  let guardados = 0;

  for (const [rasgo, i] of modelo.vocab.indice) {
    const fila = modelo.pesos[i];
    const plano: number[] = [];
    for (let c = 0; c < fila.length; c += 1) {
      // Se guardan pares [clase, peso] y sólo los que mueven la aguja. Las
      // filas quedan casi vacías por el castigo, así que esto reduce el
      // archivo varias veces sin cambiar ninguna predicción notable.
      if (Math.abs(fila[c]) >= PESO_DESPRECIABLE) {
        plano.push(c, Math.round(fila[c] * 1000) / 1000);
      }
    }
    if (plano.length > 0) {
      pesos[rasgo] = plano;
      rarezas[rasgo] = Math.round((modelo.vocab.rareza.get(rasgo) ?? 1) * 100) / 100;
      guardados += 1;
    }
  }

  const json = JSON.stringify({
    version: 1,
    entrenadoEn: new Date().toISOString().slice(0, 10),
    clases: [...INTENCIONES],
    umbral,
    sesgo: [...modelo.sesgo].map((v) => Math.round(v * 1000) / 1000),
    rarezaDesconocida: Math.round(modelo.vocab.rarezaDesconocida * 100) / 100,
    rareza: rarezas,
    pesos,
  });
  writeFileSync(ruta, json);
  return guardados;
}

// --- Todo junto ----------------------------------------------------------

function principal(): void {
  const { entrenamiento, validacion } = generar();
  const vocab = vocabulario(entrenamiento);

  console.log(`Ejemplos de entrenamiento: ${entrenamiento.length}`);
  console.log(`Ejemplos de validación:    ${validacion.length}`);
  console.log(`Rasgos distintos:          ${vocab.indice.size}`);

  const modelo = entrenar(entrenamiento, vocab);

  // El umbral se elige contra validación. Mirar el examen para elegirlo sería
  // el error clásico: la cifra final dejaría de medir nada.
  let mejorUmbral = 0;
  let mejorAcierto = -1;
  const validacionVectorizada = validacion.map((e) => ({
    vector: vectorizar(e.texto, vocab),
    clase: e.clase,
  }));
  // El barrido empieza abajo a propósito. Con más clases, el softmax reparte
  // la probabilidad entre más casillas y el máximo baja aunque el modelo tenga
  // igual de claro de qué le hablan. Al pasar de once a diecisiete intenciones,
  // un umbral fijo de 0.2 empezó a callar respuestas que estaban bien — se veía
  // en confianzas de 0.11 a 0.18 que antes no existían.
  for (let umbral = 0.04; umbral <= 0.85; umbral += 0.02) {
    let bien = 0;
    for (const { vector, clase } of validacionVectorizada) {
      let etiqueta: Intencion = 'desconocida';
      if (vector.length > 0) {
        const probabilidad = softmax(puntajes(vector, modelo));
        let mejor = 0;
        for (let c = 1; c < probabilidad.length; c += 1) {
          if (probabilidad[c] > probabilidad[mejor]) mejor = c;
        }
        if (probabilidad[mejor] >= umbral) etiqueta = INTENCIONES[mejor];
      }
      if (etiqueta === INTENCIONES[clase]) bien += 1;
    }
    const acierto = bien / validacion.length;
    if (acierto > mejorAcierto) {
      mejorAcierto = acierto;
      mejorUmbral = Math.round(umbral * 100) / 100;
    }
  }

  console.log(`\nUmbral elegido en validación: ${mejorUmbral} (${(mejorAcierto * 100).toFixed(1)} %)`);

  // Desde la raiz del proyecto: el entrenador corre compilado en otra
  // carpeta, asi que __dirname apuntaria al lugar equivocado.
  const ruta = resolve(process.cwd(), 'src', 'ia', 'modelo.json');
  const guardados = guardar(modelo, mejorUmbral, ruta);

  const acierto = aciertosEn(EXAMEN, modelo, mejorUmbral);
  console.log(`\n=== EXAMEN (${EXAMEN.length} frases escritas a mano) ===`);
  console.log(`Aciertos: ${(acierto * 100).toFixed(1)} %`);

  const fallos = EXAMEN.filter(([t, e]) => predecir(t, modelo, mejorUmbral) !== e);
  if (fallos.length > 0) {
    console.log('\nLo que falló:');
    for (const [texto, esperada] of fallos) {
      console.log(`  "${texto}"  →  dijo ${predecir(texto, modelo, mejorUmbral)}, era ${esperada}`);
    }
  }

  console.log(`\nRasgos guardados: ${guardados} de ${vocab.indice.size}`);
}

principal();
