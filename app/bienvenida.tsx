/**
 * La bienvenida: lo primero que ve quien abre la app sin sesión.
 *
 * Como las de iOS: una imagen que se mueve (tres gemelos girando despacio),
 * tres líneas de qué hace la app, y abajo los botones. Nada de carrusel de
 * cinco pantallas que nadie lee: lo que importa cabe en una.
 *
 * Con cuenta en el teléfono, el botón grande es "Entrar"; sin cuenta, "Crear
 * cuenta". Apple aparece sólo donde existe (iPhone).
 */

import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { buscarEspecie } from '../src/dominio/catalogo';
import { calcularMorfologia } from '../src/dominio/morfologia';
import type { Especie } from '../src/dominio/tipos';
import { appleDisponible, entrarConApple, pedirApple } from '../src/servicios/cuenta';
import { Gemelo } from '../src/ui/Gemelo';
import { BotonGrande } from '../src/ui/cuentaUI';
import { useSesion } from '../src/ui/Sesion';
import { espacio, fuente, radio, useTema } from '../src/ui/tema';

const TRES = ['monstera-deliciosa', 'lophocereus-schottii', 'phalaenopsis'];

const PUNTOS: Array<{ icono: keyof typeof Ionicons.glyphMap; texto: string }> = [
  { icono: 'scan', texto: 'Le tomas una foto y la reconozco, aquí mismo y sin internet.' },
  { icono: 'water', texto: 'Te digo cuándo regar, con el clima de tu ciudad.' },
  { icono: 'sunny', texto: 'Tu patio, tu casa y tu sombra, como un juego.' },
];

function morfologiaBonita(especie: Especie, flores = 0) {
  const m = calcularMorfologia({
    especie,
    estado: {
      fecha: '',
      aguaDisponibleMm: especie.aguaUtilMm,
      fraccionDisponible: 0.7,
      demandaMm: 0,
      aporteMm: 0,
      diasConsecutivosEncharcado: 0,
      diasConsecutivosEnEstres: 0,
      nivel: 'optimo',
      esPronostico: false,
    },
    edadMeses: 18,
  });
  return { ...m, flores: Math.max(m.flores, flores) };
}

export default function PantallaBienvenida() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sesion = useSesion();
  const [hayApple, setHayApple] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const hayCuenta = sesion.perfil !== null;

  useEffect(() => {
    void appleDisponible().then(setHayApple);
  }, []);

  const plantas = useMemo(
    () =>
      TRES.map((id, i) => {
        const e = buscarEspecie(id);
        return e ? { especie: e, morfologia: morfologiaBonita(e, i === 2 ? 3 : i === 1 ? 1 : 0) } : null;
      }).filter((x): x is NonNullable<typeof x> => x !== null),
    [],
  );

  const chica = height < 700;
  const lado = Math.min(width * 0.42, chica ? 150 : 190);

  async function conApple() {
    setAviso(null);
    if (hayCuenta) {
      const r = await entrarConApple();
      if (r.ok) sesion.entrar(r.perfil);
      else if (r.motivo) setAviso(r.motivo);
      return;
    }
    const r = await pedirApple();
    if (!r.ok) {
      if (r.motivo) setAviso(r.motivo);
      return;
    }
    router.push({
      pathname: '/cuenta/crear',
      params: { metodo: 'apple', appleId: r.appleId, nombre: r.nombre ?? '', correo: r.correo ?? '' },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* Un halo de luz detrás de las plantas, como sol de mañana. */}
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={width} height={height * 0.62}>
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="42%" r="60%">
            <Stop offset="0" stopColor={tema.esOscuro ? '#1E4A34' : '#D9F2E4'} stopOpacity={1} />
            <Stop offset="1" stopColor={tema.fondo} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height * 0.62} fill="url(#halo)" />
      </Svg>

      <View style={{ flex: 1, paddingTop: insets.top + espacio.lg, paddingHorizontal: espacio.xl }}>
        <Animated.View
          entering={FadeIn.duration(600)}
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: chica ? 0 : espacio.lg }}
        >
          {plantas.map((p, i) => (
            <Animated.View
              key={p.especie.id}
              entering={FadeInDown.delay(120 + i * 110).springify().damping(16)}
              style={{ marginHorizontal: i === 1 ? -lado * 0.18 : -lado * 0.1, zIndex: i === 1 ? 2 : 1 }}
            >
              <Gemelo
                especieId={p.especie.id}
                morfologia={p.morfologia}
                ancho={i === 1 ? lado : lado * 0.78}
                alto={(i === 1 ? lado : lado * 0.78) * 1.2}
                giro={-0.6 + i * 0.5}
                inclinacion={0.26}
                interactivo={i === 1}
                detalle="alto"
                colorMaceta={['#B8683F', '#E4DCCB', '#4A5A52'][i]}
                sombra
              />
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(500)} style={{ alignItems: 'center', gap: 6, marginTop: espacio.md }}>
          <Text style={{ fontFamily: fuente.titulo, fontSize: chica ? 36 : 44, letterSpacing: -1, color: tema.texto }}>
            MEDISINA
          </Text>
          <Text style={{ fontFamily: fuente.tituloItalica, fontSize: 17, color: tema.textoSuave, textAlign: 'center' }}>
            {hayCuenta ? `Hola de nuevo, ${sesion.perfil?.nombre.split(/\s+/)[0]}` : 'Tus plantas, con gemelo y expediente'}
          </Text>
        </Animated.View>

        {!hayCuenta && (
          <View style={{ gap: espacio.md, marginTop: chica ? espacio.lg : espacio.xl }}>
            {PUNTOS.map((p, i) => (
              <Animated.View
                key={p.icono}
                entering={FadeInUp.delay(520 + i * 90).duration(420)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.md }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: tema.primarioSuave,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={p.icono} size={18} color={tema.primario} />
                </View>
                <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 14.5, lineHeight: 20, color: tema.texto }}>
                  {p.texto}
                </Text>
              </Animated.View>
            ))}
          </View>
        )}
      </View>

      <Animated.View
        entering={FadeInUp.delay(760).duration(450)}
        style={{ paddingHorizontal: espacio.xl, paddingBottom: Math.max(insets.bottom, espacio.lg) + espacio.sm, gap: espacio.md }}
      >
        {aviso && (
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.critico, textAlign: 'center' }}>{aviso}</Text>
        )}

        {hayApple && Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              hayCuenta
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={
              tema.esOscuro
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radio.md + 2}
            style={{ height: 52 }}
            onPress={() => void conApple()}
          />
        )}

        <BotonGrande
          texto={hayCuenta ? 'Entrar' : 'Crear cuenta'}
          onPress={() => router.push(hayCuenta ? '/cuenta/entrar' : '/cuenta/crear')}
        />
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, lineHeight: 17, color: tema.textoSuave, textAlign: 'center' }}>
          {hayCuenta
            ? 'Tus plantas te esperan justo donde las dejaste.'
            : 'Tu cuenta y tus plantas se quedan en este teléfono. Es gratis y funciona sin internet.'}
        </Text>
      </Animated.View>
    </View>
  );
}
