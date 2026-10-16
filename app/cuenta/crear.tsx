/**
 * Crear la cuenta, una pregunta por pantalla.
 *
 * Como el alta de un Apple ID: un título grande que pregunta una sola cosa, un
 * campo, y el botón de seguir pegado arriba del teclado. Cada paso entra
 * deslizándose desde la derecha (y al volver, desde la izquierda), con la
 * barra de arriba llenándose.
 *
 * Con Apple ya se sabe quién eres: se saltan nombre, correo y contraseña (si
 * Apple no dio el nombre, se pregunta sólo eso).
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Ciudad } from '../../src/dominio/ciudades';
import { correoValido, fuerzaContrasena, nombreValido } from '../../src/dominio/cuenta';
import { crearCuentaConApple, crearCuentaConCorreo } from '../../src/servicios/cuenta';
import { SelectorCiudad } from '../../src/ui/SelectorCiudad';
import { useSesion } from '../../src/ui/Sesion';
import { BarraPasos, BotonGrande, CampoCuenta, MedidorFuerza } from '../../src/ui/cuentaUI';
import { espacio, fuente, useTema } from '../../src/ui/tema';

type Paso = 'nombre' | 'correo' | 'contrasena' | 'ciudad' | 'desbloqueo' | 'listo';

export default function PantallaCrearCuenta() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const sesion = useSesion();
  const params = useLocalSearchParams<{ metodo?: string; appleId?: string; nombre?: string; correo?: string }>();
  const conApple = params.metodo === 'apple' && !!params.appleId;

  const pasos = useMemo<Paso[]>(() => {
    const lista: Paso[] = [];
    if (!conApple || !params.nombre) lista.push('nombre');
    if (!conApple) lista.push('correo', 'contrasena');
    lista.push('ciudad');
    if (sesion.desbloqueo !== null) lista.push('desbloqueo');
    return lista;
  }, [conApple, params.nombre, sesion.desbloqueo]);

  const [indice, setIndice] = useState(0);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  const [nombre, setNombre] = useState(params.nombre ?? '');
  const [correo, setCorreo] = useState(params.correo ?? '');
  const [contrasena, setContrasena] = useState('');
  const [ciudad, setCiudad] = useState<Ciudad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sacudir, setSacudir] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const desplazador = useRef<ScrollView>(null);
  const campo = useRef<TextInput>(null);

  const paso: Paso = terminado ? 'listo' : pasos[indice];
  const fuerza = fuerzaContrasena(contrasena);

  // El campo de cada paso toma el foco solo, cuando termina de entrar.
  useEffect(() => {
    if (paso === 'nombre' || paso === 'correo' || paso === 'contrasena') {
      const t = setTimeout(() => campo.current?.focus(), 380);
      return () => clearTimeout(t);
    }
  }, [paso]);

  function fallar(texto: string) {
    setError(texto);
    setSacudir((n) => n + 1);
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }

  function valido(): boolean {
    if (paso === 'nombre' && !nombreValido(nombre)) return false;
    if (paso === 'correo' && !correoValido(correo)) return false;
    if (paso === 'contrasena' && !fuerza.sirve) return false;
    if (paso === 'ciudad' && !ciudad) return false;
    return true;
  }

  async function seguir(desbloqueo?: boolean) {
    setError(null);
    if (paso === 'nombre' && !nombreValido(nombre)) return fallar('Escribe tu nombre (con dos letras basta).');
    if (paso === 'correo' && !correoValido(correo)) return fallar('Ese correo no se ve completo.');
    if (paso === 'contrasena' && !fuerza.sirve) return fallar(fuerza.texto);
    if (paso === 'ciudad' && !ciudad) return fallar('Elige tu ciudad para sacar el clima.');

    const ultimo = indice === pasos.length - 1;
    if (!ultimo && desbloqueo === undefined) {
      if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
      setDireccion(1);
      setIndice((i) => i + 1);
      desplazador.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    await crear(desbloqueo ?? false);
  }

  async function crear(desbloqueo: boolean) {
    if (!ciudad) return;
    setGuardando(true);
    try {
      const resto = { ciudad: { ...ciudad }, desbloqueo };
      const perfil = conApple
        ? await crearCuentaConApple({ appleId: params.appleId!, nombre: nombre || 'Tú', correo: params.correo || undefined }, resto)
        : await crearCuentaConCorreo({ nombre, correo, contrasena }, resto);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setTerminado(true);
      // Un momento para ver el "listo" antes de entrar al jardín.
      setTimeout(() => sesion.entrar(perfil), 1300);
    } catch {
      setGuardando(false);
      fallar('No pude guardar la cuenta. Intenta otra vez.');
    }
  }

  function atras() {
    setError(null);
    if (indice === 0) {
      router.back();
      return;
    }
    setDireccion(-1);
    setIndice((i) => i - 1);
  }

  const entrada = direccion === 1 ? SlideInRight : SlideInLeft;
  const salida = direccion === 1 ? SlideOutLeft : SlideOutRight;
  const pila = nombre.trim().split(/\s+/)[0] ?? '';

  if (paso === 'listo') {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, alignItems: 'center', justifyContent: 'center', gap: espacio.lg, padding: espacio.xl }}>
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: tema.primario, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="checkmark" size={60} color={tema.esOscuro ? '#0B1A13' : '#FFFFFF'} />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(250)} style={{ fontFamily: fuente.titulo, fontSize: 30, color: tema.texto, textAlign: 'center' }}>
          Listo{pila ? `, ${pila}` : ''}
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(400)} style={{ fontFamily: fuente.cuerpo, fontSize: 15, color: tema.textoSuave, textAlign: 'center' }}>
          Vamos a tu jardín.
        </Animated.Text>
      </View>
    );
  }

  const titulo = {
    nombre: '¿Cómo te llamas?',
    correo: `Mucho gusto${pila ? `, ${pila}` : ''}. ¿Tu correo?`,
    contrasena: 'Crea una contraseña',
    ciudad: '¿En qué ciudad están tus plantas?',
    desbloqueo: `¿Abrir con ${sesion.nombreDesbloqueo}?`,
  }[paso];
  const detalle = {
    nombre: 'Así te voy a llamar cuando te hable de tus plantas.',
    correo: 'Es para entrar. No te voy a escribir ni se lo doy a nadie.',
    contrasena: 'Se guarda cifrada en el llavero de este teléfono. Ni yo la puedo leer.',
    ciudad: 'De ahí saco el clima: la lluvia, el calor y las heladas que le tocan a tu jardín.',
    desbloqueo: 'Así nadie más abre tus plantas en tu teléfono. Lo puedes cambiar en Ajustes.',
  }[paso];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tema.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + espacio.sm, paddingHorizontal: espacio.xl }}>
        <BarraPasos paso={indice} total={pasos.length} onAtras={atras} />
      </View>

      <ScrollView
        ref={desplazador}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: espacio.xl, paddingTop: espacio.xl, paddingBottom: espacio.xl }}
      >
        <Animated.View key={paso} entering={entrada.duration(320)} exiting={salida.duration(220)} style={{ gap: espacio.lg }}>
          <View style={{ gap: espacio.sm }}>
            <Text style={{ fontFamily: fuente.titulo, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: tema.texto }}>
              {titulo}
            </Text>
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 15, lineHeight: 21, color: tema.textoSuave }}>{detalle}</Text>
          </View>

          {paso === 'nombre' && (
            <CampoCuenta
              refCampo={campo}
              value={nombre}
              onChangeText={(v) => {
                setNombre(v);
                setError(null);
              }}
              placeholder="Tu nombre"
              textContentType="givenName"
              autoComplete="name-given"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => void seguir()}
              error={error}
              sacudir={sacudir}
            />
          )}

          {paso === 'correo' && (
            <CampoCuenta
              refCampo={campo}
              value={correo}
              onChangeText={(v) => {
                setCorreo(v);
                setError(null);
              }}
              placeholder="tu@correo.com"
              textContentType="emailAddress"
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => void seguir()}
              error={error}
              sacudir={sacudir}
            />
          )}

          {paso === 'contrasena' && (
            <View style={{ gap: espacio.md }}>
              {/* El correo va escondido pero presente: así el llavero de iCloud
                  sabe de qué cuenta es la contraseña que sugiere y guarda. */}
              <TextInput value={correo} textContentType="username" autoComplete="username" editable={false} style={{ height: 0, opacity: 0 }} />
              <CampoCuenta
                refCampo={campo}
                value={contrasena}
                onChangeText={(v) => {
                  setContrasena(v);
                  setError(null);
                }}
                placeholder="Mínimo 8 caracteres"
                secreto
                textContentType="newPassword"
                autoComplete="new-password"
                passwordRules="minlength: 8;"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => void seguir()}
                error={error}
                sacudir={sacudir}
              />
              <MedidorFuerza nivel={fuerza.nivel} texto={contrasena ? fuerza.texto : 'Una frase larga es más segura que una palabra rara.'} />
            </View>
          )}

          {paso === 'ciudad' && (
            <View style={{ gap: espacio.md }}>
              <SelectorCiudad
                elegida={ciudad}
                onElegir={(c) => {
                  setCiudad(c);
                  setError(null);
                  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
                }}
                onEnfocar={() => setTimeout(() => desplazador.current?.scrollTo({ y: 150, animated: true }), 150)}
              />
              {error && <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.critico }}>{error}</Text>}
            </View>
          )}

          {paso === 'desbloqueo' && (
            <View style={{ alignItems: 'center', paddingVertical: espacio.xl }}>
              <Animated.View
                entering={ZoomIn.delay(150).springify().damping(14)}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 32,
                  backgroundColor: tema.primarioSuave,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={sesion.desbloqueo === 'huella' ? 'finger-print' : sesion.desbloqueo === 'face' ? 'scan-outline' : 'keypad-outline'}
                  size={64}
                  color={tema.primario}
                />
              </Animated.View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: espacio.xl, paddingTop: espacio.sm, paddingBottom: Math.max(insets.bottom, espacio.lg), gap: espacio.sm }}>
        {paso === 'desbloqueo' ? (
          <>
            <BotonGrande texto={`Sí, usar ${sesion.nombreDesbloqueo}`} cargando={guardando} onPress={() => void seguir(true)} />
            <BotonGrande texto="Ahora no" variante="claro" deshabilitado={guardando} onPress={() => void seguir(false)} />
          </>
        ) : (
          <BotonGrande
            texto={indice === pasos.length - 1 ? 'Crear mi cuenta' : 'Continuar'}
            cargando={guardando}
            deshabilitado={!valido()}
            onPress={() => void seguir()}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
