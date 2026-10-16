/**
 * El examen que decide. Escrito al final y medido una sola vez.
 *
 * LA HISTORIA, porque explica por qué hay tres archivos de examen:
 *
 *   · `prueba.ts` se escribió antes que el corpus. Empezó limpio, dio 86 %, y
 *     al ver sus errores agregué vocabulario y cambié cómo se ponderan los
 *     rasgos. Esas decisiones lo convirtieron en conjunto de AJUSTE.
 *
 *   · `examen-ciego.ts` se escribió después, sin tocar nada. Dio 79 % — dieciocho
 *     puntos menos que el de ajuste, que es la medida exacta de cuánto me había
 *     engañado. Esa cifra destapó huecos reales (la app no sabía qué es una
 *     suculenta, ni entendía "cámbiala de lugar") y los cerré. Al hacerlo,
 *     también dejó de ser ciego.
 *
 *   · Éste. Frases nuevas, del mismo registro, escritas sin volver a tocar el
 *     corpus ni los hiperparámetros después de medirlas.
 *
 * La regla: si algún día se ajusta el modelo mirando estos errores, este
 * archivo queda quemado y hay que escribir un cuarto. Suena exagerado hasta
 * que uno ve la brecha de dieciocho puntos: sin un conjunto intacto, "acierta
 * 96 %" es una cifra que uno se cuenta a sí mismo.
 */

import type { Intencion } from '../src/ia/intenciones';

export const EXAMEN_FINAL: Array<[string, Intencion]> = [
  // riego
  ['ya le urge o aguanta?', 'riego'],
  ['no la he regado en dias, le doy?', 'riego'],
  ['le pongo su agua o no', 'riego'],
  ['con cuanto queda satisfecha', 'riego'],

  // sintoma
  ['tiene las hojas como quemadas', 'sintoma'],
  ['se ve triste la pobre', 'sintoma'],
  ['le salieron unas bolitas raras', 'sintoma'],
  ['esta perdiendo el verde', 'sintoma'],
  ['se le arrugo todo', 'sintoma'],

  // luz
  ['le da el sol toda la mañana ahi', 'luz'],
  ['la pongo junto al vidrio?', 'luz'],
  ['le falta claridad donde esta', 'luz'],
  ['la reguardo del sol fuerte?', 'luz'],

  // fenologia
  ['en que epoca da flor', 'fenologia'],
  ['va a echar botones?', 'fenologia'],
  ['ya se le fue la flor?', 'fenologia'],

  // crecimiento
  ['que tan frondosa se pone', 'crecimiento'],
  ['cuanto le falta para su tamaño final', 'crecimiento'],
  ['va a estirarse mucho mas?', 'crecimiento'],

  // sustrato
  ['la maceta no tiene hoyos abajo', 'sustrato'],
  ['le falta material para que drene', 'sustrato'],
  ['le echo composta?', 'sustrato'],
  ['la tierra ya se ve acabada', 'sustrato'],

  // identidad
  ['que nombre le puse', 'identidad'],
  ['es cactacea?', 'identidad'],
  ['cuantos meses lleva conmigo', 'identidad'],
  ['dime de que especie es', 'identidad'],

  // clima
  ['van a bajar los grados', 'clima'],
  ['el pronostico dice algo de lluvia', 'clima'],
  ['cuanto sol hizo hoy', 'clima'],
  ['esta semana viene lluviosa?', 'clima'],

  // historial
  ['que dia fue el riego pasado', 'historial'],
  ['hace cuantas semanas le di agua', 'historial'],
  ['abre su bitacora', 'historial'],
  ['ya paso una semana del riego?', 'historial'],

  // estado
  ['como te trato la semana', 'estado'],
  ['ahi vamos?', 'estado'],
  ['buen dia planta', 'estado'],
  ['cuentame como sigues', 'estado'],

  // desconocida
  ['que numero de telefono es el mio', 'desconocida'],
  ['agenda una cita el martes', 'desconocida'],
  ['quien invento el telefono', 'desconocida'],
  ['recomiendame un libro', 'desconocida'],
  ['cuantos kilometros hay a hermosillo', 'desconocida'],
  ['convierte esto a dolares', 'desconocida'],

  // --- las seis intenciones nuevas, otra tanda ---
  ['tiene unos animalitos verdes en los brotes', 'plaga'],
  ['se le llenaron las hojas de telaraña', 'plaga'],
  ['que le pongo contra la cochinilla', 'plaga'],
  ['le tumbo las hojas de abajo?', 'poda'],
  ['en que mes se le hace la poda', 'poda'],
  ['le corto la guia para que engorde', 'poda'],
  ['de donde le corto para sembrar otra', 'propagacion'],
  ['echa raiz en un vaso con agua?', 'propagacion'],
  ['se puede separar la mata', 'propagacion'],
  ['es venenosa si la muerden', 'toxicidad'],
  ['la puedo tener donde anda el perro', 'toxicidad'],
  ['sus hojas son comestibles', 'toxicidad'],
  ['se me hiela si la dejo afuera', 'tolerancia'],
  ['hasta cuantos grados resiste', 'tolerancia'],
  ['necesita que le rocie agua por el ambiente', 'tolerancia'],
  ['que cosas sabes de ella', 'ayuda'],
  ['dame opciones de que preguntarte', 'ayuda'],
];
