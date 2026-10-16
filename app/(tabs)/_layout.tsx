import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fuente, useTema } from '../../src/ui/tema';

/**
 * Las pestañas: Hoy y Mis plantas a la izquierda, Jardines y Tú a la
 * derecha, y al centro —grande, levantado, imposible de no ver— Escanear, que
 * es por donde entra cada planta a la app.
 */
export default function LayoutTabs() {
  const tema = useTema();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tema.primario,
        tabBarInactiveTintColor: tema.textoSuave,
        tabBarStyle: {
          backgroundColor: tema.superficie,
          borderTopColor: tema.borde,
        },
        headerStyle: { backgroundColor: tema.fondo },
        headerTintColor: tema.texto,
        headerTitleStyle: { fontFamily: fuente.titulo, fontSize: 18 },
        tabBarLabelStyle: { fontFamily: fuente.cuerpoFuerte, fontSize: 11 },
        sceneStyle: { backgroundColor: tema.fondo },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'leaf' : 'leaf-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="plantas"
        options={{
          title: 'Mis plantas',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'flower' : 'flower-outline'} color={color} size={size} />,
        }}
      />
      {/* No abre una pestaña: abre la cámara. Por eso se ve distinto. */}
      <Tabs.Screen
        name="escaneo"
        options={{
          title: 'Escanear',
          tabBarButton: () => <BotonEscanear />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/escanear');
          },
        }}
      />
      <Tabs.Screen
        name="jardines"
        options={{
          title: 'Jardines',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'trophy' : 'trophy-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tu"
        options={{
          title: 'Tú',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={size + 2} />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * El botón de escanear: un círculo grande que sobresale de la barra, con un
 * halo que respira despacio para que el ojo lo encuentre. Al tocarlo se hunde
 * un poco y el teléfono da un golpecito, como un botón de verdad.
 */
function BotonEscanear() {
  const tema = useTema();
  const reducido = useReducedMotion();
  const halo = useSharedValue(0);
  const hundido = useSharedValue(1);

  useEffect(() => {
    if (reducido) return;
    halo.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 1400 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(halo);
  }, [halo, reducido]);

  const estiloHalo = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - halo.get()),
    transform: [{ scale: 1 + halo.get() * 0.45 }],
  }));
  const estiloBoton = useAnimatedStyle(() => ({ transform: [{ scale: hundido.get() }] }));
  const tinta = tema.esOscuro ? '#0B1A13' : '#FFFFFF';

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        router.push('/escanear');
      }}
      onPressIn={() => hundido.set(withSpring(0.9, { duration: 180, dampingRatio: 0.7 }))}
      onPressOut={() => hundido.set(withSpring(1, { duration: 320, dampingRatio: 0.5 }))}
      accessibilityRole="button"
      accessibilityLabel="Escanear una planta"
      style={{ flex: 1, alignItems: 'center' }}
    >
      <View style={{ width: 64, height: 64, marginTop: -31, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: tema.primario }, estiloHalo]}
        />
        <Animated.View
          style={[
            {
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: tema.primario,
              borderWidth: 4,
              borderColor: tema.superficie,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: tema.primario,
              shadowOpacity: 0.45,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            },
            estiloBoton,
          ]}
        >
          <Ionicons name="scan" size={30} color={tinta} />
        </Animated.View>
      </View>
      <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 10.5, color: tema.primario, marginTop: -1 }}>Escanear</Text>
    </Pressable>
  );
}
