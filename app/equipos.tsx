/**
 * Equipos de riego: las plantas que piden lo mismo, juntas.
 *
 * Detrás hay zonificación real: quien comparte banda de luz y perfil hídrico
 * comparte calendario de riego, así que se pueden regar en la misma vuelta.
 * Además se marcan las parejas que NO pueden compartir maceta aunque rieguen
 * igual, que es donde la gente se equivoca.
 *
 * Antes era una pestaña de puro texto; ahora vive dentro de Mis plantas y de
 * Tú, y cada equipo muestra a sus plantas con la misma cara que en el patio.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { listarPlantas } from '../src/datos/db';
import { agruparEnEquipos, compararEspecies, etiquetaBanda, etiquetaPerfil } from '../src/dominio/compatibilidad';
import type { Equipo, MiembroEquipo } from '../src/dominio/compatibilidad';
import { agendaDeHoy } from '../src/servicios/agenda';
import type { EstadoDePlanta } from '../src/servicios/agenda';
import { RetratoPlanta } from '../src/ui/RetratoPlanta';
import { Tarjeta, Vacio, estilosTexto } from '../src/ui/componentes';
import { espacio, fuente, radio, useTema } from '../src/ui/tema';

const ICONO_BANDA: Record<string, keyof typeof Ionicons.glyphMap> = {
  sol_pleno: 'sunny',
  semisol: 'partly-sunny',
  sombra: 'cloudy',
  interior_luminoso: 'home',
  interior_bajo: 'bed',
};

const COLORES = ['#E8940C', '#2E8B57', '#3F7CAC', '#C66A3D', '#8E5BB5', '#2A9D8F'];

interface Datos {
  equipos: Equipo[];
  conflictos: Conflicto[];
  porId: Map<string, EstadoDePlanta>;
}

export default function PantallaEquipos() {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const [datos, setDatos] = useState<Datos | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void (async () => {
        const agenda = await agendaDeHoy(await listarPlantas());
        const miembros: MiembroEquipo[] = agenda.map((e) => ({ planta: e.planta, especie: e.especie }));
        if (!vigente) return;
        setDatos({
          equipos: agruparEnEquipos(miembros),
          conflictos: detectarConflictos(miembros),
          porId: new Map(agenda.map((e) => [e.planta.id, e])),
        });
      })();
      return () => {
        vigente = false;
      };
    }, []),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      contentContainerStyle={{ padding: espacio.lg, paddingBottom: espacio.xxl, gap: espacio.lg }}
    >
      <Stack.Screen options={{ title: 'Equipos de riego' }} />
      <Text style={textos.subtitulo}>
        Las de un mismo equipo piden la misma luz y la misma agua: se riegan en la misma vuelta.
      </Text>

      {datos === null ? (
        <ActivityIndicator color={tema.primario} style={{ marginTop: espacio.xl }} />
      ) : datos.equipos.length === 0 ? (
        <Vacio
          titulo="Sin equipos todavía"
          descripcion="Cuando tengas plantas, MEDISINA las agrupa sola por lo que piden: sol, sombra, agua o desierto."
        />
      ) : (
        datos.equipos.map((equipo, i) => (
          <Animated.View key={equipo.id} entering={FadeInDown.delay(i * 70).duration(280)}>
            <TarjetaEquipo equipo={equipo} color={COLORES[i % COLORES.length]} porId={datos.porId} />
          </Animated.View>
        ))
      )}

      {datos && datos.conflictos.length > 0 && (
        <View style={{ gap: espacio.md }}>
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, letterSpacing: 0.8, color: tema.textoSuave }}>
            NO LAS JUNTES EN LA MISMA MACETA
          </Text>
          {datos.conflictos.map((conflicto, i) => (
            <Tarjeta key={i}>
              <View style={{ flexDirection: 'row', gap: espacio.md }}>
                <Ionicons name="alert-circle-outline" size={20} color={tema.acento} />
                <View style={{ flex: 1, gap: espacio.xs }}>
                  <Text style={textos.encabezadoTarjeta}>{conflicto.titulo}</Text>
                  <Text style={textos.suave}>{conflicto.razon}</Text>
                  {conflicto.afectadas.length > 0 && (
                    <Text style={[textos.suave, { color: tema.acento }]}>
                      Dale maceta propia: no la compartas con {listar(conflicto.afectadas)}.
                    </Text>
                  )}
                </View>
              </View>
            </Tarjeta>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function TarjetaEquipo({ equipo, color, porId }: { equipo: Equipo; color: string; porId: Map<string, EstadoDePlanta> }) {
  const tema = useTema();
  // Para varios equipos el nombre ya es "banda · perfil", y repetirlo debajo
  // sólo gasta renglón.
  const detalle = `${etiquetaBanda(equipo.banda)} · ${etiquetaPerfil(equipo.perfilHidrico)}`;
  const detalleAporta = detalle.toLocaleLowerCase('es') !== equipo.nombre.toLocaleLowerCase('es');
  const n = equipo.miembros.length;

  return (
    <View
      style={{
        backgroundColor: tema.superficie,
        borderRadius: radio.lg + 4,
        borderWidth: 1,
        borderColor: tema.borde,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 5, backgroundColor: color }} />
      <View style={{ padding: espacio.lg, gap: espacio.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: `${color}22`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={ICONO_BANDA[equipo.banda] ?? 'leaf'} size={20} color={color} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ fontFamily: fuente.titulo, fontSize: 18, color: tema.texto }}>{equipo.nombre}</Text>
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
              {detalleAporta ? `${detalle} · ` : ''}
              {n} {n === 1 ? 'planta' : 'plantas'}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.sm }}>
          {equipo.miembros.map(({ planta, especie }) => {
            const estado = porId.get(planta.id);
            return (
              <Pressable
                key={planta.id}
                onPress={() => router.push(`/planta/${planta.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${planta.apodo}, ${especie.nombresComunes[0]}`}
                style={({ pressed }) => ({
                  width: 96,
                  borderRadius: radio.md + 2,
                  overflow: 'hidden',
                  backgroundColor: tema.superficieAlta,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                {estado ? <RetratoPlanta estado={estado} ancho={96} alto={92} /> : <View style={{ height: 92 }} />}
                <View style={{ padding: 6 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: tema.texto }}>
                    {planta.apodo}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 10.5, color: tema.textoSuave }}>
                    {especie.nombresComunes[0]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {n > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="water" size={14} color={color} />
            <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
              Cuando a una le toque agua, revisa a las demás: suelen pedirla el mismo día.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface Conflicto {
  titulo: string;
  razon: string;
  /** Apodos de las plantas con las que no puede compartir maceta. */
  afectadas: string[];
}

/**
 * Busca parejas que comparten equipo (mismo riego) pero que no deberían
 * compartir maceta. Es el caso que más confunde: "si riegan igual, ¿por qué
 * no puedo ponerlas juntas?".
 *
 * Los conflictos se agrupan por la planta que los causa. Una sola planta de
 * raíz invasiva choca con todas las demás, y listar cada pareja por separado
 * llena la pantalla de tarjetas que dicen lo mismo.
 */
function detectarConflictos(miembros: MiembroEquipo[]): Conflicto[] {
  const porCausante = new Map<string, Conflicto>();

  for (let i = 0; i < miembros.length; i += 1) {
    for (let j = i + 1; j < miembros.length; j += 1) {
      const a = miembros[i];
      const b = miembros[j];

      const calendario = compararEspecies(a.especie, b.especie, 'mismo_calendario');
      if (calendario.veredicto === 'incompatible') continue;

      const maceta = compararEspecies(a.especie, b.especie, 'misma_maceta');
      if (maceta.veredicto !== 'incompatible') continue;

      const bloqueo = maceta.razones.find((r) => r.nivel === 'bloqueo');
      if (!bloqueo) continue;

      // Si el problema es la raíz, hay una sola culpable: se agrupa bajo ella.
      const culpable = bloqueo.aspecto === 'raiz' ? [a, b].find((m) => m.especie.agresividadRaiz === 3) : undefined;

      if (culpable) {
        const otra = culpable === a ? b : a;
        const clave = `raiz:${culpable.planta.id}`;
        const existente = porCausante.get(clave);
        if (existente) {
          existente.afectadas.push(otra.planta.apodo);
        } else {
          porCausante.set(clave, {
            titulo: culpable.planta.apodo,
            razon: 'Tiene raíz invasiva: va a ahogar a lo que le pongas al lado.',
            afectadas: [otra.planta.apodo],
          });
        }
        continue;
      }

      porCausante.set(`${bloqueo.aspecto}:${a.planta.id}:${b.planta.id}`, {
        titulo: `${a.planta.apodo} y ${b.planta.apodo}`,
        razon: bloqueo.texto,
        afectadas: [],
      });
    }
  }

  return [...porCausante.values()];
}

/** "Verdoso", "Verdoso y El Limón", "Verdoso, El Limón y El Helechón". */
function listar(apodos: string[]): string {
  if (apodos.length <= 1) return apodos[0] ?? '';
  return `${apodos.slice(0, -1).join(', ')} y ${apodos[apodos.length - 1]}`;
}
