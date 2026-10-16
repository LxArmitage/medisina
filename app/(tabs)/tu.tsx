/**
 * Tú: quién eres en MEDISINA y lo que no cabe en las otras pestañas.
 *
 * Arriba tu nombre, tu ciudad y tres números: cuántas plantas cuidas, tu
 * racha (que se toca y felicita) y la mejor que has tenido. Abajo, a un toque:
 * los equipos de riego, las semillas, compartir tu jardín y los ajustes.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listarPlantas } from '../../src/datos/db';
import type { Racha } from '../../src/dominio/racha';
import { agendaDeHoy } from '../../src/servicios/agenda';
import { rachaDe } from '../../src/servicios/racha';
import { felicitarRacha } from '../../src/ui/FelicitacionRacha';
import { Llama } from '../../src/ui/Llama';
import { useSesion } from '../../src/ui/Sesion';
import { colorDePersona } from '../../src/ui/comunidadUI';
import { Fila, Grupo } from '../../src/ui/iOS';
import { espacio, fuente, radio, useTema } from '../../src/ui/tema';

export default function PantallaTu() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { perfil } = useSesion();
  const [datos, setDatos] = useState<{ plantas: number; racha: Racha | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void (async () => {
        const agenda = await agendaDeHoy(await listarPlantas());
        const racha = await rachaDe(agenda).catch(() => null);
        if (vigente) setDatos({ plantas: agenda.length, racha });
      })();
      return () => {
        vigente = false;
      };
    }, []),
  );

  const nombre = perfil?.nombre ?? 'Tú';
  const racha = datos?.racha ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      contentContainerStyle={{ padding: espacio.lg, paddingTop: insets.top + espacio.xl, paddingBottom: 130, gap: espacio.xl }}
    >
      <Animated.View entering={FadeInDown.duration(280)} style={{ alignItems: 'center', gap: espacio.sm }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colorDePersona(perfil?.correo ?? perfil?.appleId ?? nombre),
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: tema.superficie,
          }}
        >
          <Text style={{ fontFamily: fuente.titulo, fontSize: 36, color: '#FFFFFF' }}>{(nombre.charAt(0) || '·').toUpperCase()}</Text>
        </View>
        <Text style={{ fontFamily: fuente.titulo, fontSize: 26, letterSpacing: -0.5, color: tema.texto }}>{nombre}</Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave }}>
          {[perfil?.ciudad?.nombre, perfil?.metodo === 'apple' ? 'Con Apple' : perfil?.correo].filter(Boolean).join(' · ')}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(70).duration(280)} style={{ flexDirection: 'row', gap: espacio.sm }}>
        <Numero valor={datos ? String(datos.plantas) : '–'} titulo={datos?.plantas === 1 ? 'planta' : 'plantas'} />
        <Pressable
          onPress={() => racha && felicitarRacha({ dias: racha.dias, mejor: racha.mejor, hoyCuenta: racha.hoyCuenta })}
          accessibilityRole="button"
          accessibilityLabel={racha ? `Racha de ${racha.dias} días` : 'Racha'}
          style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
        >
          <Numero
            valor={racha ? String(racha.dias) : '–'}
            titulo="de racha"
            icono={<Llama tamano={16} encendida={racha?.hoyCuenta ?? false} />}
            destacado
          />
        </Pressable>
        <Numero valor={racha ? String(racha.mejor) : '–'} titulo="la mejor" />
      </Animated.View>

      <Grupo titulo="Tus plantas">
        <Fila
          titulo="Conoce las plantas"
          detalle="Nombres, datos curiosos y cómo se ven"
          icono="library"
          colorIcono="#2E8B57"
          onPress={() => router.push('/especies')}
        />
        <Fila
          titulo="Equipos de riego"
          detalle="Las que se riegan juntas"
          icono="people"
          colorIcono="#3F7CAC"
          onPress={() => router.push('/equipos')}
        />
        <Fila
          titulo="Identificar una semilla"
          detalle="Sin foto: midiéndola"
          icono="ellipse"
          colorIcono="#8A6B3E"
          onPress={() => router.push('/semilla')}
        />
        <Fila titulo="Registrar a mano" icono="create" colorIcono="#7A6D99" onPress={() => router.push('/planta/nueva')} />
      </Grupo>

      <Grupo titulo="Tu jardín y tus amigos">
        <Fila
          titulo="Decorar mi jardín y mi casa"
          detalle="Barda, pisos, adornos y macetas"
          icono="color-palette"
          colorIcono="#C2185B"
          onPress={() => router.push('/decorar')}
        />
        <Fila
          titulo="Compartir mi jardín"
          detalle="Con un código QR"
          icono="qr-code"
          colorIcono="#2E8B57"
          onPress={() => router.push('/jardin/compartir')}
        />
        <Fila
          titulo="Agregar el jardín de alguien"
          icono="person-add"
          colorIcono="#C66A3D"
          onPress={() => router.push('/jardin/agregar')}
        />
      </Grupo>

      <Grupo>
        <Fila
          titulo="Ajustes"
          detalle="Tu cuenta, tu ciudad, Face ID"
          icono="settings"
          colorIcono="#6B7A73"
          onPress={() => router.push('/ajustes')}
        />
      </Grupo>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <Ionicons name="lock-closed" size={12} color={tema.textoSuave} />
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>Todo se guarda en este teléfono.</Text>
      </View>
    </ScrollView>
  );
}

function Numero({ valor, titulo, icono, destacado }: { valor: string; titulo: string; icono?: React.ReactNode; destacado?: boolean }) {
  const tema = useTema();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tema.superficie,
        borderRadius: radio.lg,
        borderWidth: 1,
        borderColor: destacado ? '#F4A45C' : tema.borde,
        paddingVertical: espacio.md,
        alignItems: 'center',
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icono}
        <Text style={{ fontFamily: fuente.titulo, fontSize: 24, color: destacado ? '#F07A1A' : tema.texto }}>{valor}</Text>
      </View>
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>{titulo}</Text>
    </View>
  );
}
