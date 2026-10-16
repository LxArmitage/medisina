/**
 * Piezas de la comunidad: el anillo de la calificación, las iniciales con su
 * medalla y las insignias. Las usan la tabla de Jardines y las visitas.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { Calificacion } from '../dominio/jardinCompartido';
import { fuente, radio, useTema } from './tema';

/** Oro, plata y bronce. */
export const MEDALLA = ['#E8B830', '#A9B4BF', '#C98A4B'];

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

/**
 * La calificación en un anillo, como los de Actividad del iPhone: se llena al
 * aparecer, rápido al principio y frenando al final.
 */
export function Anillo({
  valor,
  color,
  lado = 68,
  grueso = 7,
  retraso = 0,
}: {
  valor: number;
  color: string;
  lado?: number;
  grueso?: number;
  retraso?: number;
}) {
  const tema = useTema();
  const r = (lado - grueso) / 2;
  const vuelta = 2 * Math.PI * r;
  const avance = useSharedValue(0);
  useEffect(() => {
    avance.set(withDelay(retraso, withTiming(Math.max(0, Math.min(100, valor)) / 100, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [valor, retraso, avance]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: vuelta * (1 - avance.get()) }));
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${valor} de 100 puntos`}>
      <Svg width={lado} height={lado} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={lado / 2} cy={lado / 2} r={r} stroke={tema.superficieAlta} strokeWidth={grueso} fill="none" />
        <CirculoAnimado
          cx={lado / 2}
          cy={lado / 2}
          r={r}
          stroke={color}
          strokeWidth={grueso}
          strokeLinecap="round"
          strokeDasharray={`${vuelta} ${vuelta}`}
          fill="none"
          animatedProps={props}
        />
      </Svg>
      <Text style={{ fontFamily: fuente.titulo, fontSize: lado * 0.32, color: tema.texto }}>{valor}</Text>
    </View>
  );
}

/** La inicial en un círculo; con medalla, del color del lugar. */
export function Avatar({ nombre, color, lado = 38, borde }: { nombre: string; color: string; lado?: number; borde?: string }) {
  return (
    <View
      style={{
        width: lado,
        height: lado,
        borderRadius: lado / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: borde ? 3 : 0,
        borderColor: borde,
      }}
    >
      <Text style={{ fontFamily: fuente.titulo, fontSize: lado * 0.42, color: '#FFFFFF' }}>{(nombre.charAt(0) || '·').toUpperCase()}</Text>
    </View>
  );
}

/** Color estable por persona: el mismo nombre siempre del mismo color. */
export function colorDePersona(id: string): string {
  const paleta = ['#2E8B57', '#C66A3D', '#3F7CAC', '#8E5BB5', '#C24D6B', '#2A9D8F', '#B8860B', '#5B7B3A'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return paleta[h % paleta.length];
}

export function Insignias({ lista }: { lista: Calificacion['insignias'] }) {
  if (lista.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {lista.map((i) => (
        <View
          key={i.clave}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#FFF1C9',
            borderRadius: radio.completo,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Ionicons name="ribbon" size={12} color="#B8860B" />
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11.5, color: '#7A5A10' }}>{i.titulo}</Text>
        </View>
      ))}
    </View>
  );
}

const PARTES: Array<{ clave: keyof Calificacion['partes']; titulo: string; maximo: number }> = [
  { clave: 'salud', titulo: 'Salud', maximo: 40 },
  { clave: 'constancia', titulo: 'Constancia', maximo: 30 },
  { clave: 'variedad', titulo: 'Variedad', maximo: 20 },
  { clave: 'tamano', titulo: 'Tamaño', maximo: 10 },
];

/**
 * Tú contra otro jardín, parte por parte: dos barras por renglón. Dice en qué
 * le ganas y en qué te gana, que es lo que uno quiere saber para alcanzarlo.
 */
export function Comparacion({ tuya, suya, dueno }: { tuya: Calificacion; suya: Calificacion; dueno: string }) {
  const tema = useTema();
  return (
    <View style={{ gap: 12 }}>
      {PARTES.map((p) => {
        const a = tuya.partes[p.clave];
        const b = suya.partes[p.clave];
        return (
          <View key={p.clave} style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.texto }}>{p.titulo}</Text>
              <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
                {a === b ? 'Empatados' : a > b ? 'Le ganas' : `${dueno} te gana`}
              </Text>
            </View>
            <Barra valor={a / p.maximo} color={tema.primario} etiqueta="Tú" numero={a} />
            <Barra valor={b / p.maximo} color={colorDePersona(dueno)} etiqueta={dueno} numero={b} />
          </View>
        );
      })}
    </View>
  );
}

function Barra({ valor, color, etiqueta, numero }: { valor: number; color: string; etiqueta: string; numero: number }) {
  const tema = useTema();
  const ancho = useSharedValue(0);
  useEffect(() => {
    ancho.set(withTiming(Math.max(0.02, Math.min(1, valor)), { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [valor, ancho]);
  const relleno = useAnimatedStyle(() => ({ width: `${ancho.get() * 100}%` }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text numberOfLines={1} style={{ width: 64, fontFamily: fuente.cuerpo, fontSize: 11.5, color: tema.textoSuave }}>
        {etiqueta}
      </Text>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: tema.superficieAlta, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: color }, relleno]} />
      </View>
      <Text style={{ width: 22, textAlign: 'right', fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: tema.texto }}>{numero}</Text>
    </View>
  );
}
