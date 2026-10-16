/**
 * La sina flotante: el asistente que acompaña por toda la app.
 *
 * Se monta una sola vez, en el layout raíz, y queda por encima de todas las
 * pantallas. Eso es a propósito: un asistente al que hay que ir a buscar a una
 * pestaña no acompaña a nadie. Aquí siempre está en la esquina, y lo que hace
 * con la cara ya dice si hay algo que atender antes de tocarlo.
 *
 * SABE DÓNDE ESTÁS. Si lo abres desde la ficha de una planta, contesta como esa
 * planta, en primera persona. Desde cualquier otra pantalla contesta como la
 * sina y habla de todo el jardín. Es el mismo modelo de intención en las dos
 * escalas — lo decide `asistente.ts` según el enfoque.
 *
 * Se recarga el jardín al abrirlo y no en cada render: la simulación hídrica de
 * todas las plantas no es gratis, y tenerla corriendo detrás de cada pantalla
 * sería pagar por algo que sólo se mira al tocar la burbuja.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { detectarNombre, responderEnJardin } from '../dominio/asistente';
import type { Jardin, Turno } from '../dominio/asistente';
import { guardarAjuste } from '../datos/db';
import { CLAVE_NOMBRE, cargarJardin } from '../servicios/jardin';
import { CaraSina } from './CaraSina';
import type { Animo } from './CaraSina';
import { EASE_OUT, GLOBO_MIO, GLOBO_SUYO, Llegada } from './movimiento';
import { espacio, fuente, radio, useTema } from './tema';

/** Lo primero que se puede preguntar sin escribir nada. */
const ARRANQUE = ['¿Cuál necesita agua?', '¿Cómo voy?', '¿Cuál va peor?', '¿Quién eres?'];

/**
 * La hoja sube como las de iOS: resorte sin rebote. Con rebote asomaría el
 * velo por debajo de su borde por un instante.
 */
const SUBIR = { duration: 320, dampingRatio: 1 } as const;
/** Baja más rápido de lo que subió: ya se terminó de usar. */
const BAJAR = { duration: 220, easing: EASE_OUT } as const;
/** Con "reducir movimiento": la hoja no se desliza, sólo se funde. */
const FUNDIR = { duration: 200, reduceMotion: ReduceMotion.Never } as const;

export function Companero() {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const reducido = useReducedMotion();
  const ruta = usePathname();

  const { height: altoVentana } = useWindowDimensions();

  // `abierto` dice si la hoja está montada; `cerrando`, si ya va de bajada y
  // sólo falta que termine de irse para desmontarla.
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [jardin, setJardin] = useState<Jardin | null>(null);
  const [cargando, setCargando] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [borrador, setBorrador] = useState('');
  const [brinco, setBrinco] = useState(0);
  // Cuántos mensajes ya había al abrir. Ésos se ven tal cual: si cada vez que
  // se abre la hoja toda la plática brincara de nuevo, dejaría de decir cuál
  // mensaje es el nuevo.
  const [yaVistos, setYaVistos] = useState(0);
  const listaRef = useRef<ScrollView>(null);

  // 0 = abajo, fuera de la pantalla; 1 = arriba. El velo sale del mismo valor,
  // así nunca se desfasa de la hoja.
  const hoja = useSharedValue(0);
  // Cuánto tiene que bajar para salir entera. Hasta medirla se supone la
  // ventana completa: así, antes de la primera medida, ya está fuera de vista.
  const altoHoja = useSharedValue(altoVentana);
  const medida = useRef(false);

  const estiloVelo = useAnimatedStyle(() => ({ opacity: hoja.get() }));
  const estiloHoja = useAnimatedStyle(() =>
    reducido
      ? { opacity: hoja.get() }
      : { transform: [{ translateY: (1 - hoja.get()) * altoHoja.get() }] },
  );

  // La planta enfocada sale de la ruta. Así el asistente sabe de qué se está
  // hablando sin que nadie tenga que pasárselo por props desde cada pantalla.
  const enfoque = useMemo(() => {
    const marca = /^\/planta\/([^/]+)$/.exec(ruta ?? '');
    return marca && marca[1] !== 'nueva' ? marca[1] : undefined;
  }, [ruta]);

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      setJardin(await cargarJardin(enfoque));
    } catch {
      // Sin jardín la burbuja sigue ahí, sólo que dormida. Que falle la base
      // no puede tumbar todas las pantallas de la app.
      setJardin(null);
    } finally {
      setCargando(false);
    }
  }, [enfoque]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const animo = animoDe(jardin);
  const insignia = insigniaDe(jardin);

  function abrir() {
    if (!reducido) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBrinco((n) => n + 1);
    if (abierto) {
      // Iba de bajada: se da la vuelta desde donde va, sin volver a empezar.
      setCerrando(false);
      hoja.set(reducido ? withTiming(1, FUNDIR) : withSpring(1, SUBIR));
    } else {
      // La subida arranca al medirla (`alMedir`), no aquí: sin su alto no se
      // sabe desde dónde tiene que salir.
      medida.current = false;
      hoja.set(0);
      // La medida de la vez pasada no sirve: con más plática, la hoja puede
      // salir más alta y asomarse antes de que la midan.
      altoHoja.set(altoVentana);
      setYaVistos(turnos.length);
      setAbierto(true);
    }
    void refrescar();
  }

  function alMedir(alto: number) {
    altoHoja.set(alto);
    if (medida.current) return; // El teclado también la cambia de alto.
    medida.current = true;
    hoja.set(reducido ? withTiming(1, FUNDIR) : withSpring(1, SUBIR));
  }

  function cerrar() {
    if (cerrando) return;
    setCerrando(true);
    const desmontar = () => {
      setAbierto(false);
      setCerrando(false);
    };
    // Sólo se desmonta si llegó abajo. Si alguien la vuelve a abrir a medio
    // camino, la animación se interrumpe y la hoja se queda.
    hoja.set(
      withTiming(0, reducido ? FUNDIR : BAJAR, (terminada) => {
        if (terminada) scheduleOnRN(desmontar);
      }),
    );
  }

  function preguntar(texto: string) {
    const limpia = texto.trim();
    if (!limpia || !jardin) return;

    // Presentarse se atiende antes de clasificar: "me llamo Alonso" no es una
    // pregunta sobre plantas, y mandarlo al modelo sólo daría "no entendí".
    const nombre = detectarNombre(limpia);
    if (nombre && nombre !== jardin.nombre) {
      void guardarAjuste(CLAVE_NOMBRE, nombre).catch(() => undefined);
      const conNombre = { ...jardin, nombre };
      setJardin(conNombre);
      setTurnos((previos) => [
        ...previos,
        {
          mia: limpia,
          suya: {
            texto: `Mucho gusto, ${nombre}. Ya te reconozco — de aquí en adelante te hablo por tu nombre.`,
            intencion: 'identidad' as const,
            confianza: 1,
            seguir: ['¿Cuál necesita agua?', '¿Cómo voy?'],
          },
        },
      ]);
      setBorrador('');
      return;
    }

    const suya = responderEnJardin(limpia, jardin, turnos);
    setTurnos((previos) => [...previos, { mia: limpia, suya }]);
    setBorrador('');
    // Al final de la lista, que es donde está la respuesta nueva.
    setTimeout(() => listaRef.current?.scrollToEnd({ animated: !reducido }), 60);
  }

  const sugerencias =
    turnos.length === 0
      ? jardin?.nombre
        ? ARRANQUE
        : ['Me llamo…', ...ARRANQUE.slice(0, 3)]
      : turnos[turnos.length - 1].suya.seguir;

  return (
    <>
      {/* La burbuja. No se pinta encima de la pantalla de escaneo: ahí la
          cámara ocupa todo y un personaje flotando estorba la toma. */}
      {!ruta?.startsWith('/escanear') && (
        <Animated.View
          entering={reducido ? undefined : FadeIn.duration(400)}
          style={{
            position: 'absolute',
            right: espacio.lg,
            bottom: insets.bottom + 78,
            zIndex: 50,
          }}
        >
          <Pressable
            onPress={abrir}
            accessibilityRole="button"
            accessibilityLabel="Preguntarle a la sina"
            style={({ pressed }) => ({
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: tema.superficieAlta,
              borderWidth: 1,
              borderColor: tema.borde,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.94 : 1 }],
              // Sombra suave: la burbuja tiene que leerse por encima del
              // contenido sin taparlo.
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            })}
          >
            <CaraSina animo={animo} tamano={52} brinco={brinco} />
          </Pressable>

          {insignia && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 22,
                height: 22,
                paddingHorizontal: 5,
                borderRadius: 11,
                backgroundColor: insignia.urgente ? tema.acento : tema.primario,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: tema.fondo,
              }}
            >
              <Text
                style={{
                  fontFamily: fuente.cuerpoFuerte,
                  fontSize: 11,
                  color: insignia.urgente || !tema.esOscuro ? '#fff' : '#0B1A13',
                }}
              >
                {insignia.texto}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Capa dentro del árbol, no un Modal nativo.
          Un Modal se dibuja por encima de TODO React, lo que en web lo
          descoloca y en el teléfono lo saca del contexto de navegación. Una
          capa absoluta se comporta igual en las dos plataformas y deja que la
          sina siga siendo parte de la app en vez de una ventana aparte. */}
      {abierto && (
        <View
          style={[
            StyleSheet.absoluteFill,
            // Mientras baja ya no atrapa toques: si alguien toca la burbuja a
            // medio cierre, la hoja se da la vuelta en vez de perder el toque.
            { justifyContent: 'flex-end', zIndex: 60, pointerEvents: cerrando ? 'none' : 'auto' },
          ]}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }, estiloVelo]}
          />
          {/* Tocar fuera cierra. Es lo que todo el mundo intenta primero. */}
          <Pressable style={{ flex: 1 }} onPress={cerrar} />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View
              onLayout={(e) => alMedir(e.nativeEvent.layout.height)}
              style={[
                {
                  backgroundColor: tema.fondo,
                  borderTopLeftRadius: radio.lg,
                  borderTopRightRadius: radio.lg,
                  paddingBottom: insets.bottom + espacio.md,
                  maxHeight: '86%',
                },
                estiloHoja,
              ]}
            >
              <Encabezado
                jardin={jardin}
                animo={animo}
                enfoque={enfoque}
                onCerrar={cerrar}
              />

              <ScrollView
                ref={listaRef}
                style={{ maxHeight: 360 }}
                contentContainerStyle={{ padding: espacio.lg, gap: espacio.md }}
                keyboardShouldPersistTaps="handled"
              >
                {cargando && turnos.length === 0 && <ActivityIndicator color={tema.primario} />}

                {turnos.length === 0 && !cargando && (
                  <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, color: tema.textoSuave }}>
                    {presentacion(jardin, enfoque)}
                  </Text>
                )}

                {turnos.map((turno, i) => (
                  <View key={i} style={{ gap: espacio.sm }}>
                    <Llegada
                      entrada={GLOBO_MIO}
                      animar={i >= yaVistos}
                      style={{
                        alignSelf: 'flex-end',
                        maxWidth: '85%',
                        backgroundColor: tema.superficieAlta,
                        borderRadius: radio.lg,
                        borderBottomRightRadius: radio.sm,
                        paddingHorizontal: espacio.md,
                        paddingVertical: espacio.sm,
                        transformOrigin: 'bottom right',
                      }}
                    >
                      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, color: tema.texto }}>
                        {turno.mia}
                      </Text>
                    </Llegada>

                    <Llegada
                      entrada={GLOBO_SUYO}
                      animar={i >= yaVistos}
                      style={{
                        alignSelf: 'flex-start',
                        maxWidth: '92%',
                        backgroundColor: tema.primarioSuave,
                        borderRadius: radio.lg,
                        borderBottomLeftRadius: radio.sm,
                        padding: espacio.md,
                        gap: 6,
                        transformOrigin: 'bottom left',
                      }}
                    >
                      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, color: tema.texto }}>
                        {turno.suya.texto}
                      </Text>
                      {turno.suya.dato && (
                        <Text
                          style={{
                            fontFamily: fuente.cuerpoFuerte,
                            fontSize: 11.5,
                            color: tema.primario,
                          }}
                        >
                          {turno.suya.dato}
                        </Text>
                      )}
                      {turno.suya.irA && (
                        <Pressable
                          onPress={() => {
                            cerrar();
                            router.push(`/planta/${turno.suya.irA!.plantaId}`);
                          }}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                            opacity: pressed ? 0.6 : 1,
                          })}
                        >
                          <Text
                            style={{
                              fontFamily: fuente.cuerpoFuerte,
                              fontSize: 12.5,
                              color: tema.primario,
                            }}
                          >
                            Abrir {turno.suya.irA.apodo}
                          </Text>
                          <Ionicons name="arrow-forward" size={13} color={tema.primario} />
                        </Pressable>
                      )}
                    </Llegada>
                  </View>
                ))}
              </ScrollView>

              {/* Sugerencias que cambian según de qué se acaba de hablar. */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: espacio.sm,
                  paddingHorizontal: espacio.lg,
                  paddingBottom: espacio.sm,
                }}
              >
                {sugerencias.map((sugerida) => (
                  <Pressable
                    key={sugerida}
                    onPress={() =>
                      // Ésta no se envía: se deja escrita para que la persona
                      // complete su nombre. Mandarla tal cual no diría nada.
                      sugerida === 'Me llamo…' ? setBorrador('Me llamo ') : preguntar(sugerida)
                    }
                    style={({ pressed }) => ({
                      borderColor: tema.borde,
                      borderWidth: 1,
                      borderRadius: radio.completo,
                      paddingHorizontal: espacio.md,
                      minHeight: 34,
                      justifyContent: 'center',
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.texto }}>
                      {sugerida}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  gap: espacio.sm,
                  paddingHorizontal: espacio.lg,
                }}
              >
                <TextInput
                  value={borrador}
                  onChangeText={setBorrador}
                  onSubmitEditing={() => preguntar(borrador)}
                  placeholder="Pregúntale lo que sea…"
                  placeholderTextColor={tema.textoSuave}
                  returnKeyType="send"
                  // Sin esto, Enter no envia en web: el campo solo pierde el foco.
                  submitBehavior="submit"
                  style={{
                    flex: 1,
                    backgroundColor: tema.superficie,
                    borderColor: tema.borde,
                    borderWidth: 1,
                    borderRadius: radio.md,
                    paddingHorizontal: espacio.md,
                    minHeight: 46,
                    fontFamily: fuente.cuerpo,
                    fontSize: 14.5,
                    color: tema.texto,
                  }}
                />
                <Pressable
                  onPress={() => preguntar(borrador)}
                  disabled={!borrador.trim()}
                  style={({ pressed }) => ({
                    width: 46,
                    minHeight: 46,
                    borderRadius: radio.md,
                    backgroundColor: tema.primario,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: !borrador.trim() ? 0.35 : pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons name="arrow-up" size={20} color={tema.esOscuro ? '#0B1A13' : '#fff'} />
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function Encabezado({
  jardin,
  animo,
  enfoque,
  onCerrar,
}: {
  jardin: Jardin | null;
  animo: Animo;
  enfoque?: string;
  onCerrar: () => void;
}) {
  const tema = useTema();
  const enfocada = jardin?.plantas.find((p) => p.id === enfoque);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.md,
        padding: espacio.lg,
        borderBottomColor: tema.borde,
        borderBottomWidth: 1,
      }}
    >
      <CaraSina animo={animo} tamano={44} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fuente.titulo, fontSize: 17, color: tema.texto }}>
          {enfocada ? enfocada.apodo : 'La sina'}
        </Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>
          {enfocada
            ? 'Te habla ella, con sus propios números'
            : jardin
              ? `${jardin.racha.dias} ${jardin.racha.dias === 1 ? 'día' : 'días'} de racha · ${jardin.plantas.length} ${jardin.plantas.length === 1 ? 'planta' : 'plantas'}`
              : 'Cargando tu jardín…'}
        </Text>
      </View>
      <Pressable
        onPress={onCerrar}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      >
        <Ionicons name="close" size={22} color={tema.textoSuave} />
      </Pressable>
    </View>
  );
}

/**
 * La cara antes de abrir nada.
 *
 * Es el único aviso que la app da sin que nadie pida nada, así que tiene que
 * ser honesto: alerta sólo cuando de verdad hay algo que hacer hoy.
 */
function animoDe(jardin: Jardin | null): Animo {
  if (!jardin || jardin.plantas.length === 0) return 'dormida';
  if (jardin.racha.enPeligro) return 'alerta';
  if (jardin.racha.dias >= 7) return 'orgullosa';
  return 'contenta';
}

function insigniaDe(jardin: Jardin | null): { texto: string; urgente: boolean } | null {
  if (!jardin || jardin.plantas.length === 0) return null;
  if (jardin.racha.paraSalvarla.length > 0) {
    return { texto: String(jardin.racha.paraSalvarla.length), urgente: true };
  }
  if (jardin.racha.dias > 0) return { texto: String(jardin.racha.dias), urgente: false };
  return null;
}

function presentacion(jardin: Jardin | null, enfoque?: string): string {
  if (!jardin) return 'Estoy juntando los datos de tus plantas…';
  if (enfoque) return 'Pregúntame lo que quieras de mí: mi riego, por qué me veo así, mi tierra.';
  if (jardin.plantas.length === 0) {
    return 'Todavía no tienes plantas. Escanea una y desde ahí te acompaño.';
  }
  if (!jardin.nombre) {
    return 'Pregúntame lo que quieras de tus plantas — contesto con lo que hay en sus expedientes, sin conexión y sin inventar nada. Y si me dices cómo te llamas, te hablo por tu nombre.';
  }
  return 'Pregúntame lo que quieras de tus plantas. Contesto con lo que hay en sus expedientes, sin conexión y sin inventar nada.';
}
