/**
 * De visita en el jardín de alguien.
 *
 * Arriba quién es y cuántos puntos lleva; luego su patio, su casa y su sombra
 * con el mismo mundo que el tuyo —se ve, no se riega ni se mueve nada—, y al
 * final tú contra él, parte por parte: en qué le ganas y en qué te gana.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calificar, ordenarTop } from '../../src/dominio/jardinCompartido';
import type { JardinCompartido } from '../../src/dominio/jardinCompartido';
import { zonaDe } from '../../src/dominio/lugares';
import type { Zona } from '../../src/dominio/lugares';
import type { Racha } from '../../src/dominio/racha';
import { cargarMiJardin, jardinesRecibidos, quitarJardin } from '../../src/servicios/comunidad';
import { PatioJuego } from '../../src/ui/PatioJuego';
import { useSesion } from '../../src/ui/Sesion';
import { Anillo, Avatar, Comparacion, Insignias, MEDALLA, colorDePersona } from '../../src/ui/comunidadUI';
import { espacio, fuente, radio, useTema } from '../../src/ui/tema';
import { estadosDeVisita } from '../../src/ui/visita';

const ZONAS: Array<{ clave: Zona; titulo: string; icono: keyof typeof Ionicons.glyphMap }> = [
  { clave: 'patio', titulo: 'Patio', icono: 'sunny' },
  { clave: 'casa', titulo: 'Casa', icono: 'home' },
  { clave: 'sombra', titulo: 'Sombra', icono: 'leaf' },
];

export default function PantallaVisita() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSesion();
  const [datos, setDatos] = useState<{ suyo: JardinCompartido | null; mio: JardinCompartido; lugar: number; total: number } | null>(null);
  const [zona, setZona] = useState<Zona | null>(null);

  useEffect(() => {
    void (async () => {
      const [otros, mio] = await Promise.all([jardinesRecibidos(), cargarMiJardin(perfil)]);
      const suyo = otros.find((j) => j.id === id) ?? null;
      const tabla = ordenarTop([mio, ...otros].map((jardin) => ({ jardin })));
      setDatos({ suyo, mio, lugar: tabla.findIndex((f) => f.jardin.id === id) + 1, total: tabla.length });
    })();
  }, [id, perfil]);

  const estados = useMemo(() => (datos?.suyo ? estadosDeVisita(datos.suyo) : []), [datos]);

  if (!datos) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: tema.fondo }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  const { suyo, mio, lugar, total } = datos;
  if (!suyo) {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.md }}>
        <Stack.Screen options={{ title: 'Jardín' }} />
        <Ionicons name="leaf-outline" size={36} color={tema.textoSuave} />
        <Text style={{ fontFamily: fuente.titulo, fontSize: 20, color: tema.texto }}>Ese jardín ya no está</Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave, textAlign: 'center' }}>
          Lo quitaste de tu tabla. Si te lo vuelven a compartir, regresa.
        </Text>
      </View>
    );
  }

  const suya = calificar(suyo);
  const tuya = calificar(mio);
  const porZona: Record<Zona, typeof estados> = { patio: [], casa: [], sombra: [] };
  for (const e of estados) porZona[zonaDe(e.planta.ubicacion)].push(e);
  const zonaVista: Zona = zona ?? ZONAS.find((z) => porZona[z.clave].length > 0)?.clave ?? 'patio';
  const medalla = lugar >= 1 && lugar <= 3 ? MEDALLA[lugar - 1] : undefined;
  // Lo que la escena necesita de una racha: los días y el fuego encendido.
  const racha = { dias: suyo.racha, mejor: suyo.mejorRacha, hoyCuenta: suyo.racha > 0 } as unknown as Racha;
  const dias = Math.max(0, Math.round((Date.now() - new Date(`${suyo.fecha}T12:00:00`).getTime()) / 86_400_000));
  const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  const diferencia = suya.total - tuya.total;

  const quitar = () => {
    const hacer = async () => {
      await quitarJardin(suyo.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      void hacer();
      return;
    }
    Alert.alert(`¿Quitar el jardín de ${suyo.dueno}?`, 'Sale de tu tabla. Si te lo vuelve a compartir, regresa.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void hacer() },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      contentContainerStyle={{ padding: espacio.lg, paddingBottom: insets.bottom + espacio.xl * 2, gap: espacio.lg }}
    >
      <Stack.Screen options={{ title: `Jardín de ${suyo.dueno}` }} />
      {suyo.ejemplo && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: tema.superficieAlta,
            borderRadius: radio.md,
            padding: espacio.md,
          }}
        >
          <Ionicons name="sparkles" size={16} color={tema.primario} />
          <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 13, lineHeight: 18, color: tema.textoSuave }}>
            Es un jardín de ejemplo: así se ve el de un amigo cuando te lo comparte. Lo puedes quitar abajo.
          </Text>
        </View>
      )}

      {/* Quién es */}
      <Animated.View entering={FadeInDown.duration(280)} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.md }}>
        <View>
          <Avatar nombre={suyo.dueno} color={colorDePersona(suyo.id)} lado={64} borde={medalla} />
          {medalla && (
            <View
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: medalla,
                borderWidth: 2,
                borderColor: tema.fondo,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 12, color: '#fff' }}>{lugar}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: fuente.titulo, fontSize: 24, letterSpacing: -0.4, color: tema.texto }}>
            {suyo.dueno}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: fuente.cuerpo, fontSize: 13.5, color: tema.textoSuave }}>
            {[suyo.ciudad, `lugar ${lugar} de ${total}`, `compartido ${cuando}`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Anillo valor={suya.total} color={colorDePersona(suyo.id)} retraso={200} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ flexDirection: 'row', gap: espacio.sm }}>
        <Dato valor={String(suyo.plantas.length)} titulo={suyo.plantas.length === 1 ? 'planta' : 'plantas'} />
        <Dato valor={`🔥 ${suyo.racha}`} titulo="racha" />
        <Dato valor={String(new Set(suyo.plantas.map((p) => p.especieId)).size)} titulo="especies" />
      </Animated.View>

      <Insignias lista={suya.insignias} />

      {/* Su mundo */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.superficieAlta, borderRadius: radio.completo, padding: 4, gap: 4 }}>
        {ZONAS.map((z) => {
          const activa = z.clave === zonaVista;
          return (
            <Pressable
              key={z.clave}
              onPress={() => setZona(z.clave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                minHeight: 38,
                borderRadius: radio.completo,
                backgroundColor: activa ? tema.superficie : 'transparent',
                opacity: pressed ? 0.8 : 1,
                shadowColor: '#000',
                shadowOpacity: activa ? 0.1 : 0,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
              })}
            >
              <Ionicons name={z.icono} size={14} color={activa ? tema.primario : tema.textoSuave} />
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: activa ? tema.texto : tema.textoSuave }}>{z.titulo}</Text>
              <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>{porZona[z.clave].length}</Text>
            </Pressable>
          );
        })}
      </View>

      {porZona[zonaVista].length > 0 ? (
        <PatioJuego
          key={zonaVista}
          escena={zonaVista}
          estados={porZona[zonaVista]}
          racha={racha}
          onCambio={() => undefined}
          visita={{ dueno: suyo.dueno }}
        />
      ) : (
        <View
          style={{
            backgroundColor: tema.superficie,
            borderRadius: radio.lg,
            borderWidth: 1,
            borderColor: tema.borde,
            padding: espacio.xl,
            alignItems: 'center',
            gap: espacio.sm,
          }}
        >
          <Ionicons name={ZONAS.find((z) => z.clave === zonaVista)!.icono} size={26} color={tema.textoSuave} />
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave }}>
            {suyo.dueno} no tiene plantas aquí.
          </Text>
        </View>
      )}

      {/* Tú contra él */}
      <View
        style={{
          backgroundColor: tema.superficie,
          borderRadius: radio.lg + 4,
          borderWidth: 1,
          borderColor: tema.borde,
          padding: espacio.lg,
          gap: espacio.md,
        }}
      >
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 11, letterSpacing: 0.8, color: tema.primario }}>TÚ CONTRA {suyo.dueno.toUpperCase()}</Text>
          <Text style={{ fontFamily: fuente.titulo, fontSize: 19, color: tema.texto }}>
            {diferencia > 0
              ? `Te lleva ${diferencia} ${diferencia === 1 ? 'punto' : 'puntos'}`
              : diferencia < 0
                ? `Le llevas ${-diferencia} ${diferencia === -1 ? 'punto' : 'puntos'}`
                : 'Van empatados'}
          </Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, lineHeight: 18, color: tema.textoSuave }}>{consejo(tuya, suya)}</Text>
        </View>
        <Comparacion tuya={tuya} suya={suya} dueno={suyo.dueno} />
      </View>

      <Pressable
        onPress={quitar}
        accessibilityRole="button"
        style={({ pressed }) => ({ alignSelf: 'center', paddingVertical: espacio.sm, paddingHorizontal: espacio.lg, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14, color: tema.critico }}>Quitar de mi tabla</Text>
      </Pressable>
    </ScrollView>
  );
}

function Dato({ valor, titulo }: { valor: string; titulo: string }) {
  const tema = useTema();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tema.superficie,
        borderRadius: radio.md + 2,
        borderWidth: 1,
        borderColor: tema.borde,
        paddingVertical: espacio.sm + 2,
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Text style={{ fontFamily: fuente.titulo, fontSize: 20, color: tema.texto }}>{valor}</Text>
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>{titulo}</Text>
    </View>
  );
}

/** Dónde está la diferencia más grande a su favor, dicho como algo que se puede hacer. */
function consejo(tuya: ReturnType<typeof calificar>, suya: ReturnType<typeof calificar>): string {
  const huecos = [
    { d: suya.partes.salud - tuya.partes.salud, texto: 'Tiene más plantas en su punto: atiende primero las que tienen sed.' },
    { d: suya.partes.constancia - tuya.partes.constancia, texto: 'Su racha es más larga: registra algo cada día y lo alcanzas.' },
    { d: suya.partes.variedad - tuya.partes.variedad, texto: 'Tiene más especies distintas: una planta nueva te acerca.' },
    { d: suya.partes.tamano - tuya.partes.tamano, texto: 'Tiene más plantas: su jardín es más grande.' },
  ].sort((a, b) => b.d - a.d);
  if (huecos[0].d <= 0) return 'Le ganas o empatas en todo. Sigue así.';
  return huecos[0].texto;
}
