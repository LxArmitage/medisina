/**
 * Escoger la maceta de una planta: barro, talavera, rosa mexicano…
 *
 * Aparece en la caja de diálogo del patio, en lugar de los botones, con la
 * planta en grande para ver cómo le queda antes de decidir. Cada toque se
 * guarda al momento: no hay "guardar" que se olvide.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { MACETAS } from '../dominio/decoracion';
import type { EstiloMaceta } from '../dominio/decoracion';
import { edadEnMeses } from '../dominio/fenologia';
import { calcularMorfologia } from '../dominio/morfologia';
import type { EstadoDePlanta } from '../servicios/agenda';
import { elegirMaceta } from '../servicios/decoracion';
import { Gemelo } from './Gemelo';
import { colorDeMaceta } from './macetas';
import { espacio, fuente, radio } from './tema';
import type { Tema } from './tema';

export function PanelMaceta({
  estado,
  actual,
  tema,
  onCerrar,
}: {
  estado: EstadoDePlanta;
  actual?: EstiloMaceta;
  tema: Tema;
  onCerrar: () => void;
}) {
  const { planta, especie, estadoHoy, snapshot } = estado;
  const morfologia = useMemo(
    () =>
      calcularMorfologia({
        especie,
        estado: estadoHoy,
        fenologia: snapshot.fenologia,
        edadMeses: edadEnMeses(planta.fechaAdquisicion),
        medidas: planta.medidas,
      }),
    [especie, estadoHoy, snapshot.fenologia, planta.fechaAdquisicion, planta.medidas],
  );
  const enMaceta = planta.contenedor.tipo === 'maceta';
  return (
    <View
      style={{
        minHeight: 184,
        backgroundColor: tema.superficie,
        borderBottomLeftRadius: radio.lg + 4,
        borderBottomRightRadius: radio.lg + 4,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: tema.borde,
        padding: espacio.lg,
      }}
    >
      <Animated.View entering={FadeIn.duration(180)} style={{ gap: espacio.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fuente.titulo, fontSize: 19, color: tema.texto }}>
            La maceta de {planta.apodo}
          </Text>
          <Pressable
            onPress={onCerrar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Listo"
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              height: 32,
              borderRadius: 16,
              backgroundColor: tema.primario,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 13.5, color: tema.esOscuro ? '#0B1A13' : '#FFFFFF' }}>Listo</Text>
          </Pressable>
        </View>

        {!enMaceta ? (
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave }}>
            {planta.contenedor.tipo === 'agua' ? 'Vive en un frasco con agua: no lleva maceta.' : 'Está plantada en el suelo: no lleva maceta.'}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: espacio.md, alignItems: 'center' }}>
            <View style={{ width: 96, height: 110, borderRadius: radio.md, backgroundColor: tema.superficieAlta, overflow: 'hidden' }}>
              <Gemelo
                especieId={especie.id}
                morfologia={morfologia}
                apariencia={planta.apariencia}
                recipiente="maceta"
                colorMaceta={colorDeMaceta(planta.contenedor.material)}
                estiloMaceta={actual}
                semilla={planta.id}
                ancho={96}
                alto={110}
                detalle="bajo"
                sombra={false}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.sm, paddingRight: espacio.sm }}>
              {MACETAS.map((m) => {
                const activa = m.valor === (actual ?? null);
                return (
                  <Pressable
                    key={m.valor}
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => undefined);
                      void elegirMaceta(planta.id, m.valor);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activa }}
                    accessibilityLabel={`Maceta ${m.nombre}`}
                    style={({ pressed }) => ({
                      width: 64,
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 6,
                      borderRadius: radio.md,
                      borderWidth: 2,
                      borderColor: activa ? tema.primario : 'transparent',
                      backgroundColor: activa ? tema.primarioSuave : 'transparent',
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    })}
                  >
                    <MacetaDibujo estilo={m.valor} />
                    <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11, color: tema.texto }}>
                      {m.nombre.split(' ')[0]}
                    </Text>
                    {activa && (
                      <View style={{ position: 'absolute', top: 2, right: 2 }}>
                        <Ionicons name="checkmark-circle" size={16} color={tema.primario} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

/** Una macetita plana con el color (o el dibujo) de cada estilo, para su botón. */
export function MacetaDibujo({ estilo, lado = 40 }: { estilo: EstiloMaceta; lado?: number }) {
  const color = MACETAS.find((m) => m.valor === estilo)?.color ?? '#B8683F';
  const cuerpo = estilo === 'talavera' ? '#F3F0E6' : color;
  return (
    <Svg width={lado} height={lado} viewBox="0 0 40 40">
      <Path d="M8 14 L32 14 L28 36 L12 36 Z" fill={cuerpo} />
      <Rect x={5} y={8} width={30} height={7} rx={2} fill={estilo === 'talavera' ? '#2F4FA0' : color} />
      <Rect x={5} y={8} width={30} height={2.5} rx={1} fill="#FFFFFF" opacity={0.25} />
      {estilo === 'talavera' && (
        <>
          <Rect x={9} y={20} width={22} height={4} fill="#2F4FA0" />
          <Path d="M12 26 l3 3 l-3 3 l-3 -3 Z M20 26 l3 3 l-3 3 l-3 -3 Z M28 26 l3 3 l-3 3 l-3 -3 Z" fill="#E3A62E" />
          <Rect x={12} y={34} width={16} height={2} fill="#2F4FA0" />
        </>
      )}
      {estilo === 'concreto' && <Path d="M13 20 h2 M22 25 h3 M16 30 h2" stroke="#6E6C66" strokeWidth={1.2} />}
    </Svg>
  );
}
