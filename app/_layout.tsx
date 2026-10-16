import {
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
  useFonts,
} from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { abrirBd } from '../src/datos/db';
import { limpiarEjemplos } from '../src/datos/semilla';
import { cargarLlaveGuardada } from '../src/servicios/identificacion';
import { Bloqueo } from '../src/ui/Bloqueo';
import { Celebracion } from '../src/ui/Celebracion';
import { FelicitacionRacha } from '../src/ui/FelicitacionRacha';
import { Companero } from '../src/ui/Companero';
import { ProveedorSesion, useSesion } from '../src/ui/Sesion';
import { espacio, fuente, useTema } from '../src/ui/tema';

export default function LayoutRaiz() {
  const tema = useTema();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fuentesListas] = useFonts({
    Fraunces_700Bold,
    Fraunces_700Bold_Italic,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    (async () => {
      try {
        await abrirBd();
        // Ya no se siembran ejemplos: se quitan los que quedaron de antes.
        await limpiarEjemplos();
        // La llave del reconocimiento vive en los ajustes: hay que subirla
        // a memoria antes de que alguien abra la cámara.
        await cargarLlaveGuardada();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo abrir la base local');
      } finally {
        setListo(true);
      }
    })();
  }, []);

  // Se espera a las fuentes: arrancar con la del sistema y cambiarlas a medio
  // camino provoca un salto de texto que se ve barato.
  if (!listo || !fuentesListas) {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, justifyContent: 'center' }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  // GestureHandlerRootView va hasta arriba y NO es opcional. Sin él, en el
  // teléfono y en modo desarrollo, cualquier `GestureDetector` lanza un error
  // al montarse — y en el navegador no, porque la librería se salta esa
  // comprobación en web. Así se veía: picarle a "Dibujo" tumbaba la ficha en el
  // iPhone y en la computadora funcionaba perfecto.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <StatusBar style={tema.esOscuro ? 'light' : 'dark'} />
      {error && (
        <View style={{ backgroundColor: tema.acento, padding: espacio.sm }}>
          <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>{error}</Text>
        </View>
      )}
      {/* La sesión se lee de la base: va después de abrirla. */}
      <ProveedorSesion>
        <Navegacion />
      </ProveedorSesion>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Las pantallas según haya sesión o no.
 *
 * Con `Stack.Protected` las pantallas de plantas sólo existen con la sesión
 * abierta, y la bienvenida y el alta sólo sin ella. Al entrar o salir, el
 * router lleva solo a la primera pantalla disponible: no hay redirecciones a
 * mano que se puedan olvidar.
 */
function Navegacion() {
  const tema = useTema();
  const sesion = useSesion();

  if (sesion.cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, justifyContent: 'center' }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  const dentro = sesion.abierta;
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tema.fondo },
          headerTintColor: tema.texto,
          headerTitleStyle: { fontFamily: fuente.titulo, fontSize: 18 },
          contentStyle: { backgroundColor: tema.fondo },
        }}
      >
        <Stack.Protected guard={dentro}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="planta/[id]" options={{ title: '' }} />
          <Stack.Screen name="escanear" options={{ title: 'Escanear' }} />
          <Stack.Screen name="semilla" options={{ title: 'Semillas' }} />
          <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
          <Stack.Screen name="cuenta/ciudad" options={{ title: 'Tu ciudad', presentation: 'modal' }} />
          <Stack.Screen name="planta/nueva" options={{ title: 'Nueva planta', presentation: 'modal' }} />
          <Stack.Screen name="jardin/[id]" options={{ title: '' }} />
          <Stack.Screen name="equipos" options={{ title: 'Equipos de riego' }} />
          <Stack.Screen name="especies" options={{ title: 'Conoce las plantas' }} />
          <Stack.Screen name="especie/[id]" options={{ title: '' }} />
          <Stack.Screen name="decorar" options={{ title: 'Decorar' }} />
          <Stack.Screen name="jardin/agregar" options={{ title: 'Agregar un jardín', presentation: 'modal' }} />
          <Stack.Screen name="jardin/compartir" options={{ title: 'Compartir mi jardín', presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!dentro}>
          <Stack.Screen name="bienvenida" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="cuenta/crear" options={{ headerShown: false }} />
          <Stack.Screen name="cuenta/entrar" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>

      {/* Fuera del Stack, a propósito: así queda por encima de TODAS las
          pantallas y no se desmonta al navegar. Un asistente que desaparece
          al cambiar de pestaña no acompaña. Sin sesión, no hay jardín del
          que hablar. */}
      {dentro && <Companero />}
      {/* Después del compañero: cuando la racha sube, la fiesta va encima de todo. */}
      {dentro && <Celebracion />}
      {/* Tocar la racha en cualquier pantalla: la felicitación va encima de todo. */}
      {dentro && <FelicitacionRacha />}
      {dentro && sesion.bloqueada && <Bloqueo />}
    </>
  );
}
