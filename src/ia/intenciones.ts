/**
 * De qué se le puede preguntar a una planta.
 *
 * La regla para que una intención exista: tiene que haber en el expediente un
 * dato con el que contestarla. Si no hay dato, la intención sobra — sería
 * enseñarle al modelo a reconocer una pregunta que después no se puede
 * responder sin inventar, que es exactamente lo que esta app no hace.
 *
 * Empezaron siendo once y el resultado fue que el asistente contestaba "de eso
 * no sé" a la mayoría. El arreglo no fue entrenar más: fue darle más datos
 * ciertos (ver `conocimiento.ts`) y, ya con ellos, abrir las intenciones que
 * esos datos permiten responder — toxicidad, esquejes, poda, plagas, frío.
 *
 * `desconocida` es una clase más, no un descarte. Se entrena con preguntas que
 * de verdad le hace la gente a una app y que ésta no puede contestar, para que
 * el modelo aprenda a decir que no sabe en vez de forzar la más parecida.
 */

export const INTENCIONES = [
  'riego',
  'sintoma',
  'plaga',
  'luz',
  'fenologia',
  'crecimiento',
  'sustrato',
  'poda',
  'propagacion',
  'toxicidad',
  'tolerancia',
  'identidad',
  'clima',
  'historial',
  'estado',
  'ayuda',
  'desconocida',
] as const;

export type Intencion = (typeof INTENCIONES)[number];

/** Cómo se le nombra a cada intención cuando hay que mostrarla. */
export const NOMBRE_INTENCION: Record<Intencion, string> = {
  riego: 'riego',
  sintoma: 'cómo se ve',
  plaga: 'plagas',
  luz: 'luz y ubicación',
  fenologia: 'flores y temporada',
  crecimiento: 'cuánto va a crecer',
  sustrato: 'tierra y maceta',
  poda: 'poda',
  propagacion: 'esquejes y reproducción',
  toxicidad: 'si es tóxica',
  tolerancia: 'frío, calor y humedad',
  identidad: 'quién es',
  clima: 'el clima',
  historial: 'su historial',
  estado: 'cómo está',
  ayuda: 'qué te puedo preguntar',
  desconocida: 'no lo sé',
};
