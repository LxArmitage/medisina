/**
 * El examen del modelo. Escrito ANTES que el corpus de entrenamiento.
 *
 * Ese orden no es un detalle: si escribiera primero las plantillas de
 * entrenamiento y luego el examen, acabaría midiendo qué tan bien el modelo
 * reconoce mis propias plantillas, que es una cifra bonita y vacía. Estas
 * frases están escritas como escribe la gente en México con el pulgar — sin
 * acentos, con erratas, con "le echo agua" en vez de "regar" — y ninguna se
 * copió al corpus.
 *
 * Los casos difíciles están a propósito:
 *   · "cuando la regue" (pasado, es historial) contra "cuando la riego"
 *     (futuro, es riego). Cambia una letra.
 *   · "hace mucho calor" es clima, no es que la planta se vea mal.
 *   · "la tierra esta buena" es sustrato aunque empiece como un saludo.
 */

import type { Intencion } from '../src/ia/intenciones';

export const EXAMEN: Array<[string, Intencion]> = [
  // --- riego ---
  ['¿le echo agua?', 'riego'],
  ['cada cuando la riego', 'riego'],
  ['ya toca regarla?', 'riego'],
  ['necesita agua', 'riego'],
  ['cuanta agua le pongo', 'riego'],
  ['la riego hoy o mañana', 'riego'],
  ['se me olvido regarla, se la doy?', 'riego'],
  ['tiene sed?', 'riego'],
  ['esta seca, le hecho agua?', 'riego'],
  ['cuantos mililitros le toca', 'riego'],
  ['la puedo regar ahorita', 'riego'],
  ['le hace falta agua verdad', 'riego'],

  // --- sintoma ---
  ['se me esta poniendo fea', 'sintoma'],
  ['por que tiene las hojas cafes', 'sintoma'],
  ['se ve triste', 'sintoma'],
  ['tiene manchitas en las hojas', 'sintoma'],
  ['se le estan cayendo las hojas', 'sintoma'],
  ['que le pasa?', 'sintoma'],
  ['esta marchita', 'sintoma'],
  ['se ve medio mustia', 'sintoma'],
  ['tiene las puntas secas', 'sintoma'],
  ['por que se ve asi de mal', 'sintoma'],
  ['esta amarillenta', 'sintoma'],
  ['creo que se esta muriendo', 'sintoma'],

  // --- luz ---
  ['la dejo en la ventana?', 'luz'],
  ['le pega mucho el sol', 'luz'],
  ['donde la pongo', 'luz'],
  ['necesita mas luz', 'luz'],
  ['aqui esta muy oscuro para ella', 'luz'],
  ['la saco al patio?', 'luz'],
  ['le hace daño el sol directo', 'luz'],
  ['la muevo a la sombra', 'luz'],
  ['aguanta estar adentro', 'luz'],
  ['cuantas horas de sol necesita', 'luz'],

  // --- fenologia ---
  ['ya va a dar flores?', 'fenologia'],
  ['cuando echa fruta', 'fenologia'],
  ['en que mes florea', 'fenologia'],
  ['va a sacar brotes pronto', 'fenologia'],
  ['ya mero florece', 'fenologia'],
  ['cuanto falta para las flores', 'fenologia'],
  ['esta en temporada de flor', 'fenologia'],
  ['este año si va a florear', 'fenologia'],

  // --- crecimiento ---
  ['que tanto va a crecer', 'crecimiento'],
  ['hasta que altura llega', 'crecimiento'],
  ['se hace muy grande?', 'crecimiento'],
  ['va a crecer mas', 'crecimiento'],
  ['en cuanto tiempo se hace grande', 'crecimiento'],
  ['cuantos centimetros crece al año', 'crecimiento'],
  ['se va a quedar asi de chiquita', 'crecimiento'],
  ['que tan alta se pone', 'crecimiento'],

  // --- sustrato ---
  ['la tierra esta buena?', 'sustrato'],
  ['le cambio la maceta', 'sustrato'],
  ['necesita trasplante', 'sustrato'],
  ['le pongo abono', 'sustrato'],
  ['la maceta le queda chica', 'sustrato'],
  ['el drenaje si sirve', 'sustrato'],
  ['como esta el sustrato', 'sustrato'],
  ['le falta fertilizante', 'sustrato'],
  ['la tierra se ve apelmazada', 'sustrato'],
  ['tiene bien las raices', 'sustrato'],

  // --- identidad ---
  ['como te llamas', 'identidad'],
  ['que planta eres', 'identidad'],
  ['cuantos años tienes', 'identidad'],
  ['cual es tu nombre cientifico', 'identidad'],
  ['que especie es esta', 'identidad'],
  ['cuanto tiempo llevas conmigo', 'identidad'],
  ['como se llama esta planta', 'identidad'],
  ['de donde eres originaria', 'identidad'],
  ['que edad tienes', 'identidad'],

  // --- clima ---
  ['va a llover?', 'clima'],
  ['hace mucho calor hoy', 'clima'],
  ['que temperatura hay', 'clima'],
  ['va a hacer frio', 'clima'],
  ['como esta el clima', 'clima'],
  ['llueve mañana?', 'clima'],
  ['cuantos grados hay afuera', 'clima'],
  ['esta lloviendo alla?', 'clima'],

  // --- historial ---
  ['cuando la regue por ultima vez', 'historial'],
  ['hace cuanto le puse agua', 'historial'],
  ['cuando fue el ultimo riego', 'historial'],
  ['ya paso mucho desde que la regue', 'historial'],
  ['cuantos dias lleva sin que la riegue', 'historial'],
  ['que le he hecho estos dias', 'historial'],
  ['hace cuantos dias fue', 'historial'],

  // --- estado ---
  ['como estas', 'estado'],
  ['todo bien?', 'estado'],
  ['que tal te sientes', 'estado'],
  ['estas bien amiga', 'estado'],
  ['hola', 'estado'],
  ['que onda', 'estado'],
  ['como te va', 'estado'],
  ['buenos dias', 'estado'],

  // --- desconocida ---
  ['cual es la capital de francia', 'desconocida'],
  ['cuanto cuesta un iphone', 'desconocida'],
  ['quien gano el partido', 'desconocida'],
  ['ponme musica', 'desconocida'],
  ['que hora es', 'desconocida'],
  ['cuanto es dos mas dos', 'desconocida'],
  ['como hago un pastel', 'desconocida'],
  ['dime un chiste', 'desconocida'],
  ['que significa mi sueño de anoche', 'desconocida'],
  ['mandale un mensaje a german', 'desconocida'],
  ['cual es el mejor equipo de futbol', 'desconocida'],
];
