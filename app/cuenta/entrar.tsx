/**
 * Entrar: con Face ID si lo tiene encendido, con Apple si así se creó, o con
 * el correo y la contraseña.
 *
 * "¿La olvidaste?" no manda un correo —no hay servidor que lo mande—: pide
 * Face ID o el código del teléfono, que prueban que eres su dueño, y deja
 * poner una contraseña nueva. Si el teléfono no tiene ninguno de los dos, la
 * única salida honesta es empezar de cero, y se dice así.
 */

import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fuerzaContrasena } from '../../src/dominio/cuenta';
import {
  appleDisponible,
  cambiarContrasena,
  entrarConApple,
  entrarConCorreo,
  entrarConDesbloqueo,
  identificarDueno,
} from '../../src/servicios/cuenta';
import { useSesion } from '../../src/ui/Sesion';
import { BarraPasos, BotonGrande, CampoCuenta, MedidorFuerza } from '../../src/ui/cuentaUI';
import { espacio, fuente, radio, useTema } from '../../src/ui/tema';

export default function PantallaEntrar() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const sesion = useSesion();
  const perfil = sesion.perfil;

  const [correo, setCorreo] = useState(perfil?.correo ?? '');
  const [contrasena, setContrasena] = useState('');
  const [nueva, setNueva] = useState('');
  const [modoNueva, setModoNueva] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sacudir, setSacudir] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [hayApple, setHayApple] = useState(false);
  const campo = useRef<TextInput>(null);
  const pila = perfil?.nombre.split(/\s+/)[0] ?? '';
  const conDesbloqueo = !!perfil?.desbloqueo && sesion.desbloqueo !== null;

  useEffect(() => {
    void appleDisponible().then(setHayApple);
  }, []);

  // Con Face ID encendido, se ofrece solo al entrar: es lo que hace iOS.
  const yaOfrecido = useRef(false);
  useEffect(() => {
    if (!conDesbloqueo || yaOfrecido.current) return;
    yaOfrecido.current = true;
    const t = setTimeout(() => void conFace(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conDesbloqueo]);

  function fallar(texto: string) {
    setError(texto);
    setSacudir((n) => n + 1);
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }

  function exito() {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }

  async function conCorreo() {
    setError(null);
    if (!contrasena) return fallar('Escribe tu contraseña.');
    setCargando(true);
    const r = await entrarConCorreo(correo, contrasena);
    setCargando(false);
    if (!r.ok) {
      setContrasena('');
      return fallar(r.motivo);
    }
    exito();
    sesion.entrar(r.perfil);
  }

  async function conFace() {
    setError(null);
    const r = await entrarConDesbloqueo();
    if (!r.ok) {
      if (r.motivo) setError(r.motivo);
      return;
    }
    exito();
    sesion.entrar(r.perfil);
  }

  async function conAppleId() {
    setError(null);
    const r = await entrarConApple();
    if (!r.ok) {
      if (r.motivo) fallar(r.motivo);
      return;
    }
    exito();
    sesion.entrar(r.perfil);
  }

  async function olvide() {
    setError(null);
    if (sesion.desbloqueo === null) {
      Alert.alert(
        'Sin forma de recuperarla',
        'Este teléfono no tiene Face ID ni código, así que no hay cómo probar que eres su dueño. Puedes borrar la cuenta y empezar de cero; se borran también tus plantas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Borrar y empezar', style: 'destructive', onPress: () => void sesion.borrarTodo().then(() => router.replace('/bienvenida')) },
        ],
      );
      return;
    }
    const ok = await identificarDueno('Cambiar tu contraseña de MEDISINA');
    if (ok) {
      setModoNueva(true);
      setTimeout(() => campo.current?.focus(), 300);
    }
  }

  async function guardarNueva() {
    const f = fuerzaContrasena(nueva);
    if (!f.sirve) return fallar(f.texto);
    setCargando(true);
    await cambiarContrasena(nueva);
    const r = await entrarConCorreo(perfil?.correo ?? correo, nueva);
    setCargando(false);
    if (!r.ok) return fallar(r.motivo);
    exito();
    sesion.entrar(r.perfil);
  }

  if (!perfil) {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, padding: espacio.xl, paddingTop: insets.top + espacio.sm, gap: espacio.xl }}>
        <BarraPasos paso={0} total={1} onAtras={() => router.back()} />
        <Text style={{ fontFamily: fuente.titulo, fontSize: 30, color: tema.texto }}>Todavía no hay cuenta</Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 15, lineHeight: 21, color: tema.textoSuave }}>
          En este teléfono nadie ha creado una. Tus plantas viven aquí, así que la cuenta también se crea aquí.
        </Text>
        <BotonGrande texto="Crear cuenta" onPress={() => router.replace('/cuenta/crear')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tema.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + espacio.sm, paddingHorizontal: espacio.xl }}>
        <BarraPasos paso={0} total={1} onAtras={() => router.back()} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: espacio.xl, gap: espacio.lg }}
      >
        <Animated.View entering={FadeInDown.duration(320)} style={{ gap: espacio.sm }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: tema.primario,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: espacio.sm,
            }}
          >
            <Text style={{ fontFamily: fuente.titulo, fontSize: 28, color: tema.esOscuro ? '#0B1A13' : '#FFFFFF' }}>
              {pila.charAt(0).toUpperCase() || '·'}
            </Text>
          </View>
          <Text style={{ fontFamily: fuente.titulo, fontSize: 30, lineHeight: 36, color: tema.texto }}>
            {modoNueva ? 'Tu contraseña nueva' : `Hola de nuevo${pila ? `, ${pila}` : ''}`}
          </Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 15, lineHeight: 21, color: tema.textoSuave }}>
            {modoNueva
              ? 'Ya comprobé que eres el dueño del teléfono. Escribe la nueva y entras.'
              : perfil.metodo === 'apple'
                ? 'Tu cuenta se hizo con Apple.'
                : perfil.correo}
          </Text>
        </Animated.View>

        {modoNueva ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ gap: espacio.md }}>
            <TextInput value={perfil.correo ?? ''} textContentType="username" editable={false} style={{ height: 0, opacity: 0 }} />
            <CampoCuenta
              refCampo={campo}
              value={nueva}
              onChangeText={(v) => {
                setNueva(v);
                setError(null);
              }}
              placeholder="Mínimo 8 caracteres"
              secreto
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={() => void guardarNueva()}
              error={error}
              sacudir={sacudir}
            />
            <MedidorFuerza nivel={fuerzaContrasena(nueva).nivel} texto={nueva ? fuerzaContrasena(nueva).texto : ' '} />
          </Animated.View>
        ) : perfil.metodo === 'correo' ? (
          <View style={{ gap: espacio.md }}>
            <CampoCuenta
              etiqueta="Correo"
              value={correo}
              onChangeText={setCorreo}
              textContentType="username"
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => campo.current?.focus()}
            />
            <CampoCuenta
              etiqueta="Contraseña"
              refCampo={campo}
              value={contrasena}
              onChangeText={(v) => {
                setContrasena(v);
                setError(null);
              }}
              secreto
              textContentType="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => void conCorreo()}
              error={error}
              sacudir={sacudir}
            />
            <Pressable onPress={() => void olvide()} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-end' }}>
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14, color: tema.primario }}>¿La olvidaste?</Text>
            </Pressable>
          </View>
        ) : (
          error && <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13.5, color: tema.critico }}>{error}</Text>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: espacio.xl, paddingTop: espacio.sm, paddingBottom: Math.max(insets.bottom, espacio.lg), gap: espacio.sm }}>
        {modoNueva ? (
          <BotonGrande texto="Guardar y entrar" cargando={cargando} onPress={() => void guardarNueva()} />
        ) : (
          <>
            {perfil.metodo === 'correo' && <BotonGrande texto="Entrar" cargando={cargando} onPress={() => void conCorreo()} />}
            {perfil.metodo === 'apple' && hayApple && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={
                  tema.esOscuro
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={radio.md + 2}
                style={{ height: 52 }}
                onPress={() => void conAppleId()}
              />
            )}
            {conDesbloqueo && (
              <BotonGrande
                texto={`Entrar con ${sesion.nombreDesbloqueo}`}
                icono={sesion.desbloqueo === 'huella' ? 'finger-print' : 'scan-outline'}
                variante={perfil.metodo === 'correo' ? 'claro' : 'primario'}
                onPress={() => void conFace()}
              />
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
