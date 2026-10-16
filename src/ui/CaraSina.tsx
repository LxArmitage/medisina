/**
 * La sina: el personaje que acompaña por toda la app.
 *
 * Es un *Lophocereus schottii*, el cacto columnar de Sonora y Sinaloa que le da
 * nombre a MEDISINA — el que se cicatriza solo en el desierto y da una fruta
 * roja que se come. No es una mascota puesta por poner: es la idea de la app
 * con cara.
 *
 * El gesto no es decorativo, es información. Antes de leer una palabra ya se
 * sabe si hay algo que atender: si la sina está alerta, algo pasa. Esa lectura
 * de un cuarto de segundo es la razón de que sea un personaje y no un icono de
 * chat.
 *
 * Movimiento: respira siempre, parpadea de vez en cuando, y al tocarla da un
 * brinco. Todo se apaga con `useReducedMotion`, porque un personaje que no
 * para de moverse es exactamente lo que estorba a quien pidió menos animación.
 */

import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export type Animo =
  /** Todo en rango. */
  | 'contenta'
  /** Algo necesita atención hoy. */
  | 'alerta'
  /** Racha o logro recién conseguido. */
  | 'orgullosa'
  /** Sin plantas todavía. */
  | 'dormida';

export interface CaraSinaProps {
  animo?: Animo;
  tamano?: number;
  /** Sube con el toque: hace el brinco. */
  brinco?: number;
}

/** Verde del cuerpo según el ánimo. El alerta tira a ocre, no a rojo. */
const CUERPO: Record<Animo, [string, string]> = {
  contenta: ['#2FBF63', '#1E8A47'],
  alerta: ['#D9A21B', '#A97B0E'],
  orgullosa: ['#35D07F', '#1E8A47'],
  dormida: ['#6E8F78', '#4E6957'],
};

export function CaraSina({ animo = 'contenta', tamano = 56, brinco = 0 }: CaraSinaProps) {
  const reducido = useReducedMotion();
  const respirar = useSharedValue(1);
  const parpadeo = useSharedValue(1);
  const salto = useSharedValue(0);

  useEffect(() => {
    if (reducido) {
      respirar.value = 1;
      parpadeo.value = 1;
      return;
    }
    // Respiración lenta y de muy poca amplitud. Si se nota, distrae.
    respirar.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    // El parpadeo es lo que la vuelve un ser vivo y no un dibujo.
    parpadeo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200 }),
        withTiming(0.08, { duration: 90 }),
        withTiming(1, { duration: 110 }),
      ),
      -1,
      false,
    );
  }, [reducido, respirar, parpadeo]);

  useEffect(() => {
    if (reducido || brinco === 0) return;
    salto.value = withSequence(
      withTiming(-7, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 260, easing: Easing.elastic(1.6) }),
    );
  }, [brinco, reducido, salto]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: salto.value }, { scale: respirar.value }],
  }));

  // 4.2 es el alto normal del ojo; al parpadear baja casi a cero.
  const ojos = useAnimatedProps(() => ({ ry: 4.2 * parpadeo.value }));

  const [claro, oscuro] = CUERPO[animo];
  const dormida = animo === 'dormida';

  return (
    <Animated.View style={[{ width: tamano, height: tamano }, estilo]}>
      <Svg width={tamano} height={tamano} viewBox="0 0 100 100">
        {/* Sombra de apoyo: sin ella el personaje flota y se ve pegado encima. */}
        <Ellipse cx={50} cy={92} rx={26} ry={5} fill="#000" opacity={0.13} />

        {/* Brazos. El de la derecha va más alto: la simetría exacta se lee
            como icono, y la asimetría leve, como criatura. */}
        <G>
          <Path
            d="M28 62 Q16 62 16 50 Q16 42 22 42 Q28 42 28 50 Z"
            fill={oscuro}
          />
          <Path
            d="M72 58 Q84 58 84 44 Q84 35 78 35 Q72 35 72 44 Z"
            fill={oscuro}
          />
        </G>

        {/* Cuerpo columnar */}
        <Path
          d="M34 88 L34 34 Q34 16 50 16 Q66 16 66 34 L66 88 Z"
          fill={claro}
        />
        {/* Costillas: lo que lo hace cacto y no cápsula verde. */}
        {[41, 50, 59].map((x) => (
          <Rect key={x} x={x - 1} y={26} width={2} height={60} rx={1} fill={oscuro} opacity={0.42} />
        ))}

        {/* La pitaya: la fruta roja comestible de la sina. Es la marca. */}
        {!dormida && (
          <G>
            <Circle cx={62} cy={20} r={6.5} fill="#E5484D" />
            <Circle cx={60} cy={18} r={2} fill="#FF8087" opacity={0.75} />
          </G>
        )}

        {/* Cara */}
        <G>
          {dormida ? (
            <>
              <Path d="M40 46 Q44 42 48 46" stroke="#0B2B1A" strokeWidth={2.4} fill="none" strokeLinecap="round" />
              <Path d="M52 46 Q56 42 60 46" stroke="#0B2B1A" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* Se anima el radio del óvalo y no una transformación de estilo:
                  react-native-svg no aplica transformaciones de estilo de forma
                  fiable, y con `animatedProps` el parpadeo lo hace el mismo SVG. */}
              <OjoAnimado cx={43.5} cy={45} rx={3.4} animatedProps={ojos} fill="#0B2B1A" />
              <OjoAnimado cx={56.5} cy={45} rx={3.4} animatedProps={ojos} fill="#0B2B1A" />
              {/* El brillo del ojo. Un punto blanco decide si el personaje
                  parece vivo o parece un muñeco. */}
              <Circle cx={44.8} cy={43.4} r={1.15} fill="#fff" opacity={0.9} />
              <Circle cx={57.8} cy={43.4} r={1.15} fill="#fff" opacity={0.9} />
            </>
          )}

          {/* Boca según el ánimo */}
          {animo === 'alerta' ? (
            <Ellipse cx={50} cy={58} rx={3.6} ry={4.4} fill="#0B2B1A" opacity={0.85} />
          ) : animo === 'orgullosa' ? (
            <Path d="M42 55 Q50 65 58 55 Q50 61 42 55 Z" fill="#0B2B1A" opacity={0.88} />
          ) : dormida ? (
            <Ellipse cx={50} cy={57} rx={2.4} ry={2.8} fill="#0B2B1A" opacity={0.6} />
          ) : (
            <Path
              d="M44 56 Q50 61 56 56"
              stroke="#0B2B1A"
              strokeWidth={2.4}
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* Cachetes: sólo cuando está contenta o orgullosa. */}
          {(animo === 'contenta' || animo === 'orgullosa') && (
            <>
              <Ellipse cx={37.5} cy={53} rx={3.4} ry={2.2} fill="#E5484D" opacity={0.28} />
              <Ellipse cx={62.5} cy={53} rx={3.4} ry={2.2} fill="#E5484D" opacity={0.28} />
            </>
          )}
        </G>

        {/* Zeta de sueño */}
        {dormida && (
          <Path
            d="M74 24 h8 l-8 9 h8"
            stroke="#6E8F78"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </Animated.View>
  );
}

/** Óvalo animable: Reanimated necesita el componente envuelto para tocarlo. */
const OjoAnimado = Animated.createAnimatedComponent(Ellipse);
