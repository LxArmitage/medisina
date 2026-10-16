/**
 * Mis plantas — todas, con la misma cara que tienen en el patio.
 *
 * Antes era una lista de texto agrupada por banda de luz ("media sombra",
 * "adentro"…), que no coincidía con los tres lugares de Hoy y obligaba a leer
 * para reconocer cada planta. Ahora es una cuadrícula de retratos: el gemelo
 * de cada una sobre el fondo de su zona, su nombre y cómo anda hoy. Agrupada
 * igual que el patio —Patio, Casa, Sombra— para que las dos pantallas cuenten
 * la misma historia.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listarPlantas } from '../../src/datos/db';
import { especiesReales } from '../../src/dominio/catalogo';
import { zonaDe } from '../../src/dominio/lugares';
import type { Zona } from '../../src/dominio/lugares';
import { agendaDeHoy } from '../../src/servicios/agenda';
import type { EstadoDePlanta } from '../../src/servicios/agenda';
import { RetratoPlanta } from '../../src/ui/RetratoPlanta';
import { Boton, Vacio } from '../../src/ui/componentes';
import { etiquetaAccion } from '../../src/ui/etiquetas';
import { BarraCompacta, Fila, Grupo, TituloGrande, useDesplazamiento } from '../../src/ui/iOS';
import { colorDeNivel, espacio, fuente, radio, useTema } from '../../src/ui/tema';

const ZONAS: Array<{ clave: Zona; titulo: string; icono: keyof typeof Ionicons.glyphMap; color: string }> = [
  { clave: 'patio', titulo: 'Patio', icono: 'sunny', color: '#E8940C' },
  { clave: 'casa', titulo: 'Casa', icono: 'home', color: '#C66A3D' },
  { clave: 'sombra', titulo: 'Sombra', icono: 'leaf', color: '#2E8B57' },
];

export default function PantallaPlantas() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { y, alDesplazar } = useDesplazamiento();
  const [estados, setEstados] = useState<EstadoDePlanta[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void (async () => {
        const plantas = await listarPlantas();
        const agenda = await agendaDeHoy(plantas);
        if (vigente) setEstados(agenda);
      })();
      return () => {
        vigente = false;
      };
    }, []),
  );

  const porZona = useMemo(() => {
    const mapa: Record<Zona, EstadoDePlanta[]> = { patio: [], casa: [], sombra: [] };
    for (const e of estados ?? []) mapa[zonaDe(e.planta.ubicacion)].push(e);
    for (const lista of Object.values(mapa)) lista.sort((a, b) => a.planta.apodo.localeCompare(b.planta.apodo));
    return mapa;
  }, [estados]);

  const columna = Math.floor((Math.min(width, 700) - espacio.lg * 2 - espacio.md) / 2);
  const total = estados?.length ?? 0;
  const pendientes = (estados ?? []).filter((e) => etiquetaAccion(e.recomendacion.accion, e.recomendacion.urgencia).pideAtencion).length;

  const botonAgregar = (
    <Pressable
      onPress={() => router.push('/escanear')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Agregar una planta"
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: tema.primarioSuave,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name="add" size={20} color={tema.primario} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <BarraCompacta titulo="Mis plantas" y={y} derecha={total > 0 ? botonAgregar : undefined} />

      <Animated.ScrollView
        onScroll={alDesplazar}
        scrollEventThrottle={16}
        contentContainerStyle={{
          padding: espacio.lg,
          paddingTop: insets.top + espacio.lg,
          paddingBottom: 130,
          gap: espacio.xl,
        }}
      >
        <TituloGrande
          titulo="Mis plantas"
          subtitulo={
            estados === null
              ? ' '
              : total === 0
                ? 'Aún no tienes ninguna'
                : `${total} ${total === 1 ? 'planta' : 'plantas'}${pendientes > 0 ? ` · ${pendientes} ${pendientes === 1 ? 'pide' : 'piden'} algo hoy` : ' · todas bien hoy'}`
          }
          y={y}
          derecha={total > 0 ? botonAgregar : undefined}
        />

        {estados === null ? (
          <ActivityIndicator color={tema.primario} style={{ marginTop: espacio.xl }} />
        ) : total === 0 ? (
          <Vacio
            titulo="Todavía no tienes plantas"
            descripcion="Toca Escanear, abajo al centro: le tomas foto a tu planta, la reconozco y nace su gemelo."
            accion={<Boton titulo="Escanear una planta" onPress={() => router.push('/escanear')} />}
          />
        ) : (
          ZONAS.filter((z) => porZona[z.clave].length > 0).map((z, iz) => (
            <View key={z.clave} style={{ gap: espacio.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${z.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={z.icono} size={15} color={z.color} />
                </View>
                <Text style={{ fontFamily: fuente.titulo, fontSize: 20, color: tema.texto }}>{z.titulo}</Text>
                <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave }}>{porZona[z.clave].length}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.md }}>
                {porZona[z.clave].map((e, i) => (
                  <Animated.View key={e.planta.id} entering={FadeInDown.delay(Math.min(8, iz * 2 + i) * 50).duration(260)}>
                    <TarjetaPlanta estado={e} ancho={columna} />
                  </Animated.View>
                ))}
              </View>
            </View>
          ))
        )}

        {total > 0 && (
          <Grupo titulo="Más" nota="Todo se guarda en este teléfono. Nada sale de aquí.">
            <Fila
              titulo="Conoce las plantas"
              detalle={`Las ${especiesReales().length} que reconozco: nombres, datos curiosos y cómo se ven`}
              icono="library"
              colorIcono="#2E8B57"
              onPress={() => router.push('/especies')}
            />
            <Fila
              titulo="Equipos de riego"
              detalle="Las que se riegan juntas, y las que no deben compartir maceta"
              icono="people"
              colorIcono="#3F7CAC"
              onPress={() => router.push('/equipos')}
            />
            <Fila
              titulo="Identificar una semilla"
              detalle="Sin foto: se identifica midiéndola"
              icono="ellipse"
              colorIcono="#8A6B3E"
              onPress={() => router.push('/semilla')}
            />
            <Fila titulo="Registrar a mano" icono="create" colorIcono="#7A6D99" onPress={() => router.push('/planta/nueva')} />
          </Grupo>
        )}
      </Animated.ScrollView>
    </View>
  );
}

/** Retrato, nombre, especie y cómo está hoy. Toda la tarjeta abre su ficha. */
function TarjetaPlanta({ estado, ancho }: { estado: EstadoDePlanta; ancho: number }) {
  const tema = useTema();
  const { planta, especie, recomendacion, estadoHoy } = estado;
  const accion = etiquetaAccion(recomendacion.accion, recomendacion.urgencia);
  const color = colorDeNivel(tema, estadoHoy.nivel);
  const comun = especie.nombresComunes[0];

  return (
    <Pressable
      onPress={() => router.push(`/planta/${planta.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${planta.apodo}, ${comun}. ${accion.texto}`}
      style={({ pressed }) => ({
        width: ancho,
        borderRadius: radio.lg + 2,
        overflow: 'hidden',
        backgroundColor: tema.superficie,
        borderWidth: 1,
        borderColor: accion.pideAtencion ? color : tema.borde,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <RetratoPlanta estado={estado} ancho={ancho} alto={Math.round(ancho * 0.92)} />
      {accion.pideAtencion && (
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: color,
            borderRadius: radio.completo,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Ionicons name="water" size={11} color={tema.esOscuro ? '#10100C' : '#fff'} />
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11, color: tema.esOscuro ? '#10100C' : '#fff' }}>{accion.texto}</Text>
        </View>
      )}
      <View style={{ padding: espacio.sm + 2, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fuente.cuerpoNegro, fontSize: 15, color: tema.texto }}>
            {planta.apodo}
          </Text>
        </View>
        <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
          {comun.charAt(0).toUpperCase() + comun.slice(1)}
        </Text>
      </View>
    </Pressable>
  );
}
