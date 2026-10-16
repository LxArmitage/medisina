/**
 * Decorar: tu patio, tu casa y tu sombra, a tu gusto; y la maceta de cada
 * planta.
 *
 * Arriba, la escena en chiquito, con los mismos dibujos que el patio de
 * verdad; abajo, las opciones. Cada toque se ve al momento y se guarda al
 * momento: no hay un "guardar" que se olvide.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { listarPlantas } from '../src/datos/db';
import { buscarEspecie } from '../src/dominio/catalogo';
import {
  ADORNOS_CASA,
  ADORNOS_PATIO,
  ADORNOS_SOMBRA,
  BARDAS,
  CORTINAS,
  MACETAS,
  PAREDES,
  PISOS_CASA,
  PISOS_PATIO,
  PISOS_SOMBRA,
  TAPETES,
  alternar,
} from '../src/dominio/decoracion';
import type { Decoracion, EstiloMaceta, Opcion, OpcionAdorno } from '../src/dominio/decoracion';
import type { Planta } from '../src/dominio/tipos';
import { actualizarDecoracion, elegirMaceta, useDecoracion, useMacetas } from '../src/servicios/decoracion';
import { MuestraEspecie } from '../src/ui/MuestraEspecie';
import { MacetaDibujo } from '../src/ui/PanelMaceta';
import { VistaPreviaEscena } from '../src/ui/PatioJuego';
import { MuestraAdorno } from '../src/ui/adornos';
import { Segmentado } from '../src/ui/iOS';
import { ALTO_MUNDO } from '../src/ui/mundoPatio';
import { espacio, fuente, radio, useTema } from '../src/ui/tema';

type Pestana = 'patio' | 'casa' | 'sombra' | 'macetas';

/** El ancho del mundo de la vista previa, antes de achicarla a la pantalla. */
const ANCHO_MUESTRA = 640;

export default function PantallaDecorar() {
  const tema = useTema();
  const { width } = useWindowDimensions();
  const decoracion = useDecoracion();
  const macetas = useMacetas();
  const [pestana, setPestana] = useState<Pestana>('patio');
  const [plantas, setPlantas] = useState<Planta[]>([]);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void listarPlantas().then((p) => vigente && setPlantas(p.filter((x) => x.contenedor.tipo === 'maceta')));
      return () => {
        vigente = false;
      };
    }, []),
  );

  const cambiar = (cambio: (d: Decoracion) => Decoracion) => {
    void Haptics.selectionAsync().catch(() => undefined);
    void actualizarDecoracion(cambio);
  };

  const lado = Math.min(width, 640) - espacio.lg * 2;
  const escala = lado / ANCHO_MUESTRA;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tema.fondo }} contentContainerStyle={{ padding: espacio.lg, gap: espacio.lg, paddingBottom: espacio.xxl }}>
      <Stack.Screen options={{ title: 'Decorar' }} />
      <Segmentado<Pestana>
        opciones={[
          { valor: 'patio', etiqueta: 'Patio' },
          { valor: 'casa', etiqueta: 'Casa' },
          { valor: 'sombra', etiqueta: 'Sombra' },
          { valor: 'macetas', etiqueta: 'Macetas' },
        ]}
        valor={pestana}
        onCambio={setPestana}
      />

      {pestana !== 'macetas' && (
        <View
          style={{ width: lado, height: ALTO_MUNDO * escala, borderRadius: radio.lg, overflow: 'hidden', borderWidth: 1, borderColor: tema.borde }}
          accessibilityLabel={`Así se ve tu ${pestana === 'patio' ? 'patio' : pestana === 'casa' ? 'casa' : 'rincón de sombra'}`}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: ANCHO_MUESTRA,
              height: ALTO_MUNDO,
              transform: [
                { translateX: -(ANCHO_MUESTRA * (1 - escala)) / 2 },
                { translateY: -(ALTO_MUNDO * (1 - escala)) / 2 },
                { scale: escala },
              ],
            }}
          >
            <VistaPreviaEscena escena={pestana} decoracion={decoracion} ancho={ANCHO_MUESTRA} />
          </View>
        </View>
      )}

      {pestana === 'patio' && (
        <>
          <Colores
            titulo="La barda"
            opciones={BARDAS}
            valor={decoracion.patio.barda}
            onCambio={(barda) => cambiar((d) => ({ ...d, patio: { ...d.patio, barda } }))}
          />
          <Colores
            titulo="El piso"
            opciones={PISOS_PATIO}
            valor={decoracion.patio.piso}
            onCambio={(piso) => cambiar((d) => ({ ...d, patio: { ...d.patio, piso } }))}
          />
          <Adornos
            zona="patio"
            opciones={ADORNOS_PATIO}
            elegidos={decoracion.patio.adornos}
            onCambio={(a) => cambiar((d) => ({ ...d, patio: { ...d.patio, adornos: alternar(d.patio.adornos, a) } }))}
          />
        </>
      )}

      {pestana === 'casa' && (
        <>
          <Colores titulo="Las paredes" opciones={PAREDES} valor={decoracion.casa.pared} onCambio={(pared) => cambiar((d) => ({ ...d, casa: { ...d.casa, pared } }))} />
          <Colores titulo="Las cortinas" opciones={CORTINAS} valor={decoracion.casa.cortina} onCambio={(cortina) => cambiar((d) => ({ ...d, casa: { ...d.casa, cortina } }))} />
          <Colores titulo="El piso" opciones={PISOS_CASA} valor={decoracion.casa.piso} onCambio={(piso) => cambiar((d) => ({ ...d, casa: { ...d.casa, piso } }))} />
          <Colores titulo="El tapete" opciones={TAPETES} valor={decoracion.casa.tapete} onCambio={(tapete) => cambiar((d) => ({ ...d, casa: { ...d.casa, tapete } }))} />
          <Adornos
            zona="casa"
            opciones={ADORNOS_CASA}
            elegidos={decoracion.casa.adornos}
            onCambio={(a) => cambiar((d) => ({ ...d, casa: { ...d.casa, adornos: alternar(d.casa.adornos, a) } }))}
          />
        </>
      )}

      {pestana === 'sombra' && (
        <>
          <Colores titulo="El piso" opciones={PISOS_SOMBRA} valor={decoracion.sombra.piso} onCambio={(piso) => cambiar((d) => ({ ...d, sombra: { ...d.sombra, piso } }))} />
          <Adornos
            zona="sombra"
            opciones={ADORNOS_SOMBRA}
            elegidos={decoracion.sombra.adornos}
            onCambio={(a) => cambiar((d) => ({ ...d, sombra: { ...d.sombra, adornos: alternar(d.sombra.adornos, a) } }))}
          />
        </>
      )}

      {pestana === 'macetas' && (
        <View style={{ gap: espacio.sm }}>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave, lineHeight: 20 }}>
            Escoge la maceta de cada planta. También se cambia en el patio: toca la planta y luego “Maceta”.
          </Text>
          {plantas.length === 0 && (
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.textoSuave, textAlign: 'center', marginTop: espacio.lg }}>
              Todavía no tienes plantas en maceta.
            </Text>
          )}
          {plantas.map((planta) => {
            const especie = buscarEspecie(planta.especieId);
            if (!especie) return null;
            const actual = macetas[planta.id];
            return (
              <View
                key={planta.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: tema.superficie, borderRadius: radio.lg, borderWidth: 1, borderColor: tema.borde, padding: espacio.sm }}
              >
                <View style={{ width: 60, alignItems: 'center' }}>
                  <MuestraMaceta especieId={planta.especieId} plantaId={planta.id} estilo={actual} />
                  <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: tema.texto }}>
                    {planta.apodo}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                  {MACETAS.map((m) => {
                    const activa = m.valor === actual;
                    return (
                      <Pressable
                        key={m.valor}
                        onPress={() => {
                          void Haptics.selectionAsync().catch(() => undefined);
                          void elegirMaceta(planta.id, m.valor);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: activa }}
                        accessibilityLabel={`Maceta ${m.nombre} para ${planta.apodo}`}
                        style={({ pressed }) => ({
                          padding: 4,
                          borderRadius: radio.md,
                          borderWidth: 2,
                          borderColor: activa ? tema.primario : 'transparent',
                          backgroundColor: activa ? tema.primarioSuave : 'transparent',
                          transform: [{ scale: pressed ? 0.93 : 1 }],
                        })}
                      >
                        <MacetaDibujo estilo={m.valor} lado={34} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/** Una fila de opciones de color (o de material), con su nombre abajo. */
function Colores<T extends string>({ titulo, opciones, valor, onCambio }: { titulo: string; opciones: Opcion<T>[]; valor: T; onCambio: (v: T) => void }) {
  const tema = useTema();
  const elegida = opciones.find((o) => o.valor === valor);
  return (
    <View style={{ gap: espacio.sm }}>
      <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: tema.textoSuave }}>
        {titulo} · <Text style={{ color: tema.texto }}>{elegida?.nombre}</Text>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
        {opciones.map((o) => {
          const activa = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              onPress={() => onCambio(o.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={o.nombre}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                padding: 3,
                borderWidth: 2.5,
                borderColor: activa ? tema.primario : 'transparent',
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 18,
                  backgroundColor: o.color,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {o.valor === 'ninguno' && <Ionicons name="close" size={18} color="#999" />}
                {activa && o.valor !== 'ninguno' && <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Los adornos: un botón con su dibujo, que se prende y se apaga. */
function Adornos<T extends string>({
  zona,
  opciones,
  elegidos,
  onCambio,
}: {
  zona: keyof Decoracion;
  opciones: OpcionAdorno<T>[];
  elegidos: T[];
  onCambio: (v: T) => void;
}) {
  const tema = useTema();
  const { width } = useWindowDimensions();
  const columnas = width >= 600 ? 4 : 3;
  const ancho = (Math.min(width, 640) - espacio.lg * 2 - espacio.sm * (columnas - 1)) / columnas;
  return (
    <View style={{ gap: espacio.sm }}>
      <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: tema.textoSuave }}>
        Adornos · <Text style={{ color: tema.texto }}>{elegidos.length === 0 ? 'ninguno' : `${elegidos.length} ${elegidos.length === 1 ? 'puesto' : 'puestos'}`}</Text>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
        {opciones.map((o) => {
          const puesto = elegidos.includes(o.valor);
          return (
            <Pressable
              key={o.valor}
              onPress={() => onCambio(o.valor)}
              accessibilityRole="switch"
              accessibilityState={{ checked: puesto }}
              accessibilityLabel={o.nombre}
              style={({ pressed }) => ({
                width: ancho,
                alignItems: 'center',
                gap: 2,
                paddingVertical: espacio.sm,
                borderRadius: radio.lg,
                borderWidth: 1.5,
                borderColor: puesto ? tema.primario : tema.borde,
                backgroundColor: puesto ? tema.primarioSuave : tema.superficie,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <MuestraAdorno zona={zona} adorno={o.valor} lado={58} />
              <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: tema.texto }}>
                {o.nombre}
              </Text>
              <View style={{ position: 'absolute', top: 6, right: 6 }}>
                <Ionicons name={puesto ? 'checkmark-circle' : 'add-circle-outline'} size={18} color={puesto ? tema.primario : tema.textoSuave} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Su planta con la maceta que tiene puesta. */
function MuestraMaceta({ especieId, plantaId, estilo }: { especieId: string; plantaId: string; estilo?: EstiloMaceta }) {
  const especie = buscarEspecie(especieId);
  if (!especie) return null;
  return <MuestraEspecie especie={especie} ancho={56} alto={62} estiloMaceta={estilo} semilla={plantaId} />;
}
