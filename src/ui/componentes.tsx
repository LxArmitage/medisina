/** Piezas de interfaz compartidas. */

import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colorDeNivel, espacio, fuente, radio, useTema } from './tema';
import type { NivelHidricoColoreable, Tema } from './tema';

// ---------------------------------------------------------------------------
// Respuesta al tacto
// ---------------------------------------------------------------------------

/**
 * Lo que hace que un botón se sienta físico.
 *
 * Reglas de `animate-expo`: la señal va al presionar, no al soltar — esa es la
 * latencia que la gente percibe. `scale` en vez de opacidad porque arrastra el
 * texto y los iconos con él. 120 ms, dentro del tramo de 100-150 para
 * retroalimentación de presión.
 */
const PRESION = {
  transitionProperty: 'transform',
  transitionDuration: '120ms',
  transitionTimingFunction: 'ease-out',
} as const;

/** Golpe háptico al confirmar. Nunca es la única señal: siempre acompaña a una visual. */
function tocar(estilo: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  // En web no existe y lanza; en Android muchos equipos no lo tienen.
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(estilo).catch(() => undefined);
}

// ---------------------------------------------------------------------------

export function Tarjeta({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const tema = useTema();
  const base: ViewStyle = {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radio.lg,
    padding: espacio.lg,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      // Un dedo que se desliza unos píxeles no debería cancelar la pulsación.
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[base, { ...PRESION, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

export function Chip({
  texto,
  color,
  icono,
}: {
  texto: string;
  color?: string;
  icono?: ReactNode;
}) {
  const tema = useTema();
  const tono = color ?? tema.primario;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.xs,
        backgroundColor: `${tono}1F`,
        borderRadius: radio.completo,
        paddingHorizontal: espacio.md,
        paddingVertical: 5,
        alignSelf: 'flex-start',
      }}
    >
      {icono}
      <Text style={{ color: tono, fontSize: 12, fontFamily: fuente.cuerpoFuerte }}>{texto}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  deshabilitado,
  style,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tema = useTema();
  const fondo =
    variante === 'primario'
      ? tema.primario
      : variante === 'peligro'
        ? tema.acento
        : 'transparent';
  const colorTexto = variante === 'secundario' ? tema.primario : '#FFFFFF';

  return (
    <Pressable
      onPress={() => {
        tocar(
          variante === 'peligro'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
        onPress();
      }}
      disabled={deshabilitado}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            {
              ...PRESION,
              backgroundColor: fondo,
              borderRadius: radio.md,
              // 44 pt de alto mínimo: es el tamaño real de una yema.
              minHeight: 46,
              justifyContent: 'center',
              paddingVertical: espacio.md,
              paddingHorizontal: espacio.lg,
              alignItems: 'center',
              borderWidth: variante === 'secundario' ? 1 : 0,
              borderColor: tema.primario,
              opacity: deshabilitado ? 0.4 : 1,
              transform: [{ scale: pressed && !deshabilitado ? 0.97 : 1 }],
            },
          ]}
        >
          <Text style={{ color: colorTexto, fontFamily: fuente.cuerpoFuerte, fontSize: 15 }}>
            {titulo}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

/**
 * Barra de humedad del sustrato.
 * Marca el umbral de estrés de la especie para que el número tenga referencia:
 * "40 %" no significa nada si no sabes dónde empieza a sufrir esta planta.
 */
export function BarraHumedad({
  fraccion,
  nivel,
  umbralEstres,
}: {
  fraccion: number;
  nivel: NivelHidricoColoreable;
  umbralEstres?: number;
}) {
  const tema = useTema();
  const color = colorDeNivel(tema, nivel);
  const ancho = Math.max(2, Math.min(100, fraccion * 100));

  return (
    <View
      style={{
        height: 10,
        borderRadius: radio.completo,
        backgroundColor: tema.superficieAlta,
        overflow: 'hidden',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          height: '100%',
          width: `${ancho}%`,
          backgroundColor: color,
          borderRadius: radio.completo,
        }}
      />
      {umbralEstres !== undefined && (
        <View
          style={{
            position: 'absolute',
            left: `${Math.min(98, umbralEstres * 100)}%`,
            height: '100%',
            width: 2,
            backgroundColor: tema.texto,
            opacity: 0.35,
          }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

export function Vacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  const tema = useTema();
  return (
    <View style={{ alignItems: 'center', paddingVertical: espacio.xxl, gap: espacio.sm }}>
      <Text style={{ fontSize: 19, fontFamily: fuente.titulo, color: tema.texto }}>{titulo}</Text>
      <Text
        style={{
          fontSize: 14,
          color: tema.textoSuave,
          textAlign: 'center',
          paddingHorizontal: espacio.xl,
          lineHeight: 20,
        }}
      >
        {descripcion}
      </Text>
      {accion}
    </View>
  );
}

// ---------------------------------------------------------------------------

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  const tema = useTema();
  return (
    <View style={{ gap: espacio.md }}>
      <Text
        style={{
          fontFamily: fuente.cuerpoNegro,
          fontSize: 11.5,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: tema.textoSuave,
        }}
      >
        {titulo}
      </Text>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------

export function estilosTexto(tema: Tema) {
  return StyleSheet.create({
    titulo: {
      fontFamily: fuente.titulo,
      fontSize: 30,
      color: tema.texto,
      letterSpacing: -0.8,
      lineHeight: 34,
    },
    subtitulo: {
      fontFamily: fuente.cuerpo,
      fontSize: 15,
      color: tema.textoSuave,
      lineHeight: 22,
    },
    encabezadoTarjeta: {
      fontFamily: fuente.cuerpoNegro,
      fontSize: 17,
      color: tema.texto,
      letterSpacing: -0.2,
    },
    cuerpo: { fontFamily: fuente.cuerpo, fontSize: 14.5, color: tema.texto, lineHeight: 21 },
    suave: { fontFamily: fuente.cuerpo, fontSize: 13, color: tema.textoSuave, lineHeight: 19 },
    // Los rótulos de sección: espaciados y en versalitas.
    rotulo: {
      fontFamily: fuente.cuerpoNegro,
      fontSize: 11.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: tema.textoSuave,
    },
  });
}
