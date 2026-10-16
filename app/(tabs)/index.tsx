/**
 * Hoy: el patio, el clima y lo que toca, en una sola pantalla.
 *
 * Antes "Hoy" y "Patio" eran dos pestañas que decían casi lo mismo: las dos
 * mostraban qué planta tenía sed, las dos tenían la racha, las dos un botón de
 * regar. Ahora es una sola, y se lee de arriba abajo:
 *
 *   1. El lugar: patio, casa o sombra, como escena de juego. Ahí se riega y se
 *      revisa de un toque, y la racha sube sin salir.
 *   2. El clima de estos días y a quién hay que mover por él.
 *   3. La racha.
 *   4. La lista corta de lo que falta, para quien prefiere leer.
 *
 * El botón de escanear vive en la barra de abajo, donde antes estaba el patio.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listarPlantas, nuevoId } from '../../src/datos/db';
import { saludo } from '../../src/dominio/cuenta';
import { infoLugar } from '../../src/dominio/lugares';
import type { Lugar } from '../../src/dominio/lugares';
import type { Racha } from '../../src/dominio/racha';
import { agendaDeHoy } from '../../src/servicios/agenda';
import type { EstadoDePlanta } from '../../src/servicios/agenda';
import { climaDelJardin, escenaDe } from '../../src/servicios/climaJardin';
import { registrarCuidado } from '../../src/servicios/cuidado';
import { rachaDe } from '../../src/servicios/racha';
import { PatioJuego } from '../../src/ui/PatioJuego';
import { useSesion } from '../../src/ui/Sesion';
import { TarjetaClima } from '../../src/ui/TarjetaClima';
import { TarjetaRacha } from '../../src/ui/TarjetaRacha';
import { Vacio, estilosTexto } from '../../src/ui/componentes';
import type { Escena } from '../../src/ui/escenasPatio';
import { etiquetaAccion } from '../../src/ui/etiquetas';
import { AVISO, AVISO_SALE, DESAPARECE, Llegada } from '../../src/ui/movimiento';
import { colorDeNivel, espacio, fuente, radio, useTema } from '../../src/ui/tema';

const ESCENAS: Array<{ clave: Escena; titulo: string; icono: keyof typeof Ionicons.glyphMap; vacia: string }> = [
  { clave: 'patio', titulo: 'Patio', icono: 'sunny', vacia: 'Aquí viven las de sol y media sombra.' },
  { clave: 'casa', titulo: 'Casa', icono: 'home', vacia: 'Aquí viven las de interior, junto a la ventana.' },
  { clave: 'sombra', titulo: 'Sombra', icono: 'leaf', vacia: 'Aquí viven las que prefieren la sombra.' },
];

export default function PantallaHoy() {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const insets = useSafeAreaInsets();
  const reducido = useReducedMotion();
  const { perfil } = useSesion();

  const [estados, setEstados] = useState<EstadoDePlanta[]>([]);
  const [racha, setRacha] = useState<Racha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [elegida, setElegida] = useState<Escena | null>(null);
  // Mientras se arrastra una planta en la escena, la pantalla no se desplaza:
  // si no, el dedo que sube hacia las zonas mueve toda la página.
  const [arrastrando, setArrastrando] = useState(false);
  const [mudanza, setMudanza] = useState<{ apodo: string; lugar: Lugar; n: number } | null>(null);
  const relojMudanza = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (relojMudanza.current) clearTimeout(relojMudanza.current);
    },
    [],
  );

  const alMudar = useCallback((_id: string, apodo: string, lugar: Lugar) => {
    setMudanza((m) => ({ apodo, lugar, n: (m?.n ?? 0) + 1 }));
    if (relojMudanza.current) clearTimeout(relojMudanza.current);
    relojMudanza.current = setTimeout(() => setMudanza(null), 4200);
  }, []);

  const cargar = useCallback(async (vigente: () => boolean = () => true) => {
    const plantas = await listarPlantas();
    const agenda = await agendaDeHoy(plantas);
    // La racha sale de la misma simulación que ya se hizo para la agenda.
    const nueva = await rachaDe(agenda).catch(() => null);
    if (!vigente()) return;
    setEstados(agenda);
    setRacha(nueva);
    setCargando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void cargar(() => vigente);
      return () => {
        vigente = false;
      };
    }, [cargar]),
  );

  const clima = useMemo(() => climaDelJardin(estados), [estados]);
  const pendientes = estados.filter((e) => etiquetaAccion(e.recomendacion.accion, e.recomendacion.urgencia).pideAtencion);

  const porEscena = useMemo(() => {
    const mapa: Record<Escena, EstadoDePlanta[]> = { patio: [], casa: [], sombra: [] };
    for (const e of estados) mapa[escenaDe(e)].push(e);
    return mapa;
  }, [estados]);

  // Si nadie eligió, se abre donde está la que más urge; si no urge nada, el
  // primer lugar que tenga plantas.
  const escena: Escena =
    elegida ??
    (pendientes[0] ? escenaDe(pendientes[0]) : ESCENAS.find((e) => porEscena[e.clave].length > 0)?.clave ?? 'patio');
  const enEscena = porEscena[escena];
  const avisosEscena = clima.avisos.filter((a) => enEscena.some((e) => e.planta.id === a.plantaId));

  const cuidarRapido = useCallback(
    async (estado: EstadoDePlanta, tipo: 'riego' | 'cambio_agua' | 'observacion') => {
      await registrarCuidado({
        id: nuevoId(),
        plantaId: estado.planta.id,
        tipo,
        fecha: new Date().toISOString(),
        cantidadMl: tipo === 'riego' ? estado.recomendacion.mlSugeridos : undefined,
        nota: tipo === 'observacion' ? 'La revisé: todo en orden' : 'Registrado desde Hoy',
      });
      await cargar();
    },
    [cargar],
  );

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: tema.fondo }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      scrollEnabled={!arrastrando}
      contentContainerStyle={{
        padding: espacio.lg,
        paddingTop: insets.top + espacio.lg,
        paddingBottom: 120,
        gap: espacio.lg,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={async () => {
            setRefrescando(true);
            await cargar();
            setRefrescando(false);
          }}
          tintColor={tema.primario}
        />
      }
    >
      <View style={{ gap: espacio.xs }}>
        {perfil && (
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, letterSpacing: 0.3, color: tema.primario }}>
            {saludo(perfil.nombre)}
          </Text>
        )}
        <Text style={textos.titulo}>Hoy</Text>
        <Text style={textos.subtitulo}>
          {fechaLegible()}
          {'  ·  '}
          {resumen(estados.length, pendientes.length)}
        </Text>
      </View>

      {estados.length === 0 ? (
        <Vacio
          titulo="Todavía no tienes plantas"
          descripcion="Toca Escanear abajo: le tomas una foto a tu planta, la reconozco y nace su gemelo."
        />
      ) : (
        <>
          {/* Los tres lugares. El zIndex es para el aviso de mudanza, que
              cuelga de aquí encima del patio. */}
          <View style={{ zIndex: 2 }}>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: tema.superficieAlta,
              borderRadius: radio.completo,
              padding: 4,
              gap: 4,
            }}
          >
            {ESCENAS.map((e) => (
              <SegmentoEscena
                key={e.clave}
                titulo={e.titulo}
                icono={e.icono}
                activa={e.clave === escena}
                cuantas={porEscena[e.clave].length}
                urge={porEscena[e.clave].some((x) => pendientes.includes(x))}
                // Cuando le llega una planta, el segmento brinca: se ve a dónde se fue.
                brinco={mudanza && infoLugar(mudanza.lugar).zona === e.clave ? mudanza.n : 0}
                onPress={() => setElegida(e.clave)}
              />
            ))}
          </View>

          {/* Flota sobre el patio en vez de ocupar su lugar en la columna.
              Antes, al aparecer empujaba el patio 42 px hacia abajo y al irse
              lo jalaba de regreso — justo debajo del dedo que acababa de
              soltar la planta. */}
          {mudanza && (
            <Llegada
              key={mudanza.n}
              entrada={AVISO}
              exiting={reducido ? DESAPARECE : AVISO_SALE}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: espacio.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: espacio.sm,
                backgroundColor: tema.texto,
                borderRadius: radio.completo,
                paddingLeft: espacio.lg,
                paddingRight: 6,
                minHeight: 42,
                // Ahora va encima de la escena: la sombra lo despega de ella.
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <Ionicons name="checkmark-circle" size={17} color={tema.primario} />
              <Text numberOfLines={2} style={{ flex: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 13.5, color: tema.fondo }}>
                {mudanza.apodo} ya vive {infoLugar(mudanza.lugar).donde}
              </Text>
              {infoLugar(mudanza.lugar).zona !== escena && (
                <Pressable
                  onPress={() => {
                    setElegida(infoLugar(mudanza.lugar).zona);
                    setMudanza(null);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    backgroundColor: tema.primario,
                    borderRadius: radio.completo,
                    paddingHorizontal: 14,
                    minHeight: 32,
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.esOscuro ? '#0B1A13' : '#fff' }}>
                    Ver
                  </Text>
                </Pressable>
              )}
            </Llegada>
          )}
          </View>

          {enEscena.length > 0 ? (
            <PatioJuego
              key={escena}
              escena={escena}
              estados={enEscena}
              racha={racha}
              avisos={avisosEscena}
              onCambio={() => void cargar()}
              onMudada={alMudar}
              onArrastre={setArrastrando}
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
              <Ionicons name={ESCENAS.find((e) => e.clave === escena)!.icono} size={28} color={tema.textoSuave} />
              <Text style={{ fontFamily: fuente.titulo, fontSize: 17, color: tema.texto }}>Todavía vacío</Text>
              <Text style={[textos.suave, { textAlign: 'center' }]}>
                {ESCENAS.find((e) => e.clave === escena)!.vacia} Escanea una y dile dónde la tienes.
              </Text>
            </View>
          )}

          <TarjetaClima
            clima={clima}
            estados={estados}
            onMudada={(id, apodo, lugar) => {
              alMudar(id, apodo, lugar);
              void cargar();
            }}
            onCambio={() => void cargar()}
          />

          {racha && <TarjetaRacha racha={racha} onAtender={(id) => router.push(`/planta/${id}`)} />}

          {pendientes.length > 0 && (
            <View style={{ gap: espacio.sm }}>
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, letterSpacing: 0.8, color: tema.textoSuave }}>
                LO QUE FALTA HOY
              </Text>
              {pendientes.map((e) => (
                <FilaPendiente key={e.planta.id} estado={e} onCuidar={cuidarRapido} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

/** Un segmento del selector Patio · Casa · Sombra. Brinca cuando le llega una planta. */
function SegmentoEscena({
  titulo,
  icono,
  activa,
  cuantas,
  urge,
  brinco,
  onPress,
}: {
  titulo: string;
  icono: keyof typeof Ionicons.glyphMap;
  activa: boolean;
  cuantas: number;
  urge: boolean;
  brinco: number;
  onPress: () => void;
}) {
  const tema = useTema();
  const escala = useSharedValue(1);
  useEffect(() => {
    if (brinco === 0) return;
    escala.set(withSequence(withTiming(1.12, { duration: 140 }), withSpring(1, { duration: 420, dampingRatio: 0.45 })));
  }, [brinco, escala]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  return (
    <Animated.View style={[{ flex: 1 }, estilo]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: activa }}
        accessibilityLabel={`${titulo}: ${cuantas} ${cuantas === 1 ? 'planta' : 'plantas'}${urge ? ', alguna pide algo' : ''}`}
        style={({ pressed }) => ({
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
        <Ionicons name={icono} size={14} color={activa ? tema.primario : tema.textoSuave} />
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: activa ? tema.texto : tema.textoSuave }}>
          {titulo}
        </Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>{cuantas}</Text>
        {urge && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tema.critico }} />}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Un renglón por planta que pide algo: quién, qué, y el botón para hacerlo.
 * Nada más: el detalle está en su ficha y la escena ya lo muestra.
 */
function FilaPendiente({
  estado,
  onCuidar,
}: {
  estado: EstadoDePlanta;
  onCuidar: (e: EstadoDePlanta, tipo: 'riego' | 'cambio_agua' | 'observacion') => Promise<void>;
}) {
  const tema = useTema();
  const [ocupado, setOcupado] = useState(false);
  const { planta, recomendacion, estadoHoy } = estado;
  const accion = etiquetaAccion(recomendacion.accion, recomendacion.urgencia);
  const color = colorDeNivel(tema, estadoHoy.nivel);
  const boton =
    recomendacion.accion === 'regar'
      ? { tipo: 'riego' as const, texto: `Regar ${recomendacion.mlSugeridos} ml`, icono: 'water' as const }
      : recomendacion.accion === 'cambiar_agua'
        ? { tipo: 'cambio_agua' as const, texto: 'Cambié el agua', icono: 'sync' as const }
        : { tipo: 'observacion' as const, texto: 'La revisé', icono: 'eye' as const };

  return (
    <Pressable
      onPress={() => router.push(`/planta/${planta.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.md,
        backgroundColor: tema.superficie,
        borderRadius: radio.md,
        borderLeftWidth: 4,
        borderLeftColor: color,
        padding: espacio.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.texto }}>
          {planta.apodo}
        </Text>
        <Text numberOfLines={2} style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
          {accion.texto} · {recomendacion.motivo}
        </Text>
      </View>
      <Pressable
        disabled={ocupado}
        onPress={async () => {
          setOcupado(true);
          try {
            await onCuidar(estado, boton.tipo);
          } finally {
            setOcupado(false);
          }
        }}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: boton.tipo === 'observacion' ? tema.primarioSuave : '#2F8FD8',
          borderRadius: radio.completo,
          paddingHorizontal: 12,
          minHeight: 36,
          opacity: ocupado ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name={boton.icono} size={14} color={boton.tipo === 'observacion' ? tema.primario : '#fff'} />
        <Text
          style={{
            fontFamily: fuente.cuerpoFuerte,
            fontSize: 12.5,
            color: boton.tipo === 'observacion' ? tema.primario : '#fff',
          }}
        >
          {boton.texto}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function resumen(cuantas: number, pendientes: number): string {
  if (cuantas === 0) return 'sin plantas todavía';
  if (pendientes === 0) return 'nada urgente';
  return `${pendientes} ${pendientes === 1 ? 'planta pide' : 'plantas piden'} algo`;
}

function fechaLegible(): string {
  const formato = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const texto = formato.format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
