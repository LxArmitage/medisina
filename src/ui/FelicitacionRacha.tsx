/**
 * Tocar tu racha y que te feliciten.
 *
 * Donde se vea la racha (el fuego del patio, la tarjeta de Hoy) se puede
 * tocar, y aparece esto: la llama grande, hojitas que brincan y una frase que
 * reconoce lo que hiciste. Es un premio que uno puede pedir cuando quiera: por
 * eso vive en la raíz, encima de todo, y se llama con `felicitarRacha`.
 *
 * Lo que dice depende de cómo vas: no es lo mismo llevar un mes que haber
 * empezado ayer, ni haber cuidado hoy que tenerlo pendiente. Felicitar igual
 * en los tres casos sería no estar viendo.
 */

import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { mensajeDeRacha } from '../dominio/felicitacion';
import type { DatosRacha } from '../dominio/felicitacion';
import { Llama } from './Llama';
import { Llegada, TARJETA, VELO_ENTRA, VELO_SALE } from './movimiento';
import { espacio, fuente, radio, useTema } from './tema';

type Oyente = (r: DatosRacha) => void;
const oyentes = new Set<Oyente>();

/** Pide la felicitación desde cualquier pantalla. */
export function felicitarRacha(r: DatosRacha) {
  oyentes.forEach((o) => o(r));
}

const DURACION = 3400;

export function FelicitacionRacha() {
  const tema = useTema();
  const reducido = useReducedMotion();
  const [actual, setActual] = useState<{ r: DatosRacha; id: number } | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cuenta = useRef(0);

  useEffect(() => {
    const oir: Oyente = (r) => {
      if (reloj.current) clearTimeout(reloj.current);
      cuenta.current += 1;
      setActual({ r, id: cuenta.current });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reloj.current = setTimeout(() => setActual(null), DURACION);
    };
    oyentes.add(oir);
    return () => {
      oyentes.delete(oir);
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, []);

  if (!actual) return null;
  const { titulo, texto } = mensajeDeRacha(actual.r);
  const cerrar = () => {
    if (reloj.current) clearTimeout(reloj.current);
    setActual(null);
  };

  return (
    <Animated.View
      key={actual.id}
      entering={VELO_ENTRA}
      exiting={VELO_SALE}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      <Pressable
        onPress={cerrar}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,12,8,0.45)' }}
      />
      {/* Antes crecía desde un punto (escala cero) con rebote: se leía como
          algo que explota, no como una tarjeta que llega. Ahora sube un poco
          y se asienta; la fiesta la ponen la llama y las hojitas. */}
      <Llegada
        entrada={TARJETA}
        accessibilityRole="alert"
        style={{
          width: 300,
          maxWidth: '86%',
          backgroundColor: tema.superficie,
          borderRadius: radio.lg + 10,
          paddingTop: espacio.xl,
          paddingBottom: espacio.lg,
          paddingHorizontal: espacio.lg,
          alignItems: 'center',
          gap: espacio.sm,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 14,
        }}
      >
        <View style={{ width: 120, height: 96, alignItems: 'center', justifyContent: 'flex-end' }}>
          {!reducido &&
            HOJITAS.map((h, i) => <Hojita key={i} {...h} />)}
          <LlamaQueLate reducido={reducido} encendida={actual.r.hoyCuenta || actual.r.dias > 0} />
        </View>
        <Text style={{ fontFamily: fuente.titulo, fontSize: 44, lineHeight: 48, color: '#F07A1A' }}>{actual.r.dias}</Text>
        <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 11, letterSpacing: 1, color: tema.textoSuave, marginTop: -6 }}>
          {actual.r.dias === 1 ? 'DÍA DE RACHA' : 'DÍAS DE RACHA'}
        </Text>
        <Text style={{ fontFamily: fuente.titulo, fontSize: 21, color: tema.texto, textAlign: 'center', marginTop: espacio.xs }}>
          {titulo}
        </Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, lineHeight: 21, color: tema.textoSuave, textAlign: 'center' }}>
          {texto}
        </Text>
        <Pressable
          onPress={cerrar}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: espacio.sm,
            alignSelf: 'stretch',
            minHeight: 46,
            borderRadius: radio.md + 2,
            backgroundColor: tema.primario,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.esOscuro ? '#0B1A13' : '#fff' }}>¡Gracias!</Text>
        </Pressable>
      </Llegada>
    </Animated.View>
  );
}

function LlamaQueLate({ reducido, encendida }: { reducido: boolean; encendida: boolean }) {
  const escala = useSharedValue(reducido ? 1 : 0.6);
  useEffect(() => {
    if (reducido) return;
    escala.set(
      withSequence(
        withSpring(1.18, { duration: 380, dampingRatio: 0.5 }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [escala, reducido]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  return (
    <Animated.View style={estilo}>
      <Llama tamano={78} encendida={encendida} />
    </Animated.View>
  );
}

/** Seis hojitas que salen disparadas de la llama y caen girando. */
const HOJITAS = [
  { dx: -52, dy: -62, giro: -160, color: '#4CAF50', retraso: 60 },
  { dx: 50, dy: -70, giro: 190, color: '#8BC34A', retraso: 90 },
  { dx: -30, dy: -84, giro: -90, color: '#F2B134', retraso: 40 },
  { dx: 34, dy: -40, giro: 120, color: '#2E8B57', retraso: 120 },
  { dx: -60, dy: -26, giro: -220, color: '#F07A1A', retraso: 150 },
  { dx: 62, dy: -30, giro: 240, color: '#66BB6A', retraso: 30 },
];

function Hojita({ dx, dy, giro, color, retraso }: { dx: number; dy: number; giro: number; color: string; retraso: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(retraso, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })));
  }, [t, retraso]);
  const estilo = useAnimatedStyle(() => {
    const u = t.get();
    // Sube rápido y cae un poco al final: una parábola corta.
    return {
      opacity: u < 0.85 ? 1 : (1 - u) / 0.15,
      transform: [
        { translateX: dx * u },
        { translateY: dy * u + 40 * u * u },
        { rotate: `${giro * u}deg` },
        { scale: 0.6 + 0.4 * Math.min(1, u * 3) },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', bottom: 34 }, estilo]}>
      <Svg width={14} height={9}>
        <Path d="M1 4.5 Q7 -1.5 13 4.5 Q7 10.5 1 4.5 Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}
