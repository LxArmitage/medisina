/**
 * Agregar el jardín de alguien: escaneas su código QR o pegas el mensaje que
 * te mandó.
 *
 * La cámara lee sola, sin botón: en cuanto el código entra en el cuadro, el
 * marco se pone verde, el teléfono da un golpecito y aparece la tarjeta del
 * jardín que llegó. Un código que no es de MEDISINA no se lee dos veces
 * seguidas: se avisa una vez y se ignora un rato, para que no parpadee.
 */

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calificar } from '../../src/dominio/jardinCompartido';
import type { JardinCompartido } from '../../src/dominio/jardinCompartido';
import { agregarJardin } from '../../src/servicios/comunidad';
import { Anillo, Avatar, colorDePersona } from '../../src/ui/comunidadUI';
import { BotonGrande } from '../../src/ui/cuentaUI';
import { Segmentado } from '../../src/ui/iOS';
import { espacio, fuente, radio, useTema } from '../../src/ui/tema';

type Modo = 'escanear' | 'pegar';

export default function PantallaAgregarJardin() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  // En la computadora casi nunca hay a quién apuntarle la cámara.
  const [modo, setModo] = useState<Modo>(Platform.OS === 'web' ? 'pegar' : 'escanear');
  const [llegado, setLlegado] = useState<{ jardin: JardinCompartido; nuevo: boolean } | null>(null);

  const recibir = useCallback(async (codigo: string): Promise<string | null> => {
    const r = await agregarJardin(codigo);
    if (!r.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      return r.motivo;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setLlegado({ jardin: r.jardin, nuevo: r.nuevo });
    return null;
  }, []);

  if (llegado) {
    return (
      <Llegada
        jardin={llegado.jardin}
        nuevo={llegado.nuevo}
        onOtro={() => setLlegado(null)}
        onVisitar={() => {
          router.back();
          router.push({ pathname: '/jardin/[id]', params: { id: llegado.jardin.id } });
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tema.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: espacio.lg, paddingBottom: insets.bottom + espacio.xl, gap: espacio.lg }}
      >
        <Segmentado<Modo>
          opciones={[
            { valor: 'escanear', etiqueta: 'Escanear QR' },
            { valor: 'pegar', etiqueta: 'Pegar mensaje' },
          ]}
          valor={modo}
          onCambio={setModo}
        />
        {modo === 'escanear' ? <Escaner onCodigo={recibir} /> : <Pegar onCodigo={recibir} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------

function Escaner({ onCodigo }: { onCodigo: (codigo: string) => Promise<string | null> }) {
  const tema = useTema();
  const { width } = useWindowDimensions();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [aviso, setAviso] = useState<string | null>(null);
  const [leido, setLeido] = useState(false);
  const ocupado = useRef(false);
  const ignorar = useRef<{ codigo: string; hasta: number } | null>(null);

  // El marco respira mientras busca: se nota que está viva.
  const pulso = useSharedValue(1);
  useEffect(() => {
    pulso.set(withRepeat(withSequence(withTiming(1.035, { duration: 900 }), withTiming(1, { duration: 900 })), -1));
  }, [pulso]);
  const estiloMarco = useAnimatedStyle(() => ({ transform: [{ scale: pulso.get() }] }));

  const lado = Math.min(width - espacio.lg * 2, 420);

  const alLeer = useCallback(
    async ({ data }: { data: string }) => {
      if (ocupado.current) return;
      const ahora = Date.now();
      if (ignorar.current && ignorar.current.codigo === data && ahora < ignorar.current.hasta) return;
      ocupado.current = true;
      const error = await onCodigo(data);
      if (error) {
        ignorar.current = { codigo: data, hasta: ahora + 4000 };
        setAviso(error);
        setTimeout(() => setAviso(null), 3200);
        ocupado.current = false;
      } else {
        setLeido(true);
      }
    },
    [onCodigo],
  );

  if (!permiso) return <View style={{ height: lado }} />;

  if (!permiso.granted) {
    return (
      <View
        style={{
          backgroundColor: tema.superficie,
          borderRadius: radio.lg + 4,
          borderWidth: 1,
          borderColor: tema.borde,
          padding: espacio.xl,
          alignItems: 'center',
          gap: espacio.md,
        }}
      >
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tema.primarioSuave, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera" size={28} color={tema.primario} />
        </View>
        <Text style={{ fontFamily: fuente.titulo, fontSize: 19, color: tema.texto, textAlign: 'center' }}>Para leer el código hace falta la cámara</Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, lineHeight: 20, color: tema.textoSuave, textAlign: 'center' }}>
          Sólo mira el código mientras esta pantalla está abierta. No toma fotos ni guarda nada.
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <BotonGrande texto={permiso.canAskAgain ? 'Permitir la cámara' : 'Abre Ajustes para permitirla'} icono="camera-outline" onPress={() => void pedirPermiso()} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: espacio.md }}>
      <View style={{ width: lado, height: lado, alignSelf: 'center', borderRadius: radio.lg + 8, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={leido ? undefined : (r) => void alLeer(r)}
        />
        {/* El cuadro donde va el código: esquinas, no un rectángulo completo. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ width: lado * 0.66, height: lado * 0.66 }, estiloMarco]}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((e) => (
              <Esquina key={e} donde={e} color={leido ? '#3DDC84' : '#FFFFFF'} />
            ))}
          </Animated.View>
        </View>
        {aviso && (
          <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(200)}
            style={{
              position: 'absolute',
              left: espacio.md,
              right: espacio.md,
              bottom: espacio.md,
              backgroundColor: 'rgba(20,16,12,0.86)',
              borderRadius: radio.completo,
              paddingHorizontal: espacio.lg,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle" size={17} color="#FFB4A2" />
            <Text style={{ flex: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: '#fff' }}>{aviso}</Text>
          </Animated.View>
        )}
      </View>
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, lineHeight: 20, color: tema.textoSuave, textAlign: 'center', paddingHorizontal: espacio.lg }}>
        Pídele a tu amigo que abra Jardines y toque "Compartir mi jardín". Apunta a su pantalla: se lee solo.
      </Text>
    </View>
  );
}

function Esquina({ donde, color }: { donde: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const largo = 34;
  const grueso = 5;
  const arriba = donde[0] === 't';
  const izquierda = donde[1] === 'l';
  return (
    <View
      style={{
        position: 'absolute',
        width: largo,
        height: largo,
        top: arriba ? 0 : undefined,
        bottom: arriba ? undefined : 0,
        left: izquierda ? 0 : undefined,
        right: izquierda ? undefined : 0,
        borderColor: color,
        borderTopWidth: arriba ? grueso : 0,
        borderBottomWidth: arriba ? 0 : grueso,
        borderLeftWidth: izquierda ? grueso : 0,
        borderRightWidth: izquierda ? 0 : grueso,
        borderTopLeftRadius: arriba && izquierda ? 14 : 0,
        borderTopRightRadius: arriba && !izquierda ? 14 : 0,
        borderBottomLeftRadius: !arriba && izquierda ? 14 : 0,
        borderBottomRightRadius: !arriba && !izquierda ? 14 : 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------

function Pegar({ onCodigo }: { onCodigo: (codigo: string) => Promise<string | null> }) {
  const tema = useTema();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sacudida = useSharedValue(0);
  const estiloSacudida = useAnimatedStyle(() => ({ transform: [{ translateX: sacudida.get() }] }));

  const agregar = async (valor = texto) => {
    if (!valor.trim()) return;
    setOcupado(true);
    const e = await onCodigo(valor);
    setOcupado(false);
    if (e) {
      setError(e);
      sacudida.set(
        withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withSpring(0, { duration: 260 })),
      );
    }
  };

  return (
    <View style={{ gap: espacio.md }}>
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, lineHeight: 20, color: tema.textoSuave }}>
        Si te mandaron el jardín por mensaje, copia el mensaje entero y pégalo aquí. No importa que traiga texto de más.
      </Text>
      <Animated.View style={estiloSacudida}>
        <TextInput
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            setError(null);
          }}
          placeholder="Mira mi jardín en MEDISINA… MEDISINA1:[…]"
          placeholderTextColor={tema.textoSuave}
          multiline
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            minHeight: 120,
            maxHeight: 220,
            textAlignVertical: 'top',
            backgroundColor: tema.superficie,
            borderRadius: radio.md + 2,
            borderWidth: 1.5,
            borderColor: error ? tema.critico : tema.borde,
            padding: espacio.md,
            paddingTop: espacio.md,
            fontFamily: fuente.cuerpo,
            fontSize: 14,
            color: tema.texto,
          }}
        />
      </Animated.View>
      {error && (
        <Animated.View entering={FadeIn.duration(160)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle" size={16} color={tema.critico} />
          <Text style={{ flex: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.critico }}>{error}</Text>
        </Animated.View>
      )}
      <View style={{ flexDirection: 'row', gap: espacio.sm }}>
        <View style={{ flex: 1 }}>
          <BotonGrande
            texto="Pegar"
            variante="claro"
            icono="clipboard-outline"
            onPress={async () => {
              const pegado = await Clipboard.getStringAsync().catch(() => '');
              if (!pegado) {
                setError('No hay nada copiado todavía.');
                return;
              }
              setTexto(pegado);
              setError(null);
              // Si lo pegado ya es un jardín, no hace falta otro toque.
              if (pegado.includes('MEDISINA1:')) void agregar(pegado);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <BotonGrande texto="Agregar" icono="add" deshabilitado={!texto.trim()} cargando={ocupado} onPress={() => void agregar()} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** El jardín que acaba de llegar: quién, cuántos puntos, y a visitarlo. */
function Llegada({ jardin, nuevo, onVisitar, onOtro }: { jardin: JardinCompartido; nuevo: boolean; onVisitar: () => void; onOtro: () => void }) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const c = calificar(jardin);
  const entrada = useSharedValue(0.6);
  useEffect(() => {
    entrada.set(withSpring(1, { duration: 520, dampingRatio: 0.55 }));
  }, [entrada]);
  const estiloAvatar = useAnimatedStyle(() => ({ transform: [{ scale: entrada.get() }] }));

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo, padding: espacio.xl, paddingBottom: insets.bottom + espacio.xl, justifyContent: 'center', gap: espacio.xl }}>
      <View style={{ alignItems: 'center', gap: espacio.md }}>
        <Animated.View style={estiloAvatar}>
          <Avatar nombre={jardin.dueno} color={colorDePersona(jardin.id)} lado={88} />
        </Animated.View>
        <Animated.Text
          entering={FadeInDown.delay(120).duration(300)}
          style={{ fontFamily: fuente.titulo, fontSize: 26, letterSpacing: -0.5, color: tema.texto, textAlign: 'center' }}
        >
          {nuevo ? `Llegó el jardín de ${jardin.dueno}` : `Actualizaste el jardín de ${jardin.dueno}`}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(180).duration(300)} style={{ fontFamily: fuente.cuerpo, fontSize: 15, color: tema.textoSuave, textAlign: 'center' }}>
          {[jardin.ciudad, `${jardin.plantas.length} ${jardin.plantas.length === 1 ? 'planta' : 'plantas'}`, `racha de ${jardin.racha} días`]
            .filter(Boolean)
            .join(' · ')}
        </Animated.Text>
      </View>
      <Animated.View
        entering={FadeInDown.delay(260).duration(320)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.lg,
          backgroundColor: tema.superficie,
          borderRadius: radio.lg + 4,
          borderWidth: 1,
          borderColor: tema.borde,
          padding: espacio.lg,
        }}
      >
        <Anillo valor={c.total} color={colorDePersona(jardin.id)} retraso={320} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.texto }}>{c.total} puntos</Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, lineHeight: 18, color: tema.textoSuave }}>
            Ya aparece en tu tabla de Jardines. Cuando te mande uno nuevo, se actualiza.
          </Text>
        </View>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(340).duration(320)} style={{ gap: espacio.sm }}>
        <BotonGrande texto="Visitar su jardín" icono="walk-outline" onPress={onVisitar} />
        <BotonGrande texto="Agregar otro" variante="claro" onPress={onOtro} />
      </Animated.View>
    </View>
  );
}
