/**
 * El modelo, corriendo.
 *
 * Esto es todo lo que viaja al teléfono: una tabla de pesos y unas sumas. Sin
 * red, sin servidor, sin llave de API y sin costo por pregunta. Una
 * clasificación son microsegundos.
 *
 * QUÉ ES Y QUÉ NO ES. Es un modelo de verdad — se entrenó con descenso de
 * gradiente sobre ejemplos etiquetados, y acierta 96 de cada 100 preguntas
 * escritas a mano que nunca vio. No es un modelo de lenguaje: no redacta, no
 * razona y no sabe nada del mundo. Lo único que hace es decidir DE QUÉ le
 * están preguntando. Redactar la respuesta es trabajo de `preguntas.ts`, que
 * la arma con datos del expediente — y por eso ninguna respuesta puede
 * inventar un número, que es la propiedad que hace todo esto confiable.
 *
 * Los pesos los produce `entrenamiento/entrenar.ts`. Este archivo no aprende:
 * si hay que enseñarle algo nuevo, se agrega al corpus y se vuelve a entrenar.
 */

import { INTENCIONES } from './intenciones';
import type { Intencion } from './intenciones';
import { vectorizar } from './rasgos';

interface ModeloSerializado {
  version: number;
  entrenadoEn: string;
  clases: string[];
  /** Debajo de esta confianza, mejor decir que no se entendió. */
  umbral: number;
  sesgo: number[];
  rarezaDesconocida: number;
  rareza: Record<string, number>;
  /** Por rasgo, pares planos [clase, peso]. Los pesos nulos no se guardan. */
  pesos: Record<string, number[]>;
}

// `require` y no `import`: con `import` de un JSON, TypeScript se pone a
// inferir el tipo literal de cinco mil llaves y revisar tipos tarda una
// eternidad. La forma ya está declarada arriba, que es lo que importa.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MODELO = require('./modelo.json') as ModeloSerializado;

/**
 * Las clases salen del MODELO, no de la constante de la app.
 *
 * Parece lo mismo y no lo es. Los pesos guardan números de clase; si alguien
 * agrega una intención a `INTENCIONES` y no reentrena, los índices se recorren
 * y el modelo empieza a contestar con la etiqueta de al lado — sin error, sin
 * aviso, con la confianza intacta. Pasó: al abrir seis intenciones nuevas, las
 * pruebas empezaron a ver "tolerancia" donde el modelo decía "desconocida".
 *
 * Leyendo del archivo, un modelo viejo sigue siendo coherente consigo mismo, y
 * la discrepancia se anuncia en vez de esconderse.
 */
const CLASES = MODELO.clases as Intencion[];

if (CLASES.length !== INTENCIONES.length) {
  console.warn(
    `[ia] El modelo se entrenó con ${CLASES.length} intenciones y la app define ` +
      `${INTENCIONES.length}. Corre "npm run entrenar" — hasta entonces, las ` +
      'intenciones nuevas no se van a reconocer.',
  );
}

export interface Lectura {
  intencion: Intencion;
  /** Qué tan seguro está, de 0 a 1. */
  confianza: number;
  /**
   * Si se atreve a contestar sin avisar que duda.
   *
   * El umbral de abstención y éste miden cosas distintas y por eso son dos. El
   * primero decide entre contestar y callarse; éste decide entre contestar a
   * secas y contestar diciendo "creo que me preguntas de X, ¿o era Y?".
   *
   * Hace falta porque con diecisiete intenciones hay una franja ancha donde la
   * ganadora saca 20 % y la segunda 17 %: ahí acertar es una moneda al aire, y
   * lo honesto —y lo más útil— es decirlo y ofrecer la otra opción, en vez de
   * afirmar o de encogerse de hombros.
   */
  segura: boolean;
  /**
   * La segunda opción más probable.
   *
   * Sirve para ofrecer una salida cuando la primera no era: "te contesté del
   * riego, ¿querías saber de la tierra?".
   */
  alternativa: Intencion | null;
}

/**
 * Cuánto de la frase tiene que sonarle al modelo para que se atreva a opinar.
 *
 * Es una salvaguarda aparte del umbral de confianza, y hace falta porque las
 * dos miden cosas distintas. El umbral pregunta "¿qué tan por encima quedó la
 * ganadora?"; esto pregunta "¿entendí siquiera las palabras?".
 *
 * Se vio con "asdkjfh qwerty": ningún rasgo de esa frase existe en el modelo,
 * así que el resultado lo decidía sólo el sesgo de las clases — y el sesgo
 * apuntaba a `estado`, la clase de los saludos. La confianza salía razonable
 * porque el softmax no sabe distinguir "estoy seguro" de "no tengo nada".
 */
const MASA_MINIMA_CONOCIDA = 0.25;

/** Por debajo de esto contesta, pero avisando que no está segura. */
const CONFIANZA_SEGURA = 0.35;

export function clasificar(pregunta: string): Lectura {
  const vector = vectorizar(pregunta, rareza);
  if (vector.length === 0) {
    return { intencion: 'desconocida', confianza: 1, segura: true, alternativa: null };
  }

  const puntos = [...MODELO.sesgo];
  let masaTotal = 0;
  let masaConocida = 0;
  for (const [rasgo, valor] of vector) {
    masaTotal += Math.abs(valor);
    const fila = MODELO.pesos[rasgo];
    if (!fila) continue;
    masaConocida += Math.abs(valor);
    // Pares planos: [clase, peso, clase, peso, ...].
    for (let i = 0; i < fila.length; i += 2) {
      puntos[fila[i]] += fila[i + 1] * valor;
    }
  }

  if (masaTotal > 0 && masaConocida / masaTotal < MASA_MINIMA_CONOCIDA) {
    return { intencion: 'desconocida', confianza: 0, segura: true, alternativa: null };
  }

  const probabilidad = softmax(puntos);
  let mejor = 0;
  let segundo = -1;
  for (let c = 1; c < probabilidad.length; c += 1) {
    if (probabilidad[c] > probabilidad[mejor]) {
      segundo = mejor;
      mejor = c;
    } else if (segundo === -1 || probabilidad[c] > probabilidad[segundo]) {
      segundo = c;
    }
  }

  const confianza = probabilidad[mejor];
  const alternativa =
    segundo >= 0 && CLASES[segundo] !== 'desconocida' ? CLASES[segundo] : null;

  // Preferir callar a acertar de milagro: una respuesta de riego a una
  // pregunta sobre plagas se lee como que la app no entiende nada.
  if (confianza < MODELO.umbral) {
    return { intencion: 'desconocida', confianza, segura: true, alternativa };
  }

  return {
    intencion: CLASES[mejor],
    confianza,
    segura: confianza >= CONFIANZA_SEGURA,
    alternativa,
  };
}

/** Cuándo el modelo dice, con todas sus letras, que no entendió. */
export function noEntendio(lectura: Lectura): boolean {
  return lectura.intencion === 'desconocida';
}

export const MODELO_ENTRENADO_EN = MODELO.entrenadoEn;

// ---------------------------------------------------------------------------

function rareza(rasgo: string): number {
  return MODELO.rareza[rasgo] ?? MODELO.rarezaDesconocida;
}

function softmax(puntos: number[]): number[] {
  let mayor = -Infinity;
  for (const p of puntos) if (p > mayor) mayor = p;
  let suma = 0;
  const salida = puntos.map((p) => {
    const e = Math.exp(p - mayor);
    suma += e;
    return e;
  });
  return salida.map((e) => e / suma);
}
