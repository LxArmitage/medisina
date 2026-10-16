/**
 * Cómo aparecen y se van los mensajes: avisos, globos del chat y tarjetas.
 *
 * Todos siguen las mismas reglas, por eso viven juntos:
 *
 * - NADA APARECE DE LA NADA. Se entra desde 0.94–0.96 de tamaño y transparente,
 *   nunca desde escala cero: un mensaje que crece desde un punto se lee como
 *   una explosión, no como algo que llega.
 * - SE VA POR DONDE LLEGÓ, Y MÁS RÁPIDO. Quien ya lo leyó no necesita verlo
 *   irse con calma: la salida dura ~20 % menos que la entrada.
 * - SIN REBOTE. Rebotar se gana con un dedo que avienta algo; un mensaje que
 *   llega solo se asienta, con ease-out fuerte (arranca rápido, frena suave).
 * - NUNCA MÁS DE 300 MS. Un aviso no lo pidió nadie: tiene que ser más rápido
 *   y más callado que lo que sí se pidió.
 *
 * LA ENTRADA ES UN VALOR ANIMADO, NO UN `entering`. Los `Keyframe` de
 * Reanimated se ven bien en el teléfono, pero en el navegador (4.5) se borran a
 * los pocos segundos aunque no hayan arrancado —pasa con la pestaña en segundo
 * plano— y dejan el mensaje invisible para siempre, además de sacarlo del flujo
 * de la página. Un valor que va de 0 a 1 al montarse hace lo mismo en los dos
 * lados. Las SALIDAS sí son `exiting`: al desmontarse ya no hay render en el
 * que mover nada, y las predefinidas (`FadeOut…`) funcionan bien en los dos.
 *
 * Con "reducir movimiento" no hay desplazamiento ni escala, pero sí fundido:
 * sin él, el mensaje brincaría a la pantalla de golpe, y eso también es
 * movimiento, sólo que brusco.
 */

import { useEffect } from 'react';
import type { ComponentProps } from 'react';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  FadeOutUp,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/** Arranca rápido y se asienta. Para todo lo que entra o sale. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Para lo que se mueve de un lugar a otro dentro de la pantalla. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

export interface Entrada {
  /** De cuántos puntos más abajo (+) o más arriba (−) llega. */
  desdeY: number;
  /** De qué tamaño arranca. Nunca menos de 0.9. */
  desdeEscala: number;
  duracion: number;
  /** Cuánto espera antes de empezar. */
  retraso?: number;
}

/** Aviso de arriba (toast): baja un poco desde el borde al llegar. */
export const AVISO: Entrada = { desdeY: -14, desdeEscala: 0.96, duracion: 280 };

/** Tarjeta al centro: sube un poco mientras se asienta. */
export const TARJETA: Entrada = { desdeY: 16, desdeEscala: 0.94, duracion: 300 };

/**
 * Lo que tú escribiste: sale ya, porque es la respuesta a tu toque. El globo
 * lleva `transformOrigin: 'bottom right'`, su esquina recortada: crece desde ahí.
 */
export const GLOBO_MIO: Entrada = { desdeY: 8, desdeEscala: 0.96, duracion: 200 };

/**
 * La respuesta: llega un instante DESPUÉS de tu mensaje, como en una plática
 * de verdad. Si las dos burbujas aparecen en el mismo cuadro, se leen como un
 * bloque y no como un ida y vuelta. Crece desde abajo a la izquierda.
 */
export const GLOBO_SUYO: Entrada = { desdeY: 10, desdeEscala: 0.94, duracion: 260, retraso: 140 };

/** Con "reducir movimiento" la entrada es sólo este fundido. */
const FUNDIDO_REDUCIDO = 200;

/**
 * El estilo de algo que acaba de montarse y va llegando.
 *
 * Con `animar` en falso ya está en su lugar desde el primer cuadro: es para lo
 * que vuelve a montarse pero ya se había visto (la plática al reabrir el chat).
 */
export function useEntrada(entrada: Entrada, animar = true) {
  const reducido = useReducedMotion();
  const avance = useSharedValue(animar ? 0 : 1);
  const { desdeY, desdeEscala, duracion, retraso = 0 } = entrada;

  useEffect(() => {
    if (!animar) return;
    avance.set(
      withDelay(
        retraso,
        withTiming(1, {
          duration: reducido ? FUNDIDO_REDUCIDO : duracion,
          easing: EASE_OUT,
          // El fundido se queda aun con "reducir movimiento" (ver arriba).
          reduceMotion: ReduceMotion.Never,
        }),
        ReduceMotion.Never,
      ),
    );
    // Sólo al montarse: una entrada no se repite porque cambie otra cosa.
  }, [avance]);

  return useAnimatedStyle(() => {
    const v = avance.get();
    if (reducido) return { opacity: v };
    return {
      opacity: v,
      transform: [{ translateY: (1 - v) * desdeY }, { scale: desdeEscala + (1 - desdeEscala) * v }],
    };
  });
}

type PropsLlegada = ComponentProps<typeof Animated.View> & {
  entrada: Entrada;
  /** Falso para lo que ya se había visto y sólo se vuelve a montar. */
  animar?: boolean;
};

/** Un `Animated.View` que llega con `entrada` al montarse. */
export function Llegada({ entrada, animar = true, style, ...resto }: PropsLlegada) {
  const estilo = useEntrada(entrada, animar);
  return <Animated.View {...resto} style={[style, estilo]} />;
}

// ---------------------------------------------------------------------------
// Salidas y fundidos
// ---------------------------------------------------------------------------

/** El aviso de arriba se va por donde llegó: sube mientras se desvanece. */
export const AVISO_SALE = FadeOutUp.duration(220).easing(EASE_OUT);

/** El velo oscuro detrás de una tarjeta: acompaña, no protagoniza. */
export const VELO_ENTRA = FadeIn.duration(220).easing(EASE_OUT).reduceMotion(ReduceMotion.Never);
/** Se lleva el velo y la tarjeta juntos: un solo gesto de salida. */
export const VELO_SALE = FadeOut.duration(200).easing(EASE_OUT).reduceMotion(ReduceMotion.Never);

/** Con "reducir movimiento": salir sin desplazarse. */
export const DESAPARECE = FadeOut.duration(160).easing(EASE_OUT).reduceMotion(ReduceMotion.Never);
