/**
 * De cuál planta está hablando la persona.
 *
 * "¿La sina aguanta el frío?", "¿cuándo riego el helecho?", "¿y la lengua de
 * suegra?". Antes el asistente no buscaba el nombre en la frase y contestaba
 * "eso depende de cuál, ábreme la ficha" — a una pregunta que ya decía cuál.
 * Eso es lo que más lo hacía sentir un chatbot.
 *
 * Se reconoce por apodo ("Helecho Rulo" con decir "helecho" o "rulo"), por
 * nombre común de la especie ("lengua de suegra", "potos") y por nombre
 * científico. Y si la pregunta no nombra a nadie pero habla de "ella", "la
 * otra" o empieza con "¿y…?", se entiende que sigue siendo la de antes.
 */

import { normalizar } from './saber';

export interface Nombrable {
  id: string;
  apodo: string;
  especie: { nombresComunes: string[]; nombreCientifico: string };
}

/** Palabras que no identifican a nadie aunque estén en un apodo. */
const GENERICAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'mi', 'mis', 'don', 'dona', 'planta', 'maceta', 'patio', 'sala', 'grande', 'chica', 'chiquita', 'nueva']);

function palabras(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p.length >= 3 && !GENERICAS.has(p));
}

/** Coincidencia tolerante a plural y diminutivo: "helechos", "sinita". */
function parecida(a: string, b: string): boolean {
  if (a === b) return true;
  const corta = a.length <= b.length ? a : b;
  const larga = a.length <= b.length ? b : a;
  return corta.length >= 4 && larga.startsWith(corta.slice(0, Math.max(4, corta.length - 1)));
}

/**
 * Las plantas que menciona la pregunta, de la más clara a la menos. Una frase
 * completa ("lengua de suegra") pesa más que una palabra suelta.
 */
export function plantasMencionadas<T extends Nombrable>(pregunta: string, plantas: T[]): T[] {
  const texto = ` ${normalizar(pregunta)} `;
  const enPregunta = palabras(pregunta);
  const puntajes: Array<{ planta: T; puntaje: number }> = [];

  for (const planta of plantas) {
    let puntaje = 0;
    // Apodo completo o nombre común completo, dentro de la frase: lo más claro.
    for (const nombre of [planta.apodo, ...planta.especie.nombresComunes, planta.especie.nombreCientifico]) {
      const n = normalizar(nombre).replace(/^(el|la|los|las|mi) /, '');
      if (n.length >= 3 && texto.includes(` ${n} `)) puntaje = Math.max(puntaje, 3 + n.split(' ').length);
    }
    // Si no, palabras sueltas del apodo o del nombre común.
    if (puntaje === 0) {
      const delApodo = palabras(planta.apodo);
      const delNombre = planta.especie.nombresComunes.flatMap(palabras);
      if (delApodo.some((a) => enPregunta.some((q) => parecida(a, q)))) puntaje = 2;
      else if (delNombre.some((a) => enPregunta.some((q) => parecida(a, q)))) puntaje = 1;
    }
    if (puntaje > 0) puntajes.push({ planta, puntaje });
  }

  if (puntajes.length === 0) return [];
  const mejor = Math.max(...puntajes.map((p) => p.puntaje));
  // Si una se nombró con todas sus letras, las que sólo comparten una palabra
  // suelta no cuentan ("la lengua de suegra" no menciona a "La Lengua de vaca").
  return puntajes
    .filter((p) => p.puntaje >= Math.min(mejor, 3) || mejor < 3)
    .sort((a, b) => b.puntaje - a.puntaje)
    .map((p) => p.planta);
}

/** "¿y ella?", "¿y la otra?", "¿la riego?": sigue hablando de la de antes. */
export function sigueConLaDeAntes(pregunta: string): boolean {
  const t = normalizar(pregunta);
  return /^(y|entonces|oye y)\b/.test(t) || /\b(ella|esa|esta|la misma|tambien)\b/.test(t) || /\b(la|le|lo)\s+(riego|podo|muevo|cambio|abono|trasplanto|pongo|saco)\b/.test(t);
}
