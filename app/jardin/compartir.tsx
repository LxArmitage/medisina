/**
 * Compartir tu jardín: un código QR para que alguien lo escanee con su
 * teléfono, o el mismo código en un mensaje para mandarlo por WhatsApp.
 *
 * El QR va siempre negro sobre blanco, también en tema oscuro: con poco
 * contraste las cámaras batallan, y es lo último que debe fallar.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calificar, codificarJardin, mensajeDeJardin } from '../../src/dominio/jardinCompartido';
import type { JardinCompartido } from '../../src/dominio/jardinCompartido';
import { cargarMiJardin } from '../../src/servicios/comunidad';
import { useSesion } from '../../src/ui/Sesion';
import { Avatar, colorDePersona } from '../../src/ui/comunidadUI';
import { BotonGrande } from '../../src/ui/cuentaUI';
import { espacio, fuente, radio, useTema } from '../../src/ui/tema';

export default function PantallaCompartirJardin() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { perfil } = useSesion();
  const [jardin, setJardin] = useState<JardinCompartido | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    void cargarMiJardin(perfil).then(setJardin);
  }, [perfil]);

  if (!jardin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: tema.fondo }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  if (jardin.plantas.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, padding: espacio.xl, justifyContent: 'center', alignItems: 'center', gap: espacio.md }}>
        <Ionicons name="leaf-outline" size={40} color={tema.textoSuave} />
        <Text style={{ fontFamily: fuente.titulo, fontSize: 21, color: tema.texto, textAlign: 'center' }}>Tu jardín está vacío</Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, lineHeight: 21, color: tema.textoSuave, textAlign: 'center' }}>
          Escanea tus plantas primero. Cuando tengas alguna, aquí sale el código para que tus amigos la vean.
        </Text>
      </View>
    );
  }

  const codigo = codificarJardin(jardin);
  const mensaje = mensajeDeJardin(jardin);
  const c = calificar(jardin);
  const lado = Math.min(width - espacio.lg * 2 - 48, 320);

  const copiar = async () => {
    const listo = await Clipboard.setStringAsync(mensaje).catch(() => false);
    if (!listo) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  const mandar = async () => {
    try {
      await Share.share({ message: mensaje });
    } catch {
      // En la computadora no siempre hay a dónde compartir: se copia.
      await copiar();
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      contentContainerStyle={{ padding: espacio.lg, paddingBottom: insets.bottom + espacio.xl, gap: espacio.lg, alignItems: 'stretch' }}
    >
      <Animated.View
        entering={ZoomIn.springify().damping(16)}
        style={{
          alignSelf: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 28,
          padding: 24,
          paddingBottom: 18,
          alignItems: 'center',
          gap: 14,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <QRCode value={codigo} size={lado} ecl="L" color="#10100C" backgroundColor="#FFFFFF" quietZone={4} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar nombre={jardin.dueno} color={colorDePersona(jardin.id)} lado={34} />
          <View>
            <Text style={{ fontFamily: fuente.titulo, fontSize: 17, color: '#10100C' }}>El jardín de {jardin.dueno}</Text>
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: '#6B6457' }}>
              {jardin.plantas.length} {jardin.plantas.length === 1 ? 'planta' : 'plantas'} · {c.total} puntos · 🔥 {jardin.racha}
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.delay(200)}
        style={{ fontFamily: fuente.cuerpo, fontSize: 14, lineHeight: 20, color: tema.textoSuave, textAlign: 'center', paddingHorizontal: espacio.md }}
      >
        Que tu amigo abra Jardines, toque el botón del código QR (arriba a la derecha) y apunte a tu pantalla. Si está lejos, mándaselo
        por mensaje.
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(260).duration(300)} style={{ flexDirection: 'row', gap: espacio.sm }}>
        <View style={{ flex: 1 }}>
          <BotonGrande texto="Mandar" icono={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} onPress={() => void mandar()} />
        </View>
        <View style={{ flex: 1 }}>
          <BotonGrande texto={copiado ? 'Copiado' : 'Copiar'} variante="claro" icono={copiado ? 'checkmark' : 'copy-outline'} onPress={() => void copiar()} />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(320).duration(300)}
        style={{
          flexDirection: 'row',
          gap: espacio.sm,
          backgroundColor: tema.superficie,
          borderRadius: radio.md + 2,
          borderWidth: 1,
          borderColor: tema.borde,
          padding: espacio.md,
        }}
      >
        <Ionicons name="lock-closed" size={16} color={tema.textoSuave} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 13, lineHeight: 19, color: tema.textoSuave }}>
          Viaja tu nombre de pila{jardin.ciudad ? ', tu ciudad' : ''}, tu racha y tus plantas: especie, apodo, dónde viven y cómo andan de agua.
          No viajan fotos, ni tu correo, ni tu bitácora. Es la foto de hoy: si cambia tu jardín, compártelo otra vez.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}
