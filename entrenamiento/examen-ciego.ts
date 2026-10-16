/**
 * El segundo examen. Escrito DESPUÉS de terminar el modelo, y mirado una sola vez.
 *
 * POR QUÉ HACEN FALTA DOS. `prueba.ts` se escribió antes que el corpus, así que
 * empezó siendo un examen limpio. Pero al ver qué fallaba tomé decisiones —
 * agregar vocabulario, pasar las frases a tercera persona, ponderar los rasgos
 * por rareza — y todas esas decisiones las tomé mirando sus errores. Eso lo
 * convirtió en un conjunto de AJUSTE: sigue siendo útil para no romper lo que
 * ya funcionaba, pero su 96 % ya no mide qué tan bien generaliza el modelo,
 * porque el modelo se afinó contra él.
 *
 * Este archivo es el control honesto: frases nuevas, sobre las mismas
 * intenciones, escritas sin volver a tocar el corpus ni los hiperparámetros
 * después de medirlas. La cifra que sale de aquí es la que hay que creer.
 *
 * Si algún día se ajusta el modelo mirando estos errores, este archivo pierde
 * su valor y hay que escribir un tercero. No es burocracia: es la única forma
 * de que "acierta X %" signifique algo.
 */

import type { Intencion } from '../src/ia/intenciones';

export const EXAMEN_CIEGO: Array<[string, Intencion]> = [
  // riego
  ['nose si ya necesita agua', 'riego'],
  ['le doy tantita agua?', 'riego'],
  ['cuanto le sirvo hoy', 'riego'],
  ['mañana la riego mejor?', 'riego'],
  ['se ve seca la tierra, le hecho?', 'riego'],
  ['cuantas veces por semana le toca', 'riego'],

  // sintoma
  ['tiene las hojitas cafes en la orilla', 'sintoma'],
  ['se le ven bichitos blancos', 'sintoma'],
  ['por que se puso asi de fea', 'sintoma'],
  ['esta perdiendo hojas', 'sintoma'],
  ['la veo apachurrada', 'sintoma'],
  ['tiene el tallo blandito', 'sintoma'],

  // luz
  ['le conviene la ventana del norte', 'luz'],
  ['aguanta el sol de mediodia?', 'luz'],
  ['la cambio a un lugar mas claro', 'luz'],
  ['cuanta luz le hace falta', 'luz'],
  ['la dejo en el corredor?', 'luz'],

  // fenologia
  ['cuando le salen capullos', 'fenologia'],
  ['este mes le toca florecer', 'fenologia'],
  ['da fruto en verano?', 'fenologia'],
  ['cuanto falta para que eche flor', 'fenologia'],

  // crecimiento
  ['hasta que tamaño llega', 'crecimiento'],
  ['cuanto sube por año', 'crecimiento'],
  ['va a necesitar mas espacio?', 'crecimiento'],
  ['se queda del mismo porte?', 'crecimiento'],

  // sustrato
  ['la tierra esta muy compacta', 'sustrato'],
  ['le hace falta nutrientes', 'sustrato'],
  ['le cambio a una maceta mas grande', 'sustrato'],
  ['las raices ya no caben', 'sustrato'],
  ['el agua no baja, se queda arriba', 'sustrato'],

  // identidad
  ['de que familia es', 'identidad'],
  ['cuanto tiempo lleva en la casa', 'identidad'],
  ['dime su nombre en latin', 'identidad'],
  ['es una suculenta?', 'identidad'],
  ['en que ciudad esta', 'identidad'],

  // clima
  ['cuanta lluvia cae esta semana', 'clima'],
  ['mañana va a estar frio', 'clima'],
  ['hay pronostico de lluvia', 'clima'],
  ['hoy esta muy caluroso', 'clima'],

  // historial
  ['dime cuando fue el ultimo riego', 'historial'],
  ['cuantos dias llevo sin regarla', 'historial'],
  ['enseñame lo que he anotado', 'historial'],
  ['la regue el fin de semana?', 'historial'],

  // estado
  ['como va todo por alla', 'estado'],
  ['dame el reporte de hoy', 'estado'],
  ['que tal amaneciste', 'estado'],
  ['hola, que hay', 'estado'],

  // desconocida
  ['cuanto mide la torre eiffel', 'desconocida'],
  ['reservame una mesa', 'desconocida'],
  ['cual es tu comida favorita', 'desconocida'],
  ['hazme un resumen del partido', 'desconocida'],
  ['cambia el idioma de la app', 'desconocida'],
  ['cuanto gana un ingeniero', 'desconocida'],

  // --- las seis intenciones que se abrieron después ---
  ['le salieron pulgones, que le echo', 'plaga'],
  ['tiene mosquitas volando en la tierra', 'plaga'],
  ['como le quito esos bichos blancos', 'plaga'],
  ['le corto las ramas secas?', 'poda'],
  ['ya toca podarla', 'poda'],
  ['le quito las flores que ya se marchitaron', 'poda'],
  ['como le saco una plantita', 'propagacion'],
  ['puedo poner un gajo en agua', 'propagacion'],
  ['quiero hacer otra igual', 'propagacion'],
  ['es mala para los gatos?', 'toxicidad'],
  ['si se la come mi perro le pasa algo', 'toxicidad'],
  ['se puede comer?', 'toxicidad'],
  ['aguanta el frio de diciembre?', 'tolerancia'],
  ['cuantos grados soporta', 'tolerancia'],
  ['le afecta el aire seco', 'tolerancia'],
  ['que te puedo preguntar', 'ayuda'],
  ['en que me ayudas', 'ayuda'],
  ['no se que preguntar', 'ayuda'],
];
