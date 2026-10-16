/**
 * La app bloqueada: se pide Face ID (o el código) para entrar.
 *
 * Va encima de todo y no es una pantalla de la navegación: al desbloquear,
 * cada quien sigue donde estaba. Pide Face ID sola al aparecer, como las
 * apps de banco; si la persona cancela, queda el botón para intentar otra vez
 * y la salida para entrar con la contraseña.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSesion } from './Sesion';
import { BotonGrande } from './cuentaUI';
import { espacio, fuente, useTema } from './tema';

export function Bloqueo() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const sesion = useSesion();
  const [fallo, setFallo] = useState(false);
  const pedido = useRef(false);
  const pila = sesion.perfil?.nombre.split(/\s+/)[0] ?? '';

  async function intentar() {
    setFallo(false);
    const ok = await sesion.desbloquear();
    if (!ok) setFallo(true);
  }

  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    const t = setTimeout(() => void intentar(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(260)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        backgroundColor: tema.fondo,
        alignItems: 'center',
        justifyContent: 'center',
        padding: espacio.xl,
        paddingBottom: insets.bottom + espacio.xl,
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.lg }}>
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: tema.primarioSuave, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="lock-closed" size={44} color={tema.primario} />
        </Animated.View>
        <Text style={{ fontFamily: fuente.titulo, fontSize: 28, color: tema.texto }}>MEDISINA</Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 15, color: tema.textoSuave, textAlign: 'center' }}>
          {fallo ? 'No se pudo comprobar. Intenta otra vez.' : `Hola${pila ? `, ${pila}` : ''}. Tus plantas te esperan.`}
        </Text>
      </View>
      <View style={{ alignSelf: 'stretch', gap: espacio.md }}>
        <BotonGrande
          texto={`Desbloquear con ${sesion.nombreDesbloqueo}`}
          icono={sesion.desbloqueo === 'huella' ? 'finger-print' : 'scan-outline'}
          onPress={() => void intentar()}
        />
        <Pressable onPress={() => void sesion.salir()} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14, color: tema.textoSuave, textAlign: 'center' }}>
            Entrar con mi contraseña
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
