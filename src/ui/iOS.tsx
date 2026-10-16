/**
 * Las piezas de interfaz que iOS enseñó a todo el mundo a leer.
 *
 * No es copiar por copiar. Un usuario de iPhone ya sabe, sin pensarlo, que un
 * bloque redondeado con separadores cortos es una lista de ajustes, que el
 * título gordo se encoge al bajar, y que un chevron a la derecha significa
 * "aquí hay más". Usar esas convenciones es gastar cero atención en enseñar la
 * interfaz y dejarla toda para las plantas.
 *
 * Lo que se trae de iOS:
 *   · Título grande que colapsa en una barra compacta al desplazar.
 *   · Listas agrupadas con inserción: tarjeta redondeada, separadores que
 *     empiezan donde empieza el texto, encabezado en versalitas.
 *   · Control segmentado.
 *
 * Lo que NO se trae: la tipografía ni la paleta. Esas son de MEDISINA, y son
 * lo que hace que no parezca una app de sistema.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Children, Fragment, isValidElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espacio, fuente, radio, useTema } from './tema';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

/** Dónde termina de encogerse el título. 44 px es el recorrido de iOS. */
const RECORRIDO = 44;

// ---------------------------------------------------------------------------

/**
 * El desplazamiento de la pantalla, en el hilo de UI.
 *
 * Va en un valor compartido y no en estado de React a propósito: el título se
 * encoge en cada cuadro, y hacerlo con `setState` obligaría a React a
 * re-renderizar la lista entera sesenta veces por segundo.
 */
export function useDesplazamiento() {
  const y = useSharedValue(0);
  const alDesplazar = useAnimatedScrollHandler((evento) => {
    y.value = evento.contentOffset.y;
  });
  return { y, alDesplazar };
}

export interface BarraCompactaProps {
  titulo: string;
  y: ReturnType<typeof useSharedValue<number>>;
  /** Botón de la izquierda, normalmente el de volver. */
  izquierda?: ReactNode;
  derecha?: ReactNode;
}

/**
 * La barra que aparece cuando el título grande ya se fue arriba.
 *
 * Va fija y por encima del contenido. Aparece con un desvanecido corto: si
 * apareciera de golpe, el ojo lo lee como un salto de la pantalla.
 */
export function BarraCompacta({ titulo, y, izquierda, derecha }: BarraCompactaProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();

  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [RECORRIDO * 0.5, RECORRIDO], [0, 1], 'clamp'),
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          paddingTop: insets.top,
          backgroundColor: tema.fondo,
          borderBottomColor: tema.borde,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        estilo,
      ]}
    >
      <View
        style={{
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: espacio.lg,
          gap: espacio.sm,
        }}
      >
        <View style={{ minWidth: 28 }}>{izquierda}</View>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: fuente.cuerpoFuerte,
            fontSize: 16,
            color: tema.texto,
          }}
        >
          {titulo}
        </Text>
        <View style={{ minWidth: 28, alignItems: 'flex-end' }}>{derecha}</View>
      </View>
    </Animated.View>
  );
}

export interface TituloGrandeProps {
  titulo: string;
  subtitulo?: string;
  y: ReturnType<typeof useSharedValue<number>>;
  derecha?: ReactNode;
}

/** El título grande, dentro del contenido. Se desvanece al subir. */
export function TituloGrande({ titulo, subtitulo, y, derecha }: TituloGrandeProps) {
  const tema = useTema();

  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, RECORRIDO], [1, 0], 'clamp'),
    // Sube un poco más despacio que el desplazamiento: da profundidad sin que
    // se note que hay un truco.
    transform: [{ translateY: interpolate(y.value, [0, RECORRIDO], [0, 8], 'clamp') }],
  }));

  return (
    <Animated.View style={[{ gap: 2, marginBottom: espacio.md }, estilo]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: espacio.md }}>
        <Text style={{ flex: 1, fontFamily: fuente.titulo, fontSize: 32, color: tema.texto }}>
          {titulo}
        </Text>
        {derecha}
      </View>
      {subtitulo && (
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave }}>
          {subtitulo}
        </Text>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

export interface GrupoProps {
  titulo?: string;
  /** Explicación bajo el grupo, como el pie de una sección de Ajustes. */
  nota?: string;
  children: ReactNode;
}

/**
 * Una sección de lista agrupada.
 *
 * El encabezado va en versalitas y pequeño, y la tarjeta redondeada agrupa sus
 * filas. Los separadores los pone este componente y no las filas, porque quien
 * sabe cuál es la última es el grupo — y un separador colgando debajo de la
 * última fila es de las cosas que hacen que algo se vea sin terminar.
 */
export function Grupo({ titulo, nota, children }: GrupoProps) {
  const tema = useTema();
  const filas = Children.toArray(children).filter(isValidElement);

  return (
    <View style={{ gap: espacio.sm }}>
      {titulo && (
        <Text
          style={{
            fontFamily: fuente.cuerpoFuerte,
            fontSize: 11.5,
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            color: tema.textoSuave,
            paddingHorizontal: espacio.md,
          }}
        >
          {titulo}
        </Text>
      )}

      <View
        style={{
          backgroundColor: tema.superficie,
          borderRadius: radio.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tema.borde,
          overflow: 'hidden',
        }}
      >
        {filas.map((fila, i) => (
          <Fragment key={i}>
            {fila}
            {i < filas.length - 1 && (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: tema.borde,
                  // Empieza donde empieza el texto, no en el borde: es el
                  // detalle que hace que una lista se vea ordenada.
                  marginLeft: espacio.lg + 34,
                }}
              />
            )}
          </Fragment>
        ))}
      </View>

      {nota && (
        <Text
          style={{
            fontFamily: fuente.cuerpo,
            fontSize: 12,
            color: tema.textoSuave,
            paddingHorizontal: espacio.md,
          }}
        >
          {nota}
        </Text>
      )}
    </View>
  );
}

export interface FilaProps {
  titulo: string;
  detalle?: string;
  /** Icono a la izquierda, en su cuadro de color. Como en Ajustes. */
  icono?: NombreIcono;
  colorIcono?: string;
  /** Lo que va a la derecha antes del chevron: un valor, una etiqueta. */
  valor?: string;
  /** Contenido libre a la derecha, si un texto no alcanza. */
  accesorio?: ReactNode;
  onPress?: () => void;
  destructiva?: boolean;
}

export function Fila({
  titulo,
  detalle,
  icono,
  colorIcono,
  valor,
  accesorio,
  onPress,
  destructiva,
}: FilaProps) {
  const tema = useTema();
  const color = destructiva ? tema.acento : tema.texto;

  const contenido = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.md,
        paddingHorizontal: espacio.lg,
        // 44 pt es el mínimo táctil de Apple, y es un mínimo por algo.
        minHeight: 48,
        paddingVertical: espacio.sm,
      }}
    >
      {icono && (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            backgroundColor: colorIcono ?? tema.primario,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icono} size={15} color="#fff" />
        </View>
      )}

      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: fuente.cuerpoMedio, fontSize: 15, color }}>{titulo}</Text>
        {detalle && (
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
            {detalle}
          </Text>
        )}
      </View>

      {accesorio}
      {valor && (
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave }}>
          {valor}
        </Text>
      )}
      {onPress && <Ionicons name="chevron-forward" size={16} color={tema.textoSuave} />}
    </View>
  );

  if (!onPress) return contenido;

  return (
    <Pressable
      onPress={onPress}
      // En iOS la fila se ilumina al tocarla; en Android se atenúa. Cada
      // plataforma espera la suya.
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? Platform.OS === 'ios'
            ? tema.superficieAlta
            : tema.superficieAlta
          : 'transparent',
      })}
    >
      {contenido}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

export interface SegmentadoProps<T extends string> {
  opciones: Array<{ valor: T; etiqueta: string }>;
  valor: T;
  onCambio: (valor: T) => void;
}

/** Control segmentado: pocas opciones, todas visibles, una activa. */
export function Segmentado<T extends string>({ opciones, valor, onCambio }: SegmentadoProps<T>) {
  const tema = useTema();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: tema.superficieAlta,
        borderRadius: radio.md,
        padding: 3,
        gap: 3,
      }}
    >
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            onPress={() => onCambio(opcion.valor)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radio.sm,
              backgroundColor: activa ? tema.superficie : 'transparent',
              opacity: pressed && !activa ? 0.6 : 1,
              // La pastilla activa se levanta apenas. Sin sombra se pierde
              // contra el canal en tema claro.
              shadowColor: '#000',
              shadowOpacity: activa ? 0.12 : 0,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: activa ? 2 : 0,
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: activa ? fuente.cuerpoFuerte : fuente.cuerpo,
                fontSize: 13,
                color: activa ? tema.texto : tema.textoSuave,
              }}
            >
              {opcion.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
