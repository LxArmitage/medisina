/**
 * El patio como escena de juego.
 *
 * Antes eran franjas con plantas paradas: se veía, pero no se jugaba. Aquí el
 * patio es un lugar que se recorre de lado —la casa, el árbol, la pérgola, el
 * sol, el estanque—, con la sina caminando entre las macetas y una caja de
 * diálogo abajo, como en un juego de rol.
 *
 * LA REGLA DE ESTA PANTALLA: todo lo que se mueve dice algo.
 *   · La sina camina primero hacia la planta que más urge. Es la flecha que
 *     no parece flecha. Si nadie pide nada, pasea; de noche, duerme.
 *   · Sobre cada planta que te necesita flota un globo con lo que pide.
 *   · Tocar una planta abre sus botones; regar o revisar se ve pasar en la
 *     escena —la regadera, las gotas, la planta que rebota— y justo después
 *     la racha sube (la celebración vive en la raíz, `Celebracion.tsx`).
 *   · El cielo es el de tu hora, y si hoy llueve en tu zona, llueve aquí.
 *
 * El mapa —dónde va cada cosa— sale de `mundoPatio.ts`, que es puro y está
 * probado: aquí sólo se dibuja lo que esa cuenta decide.
 *
 * Con "reducir movimiento" la sina se queda quieta, no hay nubes, lluvia ni
 * paralaje, y las gotas y chispas se cambian por un fundido del texto.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  cancelAnimation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { nuevoId } from '../datos/db';
import { guardarAcomodos, leerAcomodos, reacomodar } from '../servicios/acomodo';
import type { Acomodos } from '../servicios/acomodo';
import { datoDelDia } from '../dominio/curiosidades';
import { DECORACION_INICIAL } from '../dominio/decoracion';
import type { Barda, Decoracion, EstiloMaceta } from '../dominio/decoracion';
import { edadEnMeses } from '../dominio/fenologia';
import { LUGARES, ZONAS, infoLugar, lugarDe, mejorLugarEn, veredictoMudanza, zonaDe } from '../dominio/lugares';
import type { Lugar, VeredictoMudanza, Zona } from '../dominio/lugares';
import { calcularMorfologia } from '../dominio/morfologia';
import { nombresDe } from '../dominio/nombres';
import { diaLocal } from '../dominio/racha';
import type { Racha } from '../dominio/racha';
import type { EstadoDePlanta } from '../servicios/agenda';
import { registrarCuidado } from '../servicios/cuidado';
import { useDecoracion, useMacetas } from '../servicios/decoracion';
import { mudarPlanta } from '../servicios/mudanza';
import { AdornosCasa, AdornosPatio, AdornosSombra, BardaPatio, PisoDeSombra, PisoDelPatio } from './adornos';
import { PanelMaceta } from './PanelMaceta';
import { CaraSina } from './CaraSina';
import type { Animo } from './CaraSina';
import type { AvisoMover } from '../dominio/avisosClima';
import { felicitarRacha } from './FelicitacionRacha';
import {
  DestellosDeLuz,
  FondoCasa,
  FondoSombra,
  HojasQueCaen,
  Luciernagas,
  Mariposas,
  Pajaros,
  VeloDeHora,
  VidaCasa,
} from './escenasPatio';
import type { Escena } from './escenasPatio';
import { PISO_CASA } from './escenasPatio';
import { Gemelo } from './Gemelo';
import { colorDeMaceta } from './macetas';
import { Llama } from './Llama';
import { etiquetaAccion } from './etiquetas';
import {
  ALTO_MUNDO,
  CAMINO,
  HORIZONTE,
  SUELO_FONDO,
  SUELO_FRENTE,
  NOMBRE_ZONA,
  TAMANO_PLANTA,
  armarMundo,
  astro,
  duracionRuta,
  momentoDelDia,
  posicionSina,
  zonaPara,
} from './mundoPatio';
import type { HabitanteEntrada, Momento, Mundo, Region, Sitio } from './mundoPatio';
import { colorDeNivel, espacio, fuente, radio, useTema } from './tema';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const NARANJA = '#FF7A1A';
const AGUA = '#2F8FD8';
/** Lado de la sina en la escena. */
const TAM_SINA = 46;
/** Cuánto dura la animación de un cuidado antes de guardarlo y celebrar. */
const ANTES_DE_GUARDAR = 900;
/** Cuánto se queda el efecto en la escena. */
const DURACION_EFECTO = 1400;

// ---------------------------------------------------------------------------
// Paleta por hora
// ---------------------------------------------------------------------------

interface Paleta {
  cielo: [string, string];
  lejos: string;
  cerca: string;
  pasto: [string, string];
  camino: string;
  nube: number;
}

const PALETA: Record<Momento, Paleta> = {
  amanecer: {
    cielo: ['#7FA9D9', '#FAD3A8'],
    lejos: '#A9B89A',
    cerca: '#86A776',
    pasto: ['#8DBB67', '#5F8F46'],
    camino: '#E2C79A',
    nube: 0.85,
  },
  dia: {
    cielo: ['#5DB6EE', '#CDEEFB'],
    lejos: '#A4CFA0',
    cerca: '#7DB86A',
    pasto: ['#8CC867', '#5A9A42'],
    camino: '#E6CD9F',
    nube: 0.9,
  },
  atardecer: {
    cielo: ['#4F5596', '#F5A266'],
    lejos: '#8C7F8E',
    cerca: '#6F8660',
    pasto: ['#7C9C57', '#4C6B3A'],
    camino: '#D6B283',
    nube: 0.7,
  },
  noche: {
    cielo: ['#0C1631', '#2A3B66'],
    lejos: '#22324A',
    cerca: '#1C3A2C',
    pasto: ['#2C4A33', '#1A3022'],
    camino: '#4F4838',
    nube: 0.22,
  },
};

// ---------------------------------------------------------------------------

export interface PatioJuegoProps {
  /** Ordenados por urgencia, como los entrega `agendaDeHoy`. */
  estados: EstadoDePlanta[];
  racha: Racha | null;
  /** Después de guardar un cuidado: recargar la agenda y la racha. */
  onCambio: () => void;
  /** Qué lugar se ve: el patio, la casa por dentro o bajo los árboles. */
  escena?: Escena;
  /** Plantas que conviene mover por el clima de los próximos días. */
  avisos?: AvisoMover[];
  /** Se mudó una planta de lugar (ya guardado). */
  onMudada?: (plantaId: string, apodo: string, lugar: Lugar) => void;
  /** Mientras se arrastra una planta: quien contiene la escena no debe desplazarse. */
  onArrastre?: (activo: boolean) => void;
  /** De visita en el jardín de alguien más: se mira, no se riega ni se mueve nada. */
  visita?: { dueno: string };
}

/** Hacia dónde se puede soltar una planta que se arrastra. */
const ICONO_ZONA: Record<Zona, keyof typeof Ionicons.glyphMap> = { patio: 'sunny', casa: 'home', sombra: 'leaf' };
const COLOR_ZONA: Record<Zona, string> = { patio: '#F2A516', casa: '#C66A3D', sombra: '#2E8B57' };

/** El panel de mudanza abierto: la lista de rincones o la confirmación. */
interface PanelMudanza {
  plantaId: string;
  confirmar: { lugar: Lugar; veredicto: VeredictoMudanza } | null;
}

/** Una planta levantada con el dedo. */
interface Arrastre {
  plantaId: string;
  /** Sobre qué zona está el dedo ahora, si sobre alguna. */
  encima: Zona | null;
}

type TipoEfecto = 'agua' | 'revision';

interface Efecto {
  id: number;
  plantaId: string;
  tipo: TipoEfecto;
  texto: string;
}

export function PatioJuego({
  estados,
  racha,
  onCambio,
  escena = 'patio',
  avisos = [],
  onMudada,
  onArrastre,
  visita,
}: PatioJuegoProps) {
  const tema = useTema();
  const reducido = useReducedMotion();
  const { width } = useWindowDimensions();

  const [vista, setVista] = useState(() => Math.max(280, width - espacio.lg * 2));
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [efecto, setEfecto] = useState<Efecto | null>(null);
  const [rebote, setRebote] = useState<{ plantaId: string; n: number }>({ plantaId: '', n: 0 });
  const [recienCuidadas, setRecienCuidadas] = useState<Set<string>>(() => new Set());
  const [ocupado, setOcupado] = useState(false);
  const [brincoSina, setBrincoSina] = useState(0);
  const [panel, setPanel] = useState<PanelMudanza | null>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [mudandoA, setMudandoA] = useState<Lugar | null>(null);
  // Dónde acomodó la persona cada planta dentro de su zona. De visita, no.
  const [acomodos, setAcomodos] = useState<Acomodos>({});
  // Cómo decoró su jardín y qué maceta le puso a cada una. De visita se ve
  // el jardín de siempre: la decoración no viaja en el código del QR.
  const decoGuardada = useDecoracion();
  const macetasGuardadas = useMacetas();
  const decoracion = visita ? DECORACION_INICIAL : decoGuardada;
  const macetas: Record<string, EstiloMaceta> = visita ? {} : macetasGuardadas;
  const [escogiendoMaceta, setEscogiendoMaceta] = useState<string | null>(null);
  useEffect(() => {
    if (visita) return;
    let vigente = true;
    void leerAcomodos().then((a) => vigente && setAcomodos(a));
    return () => {
      vigente = false;
    };
  }, [visita]);

  const montado = useRef(true);
  const cuenta = useRef(0);
  const relojes = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      relojes.current.forEach(clearTimeout);
    };
  }, []);
  const despues = useCallback((ms: number, fn: () => void) => {
    relojes.current.push(setTimeout(() => montado.current && fn(), ms));
  }, []);

  const momento = momentoDelDia();
  const paleta = PALETA[momento];

  // -- El mundo ------------------------------------------------------------
  const entradas: HabitanteEntrada[] = useMemo(
    () =>
      estados.map((e, i) => ({
        id: e.planta.id,
        zona: zonaPara(e.planta.contenedor.tipo, e.planta.ubicacion.exposicion),
        pideAtencion: etiquetaAccion(e.recomendacion.accion, e.recomendacion.urgencia).pideAtencion,
        // La agenda ya viene ordenada por urgencia: el índice es el orden.
        urgencia: i,
        acomodo: acomodos[e.planta.id],
      })),
    [estados, acomodos],
  );
  // Clave estable: recargar la agenda sin que cambie nada no reinicia la
  // caminata de la sina.
  const claveMundo = JSON.stringify(entradas) + Math.round(vista);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mundo = useMemo(() => armarMundo(entradas, vista), [claveMundo]);

  const porId = useMemo(() => new Map(estados.map((e) => [e.planta.id, e])), [estados]);
  const pendientes = estados.filter(
    (e) => etiquetaAccion(e.recomendacion.accion, e.recomendacion.urgencia).pideAtencion,
  );

  const hoy = diaLocal(new Date());
  const cuidadasHoy = useMemo(() => {
    const set = new Set(recienCuidadas);
    for (const e of estados) {
      if (e.eventos.some((ev) => diaLocal(new Date(ev.fecha)) === hoy)) set.add(e.planta.id);
    }
    return set;
  }, [estados, recienCuidadas, hoy]);

  const clima = estados.find((e) => e.snapshot.clima)?.snapshot.clima ?? null;
  const lloviendo = estados.some((e) => (e.snapshot.clima?.lluviaHoyMm ?? 0) >= 1);

  const dormida = momento === 'noche' && pendientes.length === 0;
  const animo: Animo = dormida
    ? 'dormida'
    : pendientes.length > 0
      ? 'alerta'
      : racha?.hoyCuenta
        ? 'orgullosa'
        : 'contenta';

  // -- Desplazamiento ------------------------------------------------------
  const desplazador = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const alDesplazar = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });
  const recorrido = Math.max(0, mundo.ancho - vista);

  const irA = useCallback(
    (x: number) => {
      if (recorrido <= 0) return;
      const destino = Math.max(0, Math.min(recorrido, x - vista / 2));
      desplazador.current?.scrollTo({ x: destino, animated: !reducido });
    },
    [desplazador, recorrido, vista, reducido],
  );

  // Al entrar, si la que más urge quedó fuera de la pantalla, la cámara va
  // hacia ella. Una sola vez: después, la cámara es de quien la mueve.
  const yaEnfoco = useRef(false);
  useEffect(() => {
    if (yaEnfoco.current || recorrido <= 0) return;
    const primera = pendientes[0];
    const sitio = primera && mundo.sitios.find((s) => s.id === primera.planta.id);
    if (!sitio) return;
    yaEnfoco.current = true;
    if (sitio.x > vista - 60) despues(350, () => irA(sitio.x));
  }, [mundo, pendientes, recorrido, vista, irA, despues]);

  const alMedir = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Number.isFinite(w) && w > 0 && Math.abs(w - vista) > 1) setVista(w);
  };

  // -- Tocar ---------------------------------------------------------------
  const tocarPlanta = useCallback((id: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSeleccion((actual) => (actual === id ? null : id));
  }, []);

  const tocarSina = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
    setBrincoSina((n) => n + 1);
    setSeleccion(null);
    const primera = pendientes[0];
    const sitio = primera && mundo.sitios.find((s) => s.id === primera.planta.id);
    if (sitio) irA(sitio.x);
  }, [pendientes, mundo, irA]);

  const cuidar = useCallback(
    (estado: EstadoDePlanta, tipo: 'riego' | 'cambio_agua' | 'observacion') => {
      if (ocupado || visita) return;
      setOcupado(true);
      // Un golpe suave al tocar, junto con la regadera que aparece. La
      // vibración de éxito es de la celebración, si la racha sube.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

      const id = estado.planta.id;
      const ml = estado.recomendacion.mlSugeridos;
      cuenta.current += 1;
      setEfecto({
        id: cuenta.current,
        plantaId: id,
        tipo: tipo === 'observacion' ? 'revision' : 'agua',
        texto:
          tipo === 'riego'
            ? `${ml} ml`
            : tipo === 'cambio_agua'
              ? 'Agua nueva'
              : 'Revisada',
      });
      // La planta rebota cuando le caen las gotas, no cuando tocas el botón.
      despues(reducido ? 0 : tipo === 'observacion' ? 250 : 650, () =>
        setRebote((r) => ({ plantaId: id, n: r.n + 1 })),
      );
      despues(DURACION_EFECTO, () => setEfecto(null));

      despues(reducido ? 250 : ANTES_DE_GUARDAR, () => {
        void (async () => {
          try {
            await registrarCuidado({
              id: nuevoId(),
              plantaId: id,
              tipo,
              fecha: new Date().toISOString(),
              cantidadMl: tipo === 'riego' ? ml : undefined,
              nota:
                tipo === 'observacion'
                  ? 'La revisé: todo en orden'
                  : 'Registrado desde el patio',
            });
            if (!montado.current) return;
            setRecienCuidadas((s) => new Set(s).add(id));
            setSeleccion(null);
          } finally {
            if (montado.current) {
              setOcupado(false);
              onCambio();
            }
          }
        })();
      });
    },
    [ocupado, reducido, despues, onCambio, visita],
  );

  // -- Mudanza ------------------------------------------------------------
  const mover = useCallback(
    async (estado: EstadoDePlanta, lugar: Lugar) => {
      if (ocupado) return;
      setOcupado(true);
      setMudandoA(lugar);
      try {
        await mudarPlanta(estado.planta, lugar);
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
        if (!montado.current) return;
        setPanel(null);
        setSeleccion(null);
        onMudada?.(estado.planta.id, estado.planta.apodo, lugar);
      } finally {
        if (montado.current) {
          setOcupado(false);
          setMudandoA(null);
          onCambio();
        }
      }
    },
    [ocupado, onCambio, onMudada],
  );

  /** Elegir un rincón: si ahí le va mal, se pregunta antes. */
  const elegirLugar = useCallback(
    (estado: EstadoDePlanta, lugar: Lugar) => {
      const v = veredictoMudanza(estado.especie, lugar, estado.planta.apodo);
      if (v.nivel === 'mal') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
        setSeleccion(estado.planta.id);
        setPanel({ plantaId: estado.planta.id, confirmar: { lugar, veredicto: v } });
        return;
      }
      void mover(estado, lugar);
    },
    [mover],
  );

  // El arrastre: dónde está la escena en la pantalla, y dónde las zonas.
  const contenedor = useRef<View>(null);
  const origen = useRef({ x: 0, y: 0 });
  const fantasmaX = useSharedValue(0);
  const fantasmaY = useSharedValue(0);
  const fantasmaEscala = useSharedValue(1);

  const zonaEn = useCallback(
    (xLocal: number, yLocal: number): Zona | null => {
      const cajas = cajasDeZonas(vista);
      const hit = cajas.find((c) => xLocal >= c.x - 10 && xLocal <= c.x + c.ancho + 10 && yLocal >= c.y - 14 && yLocal <= c.y + c.alto + 18);
      return hit?.zona ?? null;
    },
    [vista],
  );

  const levantar = useCallback(
    (id: string, ax: number, ay: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      // Si la que se levanta ya estaba seleccionada, sigue seleccionada: su
      // gesto no debe cambiar a medio camino.
      setSeleccion((s) => (s === id ? s : null));
      setPanel(null);
      contenedor.current?.measureInWindow((x, y) => {
        origen.current = { x, y };
        fantasmaX.set(ax - x);
        fantasmaY.set(ay - y);
      });
      fantasmaX.set(ax - origen.current.x);
      fantasmaY.set(ay - origen.current.y);
      fantasmaEscala.set(reducido ? 1 : withSpring(1.08, { duration: 260, dampingRatio: 0.6 }));
      setArrastre({ plantaId: id, encima: null });
      onArrastre?.(true);
    },
    [fantasmaX, fantasmaY, fantasmaEscala, reducido, onArrastre],
  );

  const arrastrar = useCallback(
    (ax: number, ay: number) => {
      const x = ax - origen.current.x;
      const y = ay - origen.current.y;
      fantasmaX.set(x);
      fantasmaY.set(y);
      const encima = zonaEn(x, y);
      setArrastre((a) => {
        if (!a || a.encima === encima) return a;
        if (encima) void Haptics.selectionAsync().catch(() => undefined);
        return { ...a, encima };
      });
    },
    [fantasmaX, fantasmaY, zonaEn],
  );

  const soltar = useCallback(
    (ax: number, ay: number) => {
      const a = arrastre;
      onArrastre?.(false);
      setArrastre(null);
      if (!a) return;
      const estado = porId.get(a.plantaId);
      if (!estado) return;
      const xLocal = ax - origen.current.x;
      const yLocal = ay - origen.current.y;
      const zona = zonaEn(xLocal, yLocal);
      if (zona) {
        if (zona !== zonaDe(estado.planta.ubicacion)) elegirLugar(estado, mejorLugarEn(zona, estado.especie));
        return;
      }
      // Suelta fuera de las cajas pero dentro de la escena: se queda en su
      // zona, en el lugar donde la dejó el dedo.
      if (xLocal < 0 || xLocal > vista || yLocal < 0 || yLocal > ALTO_MUNDO) return;
      const sitio = mundo.sitios.find((s) => s.id === estado.planta.id);
      if (!sitio) return;
      const fila = mundo.sitios.filter((s) => s.zona === sitio.zona).map((s) => ({ id: s.id, x: s.x, atras: s.escala < 1 }));
      // El dedo va a media planta; la maceta queda como 50 puntos más abajo.
      const atras = yLocal + 50 < (SUELO_FONDO + SUELO_FRENTE) / 2;
      const cambios = reacomodar(fila, estado.planta.id, xLocal + scrollX.get(), atras);
      setAcomodos((antes) => ({ ...antes, ...cambios }));
      setSeleccion(estado.planta.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      void guardarAcomodos(cambios).catch(() => undefined);
    },
    [arrastre, onArrastre, porId, zonaEn, elegirLugar, vista, mundo, scrollX],
  );

  const cancelarArrastre = useCallback(() => {
    setArrastre((a) => {
      if (a) onArrastre?.(false);
      return null;
    });
  }, [onArrastre]);

  const seleccionada = seleccion ? porId.get(seleccion) : undefined;
  const arrastrada = arrastre ? porId.get(arrastre.plantaId) : undefined;
  const zonaActual: Zona = escena;
  const avisoDe = useMemo(() => {
    const mapa = new Map<string, AvisoMover>();
    for (const a of avisos) if (!mapa.has(a.plantaId)) mapa.set(a.plantaId, a);
    return mapa;
  }, [avisos]);
  const afuera = escena !== 'casa';

  return (
    <View style={{ gap: 0 }}>
      <View
        ref={contenedor}
        onLayout={alMedir}
        style={{
          height: ALTO_MUNDO,
          borderTopLeftRadius: radio.lg + 4,
          borderTopRightRadius: radio.lg + 4,
          overflow: 'hidden',
          backgroundColor: afuera ? paleta.cielo[1] : '#E9DCC4',
        }}
      >
        {afuera && (
          <>
            <Cielo ancho={vista} momento={momento} />
            {!reducido && escena === 'patio' && <Nubes ancho={vista} opacidad={paleta.nube} />}
            {!reducido && escena === 'patio' && !lloviendo && momento !== 'noche' && <Pajaros ancho={vista} />}
            <Capa factor={0.18} ancho={vista + recorrido * 0.18} scrollX={scrollX} reducido={reducido}>
              <Colinas ancho={vista + recorrido * 0.18} base={HORIZONTE + 4} alto={70} color={paleta.lejos} semilla={1.3} />
            </Capa>
            <Capa factor={0.42} ancho={vista + recorrido * 0.42} scrollX={scrollX} reducido={reducido}>
              <Colinas ancho={vista + recorrido * 0.42} base={HORIZONTE + 6} alto={38} color={paleta.cerca} semilla={4.1} />
            </Capa>
          </>
        )}

        <Animated.ScrollView
          ref={desplazador}
          horizontal
          // Con una planta seleccionada, el dedo sobre ella la acomoda; el patio
          // se recorre con las flechas o soltándola.
          scrollEnabled={!arrastre && !(seleccion && !visita)}
          onScroll={alDesplazar}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentContainerStyle={{ width: mundo.ancho, height: ALTO_MUNDO }}
        >
          {afuera && <Suelo ancho={mundo.ancho} paleta={paleta} />}
          {escena === 'patio' && <PisoDelPatio ancho={mundo.ancho} piso={decoracion.patio.piso} />}
          {escena === 'patio' && <BardaPatio ancho={mundo.ancho} barda={decoracion.patio.barda} momento={momento} />}
          {escena === 'casa' && <FondoCasa ancho={mundo.ancho} momento={momento} casa={decoracion.casa} />}
          {escena === 'casa' && <AdornosCasa ancho={mundo.ancho} adornos={decoracion.casa.adornos} momento={momento} piso={PISO_CASA} />}
          {escena === 'casa' && (
            <VidaCasa ancho={mundo.ancho} momento={momento} reducido={reducido} gato={decoracion.casa.adornos.includes('gato')} />
          )}
          {escena === 'sombra' && <PisoDeSombra ancho={mundo.ancho} piso={decoracion.sombra.piso} momento={momento} />}
          {escena === 'sombra' && (
            <FondoSombra ancho={mundo.ancho} momento={momento} hongos={decoracion.sombra.adornos.includes('hongos')} />
          )}
          {escena === 'sombra' && <AdornosSombra ancho={mundo.ancho} adornos={decoracion.sombra.adornos} momento={momento} />}
          {escena === 'sombra' && !reducido && momento !== 'noche' && <DestellosDeLuz ancho={mundo.ancho} momento={momento} />}
          {escena === 'patio' &&
            mundo.regiones.map((r) => <Escenografia key={r.zona} region={r} momento={momento} barda={decoracion.patio.barda} />)}
          {escena === 'patio' && mundo.regiones.some((r) => r.zona === 'agua') && !reducido && (
            <Ondas region={mundo.regiones.find((r) => r.zona === 'agua')!} />
          )}
          {escena === 'patio' && mundo.regiones.map((r) => <Letrero key={`l-${r.zona}`} region={r} />)}
          {afuera && <VeloDeHora ancho={mundo.ancho} momento={momento} />}
          {escena === 'patio' && <AdornosPatio ancho={mundo.ancho} adornos={decoracion.patio.adornos} momento={momento} />}

          {mundo.sitios.map((sitio) => {
            const estado = porId.get(sitio.id);
            if (!estado) return null;
            return (
              <Habitante
                key={sitio.id}
                estado={estado}
                sitio={sitio}
                seleccionada={seleccion === sitio.id}
                cuidadaHoy={cuidadasHoy.has(sitio.id)}
                rebote={rebote.plantaId === sitio.id ? rebote.n : 0}
                aviso={avisoDe.get(sitio.id)}
                factor={escena === 'patio' ? 1.1 : 1.4}
                estiloMaceta={macetas[sitio.id]}
                levantada={arrastre?.plantaId === sitio.id}
                arrastrable={!visita}
                onToque={tocarPlanta}
                onLevantar={levantar}
                onArrastrar={arrastrar}
                onSoltar={soltar}
                onCancelar={cancelarArrastre}
                onMover={(id) => {
                  setSeleccion(id);
                  setPanel({ plantaId: id, confirmar: null });
                }}
              />
            );
          })}

          {afuera && momento === 'noche' && !reducido && <Luciernagas ancho={mundo.ancho} />}
          {/* Lo que vuela va encima de las plantas */}
          {escena === 'patio' && !reducido && !lloviendo && (momento === 'dia' || momento === 'amanecer') && (
            <Mariposas ancho={mundo.ancho} />
          )}
          {escena === 'sombra' && !reducido && momento !== 'noche' && <HojasQueCaen ancho={mundo.ancho} momento={momento} />}

          <Sina mundo={mundo} animo={animo} quieta={reducido || dormida} brinco={brincoSina} onToque={tocarSina} />

          {efecto && (
            <EfectoEnEscena
              key={efecto.id}
              efecto={efecto}
              sitio={mundo.sitios.find((s) => s.id === efecto.plantaId)}
              reducido={reducido}
            />
          )}
        </Animated.ScrollView>

        {lloviendo && afuera && !reducido && <Lluvia ancho={vista} />}
        {recorrido > 0 && <Flechas scrollX={scrollX} recorrido={recorrido} />}

        {!arrastre && (
        <Hud
          racha={racha}
          pendientes={pendientes.length}
          momento={momento}
          temperatura={clima?.tMaxHoyC ?? null}
          lloviendo={lloviendo}
          onDecorar={visita ? undefined : () => router.push('/decorar')}
        />
        )}

        {arrastre && arrastrada && (
          <DestinosDeArrastre
            ancho={vista}
            actual={zonaActual}
            encima={arrastre.encima}
            especie={arrastrada.especie}
            apodo={arrastrada.planta.apodo}
          />
        )}
        {arrastre && arrastrada && (
          <Fantasma estado={arrastrada} x={fantasmaX} y={fantasmaY} escala={fantasmaEscala} estiloMaceta={macetas[arrastrada.planta.id]} />
        )}
      </View>

      {visita ? (
        <DialogoVisita dueno={visita.dueno} seleccionada={seleccionada} animo={animo} tema={tema} onCerrar={() => setSeleccion(null)} />
      ) : panel && seleccionada && seleccionada.planta.id === panel.plantaId ? (
        <PanelDeMudanza
          estado={seleccionada}
          confirmar={panel.confirmar}
          ocupado={ocupado}
          mudandoA={mudandoA}
          tema={tema}
          onElegir={(lugar) => elegirLugar(seleccionada, lugar)}
          onConfirmar={(lugar) => void mover(seleccionada, lugar)}
          onVolver={() => setPanel(panel.confirmar ? { ...panel, confirmar: null } : null)}
          onCerrar={() => {
            setPanel(null);
            setSeleccion(null);
          }}
        />
      ) : escogiendoMaceta && seleccionada && seleccionada.planta.id === escogiendoMaceta ? (
        <PanelMaceta estado={seleccionada} actual={macetas[escogiendoMaceta]} tema={tema} onCerrar={() => setEscogiendoMaceta(null)} />
      ) : (
      <Dialogo
        seleccionada={seleccionada}
        aviso={seleccionada ? avisoDe.get(seleccionada.planta.id) : undefined}
        avisos={avisos}
        pendientes={pendientes}
        racha={racha}
        momento={momento}
        animo={animo}
        ocupado={ocupado}
        onCerrar={() => setSeleccion(null)}
        onCuidar={cuidar}
        onIrA={(estado) => {
          setSeleccion(estado.planta.id);
          const sitio = mundo.sitios.find((s) => s.id === estado.planta.id);
          if (sitio) irA(sitio.x);
        }}
        onMover={(estado) => setPanel({ plantaId: estado.planta.id, confirmar: null })}
        onMaceta={(estado) => setEscogiendoMaceta(estado.planta.id)}
        tema={tema}
      />
      )}
    </View>
  );
}

/**
 * Una escena sin plantas, con la decoración que se le pase: la vista previa
 * de la pantalla de decorar. Usa las mismas capas que el patio de verdad, así
 * que lo que se ve ahí es lo que se va a ver en Hoy.
 */
export function VistaPreviaEscena({ escena, decoracion, ancho }: { escena: Escena; decoracion: Decoracion; ancho: number }) {
  const momento = momentoDelDia();
  const paleta = PALETA[momento];
  const afuera = escena !== 'casa';
  // El patio de muestra: al sol a la izquierda y la pérgola a la derecha.
  const regiones: Region[] = [
    { zona: 'sol', x: 0, ancho: Math.round(ancho * 0.55), cuantas: 0 },
    { zona: 'semisombra', x: Math.round(ancho * 0.55), ancho: Math.round(ancho * 0.45), cuantas: 0 },
  ];
  return (
    <View pointerEvents="none" style={{ width: ancho, height: ALTO_MUNDO, backgroundColor: afuera ? paleta.cielo[1] : '#E9DCC4' }}>
      {afuera && <Cielo ancho={ancho} momento={momento} />}
      {afuera && <Colinas ancho={ancho} base={HORIZONTE + 4} alto={70} color={paleta.lejos} semilla={1.3} />}
      {afuera && <Colinas ancho={ancho} base={HORIZONTE + 6} alto={38} color={paleta.cerca} semilla={4.1} />}
      {afuera && <Suelo ancho={ancho} paleta={paleta} />}
      {escena === 'patio' && <PisoDelPatio ancho={ancho} piso={decoracion.patio.piso} />}
      {escena === 'patio' && <BardaPatio ancho={ancho} barda={decoracion.patio.barda} momento={momento} />}
      {escena === 'patio' && regiones.map((r) => <Escenografia key={r.zona} region={r} momento={momento} barda={decoracion.patio.barda} />)}
      {escena === 'casa' && <FondoCasa ancho={ancho} momento={momento} casa={decoracion.casa} />}
      {escena === 'casa' && <AdornosCasa ancho={ancho} adornos={decoracion.casa.adornos} momento={momento} piso={PISO_CASA} />}
      {escena === 'casa' && <VidaCasa ancho={ancho} momento={momento} reducido gato={decoracion.casa.adornos.includes('gato')} />}
      {escena === 'sombra' && <PisoDeSombra ancho={ancho} piso={decoracion.sombra.piso} momento={momento} />}
      {escena === 'sombra' && <FondoSombra ancho={ancho} momento={momento} hongos={decoracion.sombra.adornos.includes('hongos')} />}
      {escena === 'sombra' && <AdornosSombra ancho={ancho} adornos={decoracion.sombra.adornos} momento={momento} />}
      {afuera && <VeloDeHora ancho={ancho} momento={momento} />}
      {escena === 'patio' && <AdornosPatio ancho={ancho} adornos={decoracion.patio.adornos} momento={momento} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fondo
// ---------------------------------------------------------------------------

function Cielo({ ancho, momento }: { ancho: number; momento: Momento }) {
  const { cielo } = PALETA[momento];
  const sol = astro();
  const cx = numero(sol.x * ancho, ancho / 2);
  const cy = numero(sol.y * (HORIZONTE - 30) + 10, 80);
  const estrellas = momento === 'noche' ? estrellasPara(ancho) : [];

  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      <Defs>
        <LinearGradient id={`cielo-${momento}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={cielo[0]} />
          <Stop offset={String(HORIZONTE / ALTO_MUNDO)} stopColor={cielo[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={ancho} height={ALTO_MUNDO} fill={`url(#cielo-${momento})`} />
      {estrellas.map((e, i) => (
        <Circle key={i} cx={e.x} cy={e.y} r={e.r} fill="#FFFFFF" opacity={e.o} />
      ))}
      {sol.esSol ? (
        <G>
          <Circle cx={cx} cy={cy} r={34} fill="#FFF3C4" opacity={0.28} />
          <Circle cx={cx} cy={cy} r={20} fill={momento === 'atardecer' ? '#FFB35C' : '#FFE27A'} />
        </G>
      ) : (
        <G>
          <Circle cx={cx} cy={cy} r={26} fill="#F4EFD8" opacity={0.12} />
          <Circle cx={cx} cy={cy} r={15} fill="#F1EBD2" />
          <Circle cx={cx + 6} cy={cy - 4} r={13} fill={cielo[0]} opacity={0.9} />
        </G>
      )}
    </Svg>
  );
}

function estrellasPara(ancho: number) {
  const lista: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < 22; i += 1) {
    const a = fraccion(i * 12.9898);
    const b = fraccion(i * 78.233);
    lista.push({ x: a * ancho, y: 12 + b * (HORIZONTE - 80), r: 0.7 + fraccion(i * 3.1) * 1.1, o: 0.4 + b * 0.5 });
  }
  return lista;
}

/**
 * Una capa del fondo que se mueve más despacio que el suelo.
 *
 * El paralaje es lo que hace que un fondo plano se lea como lejano: lo de atrás
 * se desliza menos que lo de adelante. Con "reducir movimiento" se queda fija.
 */
function Capa({
  factor,
  ancho,
  scrollX,
  reducido,
  children,
}: {
  factor: number;
  ancho: number;
  scrollX: SharedValue<number>;
  reducido: boolean;
  children: React.ReactNode;
}) {
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: reducido ? 0 : -scrollX.get() * factor }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, width: ancho + 2, height: ALTO_MUNDO }, estilo]}
    >
      {children}
    </Animated.View>
  );
}

function Colinas({
  ancho,
  base,
  alto,
  color,
  semilla,
}: {
  ancho: number;
  base: number;
  alto: number;
  color: string;
  semilla: number;
}) {
  const w = numero(ancho, 400) + 2;
  let d = `M0 ${ALTO_MUNDO} L0 ${base}`;
  for (let x = 0; x <= w + 20; x += 20) {
    const y = base - alto * (0.55 + 0.3 * Math.sin(x / 90 + semilla) + 0.15 * Math.sin(x / 37 + semilla * 2));
    d += ` L${x} ${numero(y, base).toFixed(1)}`;
  }
  d += ` L${w + 20} ${ALTO_MUNDO} Z`;
  return (
    <Svg width={w} height={ALTO_MUNDO}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

/**
 * Tres nubes cruzando el cielo.
 *
 * Un solo reloj para las tres: cada una lo lee desfasada. Muy despacio y
 * translúcidas: que el cielo no esté congelado, no que alguien las mire.
 */
function Nubes({ ancho, opacidad }: { ancho: number; opacidad: number }) {
  const avance = useSharedValue(0);
  useEffect(() => {
    avance.set(withRepeat(withTiming(1, { duration: 90000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(avance);
  }, [avance]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HORIZONTE }}>
      <Nube avance={avance} desfase={0} ancho={ancho} y={34} tam={78} opacidad={opacidad} />
      <Nube avance={avance} desfase={0.38} ancho={ancho} y={86} tam={54} opacidad={opacidad * 0.85} />
      <Nube avance={avance} desfase={0.71} ancho={ancho} y={20} tam={44} opacidad={opacidad * 0.7} />
    </View>
  );
}

function Nube({
  avance,
  desfase,
  ancho,
  y,
  tam,
  opacidad,
}: {
  avance: SharedValue<number>;
  desfase: number;
  ancho: number;
  y: number;
  tam: number;
  opacidad: number;
}) {
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: ((avance.get() + desfase) % 1) * (ancho + tam * 2) - tam * 1.5 }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: y, opacity: opacidad }, estilo]}>
      <Svg width={tam} height={tam * 0.5}>
        <Ellipse cx={tam * 0.3} cy={tam * 0.32} rx={tam * 0.22} ry={tam * 0.15} fill="#fff" />
        <Ellipse cx={tam * 0.52} cy={tam * 0.24} rx={tam * 0.24} ry={tam * 0.2} fill="#fff" />
        <Ellipse cx={tam * 0.72} cy={tam * 0.33} rx={tam * 0.2} ry={tam * 0.13} fill="#fff" />
      </Svg>
    </Animated.View>
  );
}

/** Lluvia de verdad: sale del pronóstico de tu zona, no de un adorno. */
function Lluvia({ ancho }: { ancho: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(30,50,80,0.14)',
      }}
    >
      {Array.from({ length: 18 }, (_, i) => (
        <GotaDeLluvia key={i} t={t} x={fraccion(i * 7.31) * ancho} desfase={fraccion(i * 3.77)} />
      ))}
    </View>
  );
}

function GotaDeLluvia({ t, x, desfase }: { t: SharedValue<number>; x: number; desfase: number }) {
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: ((t.get() + desfase) % 1) * (ALTO_MUNDO + 40) - 30 }, { rotate: '12deg' }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x, top: 0, width: 1.6, height: 13, borderRadius: 1, backgroundColor: 'rgba(210,228,255,0.75)' },
        estilo,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Suelo y escenografía
// ---------------------------------------------------------------------------

function Suelo({ ancho, paleta }: { ancho: number; paleta: Paleta }) {
  const w = numero(ancho, 400);
  const matas: { x: number; y: number; flor: boolean }[] = [];
  for (let x = 14; x < w; x += 46) {
    const f = fraccion(x * 0.731);
    matas.push({ x: x + f * 20, y: HORIZONTE + 18 + fraccion(x * 1.37) * 90, flor: f > 0.62 });
  }
  const piedras: number[] = [];
  for (let x = 20; x < w - 10; x += 40) piedras.push(x + fraccion(x) * 8);

  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={w} height={ALTO_MUNDO}>
      <Defs>
        <LinearGradient id="pasto" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={paleta.pasto[0]} />
          <Stop offset="1" stopColor={paleta.pasto[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={HORIZONTE} width={w} height={ALTO_MUNDO - HORIZONTE} fill="url(#pasto)" />
      <Rect x={0} y={HORIZONTE} width={w} height={3} fill="#FFFFFF" opacity={0.14} />
      {matas.map((m, i) => (
        <G key={i}>
          <Path
            d={`M${m.x.toFixed(1)} ${m.y.toFixed(1)} l3 -9 l2 9 l3 -7 l2 7 l3 -10 l2 10 Z`}
            fill={paleta.pasto[1]}
            opacity={0.7}
          />
          {m.flor && <Circle cx={m.x + 8} cy={m.y - 10} r={2.2} fill={i % 2 ? '#FFE27A' : '#FFFFFF'} opacity={0.9} />}
        </G>
      ))}
      {/* El camino por donde anda la sina. */}
      <Rect x={6} y={CAMINO - 14} width={w - 12} height={30} rx={15} fill={paleta.camino} />
      {piedras.map((x, i) => (
        <Ellipse key={i} cx={x} cy={CAMINO + 1 + (i % 2) * 3} rx={9} ry={4} fill="#000" opacity={0.08} />
      ))}
    </Svg>
  );
}

function Escenografia({ region, momento, barda = 'madera' }: { region: Region; momento: Momento; barda?: Barda }) {
  const w = region.ancho;
  const noche = momento === 'noche';
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: region.x }}
      width={w}
      height={ALTO_MUNDO}
    >
      {region.zona === 'interior' && <Casa w={w} momento={momento} />}
      {region.zona === 'sombra' && <Arbol w={w} noche={noche} />}
      {region.zona === 'semisombra' && <Pergola w={w} noche={noche} />}
      {region.zona === 'sol' && <Cerca w={w} noche={noche} conCerca={barda === 'madera'} />}
      {region.zona === 'agua' && <Estanque w={w} noche={noche} />}
    </Svg>
  );
}

/** Adentro: la casa cortada, como casa de muñecas. De noche, la lámpara prendida. */
function Casa({ w, momento }: { w: number; momento: Momento }) {
  const noche = momento === 'noche';
  const piso = HORIZONTE + 46;
  const muro = noche ? '#D6B684' : '#F3E6CC';
  const ventanaX = w * 0.5 - 38;
  const franjas: number[] = [];
  for (let x = 26; x < w - 20; x += 24) franjas.push(x);
  const tablas: number[] = [];
  for (let y = piso + 14; y < ALTO_MUNDO; y += 16) tablas.push(y);

  return (
    <G>
      {/* Techo */}
      <Path d={`M-4 100 L${w / 2} 30 L${w + 4} 100 Z`} fill="#B5553C" />
      <Rect x={-4} y={96} width={w + 8} height={8} fill="#8E3F2B" />
      {/* Muro */}
      <Rect x={6} y={104} width={w - 12} height={piso - 104} fill={muro} />
      {franjas.map((x) => (
        <Rect key={x} x={x} y={104} width={3} height={piso - 104} fill="#000" opacity={0.035} />
      ))}
      <Rect x={6} y={104} width={6} height={piso - 104} fill="#000" opacity={0.08} />
      <Rect x={w - 12} y={104} width={6} height={piso - 104} fill="#000" opacity={0.08} />
      {/* Ventana */}
      <Rect x={ventanaX} y={128} width={76} height={66} rx={4} fill={PALETA[momento].cielo[1]} />
      <Rect x={ventanaX} y={128} width={76} height={66} rx={4} fill="none" stroke="#FFFFFF" strokeWidth={5} />
      <Rect x={ventanaX + 36} y={128} width={4} height={66} fill="#FFFFFF" />
      <Rect x={ventanaX} y={159} width={76} height={4} fill="#FFFFFF" />
      <Rect x={ventanaX - 6} y={194} width={88} height={6} rx={2} fill="#C9A77A" />
      {noche ? (
        <G>
          {/* La lámpara */}
          <Rect x={w * 0.2 - 1} y={104} width={2} height={36} fill="#5A4632" />
          <Path d={`M${w * 0.2 - 14} 154 L${w * 0.2 + 14} 154 L${w * 0.2 + 8} 140 L${w * 0.2 - 8} 140 Z`} fill="#E9B44C" />
          <Circle cx={w * 0.2} cy={160} r={60} fill="#FFD27A" opacity={0.16} />
          <Circle cx={w * 0.2} cy={160} r={28} fill="#FFE3A3" opacity={0.25} />
        </G>
      ) : (
        // La luz que entra por la ventana y cae al piso.
        <Path
          d={`M${ventanaX} 194 L${ventanaX + 76} 194 L${ventanaX + 110} ${piso + 40} L${ventanaX + 20} ${piso + 40} Z`}
          fill="#FFF6D8"
          opacity={0.28}
        />
      )}
      {/* Zoclo y piso de duela */}
      <Rect x={6} y={piso - 6} width={w - 12} height={6} fill="#A0784F" />
      <Rect x={0} y={piso} width={w} height={ALTO_MUNDO - piso} fill={noche ? '#8C6441' : '#C9955F'} />
      {tablas.map((y) => (
        <Rect key={y} x={0} y={y} width={w} height={1.5} fill="#000" opacity={0.1} />
      ))}
      <Rect x={w * 0.18} y={CAMINO - 12} width={w * 0.64} height={26} rx={6} fill="#B5553C" opacity={0.55} />
    </G>
  );
}

/** Bajo el árbol: un fresno grande, con su sombra en el pasto. */
function Arbol({ w, noche }: { w: number; noche: boolean }) {
  const cx = w * 0.5;
  const hoja = noche ? ['#1E3A2A', '#264A33', '#18301F'] : ['#3F7D4A', '#4F9457', '#356B40'];
  return (
    <G>
      <Ellipse cx={cx} cy={344} rx={w * 0.46} ry={38} fill="#000" opacity={0.12} />
      <Path
        d={`M${cx - 16} 330 Q${cx - 10} 250 ${cx - 8} 150 L${cx + 8} 150 Q${cx + 10} 250 ${cx + 18} 330 Z`}
        fill={noche ? '#3A2A1C' : '#6B4A2F'}
      />
      <Path d={`M${cx} 200 Q${cx + 30} 180 ${cx + 52} 150`} stroke={noche ? '#3A2A1C' : '#6B4A2F'} strokeWidth={7} fill="none" />
      <Circle cx={cx - 48} cy={132} r={62} fill={hoja[2]} />
      <Circle cx={cx + 52} cy={128} r={66} fill={hoja[2]} />
      <Circle cx={cx} cy={96} r={78} fill={hoja[0]} />
      <Circle cx={cx - 58} cy={112} r={48} fill={hoja[1]} />
      <Circle cx={cx + 60} cy={104} r={50} fill={hoja[1]} />
      <Circle cx={cx - 18} cy={70} r={38} fill={hoja[1]} opacity={0.9} />
      <Circle cx={cx + 26} cy={64} r={24} fill="#FFFFFF" opacity={0.06} />
    </G>
  );
}

/** La pérgola: vigas de madera, una enredadera con flores, luz a manchas. */
function Pergola({ w, noche }: { w: number; noche: boolean }) {
  const madera = noche ? '#4A3626' : '#8A6240';
  const vigas: number[] = [];
  for (let x = 10; x < w - 6; x += 26) vigas.push(x);
  const racimos: { x: number; y: number; r: number }[] = [];
  for (let x = 16; x < w - 10; x += 22) {
    racimos.push({ x, y: 124 + fraccion(x * 0.37) * 12, r: 9 + fraccion(x * 0.91) * 7 });
  }
  return (
    <G>
      {!noche &&
        [0.2, 0.45, 0.7].map((f, i) => (
          <Ellipse key={i} cx={w * f + 10} cy={330 + i * 10} rx={34} ry={9} fill="#FFF3C0" opacity={0.2} />
        ))}
      <Rect x={18} y={118} width={9} height={SUELO_POSTE - 118} fill={madera} />
      <Rect x={w - 27} y={118} width={9} height={SUELO_POSTE - 118} fill={madera} />
      <Rect x={6} y={112} width={w - 12} height={10} rx={2} fill={madera} />
      {vigas.map((x) => (
        <Rect key={x} x={x} y={104} width={6} height={24} rx={1} fill={madera} opacity={0.9} />
      ))}
      {racimos.map((r, i) => (
        <G key={i}>
          <Circle cx={r.x} cy={r.y} r={r.r} fill={noche ? '#244232' : '#5DA35A'} />
          {i % 3 === 0 && (
            <Path
              d={`M${r.x} ${r.y} q4 22 -2 ${30 + (i % 4) * 8}`}
              stroke={noche ? '#244232' : '#4E8E4C'}
              strokeWidth={2.5}
              fill="none"
            />
          )}
          {i % 2 === 0 && <Circle cx={r.x + 4} cy={r.y - 3} r={2.6} fill={noche ? '#8E5A6E' : '#E86A92'} />}
        </G>
      ))}
    </G>
  );
}
/** Base de los postes de la pérgola: justo detrás de la fila de atrás. */
const SUELO_POSTE = 314;

/** Al sol: la cerca de madera y un nopal, que aquí es México. */
function Cerca({ w, noche, conCerca = true }: { w: number; noche: boolean; conCerca?: boolean }) {
  const tabla = noche ? '#6D6553' : '#EBDDC0';
  const tablas: number[] = [];
  for (let x = 4; x < w - 8; x += 17) tablas.push(x);
  const nx = w - 46;
  return (
    <G>
      <Ellipse cx={w * 0.5} cy={336} rx={w * 0.42} ry={24} fill="#F2C98A" opacity={noche ? 0.06 : 0.28} />
      {conCerca &&
        tablas.map((x) => (
          <Path key={x} d={`M${x} ${HORIZONTE + 14} L${x} ${HORIZONTE - 30} L${x + 6} ${HORIZONTE - 38} L${x + 12} ${HORIZONTE - 30} L${x + 12} ${HORIZONTE + 14} Z`} fill={tabla} />
        ))}
      {conCerca && <Rect x={0} y={HORIZONTE - 22} width={w} height={6} fill={tabla} />}
      {conCerca && <Rect x={0} y={HORIZONTE - 2} width={w} height={6} fill={tabla} />}
      {conCerca && <Rect x={0} y={HORIZONTE - 22} width={w} height={6} fill="#000" opacity={0.08} />}
      {/* Nopal */}
      <G opacity={noche ? 0.7 : 1}>
        <Ellipse cx={nx} cy={HORIZONTE + 2} rx={15} ry={22} fill="#5E9C4E" />
        <Ellipse cx={nx - 16} cy={HORIZONTE - 24} rx={10} ry={15} fill="#6BAA58" transform={`rotate(-25 ${nx - 16} ${HORIZONTE - 24})`} />
        <Ellipse cx={nx + 14} cy={HORIZONTE - 30} rx={11} ry={16} fill="#6BAA58" transform={`rotate(20 ${nx + 14} ${HORIZONTE - 30})`} />
        <Circle cx={nx + 20} cy={HORIZONTE - 46} r={4} fill="#E5484D" />
      </G>
    </G>
  );
}

/** El estanque: donde viven las de frasco y las acuáticas. */
function Estanque({ w, noche }: { w: number; noche: boolean }) {
  const cx = w * 0.55;
  return (
    <G>
      <Ellipse cx={cx} cy={352} rx={w * 0.4 + 6} ry={38} fill="#8C8474" opacity={0.6} />
      <Ellipse cx={cx} cy={352} rx={w * 0.4} ry={33} fill={noche ? '#17405A' : '#3C8DB5'} />
      <Ellipse cx={cx - 10} cy={346} rx={w * 0.28} ry={18} fill="#FFFFFF" opacity={noche ? 0.05 : 0.14} />
      {/* Nenúfares */}
      <Ellipse cx={cx + w * 0.18} cy={360} rx={12} ry={5} fill={noche ? '#244A34' : '#4E9A55'} />
      <Ellipse cx={cx - w * 0.2} cy={344} rx={10} ry={4} fill={noche ? '#244A34' : '#4E9A55'} />
      <Circle cx={cx + w * 0.18 + 2} cy={357} r={3} fill="#F4A6C0" />
      {/* Tules */}
      {[0, 7, 14].map((d, i) => (
        <G key={i}>
          <Path d={`M${18 + d} 344 L${20 + d} ${282 - i * 8}`} stroke={noche ? '#2A4A30' : '#5F8F46'} strokeWidth={2.5} />
          <Rect x={17 + d} y={284 - i * 8} width={6} height={16} rx={3} fill={noche ? '#3A2A1C' : '#7A5028'} />
        </G>
      ))}
    </G>
  );
}

/** Ondas en el estanque: dos anillos que se abren, desfasados. */
function Ondas({ region }: { region: Region }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t]);
  const cx = region.x + region.ancho * 0.55;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: cx - 40, top: 344, width: 80, height: 18 }}>
      <Anillo t={t} desfase={0} />
      <Anillo t={t} desfase={0.5} />
    </View>
  );
}

function Anillo({ t, desfase }: { t: SharedValue<number>; desfase: number }) {
  const estilo = useAnimatedStyle(() => {
    const u = (t.get() + desfase) % 1;
    return { opacity: 0.6 * (1 - u), transform: [{ scale: 0.4 + u }] };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: 80,
          height: 18,
          borderRadius: 40,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.8)',
        },
        estilo,
      ]}
    />
  );
}

/** El letrero de madera de cada zona. Adentro es una placa en la pared. */
function Letrero({ region }: { region: Region }) {
  const adentro = region.zona === 'interior';
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: region.x + 14, top: adentro ? 212 : HORIZONTE - 34, alignItems: 'flex-start' }}
    >
      <View
        style={{
          backgroundColor: adentro ? '#6B4A2F' : '#A8743F',
          borderColor: '#7A5028',
          borderWidth: 1.5,
          borderRadius: 5,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11, color: '#FFF4DE' }}>
          {NOMBRE_ZONA[region.zona]}
        </Text>
      </View>
      {!adentro && <View style={{ width: 5, height: 24, marginLeft: 16, backgroundColor: '#7A5028' }} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Las plantas
// ---------------------------------------------------------------------------

/** El globo de "muévela": a dónde. */
const ICONO_MOVER: Record<AvisoMover['destino'], keyof typeof Ionicons.glyphMap> = {
  sombra: 'umbrella',
  adentro: 'home',
  techo: 'umbrella',
  mas_luz: 'sunny',
  menos_luz: 'partly-sunny',
};

const ICONO_GLOBO: Record<string, keyof typeof Ionicons.glyphMap> = {
  regar: 'water',
  suspender_riego: 'hand-left',
  cambiar_agua: 'sync',
};

function Habitante({
  estado,
  sitio,
  seleccionada,
  cuidadaHoy,
  rebote,
  aviso,
  factor = 1,
  estiloMaceta,
  levantada,
  arrastrable = true,
  onToque,
  onLevantar,
  onArrastrar,
  onSoltar,
  onCancelar,
  onMover,
}: {
  estado: EstadoDePlanta;
  sitio: Sitio;
  seleccionada: boolean;
  cuidadaHoy: boolean;
  rebote: number;
  /** Si hay que moverla por el clima de hoy o mañana. */
  aviso?: AvisoMover;
  /** Más grandes en la casa y la sombra, donde hay menos plantas y más espacio. */
  factor?: number;
  /** La maceta que le escogieron. */
  estiloMaceta?: EstiloMaceta;
  /** La que va en el dedo: aquí queda su hueco. */
  levantada: boolean;
  /** De visita no se mueve nada. */
  arrastrable?: boolean;
  onToque: (id: string) => void;
  onLevantar: (id: string, x: number, y: number) => void;
  onArrastrar: (x: number, y: number) => void;
  onSoltar: (x: number, y: number) => void;
  onCancelar: () => void;
  /** Para quien no puede arrastrar (lector de pantalla): abrir la mudanza. */
  onMover: (id: string) => void;
}) {
  const tema = useTema();
  const reducido = useReducedMotion();
  const { planta, especie, estadoHoy, snapshot, recomendacion } = estado;

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

  const accion = etiquetaAccion(recomendacion.accion, recomendacion.urgencia);
  const [cima, setCima] = useState(0);
  const tamano = Math.round(TAMANO_PLANTA * sitio.escala * factor);
  const ancho = Math.max(tamano, 96);

  // Aplastar y estirar: la planta "recibe" el agua. Conserva el volumen —se
  // ensancha lo que se achata— para que se lea como cuerpo y no como dibujo.
  const aplaste = useSharedValue(1);
  useEffect(() => {
    if (rebote === 0 || reducido) return;
    aplaste.set(
      withSequence(
        withTiming(0.9, { duration: 120, easing: EASE_OUT }),
        withSpring(1, { duration: 520, dampingRatio: 0.45 }),
      ),
    );
  }, [rebote, reducido, aplaste]);
  const estiloRebote = useAnimatedStyle(() => ({
    transform: [{ scaleY: aplaste.get() }, { scaleX: 2 - aplaste.get() }],
  }));

  // El mecido del viento, distinto en cada planta y más corto en las que
  // tienen sed: una planta sin turgencia no se mece, se cuelga.
  const mecido = useSharedValue(0);
  const amplitud = (1 - Math.min(1, Math.max(0, morfologia.caida)) * 0.8) * 1.4;
  const periodo = 2600 + sitio.fase * 1400;
  useEffect(() => {
    if (reducido) {
      mecido.set(0);
      return;
    }
    mecido.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: periodo, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: periodo, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(mecido);
  }, [reducido, mecido, periodo]);
  const estiloMecido = useAnimatedStyle(() => ({ transform: [{ rotate: `${mecido.get() * amplitud}deg` }] }));

  // Tocar la selecciona; dejar el dedo encima la levanta para llevarla a otra
  // zona. Si el dedo se mueve antes, no es ninguna de las dos: es desplazar el
  // patio, y eso lo hace el scroll.
  const presion = useSharedValue(1);
  // Las funciones se leen de aquí, al momento: si fueran dependencias del
  // gesto, cada cambio de estado a media arrastrada lo reconfiguraría, y en
  // el navegador eso lo deja colgado sin terminar nunca.
  const llamadas = useRef({ onToque, onLevantar, onArrastrar, onSoltar, onCancelar });
  llamadas.current = { onToque, onLevantar, onArrastrar, onSoltar, onCancelar };
  const gesto = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(500)
      .runOnJS(true)
      .onBegin(() => presion.set(withTiming(0.96, { duration: 90 })))
      .onEnd((_e, exito) => {
        if (exito) llamadas.current.onToque(planta.id);
      })
      .onFinalize(() => presion.set(withSpring(1, { duration: 280, dampingRatio: 0.6 })));
    // De visita no hay arrastre, y el toque va solo: dentro de `Exclusive`, un
    // arrastre apagado nunca "falla", y el toque se quedaba esperándolo.
    if (!arrastrable) return tap;
    // Ya seleccionada, basta un toque sostenido corto para levantarla; sin
    // seleccionar, el largo de siempre (para no pelear con el scroll).
    const pan = Gesture.Pan()
      .activateAfterLongPress(seleccionada ? 110 : 380)
      .runOnJS(true)
      .onStart((e) => llamadas.current.onLevantar(planta.id, e.absoluteX, e.absoluteY))
      .onUpdate((e) => llamadas.current.onArrastrar(e.absoluteX, e.absoluteY))
      .onEnd((e) => llamadas.current.onSoltar(e.absoluteX, e.absoluteY))
      .onFinalize((_e, exito) => {
        if (!exito) llamadas.current.onCancelar();
      });
    return Gesture.Exclusive(pan, tap);
  }, [planta.id, presion, arrastrable, seleccionada]);
  const estiloPresion = useAnimatedStyle(() => ({ transform: [{ scale: presion.get() }] }));

  return (
    <Animated.View
      entering={reducido ? undefined : ZoomIn.duration(260)}
      exiting={reducido ? undefined : ZoomOut.duration(220)}
      // Acomodada en otro lugar, camina hasta allá en vez de aparecer.
      layout={reducido ? undefined : LinearTransition.springify().damping(18).stiffness(160)}
      style={{
        position: 'absolute',
        left: sitio.x - ancho / 2,
        bottom: ALTO_MUNDO - sitio.base,
        width: ancho,
      }}
    >
    <GestureDetector gesture={gesto}>
    <Animated.View
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${planta.apodo}. ${accion.texto}.${cuidadaHoy ? ' Ya la cuidaste hoy.' : ''}`}
      accessibilityHint="Mantén presionada para llevarla a otra zona"
      accessibilityActions={[{ name: 'activate' }, { name: 'mover', label: 'Mover de zona' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'mover') onMover(planta.id);
        else onToque(planta.id);
      }}
      style={[
        {
          width: ancho,
          alignItems: 'center',
          justifyContent: 'flex-end',
          opacity: levantada ? 0.28 : 1,
        },
        estiloPresion,
      ]}
    >
      {/* El globo baja con la planta: el dibujo se asienta en el piso y el
          globo debe quedar justo encima de sus hojas, no flotando en la pared. */}
      <View style={{ marginBottom: -Math.max(0, cima - 6), zIndex: 1 }}>
        {accion.pideAtencion ? (
          <Globo
            icono={ICONO_GLOBO[recomendacion.accion] ?? 'alert'}
            color={recomendacion.accion === 'suspender_riego' ? tema.critico : AGUA}
            reducido={reducido}
          />
        ) : aviso && aviso.enDias <= 1 && aviso.motivo !== 'luz' ? (
          <Globo icono={ICONO_MOVER[aviso.destino]} color="#E8761A" reducido={reducido} />
        ) : null}
      </View>

      {/* La sombra y el aro de selección van en el piso, debajo de la maceta. */}
      <View
        style={{
          position: 'absolute',
          bottom: -5,
          width: tamano * 0.56,
          height: 12,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.2)',
        }}
      />
      {seleccionada && (
        <Animated.View
          entering={FadeIn.duration(160)}
          style={{
            position: 'absolute',
            bottom: -9,
            width: tamano * 0.78,
            height: 20,
            borderRadius: 999,
            borderWidth: 2.5,
            borderColor: '#FFE58A',
            backgroundColor: 'rgba(255,229,138,0.22)',
          }}
        />
      )}

      <Animated.View style={[{ transformOrigin: 'bottom center' }, estiloRebote]}>
        <Animated.View style={[{ transformOrigin: 'bottom center' }, estiloMecido]}>
          <Gemelo
            especieId={especie.id}
            morfologia={morfologia}
            apariencia={planta.apariencia}
            recipiente={planta.contenedor.tipo}
            diasSinCambioAgua={snapshot.hidrico.diasDesdeCambioAgua}
            colorMaceta={colorDeMaceta(planta.contenedor.material)}
            estiloMaceta={estiloMaceta}
            semilla={planta.id}
            ancho={tamano}
            alto={Math.round(tamano * 1.2)}
            // Cada una mirando un poco distinto: en fila y de frente parecerían
            // de catálogo.
            giro={-1.1 + sitio.fase * 1.4}
            inclinacion={0.22}
            detalle="bajo"
            sombra={false}
            apoyado
            onCima={setCima}
          />
        </Animated.View>
      </Animated.View>

      <View
        style={{
          position: 'absolute',
          top: '100%',
          marginTop: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          backgroundColor: seleccionada ? '#FFE58A' : 'rgba(0,0,0,0.45)',
          borderRadius: radio.completo,
          paddingHorizontal: 8,
          paddingVertical: 2,
          maxWidth: ancho + 10,
        }}
      >
        {cuidadaHoy && <Ionicons name="checkmark-circle" size={11} color={seleccionada ? '#B85A00' : '#FFB22E'} />}
        <Text
          numberOfLines={1}
          style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 10.5, color: seleccionada ? '#3A2A10' : '#FFFFFF' }}
        >
          {planta.apodo}
        </Text>
      </View>
      {/* Color del nivel, sin palabras: un punto junto al nombre. */}
      <View
        style={{
          position: 'absolute',
          top: '100%',
          marginTop: -2,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colorDeNivel(tema, estadoHoy.nivel),
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
        }}
      />
    </Animated.View>
    </GestureDetector>
    </Animated.View>
  );
}

/** El globo sobre la planta que pide algo. Flota para que se note sin gritar. */
function Globo({
  icono,
  color,
  reducido,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
  reducido: boolean;
}) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (reducido) return;
    y.set(
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 750, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 750, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(y);
  }, [reducido, y]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Animated.View style={[{ alignItems: 'center', marginBottom: 2 }, estilo]}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Ionicons name={icono} size={17} color={color} />
      </View>
      <View style={{ width: 8, height: 8, marginTop: -5, backgroundColor: '#FFFFFF', transform: [{ rotate: '45deg' }] }} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// La sina
// ---------------------------------------------------------------------------

function Sina({
  mundo,
  animo,
  quieta,
  brinco,
  onToque,
}: {
  mundo: Mundo;
  animo: Animo;
  quieta: boolean;
  brinco: number;
  onToque: () => void;
}) {
  const reloj = useSharedValue(0);
  const { ruta, inicioSina } = mundo;
  const total = duracionRuta(ruta);

  useEffect(() => {
    cancelAnimation(reloj);
    reloj.set(0);
    if (quieta || total <= 0) return;
    reloj.set(withRepeat(withTiming(total, { duration: total, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(reloj);
  }, [reloj, quieta, total, ruta]);

  const pos = useDerivedValue(() => posicionSina(ruta, inicioSina, reloj.get()));
  const estiloPaso = useAnimatedStyle(() => {
    const p = pos.get();
    // Un brinquito por paso, y sólo mientras camina: parada no rebota.
    const bote = p.andando ? -Math.abs(Math.sin(p.pasos * Math.PI)) * 4 : 0;
    return { transform: [{ translateX: p.x - TAM_SINA / 2 }, { translateY: bote }] };
  });
  const estiloMira = useAnimatedStyle(() => ({ transform: [{ scaleX: pos.get().mira }] }));

  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: CAMINO - TAM_SINA + 10, width: TAM_SINA }, estiloPaso]}
    >
      {animo === 'alerta' && (
        <View
          style={{
            position: 'absolute',
            top: -14,
            alignSelf: 'center',
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#FFD54A',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 12, lineHeight: 14, color: '#5A3A00' }}>!</Text>
        </View>
      )}
      <Pressable onPress={onToque} hitSlop={10} accessibilityRole="button" accessibilityLabel="La sina. Tócala y te lleva a la planta que más urge.">
        <Animated.View style={estiloMira}>
          <CaraSina animo={animo} tamano={TAM_SINA} brinco={brinco} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Efectos de cuidado
// ---------------------------------------------------------------------------

/**
 * Lo que pasa en la escena al regar o revisar.
 *
 * Un solo reloj de 0 a 1 para todo el efecto: la regadera, cada gota y el
 * texto leen su tramo de ese reloj. Así no hay diez animaciones que coordinar
 * y todas terminan juntas.
 */
function EfectoEnEscena({
  efecto,
  sitio,
  reducido,
}: {
  efecto: Efecto;
  sitio: Sitio | undefined;
  reducido: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: DURACION_EFECTO - 150, easing: Easing.linear }));
  }, [t]);

  if (!sitio) return null;
  const alto = TAMANO_PLANTA * sitio.escala * 0.95;
  const x = sitio.x;
  const cima = sitio.base - alto;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {!reducido && efecto.tipo === 'agua' && (
        <>
          <Regadera t={t} x={x + 8} y={cima - 34} />
          {Array.from({ length: 9 }, (_, i) => (
            <GotaDeRiego
              key={i}
              t={t}
              desdeX={x + 2 - (i % 3) * 5}
              desdeY={cima - 8}
              hastaY={sitio.base - alto * 0.35}
              retraso={0.22 + i * 0.045}
            />
          ))}
        </>
      )}
      {!reducido &&
        efecto.tipo === 'revision' &&
        Array.from({ length: 8 }, (_, i) => (
          <Chispa key={i} t={t} cx={x} cy={sitio.base - alto * 0.55} angulo={(i / 8) * Math.PI * 2 + 0.3} />
        ))}
      <TextoFlotante t={t} x={x} y={cima - (efecto.tipo === 'agua' ? 58 : 26)} efecto={efecto} />
    </View>
  );
}

function Regadera({ t, x, y }: { t: SharedValue<number>; x: number; y: number }) {
  const estilo = useAnimatedStyle(() => {
    const v = t.get();
    const entra = interpolate(v, [0, 0.14], [0, 1], Extrapolation.CLAMP);
    const sale = interpolate(v, [0.82, 1], [1, 0], Extrapolation.CLAMP);
    // Se inclina para servir, se sostiene, y se endereza al final.
    const inclina = interpolate(v, [0.1, 0.24, 0.7, 0.82], [0, -32, -32, 0], Extrapolation.CLAMP);
    return {
      opacity: Math.min(entra, sale),
      transform: [{ translateY: (1 - entra) * -10 }, { rotate: `${inclina}deg` }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y, width: 50, height: 38 }, estilo]}>
      <Svg width={50} height={38} viewBox="0 0 50 38">
        <Path d="M26 12 Q34 -2 44 12" stroke="#2F7FB8" strokeWidth={3.5} fill="none" />
        <Path d="M20 22 L5 9 L8 6 L22 17 Z" fill="#4FA3D9" />
        <Ellipse cx={5} cy={8} rx={4} ry={3} fill="#2F7FB8" />
        <Rect x={18} y={12} width={28} height={22} rx={4} fill="#4FA3D9" />
        <Rect x={18} y={12} width={28} height={5} rx={2} fill="#2F7FB8" />
        <Rect x={22} y={20} width={6} height={10} rx={2} fill="#FFFFFF" opacity={0.3} />
      </Svg>
    </Animated.View>
  );
}

function GotaDeRiego({
  t,
  desdeX,
  desdeY,
  hastaY,
  retraso,
}: {
  t: SharedValue<number>;
  desdeX: number;
  desdeY: number;
  hastaY: number;
  retraso: number;
}) {
  const estilo = useAnimatedStyle(() => {
    const u = Math.max(0, Math.min(1, (t.get() - retraso) / 0.3));
    // Caída con gravedad: arranca lenta y acelera. Es de las pocas veces que
    // una curva de entrada es la correcta, porque así cae el agua.
    const caida = u * u;
    return {
      opacity: u <= 0 || u >= 1 ? 0 : 1 - u * u * u,
      transform: [{ translateY: desdeY + (hastaY - desdeY) * caida }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: desdeX, top: 0, width: 5, height: 9, borderRadius: 3, backgroundColor: '#5BB3F0' },
        estilo,
      ]}
    />
  );
}

function Chispa({ t, cx, cy, angulo }: { t: SharedValue<number>; cx: number; cy: number; angulo: number }) {
  const dx = Math.cos(angulo);
  const dy = Math.sin(angulo);
  const estilo = useAnimatedStyle(() => {
    const u = Math.min(1, t.get() / 0.6);
    const sale = 1 - Math.pow(1 - u, 3);
    return {
      opacity: u >= 1 ? 0 : 1 - u * u,
      transform: [
        { translateX: cx - 7 + dx * 44 * sale },
        { translateY: cy - 7 + dy * 38 * sale },
        { scale: 0.6 + 0.5 * Math.sin(u * Math.PI) },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, estilo]}>
      <Ionicons name="sparkles" size={14} color="#FFD54A" />
    </Animated.View>
  );
}

function TextoFlotante({ t, x, y, efecto }: { t: SharedValue<number>; x: number; y: number; efecto: Efecto }) {
  const estilo = useAnimatedStyle(() => {
    const v = t.get();
    const entra = interpolate(v, [0.3, 0.45], [0, 1], Extrapolation.CLAMP);
    const sale = interpolate(v, [0.85, 1], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: Math.min(entra, sale),
      transform: [{ translateY: -14 * interpolate(v, [0.3, 1], [0, 1], Extrapolation.CLAMP) }],
    };
  });
  const agua = efecto.tipo === 'agua';
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - 60,
          top: y,
          width: 120,
          alignItems: 'center',
        },
        estilo,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: agua ? AGUA : '#1E8A47',
          borderRadius: radio.completo,
          paddingHorizontal: 9,
          paddingVertical: 3,
        }}
      >
        <Ionicons name={agua ? 'water' : 'checkmark'} size={12} color="#FFFFFF" />
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: '#FFFFFF' }}>{efecto.texto}</Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Encima de la escena
// ---------------------------------------------------------------------------

function Flechas({ scrollX, recorrido }: { scrollX: SharedValue<number>; recorrido: number }) {
  const izquierda = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.get(), [0, 40], [0, 1], Extrapolation.CLAMP),
  }));
  const derecha = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.get(), [recorrido - 40, recorrido], [1, 0], Extrapolation.CLAMP),
  }));
  const flecha = {
    position: 'absolute' as const,
    top: HORIZONTE - 70,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <>
      <Animated.View pointerEvents="none" style={[flecha, { left: 8 }, izquierda]}>
        <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[flecha, { right: 8 }, derecha]}>
        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
      </Animated.View>
    </>
  );
}

function Hud({
  racha,
  pendientes,
  momento,
  temperatura,
  lloviendo,
  onDecorar,
}: {
  racha: Racha | null;
  pendientes: number;
  momento: Momento;
  temperatura: number | null;
  lloviendo: boolean;
  /** Abre la pantalla para decorar. De visita no hay. */
  onDecorar?: () => void;
}) {
  const icono: keyof typeof Ionicons.glyphMap = lloviendo
    ? 'rainy'
    : momento === 'noche'
      ? 'moon'
      : momento === 'dia'
        ? 'sunny'
        : 'partly-sunny';

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {racha && (
        <Pressable
          onPress={() => felicitarRacha({ dias: racha.dias, mejor: racha.mejor, hoyCuenta: racha.hoyCuenta })}
          accessibilityRole="button"
          accessibilityLabel={`Racha de ${racha.dias} días. ${racha.hoyCuenta ? 'Hoy ya cuenta.' : 'Hoy todavía no cuenta.'}`}
          accessibilityHint="Toca para ver cómo vas"
          style={({ pressed }) => [
            pastilla,
            {
              borderWidth: racha.hoyCuenta ? 0 : 1.5,
              borderColor: NARANJA,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Llama tamano={15} encendida={racha.hoyCuenta} />
          <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 14, color: racha.hoyCuenta ? '#FFC58A' : '#FFFFFF' }}>
            {racha.dias}
          </Text>
          {!racha.hoyCuenta && (
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11, color: '#FFD9B8' }}>hoy falta</Text>
          )}
        </Pressable>
      )}
      <View style={{ flex: 1 }} />
      {onDecorar && (
        <Pressable
          onPress={onDecorar}
          accessibilityRole="button"
          accessibilityLabel="Decorar"
          accessibilityHint="Cambia la barda, el piso, los adornos y las macetas"
          hitSlop={6}
          style={({ pressed }) => [pastilla, { paddingHorizontal: 8, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <Ionicons name="color-palette" size={14} color="#FFFFFF" />
        </Pressable>
      )}
      <View style={pastilla}>
        <Ionicons name={icono} size={13} color="#FFFFFF" />
        {temperatura !== null && Number.isFinite(temperatura) && (
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: '#FFFFFF' }}>
            {Math.round(temperatura)}°
          </Text>
        )}
      </View>
      <View
        accessibilityLabel={pendientes > 0 ? `${pendientes} plantas te necesitan hoy` : 'Ninguna planta necesita nada hoy'}
        style={[pastilla, pendientes > 0 ? { backgroundColor: 'rgba(224,59,44,0.85)' } : null]}
      >
        <Ionicons name={pendientes > 0 ? 'alert-circle' : 'leaf'} size={13} color="#FFFFFF" />
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: '#FFFFFF' }}>
          {pendientes > 0 ? `${pendientes} ${pendientes === 1 ? 'te necesita' : 'te necesitan'}` : 'Todo bien'}
        </Text>
      </View>
    </View>
  );
}

const pastilla = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 4,
  backgroundColor: 'rgba(0,0,0,0.42)',
  borderRadius: radio.completo,
  paddingHorizontal: 9,
  paddingVertical: 5,
};

// ---------------------------------------------------------------------------
// La caja de diálogo
// ---------------------------------------------------------------------------

/**
 * Abajo de la escena, como en un juego de rol.
 *
 * Sin nada tocado habla la sina: qué urge y si hoy ya cuenta la racha. Con una
 * planta tocada, la caja se vuelve sus botones. El alto no cambia entre los dos
 * modos casi no cambia, para que la pantalla no brinque al tocar.
 */
function Dialogo({
  seleccionada,
  aviso,
  avisos,
  pendientes,
  racha,
  momento,
  animo,
  ocupado,
  onCerrar,
  onCuidar,
  onIrA,
  onMover,
  onMaceta,
  tema,
}: {
  seleccionada: EstadoDePlanta | undefined;
  aviso?: AvisoMover;
  avisos: AvisoMover[];
  pendientes: EstadoDePlanta[];
  racha: Racha | null;
  momento: Momento;
  animo: Animo;
  ocupado: boolean;
  onCerrar: () => void;
  onCuidar: (estado: EstadoDePlanta, tipo: 'riego' | 'cambio_agua' | 'observacion') => void;
  onIrA: (estado: EstadoDePlanta) => void;
  onMover: (estado: EstadoDePlanta) => void;
  onMaceta: (estado: EstadoDePlanta) => void;
  tema: ReturnType<typeof useTema>;
}) {
  const caja = {
    minHeight: 184,
    backgroundColor: tema.superficie,
    borderBottomLeftRadius: radio.lg + 4,
    borderBottomRightRadius: radio.lg + 4,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: tema.borde,
    padding: espacio.lg,
  };

  if (!seleccionada) {
    const linea = lineaDeSina(pendientes, racha, momento, avisos);
    return (
      <View style={caja}>
        <Animated.View key="sina" entering={FadeIn.duration(180)} style={{ flexDirection: 'row', gap: espacio.md }}>
          <CaraSina animo={animo} tamano={44} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 11, letterSpacing: 0.8, color: tema.primario }}>
              LA SINA
            </Text>
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, lineHeight: 21, color: tema.texto }}>
              {linea.texto}
            </Text>
            {linea.foco && (
              <Pressable
                onPress={() => onIrA(linea.foco!)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  maxWidth: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                  backgroundColor: tema.primarioSuave,
                  borderRadius: radio.completo,
                  paddingHorizontal: 14,
                  minHeight: 36,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Ionicons name="navigate" size={14} color={tema.primario} />
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 13.5, color: tema.primario }}>
                  Ir con {linea.foco.planta.apodo}
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    );
  }

  const { planta, especie, recomendacion, estadoHoy, voz } = seleccionada;
  const accion = etiquetaAccion(recomendacion.accion, recomendacion.urgencia);
  const nombres = nombresDe(especie);
  const queEs = [nombres.principal !== planta.apodo ? nombres.principal : null, nombres.ingles[0]].filter(Boolean).join(' · ');
  const dato = datoDelDia(especie.id, new Date(), planta.id);
  const enAgua = planta.contenedor.tipo === 'agua';
  const color = colorDeNivel(tema, estadoHoy.nivel);

  // El botón grande es lo que le toca HOY. Si no le toca agua, el grande es
  // "La revisé": también enciende la racha y no encharca a nadie.
  const principal: { tipo: 'riego' | 'cambio_agua' | 'observacion'; texto: string; icono: keyof typeof Ionicons.glyphMap; fondo: string } =
    recomendacion.accion === 'regar' && !enAgua
      ? { tipo: 'riego', texto: `Regar · ${recomendacion.mlSugeridos} ml`, icono: 'water', fondo: AGUA }
      : recomendacion.accion === 'cambiar_agua' || enAgua
        ? { tipo: 'cambio_agua', texto: 'Cambiar el agua', icono: 'sync', fondo: AGUA }
        : { tipo: 'observacion', texto: 'La revisé', icono: 'eye', fondo: tema.primario };
  const conRevisar = principal.tipo !== 'observacion';

  const nota = aviso
    ? aviso.texto
    : recomendacion.accion === 'suspender_riego'
      ? 'Está encharcada: hoy no se riega. Revisarla también cuenta.'
      : principal.tipo === 'observacion'
        ? 'Hoy no le toca agua. Revisarla también cuenta para tu racha.'
        : racha && !racha.hoyCuenta
          ? 'Cualquiera de los dos enciende tu racha de hoy.'
          : null;

  const moverConAviso = !!aviso && aviso.motivo !== 'luz';

  return (
    <View style={caja}>
      <Animated.View key={planta.id} entering={FadeIn.duration(180)} style={{ gap: espacio.md }}>
        <View style={{ gap: espacio.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: fuente.titulo, fontSize: 19, color: tema.texto }}>
                {planta.apodo}
              </Text>
              {queEs !== '' && (
                <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
                  {queEs}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onCerrar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={({ pressed }) => ({
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: tema.superficieAlta,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="close" size={17} color={tema.textoSuave} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm }}>
            <View
              style={{
                backgroundColor: accion.pideAtencion ? color : tema.superficieAlta,
                borderRadius: radio.completo,
                paddingHorizontal: 9,
                paddingVertical: 2,
                marginTop: 1,
              }}
            >
              <Text
                style={{
                  fontFamily: fuente.cuerpoFuerte,
                  fontSize: 11,
                  color: accion.pideAtencion ? (tema.esOscuro ? '#10100C' : '#fff') : tema.textoSuave,
                }}
              >
                {accion.texto}
              </Text>
            </View>
            <Text numberOfLines={2} style={{ flex: 1, fontFamily: fuente.tituloItalica, fontSize: 13.5, lineHeight: 19, color: tema.textoSuave }}>
              “{voz}”
            </Text>
          </View>
        </View>

        {/* Lo que le toca hoy, en grande. */}
        <BotonPrincipal
          texto={principal.texto}
          detalle={
            principal.tipo === 'observacion'
              ? racha && !racha.hoyCuenta
                ? 'Cuenta para tu racha de hoy'
                : 'Mírala de cerca y anótalo'
              : accion.pideAtencion
                ? 'Le toca hoy'
                : 'Si la ves con sed'
          }
          icono={principal.icono}
          fondo={principal.fondo}
          deshabilitado={ocupado}
          onPress={() => onCuidar(seleccionada, principal.tipo)}
        />

        {/* Lo demás: fichas con su icono, a la vista y del mismo tamaño. */}
        <View style={{ flexDirection: 'row', gap: espacio.sm }}>
          {conRevisar && (
            <FichaAccion
              icono="eye"
              titulo="La revisé"
              detalle="Suma racha"
              color={tema.primario}
              tema={tema}
              deshabilitado={ocupado}
              onPress={() => onCuidar(seleccionada, 'observacion')}
            />
          )}
          <FichaAccion
            icono="swap-horizontal"
            titulo="Mover"
            detalle={moverConAviso ? 'Conviene hoy' : 'A otra zona'}
            color={moverConAviso ? '#E8761A' : '#3F7CAC'}
            destacada={moverConAviso}
            tema={tema}
            onPress={() => onMover(seleccionada)}
          />
          {planta.contenedor.tipo === 'maceta' && (
            <FichaAccion
              icono="color-palette"
              titulo="Maceta"
              detalle="Cámbiala"
              color="#C2185B"
              tema={tema}
              onPress={() => onMaceta(seleccionada)}
            />
          )}
          <FichaAccion
            icono="leaf"
            titulo="Su ficha"
            detalle="Su futuro"
            color="#7A5FB0"
            tema={tema}
            onPress={() => router.push(`/planta/${planta.id}`)}
          />
        </View>

        {nota && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {aviso ? (
              <Ionicons name="warning" size={14} color="#E8761A" />
            ) : (
              <Llama tamano={12} encendida={racha?.hoyCuenta ?? false} />
            )}
            <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 12, color: aviso ? tema.texto : tema.textoSuave }}>
              {nota}
            </Text>
          </View>
        )}
        {dato && (
          <Pressable
            onPress={() => router.push(`/especie/${especie.id}`)}
            accessibilityRole="button"
            accessibilityHint="Abre la ficha de su especie"
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: 8,
              backgroundColor: tema.superficieAlta,
              borderRadius: radio.md,
              padding: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="sparkles" size={14} color="#E8940C" style={{ marginTop: 2 }} />
            <Text numberOfLines={3} style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 12.5, lineHeight: 17, color: tema.texto }}>
              <Text style={{ fontFamily: fuente.cuerpoNegro }}>¿Sabías que…? </Text>
              {dato}
            </Text>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 }}>
          <Ionicons name="hand-left-outline" size={13} color={tema.textoSuave} />
          <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>
            Arrástrala para acomodarla donde tú quieras.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** La acción de hoy: ancha, con su icono en burbuja y para qué sirve. */
function BotonPrincipal({
  texto,
  detalle,
  icono,
  fondo,
  deshabilitado,
  onPress,
}: {
  texto: string;
  detalle: string;
  icono: keyof typeof Ionicons.glyphMap;
  fondo: string;
  deshabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityHint={detalle}
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => ({
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        backgroundColor: fondo,
        borderRadius: 18,
        opacity: deshabilitado ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.975 : 1 }],
        shadowColor: fondo,
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icono} size={20} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoNegro, fontSize: 16, color: '#FFFFFF' }}>
          {texto}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          {detalle}
        </Text>
      </View>
      <Ionicons name="arrow-forward-circle" size={24} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );
}

/** Una acción secundaria: su color, su icono en burbuja, y abajo qué hace. */
function FichaAccion({
  icono,
  titulo,
  detalle,
  color,
  destacada,
  deshabilitado,
  tema,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
  color: string;
  destacada?: boolean;
  deshabilitado?: boolean;
  tema: ReturnType<typeof useTema>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={detalle}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 84,
        paddingVertical: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        borderRadius: 16,
        backgroundColor: destacada ? `${color}26` : tema.superficieAlta,
        borderWidth: 1.5,
        borderColor: destacada ? color : `${color}40`,
        opacity: deshabilitado ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icono} size={18} color="#FFFFFF" />
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoNegro, fontSize: 13, color: tema.texto }}>
        {titulo}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 10.5, color: destacada ? color : tema.textoSuave }}>
        {detalle}
      </Text>
      {destacada && (
        <View style={{ position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      )}
    </Pressable>
  );
}

function Boton({
  texto,
  icono,
  fondo,
  tinta,
  deshabilitado,
  onPress,
}: {
  texto: string;
  icono: keyof typeof Ionicons.glyphMap;
  fondo: string;
  tinta: string;
  deshabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 8,
        backgroundColor: fondo,
        borderRadius: radio.md,
        opacity: deshabilitado ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Ionicons name={icono} size={16} color={tinta} />
      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 14, color: tinta }}>
        {texto}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Mudanza
// ---------------------------------------------------------------------------

/** Dónde van las tres zonas cuando se levanta una planta: arriba de la escena. */
function cajasDeZonas(ancho: number) {
  const margen = 14;
  const hueco = 8;
  const w = (ancho - margen * 2 - hueco * 2) / 3;
  return ZONAS.map((z, i) => ({ zona: z.zona, titulo: z.titulo, x: margen + i * (w + hueco), y: 52, ancho: w, alto: 70 }));
}

/**
 * Las tres zonas a donde se puede soltar la planta que va en el dedo.
 *
 * Cada una dice ANTES de soltar cómo le iría ahí (su lugar ideal, la aguanta,
 * le va mal): se decide viendo, no soltando y leyendo un error.
 */
function DestinosDeArrastre({
  ancho,
  actual,
  encima,
  especie,
  apodo,
}: {
  ancho: number;
  actual: Zona;
  encima: Zona | null;
  especie: EstadoDePlanta['especie'];
  apodo: string;
}) {
  const cajas = cajasDeZonas(ancho);
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(160)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,14,20,0.38)' }}
    >
      <Text
        style={{
          position: 'absolute',
          top: 16,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: fuente.cuerpoFuerte,
          fontSize: 13.5,
          color: '#FFFFFF',
        }}
      >
        ¿A dónde llevas a {apodo}?
      </Text>
      <View
        style={{
          position: 'absolute',
          bottom: 16,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 7,
        }}
      >
        <Ionicons name="move" size={14} color="#FFFFFF" />
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: '#FFFFFF' }}>O suéltala aquí abajo para acomodarla</Text>
      </View>
      {cajas.map((c, i) => {
        const esActual = c.zona === actual;
        const lugar = mejorLugarEn(c.zona, especie);
        const v = veredictoMudanza(especie, lugar);
        const activa = encima === c.zona && !esActual;
        const marca = esActual ? 'Aquí vive' : v.nivel === 'ideal' ? 'Su lugar ideal' : v.nivel === 'aguanta' ? 'La aguanta' : 'Le va mal';
        const colorMarca = esActual ? '#FFFFFF' : v.nivel === 'mal' ? '#FFB4A8' : v.nivel === 'ideal' ? '#9CF0C4' : '#FFE9A8';
        return (
          <Animated.View
            key={c.zona}
            entering={ZoomIn.delay(i * 40).duration(220)}
            style={{ position: 'absolute', left: c.x, top: c.y, width: c.ancho, height: c.alto }}
          >
          <View
            style={{
              width: c.ancho,
              height: c.alto,
              borderRadius: 18,
              backgroundColor: activa ? COLOR_ZONA[c.zona] : 'rgba(255,255,255,0.16)',
              borderWidth: activa ? 0 : 1.5,
              borderColor: esActual ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
              borderStyle: esActual ? 'dashed' : 'solid',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              opacity: esActual ? 0.55 : 1,
              transform: [{ scale: activa ? 1.08 : 1 }],
            }}
          >
            <Ionicons name={ICONO_ZONA[c.zona]} size={20} color="#FFFFFF" />
            <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 13, color: '#FFFFFF' }}>{c.titulo}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 10, color: activa ? '#FFFFFF' : colorMarca }}>
              {marca}
            </Text>
          </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

/** La planta en el dedo: su gemelo, un poco más grande y con sombra, como levantada. */
function Fantasma({
  estado,
  x,
  y,
  escala,
  estiloMaceta,
}: {
  estado: EstadoDePlanta;
  x: SharedValue<number>;
  y: SharedValue<number>;
  escala: SharedValue<number>;
  estiloMaceta?: EstiloMaceta;
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
  const LADO = 104;
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() - LADO / 2 }, { translateY: y.get() - LADO * 1.05 }, { scale: escala.get() }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: LADO, alignItems: 'center' }, estilo]}>
      <View style={{ position: 'absolute', bottom: -6, width: LADO * 0.5, height: 12, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.3)' }} />
      <Gemelo
        especieId={especie.id}
        morfologia={morfologia}
        apariencia={planta.apariencia}
        recipiente={planta.contenedor.tipo}
        diasSinCambioAgua={snapshot.hidrico.diasDesdeCambioAgua}
        colorMaceta={colorDeMaceta(planta.contenedor.material)}
        estiloMaceta={estiloMaceta}
        semilla={planta.id}
        ancho={LADO}
        alto={Math.round(LADO * 1.15)}
        giro={-0.5}
        inclinacion={0.3}
        detalle="bajo"
        sombra={false}
      />
    </Animated.View>
  );
}

/**
 * Los cinco rincones, agrupados por zona, cada uno con cómo le iría ahí.
 *
 * Si el elegido le va mal, antes de moverla se dice por qué y se pregunta: a
 * veces hay razón (una semana de calor), y a veces fue un dedo distraído.
 */
function PanelDeMudanza({
  estado,
  confirmar,
  ocupado,
  mudandoA,
  tema,
  onElegir,
  onConfirmar,
  onVolver,
  onCerrar,
}: {
  estado: EstadoDePlanta;
  confirmar: PanelMudanza['confirmar'];
  ocupado: boolean;
  mudandoA: Lugar | null;
  tema: ReturnType<typeof useTema>;
  onElegir: (lugar: Lugar) => void;
  onConfirmar: (lugar: Lugar) => void;
  onVolver: () => void;
  onCerrar: () => void;
}) {
  const { planta, especie } = estado;
  const actual = lugarDe(planta.ubicacion);
  const caja = {
    backgroundColor: tema.superficie,
    borderBottomLeftRadius: radio.lg + 4,
    borderBottomRightRadius: radio.lg + 4,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: tema.borde,
    padding: espacio.lg,
    gap: espacio.sm,
  };

  if (confirmar) {
    const info = infoLugar(confirmar.lugar);
    return (
      <Animated.View key="confirmar" entering={FadeIn.duration(180)} style={caja}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
          <Ionicons name="warning" size={18} color="#E8761A" />
          <Text style={{ flex: 1, fontFamily: fuente.titulo, fontSize: 17, color: tema.texto }}>
            ¿Seguro? {info.titulo}
          </Text>
        </View>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, lineHeight: 20, color: tema.texto }}>
          {confirmar.veredicto.texto}
        </Text>
        <View style={{ flexDirection: 'row', gap: espacio.sm, marginTop: 4 }}>
          <Boton texto="Mejor no" icono="arrow-undo" fondo={tema.superficieAlta} tinta={tema.texto} deshabilitado={ocupado} onPress={onVolver} />
          <Boton
            texto={mudandoA ? 'Mudándola…' : 'Moverla igual'}
            icono="move"
            fondo="#E8761A"
            tinta="#FFFFFF"
            deshabilitado={ocupado}
            onPress={() => onConfirmar(confirmar.lugar)}
          />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View key="lugares" entering={FadeIn.duration(180)} style={caja}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fuente.titulo, fontSize: 17, color: tema.texto }}>
          ¿A dónde llevas a {planta.apodo}?
        </Text>
        <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Ionicons name="close" size={22} color={tema.textoSuave} />
        </Pressable>
      </View>
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave, marginTop: -4 }}>
        También puedes mantenerla presionada en la escena y arrastrarla.
      </Text>
      {LUGARES.map((l) => {
        const esActual = l.lugar === actual;
        const v = veredictoMudanza(especie, l.lugar);
        const color = v.nivel === 'ideal' ? tema.optimo : v.nivel === 'aguanta' ? tema.seco : tema.critico;
        return (
          <Pressable
            key={l.lugar}
            disabled={esActual || ocupado}
            onPress={() => onElegir(l.lugar)}
            accessibilityRole="button"
            accessibilityState={{ disabled: esActual, selected: esActual }}
            accessibilityLabel={`${l.titulo}. ${esActual ? 'Aquí vive ahora.' : v.texto}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: espacio.md,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: radio.md,
              backgroundColor: esActual ? tema.primarioSuave : pressed ? tema.superficieAlta : 'transparent',
            })}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                backgroundColor: COLOR_ZONA[l.zona],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={ICONO_ZONA[l.zona]} size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14, color: tema.texto }}>{l.titulo}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 11.5, color: tema.textoSuave }}>
                {l.detalle}
              </Text>
            </View>
            {mudandoA === l.lugar ? (
              <ActivityIndicator size="small" color={tema.primario} />
            ) : esActual ? (
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11.5, color: tema.primario }}>Aquí vive</Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11.5, color: tema.textoSuave }}>
                  {v.nivel === 'ideal' ? 'Ideal' : v.nivel === 'aguanta' ? 'La aguanta' : 'Le va mal'}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

/** De visita: quién es cada planta y cómo anda. Sin botones de cuidado. */
function DialogoVisita({
  dueno,
  seleccionada,
  animo,
  tema,
  onCerrar,
}: {
  dueno: string;
  seleccionada: EstadoDePlanta | undefined;
  animo: Animo;
  tema: ReturnType<typeof useTema>;
  onCerrar: () => void;
}) {
  const caja = {
    minHeight: 150,
    backgroundColor: tema.superficie,
    borderBottomLeftRadius: radio.lg + 4,
    borderBottomRightRadius: radio.lg + 4,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: tema.borde,
    padding: espacio.lg,
  };
  if (!seleccionada) {
    return (
      <View style={caja}>
        <Animated.View key="sina" entering={FadeIn.duration(180)} style={{ flexDirection: 'row', gap: espacio.md }}>
          <CaraSina animo={animo} tamano={44} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 11, letterSpacing: 0.8, color: tema.primario }}>DE VISITA</Text>
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, lineHeight: 21, color: tema.texto }}>
              Estás en el jardín de {dueno}. Toca una planta para conocerla.
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }
  const { planta, especie, estadoHoy } = seleccionada;
  const color = colorDeNivel(tema, estadoHoy.nivel);
  const estado = {
    encharcado: 'Con agua de más',
    humedo: 'Recién regada',
    optimo: 'En su punto',
    seco: 'Con sed',
    critico: 'Con mucha sed',
  }[estadoHoy.nivel];
  return (
    <View style={caja}>
      <Animated.View key={planta.id} entering={FadeIn.duration(180)} style={{ gap: espacio.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fuente.titulo, fontSize: 18, color: tema.texto }}>
            {planta.apodo}
          </Text>
          <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Ionicons name="close" size={22} color={tema.textoSuave} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, color: tema.texto }}>
          {especie.nombresComunes[0].charAt(0).toUpperCase() + especie.nombresComunes[0].slice(1)}
          <Text style={{ fontFamily: fuente.tituloItalica, color: tema.textoSuave }}>  {especie.nombreCientifico}</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ backgroundColor: color, borderRadius: radio.completo, paddingHorizontal: 9, paddingVertical: 2 }}>
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11.5, color: tema.esOscuro ? '#10100C' : '#fff' }}>{estado}</Text>
          </View>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>el día que {dueno} compartió su jardín</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** Lo que dice la sina cuando no hay nada tocado. */
function lineaDeSina(
  pendientes: EstadoDePlanta[],
  racha: Racha | null,
  momento: Momento,
  avisos: AvisoMover[] = [],
): { texto: string; foco?: EstadoDePlanta } {
  // Un aviso de clima para hoy o mañana va antes que todo: moverla a tiempo
  // no se puede dejar para después.
  const urgente = avisos.find((a) => a.enDias <= 1 && a.motivo !== 'luz');
  const primera = pendientes[0];
  if (urgente) {
    const foco = pendientes.find((e) => e.planta.id === urgente.plantaId);
    const extra = primera && primera.planta.id !== urgente.plantaId ? ` Y ${primera.planta.apodo} pide algo también.` : '';
    return { texto: urgente.texto + extra, foco };
  }
  if (primera) {
    const quien = primera.planta.apodo;
    const accion = primera.recomendacion.accion;
    let texto =
      accion === 'suspender_riego'
        ? `${quien} está encharcada. No la riegues hoy: tócala y dale "La revisé".`
        : accion === 'cambiar_agua'
          ? `A ${quien} le toca agua nueva. Tócala y cámbiasela.`
          : `${quien} tiene sed. Tócala y riégala.`;
    const mas = pendientes.length - 1;
    if (mas > 0) texto += mas === 1 ? ' Y otra más pide algo.' : ` Y ${mas} más piden algo.`;
    return { texto, foco: primera };
  }
  if (racha && !racha.hoyCuenta) {
    return {
      texto: 'Hoy nadie tiene sed, pero tu racha todavía no cuenta. Toca cualquier planta y dale "La revisé".',
    };
  }
  if (!racha) return { texto: 'Todo en orden por aquí.' };
  const dias = `${racha.dias} ${racha.dias === 1 ? 'día' : 'días'}`;
  if (momento === 'noche') return { texto: `Todo en orden y hoy ya cuenta: ${dias} de racha. Zzz… nos vemos mañana.` };
  return { texto: `Todo en orden y hoy ya cuenta. Llevas ${dias}: vuelve mañana y suman ${racha.dias + 1}.` };
}

// ---------------------------------------------------------------------------

/** Un número seguro para el SVG: un NaN en un atributo tumba la pantalla en el teléfono. */
function numero(n: number, respaldo: number): number {
  return Number.isFinite(n) ? n : respaldo;
}

/** Pseudoazar estable entre 0 y 1: la escenografía no cambia entre visitas. */
function fraccion(n: number): number {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}
