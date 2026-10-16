/**
 * Piezas de las pantallas de cuenta: el botón grande, el campo de texto y la
 * barra de pasos.
 *
 * Siguen las costumbres de iOS que la gente ya trae en los dedos: el botón
 * principal ancho y abajo, el campo grande con su etiqueta arriba, el ojo
 * para ver la contraseña, la barra de progreso delgada arriba y "Atrás" a la
 * izquierda. Y los tipos de contenido correctos en cada campo, para que el
 * llavero de iCloud ofrezca el correo y sugiera una contraseña segura.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, Ref } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { espacio, fuente, radio, useTema } from './tema';

export function BotonGrande({
  texto,
  onPress,
  deshabilitado,
  cargando,
  variante = 'primario',
  icono,
}: {
  texto: string;
  onPress: () => void;
  deshabilitado?: boolean;
  cargando?: boolean;
  variante?: 'primario' | 'claro';
  icono?: keyof typeof Ionicons.glyphMap;
}) {
  const tema = useTema();
  const primario = variante === 'primario';
  const tinta = primario ? (tema.esOscuro ? '#0B1A13' : '#FFFFFF') : tema.texto;
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado || cargando}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!deshabilitado, busy: !!cargando }}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: radio.md + 2,
        backgroundColor: primario ? tema.primario : tema.superficieAlta,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: deshabilitado ? 0.4 : 1,
        transform: [{ scale: pressed && !deshabilitado ? 0.975 : 1 }],
      })}
    >
      {icono && !cargando && <Ionicons name={icono} size={19} color={tinta} />}
      <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 16.5, color: tinta }}>{cargando ? 'Un momento…' : texto}</Text>
    </Pressable>
  );
}

type PropsCampo = Omit<ComponentProps<typeof TextInput>, 'style'> & {
  etiqueta?: string;
  /** Muestra el ojo para ver lo que se escribe. */
  secreto?: boolean;
  error?: string | null;
  /** Cambia cada vez que hay que sacudir el campo (contraseña equivocada). */
  sacudir?: number;
  refCampo?: Ref<TextInput>;
};

/** Un campo grande, con etiqueta, y que tiembla cuando algo está mal. */
export function CampoCuenta({ etiqueta, secreto, error, sacudir = 0, refCampo, ...props }: PropsCampo) {
  const tema = useTema();
  const [visible, setVisible] = useState(false);
  const [foco, setFoco] = useState(false);
  const x = useSharedValue(0);
  useEffect(() => {
    if (sacudir === 0) return;
    x.set(
      withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 60 }),
        withTiming(-7, { duration: 60 }),
        withTiming(7, { duration: 60 }),
        withSpring(0, { duration: 260, dampingRatio: 0.5 }),
      ),
    );
  }, [sacudir, x]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <Animated.View style={[{ gap: 6 }, estilo]}>
      {etiqueta && (
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: tema.textoSuave, paddingHorizontal: 4 }}>
          {etiqueta}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: tema.superficie,
          borderRadius: radio.md + 2,
          borderWidth: 1.5,
          borderColor: error ? tema.critico : foco ? tema.primario : tema.borde,
          paddingHorizontal: espacio.lg,
          minHeight: 56,
        }}
      >
        <TextInput
          ref={refCampo}
          placeholderTextColor={tema.textoSuave}
          secureTextEntry={secreto && !visible}
          {...props}
          onFocus={(e) => {
            setFoco(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFoco(false);
            props.onBlur?.(e);
          }}
          style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 18, color: tema.texto, paddingVertical: 14 }}
        />
        {secreto && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={tema.textoSuave} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.critico, paddingHorizontal: 4 }}>{error}</Text>
      ) : null}
    </Animated.View>
  );
}

/** Arriba: "Atrás" y la barra de pasos, delgada, que se llena con resorte. */
export function BarraPasos({
  paso,
  total,
  onAtras,
  atrasTexto = 'Atrás',
}: {
  paso: number;
  total: number;
  onAtras: () => void;
  atrasTexto?: string;
}) {
  const tema = useTema();
  const avance = useSharedValue(0);
  useEffect(() => {
    avance.set(withSpring(Math.min(1, (paso + 1) / Math.max(1, total)), { duration: 500, dampingRatio: 0.85 }));
  }, [paso, total, avance]);
  const relleno = useAnimatedStyle(() => ({ width: `${avance.get() * 100}%` }));
  return (
    <View style={{ gap: espacio.md }}>
      <Pressable
        onPress={onAtras}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={atrasTexto}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1, marginLeft: -6 })}
      >
        <Ionicons name="chevron-back" size={26} color={tema.primario} />
        <Text style={{ fontFamily: fuente.cuerpoMedio, fontSize: 17, color: tema.primario }}>{atrasTexto}</Text>
      </Pressable>
      {total > 1 && (
        <View style={{ height: 4, borderRadius: 2, backgroundColor: tema.superficieAlta, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', borderRadius: 2, backgroundColor: tema.primario }, relleno]} />
        </View>
      )}
    </View>
  );
}

/** Qué tan fuerte es la contraseña: cuatro rayitas que se encienden. */
export function MedidorFuerza({ nivel, texto }: { nivel: 0 | 1 | 2 | 3 | 4; texto: string }) {
  const tema = useTema();
  const colores = [tema.critico, tema.critico, tema.seco, tema.optimo, tema.optimo];
  return (
    <View style={{ gap: 6, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              backgroundColor: nivel >= i ? colores[nivel] : tema.superficieAlta,
            }}
          />
        ))}
      </View>
      <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: nivel === 0 ? tema.textoSuave : colores[nivel] }}>
        {texto}
      </Text>
    </View>
  );
}
