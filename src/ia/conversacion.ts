/**
 * Leer una pregunta dentro de una conversación, no suelta.
 *
 * El clasificador mira una frase y dice de qué trata. Eso basta para la primera
 * pregunta y se queda corto para la segunda, que es donde la gente habla como
 * habla: "¿cuándo la riego?" … "¿y de sol?". Esa segunda frase no tiene
 * suficiente para clasificarse sola, y el modelo contestaba "no entendí" — que
 * es justo el momento en que uno decide que la app es tonta.
 *
 * Aquí se resuelven dos cosas que el modelo no puede ver por sí mismo:
 *
 *   1. LA ELIPSIS. "¿y de sol?" es "¿y qué tal de sol?" con la mitad implícita.
 *      Se le quita la "y", se reclasifica, y si aun así no alcanza, se hereda el
 *      tema de la pregunta anterior.
 *
 *   2. LA PREGUNTA DOBLE. "¿la riego y la podo?" son dos preguntas en una. Se
 *      parte por las conjunciones, se clasifica cada mitad, y si salen dos temas
 *      distintos y seguros, se contestan los dos. Contestar sólo la primera deja
 *      a la persona repitiendo la segunda.
 *
 * Nada de esto es el modelo: son reglas sobre su salida. La diferencia importa
 * al depurar — si una lectura sale rara, aquí se ve por qué.
 */

import { clasificar } from './clasificador';
import type { Lectura } from './clasificador';
import type { Intencion } from './intenciones';

/** Por dónde se parte una pregunta que trae dos temas. */
const CONJUNCIONES = /\s+y\s+|\s*,\s*|\s+tambi[ée]n\s+|\s+adem[áa]s\s+|\s*;\s*/i;

/** Arranques que anuncian que se sigue hablando de lo mismo. */
const SEGUIMIENTO = /^\s*[¿¡]?\s*(y|pero|entonces|ok|vale|ah)\b[\s,]*/i;

/** Frases que no dicen de qué hablan porque se apoyan en lo anterior. */
const APOYADAS = /^\s*[¿¡]?\s*(y eso|y por qu[ée]|por qu[ée]|c[óo]mo as[íi]|de verdad|en serio|ah s[íi]|y qu[ée]|y ahora)\s*[?!]?\s*$/i;

export interface LecturaConversacion {
  principal: Lectura;
  /** El segundo tema, cuando la pregunta traía dos. */
  secundaria: Lectura | null;
  /** Se resolvió heredando el tema de la pregunta anterior. */
  heredada: boolean;
}

export interface OpcionesLectura {
  /** Intenciones de los turnos anteriores, del más viejo al más reciente. */
  previas?: Intencion[];
}

// ---------------------------------------------------------------------------

export function leerPregunta(
  texto: string,
  { previas = [] }: OpcionesLectura = {},
): LecturaConversacion {
  const directa = clasificar(texto);
  const anterior = previas[previas.length - 1];

  // 1. Frases que NO LLEVAN TEMA, y se comprueba antes que nada.
  //
  //    "¿y eso?" no habla de nada por sí sola. El clasificador, que siempre
  //    devuelve la clase menos mala, le encontraba parecido con historial y lo
  //    daba por seguro — una respuesta con aplomo a una frase vacía. Aquí se
  //    corta: con conversación detrás se hereda el tema; sin ella, se admite
  //    que no hay de qué hablar.
  if (APOYADAS.test(texto)) {
    if (anterior && anterior !== 'desconocida') {
      return {
        principal: { ...directa, intencion: anterior, segura: false },
        secundaria: null,
        heredada: true,
      };
    }
    return {
      principal: { intencion: 'desconocida', confianza: 0, segura: true, alternativa: null },
      secundaria: null,
      heredada: false,
    };
  }

  // 2. ¿Trae dos temas? Sólo se parte si el texto de verdad tiene una
  //    conjunción; partir por comas frases de una sola idea produce mitades sin
  //    sentido que clasifican cualquier cosa.
  const doble = buscarSegundoTema(texto, directa);
  if (doble) return { principal: directa, secundaria: doble, heredada: false };

  if (directa.intencion !== 'desconocida' && directa.segura) {
    return { principal: directa, secundaria: null, heredada: false };
  }

  // 3. ¿Es un seguimiento? Se prueba sin el arranque ("y", "pero", "entonces"),
  //    que no aporta tema y sí confunde al clasificador.
  const sinArranque = texto.replace(SEGUIMIENTO, '').trim();
  if (sinArranque.length >= 3 && sinArranque !== texto.trim()) {
    const reintento = clasificar(sinArranque);
    if (reintento.intencion !== 'desconocida' && reintento.confianza > directa.confianza) {
      return { principal: reintento, secundaria: null, heredada: false };
    }
  }

  // 4. Último recurso: heredar. Sólo si la frase empieza como seguimiento — no
  //    para cualquier cosa que no se entendió, o la app acabaría contestando
  //    del riego a "cuál es la capital de Francia".
  if (anterior && anterior !== 'desconocida' && SEGUIMIENTO.test(texto)) {
    return {
      principal: { ...directa, intencion: anterior, segura: false },
      secundaria: null,
      heredada: true,
    };
  }

  return { principal: directa, secundaria: null, heredada: false };
}

/**
 * El segundo tema de una pregunta doble, si lo hay.
 *
 * Se exige que las dos mitades sean seguras y distintas. Con una mitad dudosa,
 * contestar dos cosas duplica la probabilidad de equivocarse — y una respuesta
 * doble equivocada se lee mucho peor que una sencilla.
 */
function buscarSegundoTema(texto: string, directa: Lectura): Lectura | null {
  if (!CONJUNCIONES.test(texto)) return null;

  const partes = texto
    .split(CONJUNCIONES)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);
  if (partes.length < 2) return null;

  const lecturas = partes.map((p) => clasificar(p)).filter((l) => l.segura && l.intencion !== 'desconocida');

  const distintas: Lectura[] = [];
  for (const lectura of lecturas) {
    if (!distintas.some((d) => d.intencion === lectura.intencion)) distintas.push(lectura);
  }
  if (distintas.length < 2) return null;

  // La principal ya es una de las dos si la lectura directa acertó; si no, se
  // toman las dos primeras y la segunda es la que devuelve esta función.
  const segunda = distintas.find((d) => d.intencion !== directa.intencion);
  return segunda ?? null;
}
