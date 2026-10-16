/**
 * Jardines: los más top entre los que te han compartido, y el tuyo.
 *
 * Arriba tu jardín con su calificación y el botón de compartirlo (un QR).
 * Luego el podio —oro, plata, bronce— y la tabla. Tocar cualquiera te lleva
 * de visita: su patio, su casa y su sombra, con el mismo mundo que el tuyo.
 *
 * Sin servidor (ver `dominio/jardinCompartido.ts`): la tabla es de los
 * jardines que te llegaron por QR o por mensaje, y así se dice.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calificar, ordenarTop } from '../../src/dominio/jardinCompartido';
import type { JardinCompartido } from '../../src/dominio/jardinCompartido';
import { asegurarJardinDeEjemplo, cargarMiJardin, jardinesRecibidos } from '../../src/servicios/comunidad';
import { useSesion } from '../../src/ui/Sesion';
import { Anillo, Avatar, Insignias, MEDALLA, colorDePersona } from '../../src/ui/comunidadUI';
import { espacio, fuente, radio, useTema } from '../../src/ui/tema';

interface Fila {
  jardin: JardinCompartido;
  mio: boolean;
}

export default function PantallaJardines() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { perfil } = useSesion();
  const [filas, setFilas] = useState<Fila[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void (async () => {
        await asegurarJardinDeEjemplo().catch(() => undefined);
        const [yo, otros] = await Promise.all([cargarMiJardin(perfil), jardinesRecibidos()]);
        if (!vigente) return;
        setFilas(ordenarTop([{ jardin: yo, mio: true }, ...otros.map((j) => ({ jardin: j, mio: false }))]));
      })();
      return () => {
        vigente = false;
      };
    }, [perfil]),
  );

  if (!filas) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: tema.fondo }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  const mio = filas.find((f) => f.mio)!;
  const miCalif = calificar(mio.jardin);
  const miLugar = filas.indexOf(mio) + 1;
  const hayOtros = filas.length > 1;
  const podio = filas.slice(0, 3);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      contentContainerStyle={{ padding: espacio.lg, paddingTop: insets.top + espacio.lg, paddingBottom: 120, gap: espacio.xl }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fuente.titulo, fontSize: 30, letterSpacing: -0.8, color: tema.texto }}>Jardines</Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave }}>
            {hayOtros ? `Vas en el lugar ${miLugar} de ${filas.length}` : 'Los más top de tus amigos'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/jardin/agregar')}
          accessibilityRole="button"
          accessibilityLabel="Agregar el jardín de alguien"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: tema.primarioSuave,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="qr-code" size={19} color={tema.primario} />
        </Pressable>
      </View>

      {/* Tu jardín */}
      <Animated.View entering={FadeInDown.duration(300)}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.md }}>
            <Anillo valor={miCalif.total} color={tema.primario} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 11, letterSpacing: 0.8, color: tema.primario }}>TU JARDÍN</Text>
              <Text style={{ fontFamily: fuente.titulo, fontSize: 20, color: tema.texto }}>
                {mio.jardin.plantas.length} {mio.jardin.plantas.length === 1 ? 'planta' : 'plantas'} · {mio.jardin.racha} días
              </Text>
              <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
                Salud {miCalif.partes.salud}/40 · Constancia {miCalif.partes.constancia}/30 · Variedad {miCalif.partes.variedad}/20
              </Text>
            </View>
          </View>
          <Insignias lista={miCalif.insignias} />
          <Pressable
            onPress={() => router.push('/jardin/compartir')}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 46,
              borderRadius: radio.md,
              backgroundColor: tema.primario,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Ionicons name="share-outline" size={18} color={tema.esOscuro ? '#0B1A13' : '#fff'} />
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.esOscuro ? '#0B1A13' : '#fff' }}>
              Compartir mi jardín
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {hayOtros ? (
        <>
          {/* El podio: el segundo a la izquierda, el primero al centro y más alto. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: espacio.sm }}>
            {[1, 0, 2].map((i) => {
              const f = podio[i];
              if (!f) return <View key={i} style={{ flex: 1 }} />;
              const alto = [118, 92, 76][i];
              return (
                <Animated.View key={f.jardin.id} entering={FadeInUp.delay(120 + i * 90).springify().damping(15)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Avatar nombre={f.jardin.dueno} color={colorDePersona(f.jardin.id)} lado={i === 0 ? 58 : 44} borde={MEDALLA[i]} />
                  <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.texto }}>
                    {f.mio ? 'Tú' : f.jardin.dueno}
                  </Text>
                  <Pressable
                    onPress={() => (f.mio ? router.push('/') : router.push({ pathname: '/jardin/[id]', params: { id: f.jardin.id } }))}
                    accessibilityRole="button"
                    accessibilityLabel={`Lugar ${i + 1}: ${f.mio ? 'tu jardín' : `el jardín de ${f.jardin.dueno}`}, ${calificar(f.jardin).total} puntos`}
                    style={({ pressed }) => ({
                      alignSelf: 'stretch',
                      height: alto,
                      borderTopLeftRadius: radio.md,
                      borderTopRightRadius: radio.md,
                      backgroundColor: f.mio ? tema.primarioSuave : tema.superficie,
                      borderWidth: 1,
                      borderColor: MEDALLA[i],
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Ionicons name="trophy" size={i === 0 ? 24 : 19} color={MEDALLA[i]} />
                    <Text style={{ fontFamily: fuente.titulo, fontSize: i === 0 ? 24 : 19, color: tema.texto }}>{calificar(f.jardin).total}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          <View style={{ gap: espacio.sm }}>
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, letterSpacing: 0.8, color: tema.textoSuave }}>LA TABLA</Text>
            {filas.map((f, i) => (
              <FilaJardin key={f.jardin.id} fila={f} lugar={i + 1} />
            ))}
          </View>
        </>
      ) : (
        <Animated.View entering={FadeInUp.delay(150)} style={{ alignItems: 'center', gap: espacio.md, paddingVertical: espacio.xl }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: tema.superficieAlta, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people" size={34} color={tema.textoSuave} />
          </View>
          <Text style={{ fontFamily: fuente.titulo, fontSize: 20, color: tema.texto, textAlign: 'center' }}>
            Todavía nadie te ha compartido su jardín
          </Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, lineHeight: 20, color: tema.textoSuave, textAlign: 'center' }}>
            Pídele a alguien que abra Jardines y toque "Compartir mi jardín". Escaneas su código y aparece aquí, con su lugar
            en la tabla. Lo puedes visitar cuando quieras.
          </Text>
          <Pressable
            onPress={() => router.push('/jardin/agregar')}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: espacio.xl,
              minHeight: 46,
              borderRadius: radio.completo,
              backgroundColor: tema.primarioSuave,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="scan" size={18} color={tema.primario} />
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.primario }}>Escanear un jardín</Text>
          </Pressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}

function FilaJardin({ fila, lugar }: { fila: Fila; lugar: number }) {
  const tema = useTema();
  const c = calificar(fila.jardin);
  return (
    <Pressable
      onPress={() => (fila.mio ? router.push('/') : router.push({ pathname: '/jardin/[id]', params: { id: fila.jardin.id } }))}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.md,
        backgroundColor: fila.mio ? tema.primarioSuave : tema.superficie,
        borderRadius: radio.md,
        borderWidth: 1,
        borderColor: fila.mio ? tema.primario : tema.borde,
        paddingHorizontal: espacio.md,
        paddingVertical: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ width: 26, textAlign: 'center', fontFamily: fuente.cuerpoNegro, fontSize: 15, color: lugar <= 3 ? MEDALLA[lugar - 1] : tema.textoSuave }}>
        {lugar}
      </Text>
      <Avatar nombre={fila.jardin.dueno} color={colorDePersona(fila.jardin.id)} borde={lugar <= 3 ? MEDALLA[lugar - 1] : undefined} />
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.texto }}>
            {fila.mio ? `${fila.jardin.dueno} (tú)` : fila.jardin.dueno}
          </Text>
          {fila.jardin.ejemplo && (
            <View style={{ backgroundColor: tema.superficieAlta, borderRadius: radio.completo, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 10.5, color: tema.textoSuave }}>Ejemplo</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>
          {[fila.jardin.ciudad, `${fila.jardin.plantas.length} plantas`, `🔥 ${fila.jardin.racha}`].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={{ fontFamily: fuente.titulo, fontSize: 20, color: tema.texto }}>{c.total}</Text>
      <Ionicons name="chevron-forward" size={16} color={tema.textoSuave} />
    </Pressable>
  );
}
