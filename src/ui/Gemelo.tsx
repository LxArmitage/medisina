/**
 * El gemelo de la planta, en 3D.
 *
 * Reemplaza a los dos que había: el 3D con WebGL (que en el iPhone nunca
 * terminó de cargar) y el dibujo plano (que se veía igual para todas). Aquí la
 * planta se arma con la forma de SU especie, el color que se midió en SU foto y
 * el estado de hoy (`tresd/malla.ts`); se proyecta en perspectiva con luz
 * (`tresd/proyeccion.ts`) y se dibuja con SVG, que en el teléfono siempre
 * funciona.
 *
 * Con `interactivo` se gira arrastrando el dedo y, si nadie la toca, da vueltas
 * despacio sola. Tocar una hoja, el tallo, la maceta o una flor avisa cuál se
 * tocó (`onParte`), y la ficha explica qué le pasa a esa parte.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { aparienciaDe, formaDe } from '../dominio/forma';
import type { Morfologia } from '../dominio/morfologia';
import type { ParteGemelo } from '../dominio/partes';
import type { AparienciaObservada } from '../dominio/tipos';
import { armarMalla, crecerMalla } from './tresd/malla';
import type { Malla, Recipiente } from './tresd/malla';
import type { EstiloMaceta } from '../dominio/decoracion';
import { caraEn, encuadrar, pieDe, proyectar, puntoEnPantalla } from './tresd/proyeccion';

export interface GemeloProps {
  especieId: string;
  morfologia: Morfologia;
  /** Lo que se midió en la foto del escaneo. */
  apariencia?: AparienciaObservada;
  recipiente?: Recipiente;
  diasSinCambioAgua?: number | null;
  /** Color de la maceta. */
  colorMaceta?: string;
  /** La maceta que eligió la persona; manda sobre el color. */
  estiloMaceta?: EstiloMaceta;
  /** Hace única a la planta: su id. */
  semilla?: string;
  ancho: number;
  alto: number;
  /** Girarla con el dedo y que dé vueltas sola. */
  interactivo?: boolean;
  /** Ángulo fijo, en radianes, cuando no es interactivo. */
  giro?: number;
  /** Qué tanto se ve desde arriba. */
  inclinacion?: number;
  /** `bajo` para el patio, `alto` para la ficha. */
  detalle?: 'bajo' | 'alto';
  onParte?: (parte: ParteGemelo) => void;
  parteActiva?: ParteGemelo | null;
  /** Sombra en el piso. */
  sombra?: boolean;
  /**
   * La base de la maceta en el borde de abajo del lienzo. El encuadre centra
   * la planta y deja aire debajo; en una escena eso la hace flotar sobre su
   * propia sombra, y más entre más grande se dibuja.
   */
  apoyado?: boolean;
  /**
   * Dónde queda la punta de la planta, en puntos desde arriba del lienzo, ya
   * asentada: para que lo que va encima (un globo) quede justo sobre sus hojas.
   */
  onCima?: (puntos: number) => void;
  /**
   * Cuántas veces su tamaño de ahora se dibuja la planta; la maceta no cambia.
   * Al cambiar, la planta crece (o se achica) animada, desde la tierra.
   */
  crecimiento?: number;
  /**
   * La planta más grande que se va a mostrar, para encuadrar a todas con la
   * misma cámara. Sin marco, cada dibujo se ajusta al cuadro y una planta de
   * dentro de un año se vería del tamaño de la de hoy.
   */
  marco?: { morfologia: Morfologia; crecimiento: number } | null;
}

/** Lo que tarda en crecer de un paso al otro. */
const MS_CRECER = 700;

/** Radianes de giro por punto de arrastre. */
const GIRO_POR_PUNTO = 1 / 95;
/** Vuelta sola: radianes por segundo. Despacio: es un aparador, no un trompo. */
const GIRO_SOLO = 0.32;
/** Después de soltarla, cuánto espera antes de volver a girar sola. */
const PAUSA_TRAS_TOCAR = 2500;
/** Cada cuánto se redibuja mientras gira sola: ~24 cuadros por segundo. */
const MS_POR_CUADRO = 42;
/**
 * Cuánto gira sola antes de quedarse quieta. Una vuelta completa y un poco
 * más: suficiente para verla por todos lados sin gastar batería mientras la
 * persona lee la ficha. Tocarla la vuelve a animar.
 */
const GIRO_SOLO_MS = 24000;

function GemeloBase({
  especieId,
  morfologia,
  apariencia,
  recipiente = 'maceta',
  diasSinCambioAgua = null,
  colorMaceta,
  estiloMaceta,
  semilla,
  ancho,
  alto,
  interactivo = false,
  giro: giroFijo = -0.55,
  inclinacion = 0.28,
  detalle = 'alto',
  onParte,
  parteActiva = null,
  sombra = true,
  apoyado = false,
  onCima,
  crecimiento = 1,
  marco = null,
}: GemeloProps) {
  const reducido = useReducedMotion();

  const armar = useMemo(() => {
    const forma = formaDe(especieId);
    return (m: Morfologia): Malla =>
      armarMalla({
        forma,
        morfologia: m,
        apariencia: aparienciaDe(forma, m, apariencia),
        recipiente,
        diasSinCambioAgua,
        detalle,
        semilla: semilla ?? especieId,
        colorMaceta,
        estiloMaceta,
      });
  }, [especieId, apariencia, recipiente, diasSinCambioAgua, detalle, semilla, colorMaceta, estiloMaceta]);
  const mallaBase = useMemo(() => armar(morfologia), [armar, morfologia]);

  // El tamaño que se ve va detrás del que se pide: así, al cambiar de paso,
  // la planta crece frente a los ojos en vez de aparecer ya grande.
  const [crecimientoVisto, setCrecimientoVisto] = useState(crecimiento);
  const vistoRef = useRef(crecimiento);
  useEffect(() => {
    const desde = vistoRef.current;
    const hasta = Number.isFinite(crecimiento) && crecimiento > 0 ? crecimiento : 1;
    if (reducido || Math.abs(hasta - desde) < 1e-3) {
      vistoRef.current = hasta;
      setCrecimientoVisto(hasta);
      return;
    }
    let vivo = true;
    const inicio = Date.now();
    const cuadro = () => {
      if (!vivo) return;
      const t = Math.min(1, (Date.now() - inicio) / MS_CRECER);
      const suave = 1 - (1 - t) ** 3;
      vistoRef.current = desde + (hasta - desde) * suave;
      setCrecimientoVisto(vistoRef.current);
      if (t < 1) requestAnimationFrame(cuadro);
    };
    const id = requestAnimationFrame(cuadro);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [crecimiento, reducido]);

  const malla = useMemo(() => crecerMalla(mallaBase, crecimientoVisto), [mallaBase, crecimientoVisto]);
  // Con marco, la cámara abarca la más grande y la de ahora ya crecida: queda
  // quieta mientras la planta crece, que es lo que deja ver cuánto creció.
  const mallaMarco = useMemo(() => (marco ? crecerMalla(armar(marco.morfologia), marco.crecimiento) : null), [armar, marco]);
  const mallaMeta = useMemo(() => crecerMalla(mallaBase, crecimiento), [mallaBase, crecimiento]);
  const encuadre = useMemo(
    () => (mallaMarco ? encuadrar({ caras: [...mallaMarco.caras, ...mallaMeta.caras] }) : encuadrar(malla)),
    [mallaMarco, mallaMeta, malla],
  );

  const [giro, setGiro] = useState(giroFijo);
  const giroActual = useRef(giroFijo);
  const arrastrando = useRef(false);
  const inicioArrastre = useRef(0);
  const ultimoToque = useRef(0);
  const cuadroPendiente = useRef<number | null>(null);

  useEffect(() => {
    if (!interactivo) {
      giroActual.current = giroFijo;
      setGiro(giroFijo);
    }
  }, [giroFijo, interactivo]);

  // Dar vueltas sola mientras nadie la toca.
  useEffect(() => {
    if (!interactivo || reducido) return;
    let vivo = true;
    let antes = Date.now();
    // Al abrir, gira de inmediato (sin la pausa de después de tocar).
    const inicio = Date.now() - PAUSA_TRAS_TOCAR - 1;
    let acumulado = 0;
    const cuadro = () => {
      if (!vivo) return;
      const ahora = Date.now();
      const dt = Math.min(100, ahora - antes);
      antes = ahora;
      const desdeToque = ahora - (ultimoToque.current || inicio);
      if (!arrastrando.current && desdeToque > PAUSA_TRAS_TOCAR && desdeToque < GIRO_SOLO_MS + PAUSA_TRAS_TOCAR) {
        giroActual.current += (dt / 1000) * GIRO_SOLO;
        acumulado += dt;
        if (acumulado >= MS_POR_CUADRO) {
          acumulado = 0;
          setGiro(giroActual.current);
        }
      }
      requestAnimationFrame(cuadro);
    };
    const id = requestAnimationFrame(cuadro);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [interactivo, reducido]);

  const vista = useMemo(() => ({ giro, inclinacion, ancho, alto }), [giro, inclinacion, ancho, alto]);
  const dibujo = useMemo(
    () => proyectar(malla, vista, encuadre, { parteActiva }),
    [malla, vista, encuadre, parteActiva],
  );
  const pie = useMemo(() => puntoEnPantalla(pieDe(malla), vista, encuadre), [malla, vista, encuadre]);

  // Lo que baja el dibujo para que la maceta se pare en el borde: nunca sube,
  // para no cortar la punta de las hojas.
  const bajada = apoyado ? Math.max(0, Math.round(numero(alto * 0.97 - pie[1], 0))) : 0;
  const cima = useMemo(() => {
    let min = Infinity;
    for (const c of dibujo.caras) for (const p of c.puntos) min = Math.min(min, p[1]);
    return Number.isFinite(min) ? Math.round(min) : 0;
  }, [dibujo]);
  useEffect(() => {
    onCima?.(Math.max(0, cima + bajada));
  }, [cima, bajada, onCima]);

  const redibujar = () => {
    if (cuadroPendiente.current !== null) return;
    cuadroPendiente.current = requestAnimationFrame(() => {
      cuadroPendiente.current = null;
      setGiro(giroActual.current);
    });
  };

  const tocar = (x: number, y: number) => {
    if (!onParte) return;
    const cara = caraEn(dibujo, x, y - bajada);
    if (cara) onParte({ tipo: cara.parte, indice: cara.indice });
  };

  const gesto = useMemo(() => {
    const toque = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, exito) => {
        if (exito) tocar(e.x, e.y);
      });
    if (!interactivo) return toque;
    const arrastre = Gesture.Pan()
      .runOnJS(true)
      .minDistance(6)
      .onBegin(() => {
        arrastrando.current = true;
        inicioArrastre.current = giroActual.current;
      })
      .onUpdate((e) => {
        giroActual.current = inicioArrastre.current + e.translationX * GIRO_POR_PUNTO;
        redibujar();
      })
      .onFinalize(() => {
        arrastrando.current = false;
        ultimoToque.current = Date.now();
      });
    return Gesture.Exclusive(arrastre, toque);
    // `tocar` lee el dibujo actual; se rearma el gesto cuando cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactivo, dibujo, onParte]);

  const lienzo = (
    <View style={{ width: ancho, height: alto }}>
      {/* Bajada la planta, lo que cuelga de la maceta se dibuja por debajo del
          lienzo: el lienzo crece hacia abajo sin mover el acomodo. */}
      <Svg width={ancho} height={alto + bajada} style={{ position: 'absolute', top: 0, left: 0 }}>
        {sombra && (
          <>
            <Defs>
              <RadialGradient id="sombraGemelo" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#000" stopOpacity={0.28} />
                <Stop offset="1" stopColor="#000" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse
              cx={numero(pie[0], ancho / 2)}
              cy={numero(pie[1] + bajada, alto * 0.94)}
              rx={Math.min(ancho * 0.3, alto * 0.24)}
              ry={Math.max(4, alto * 0.035)}
              fill="url(#sombraGemelo)"
            />
          </>
        )}
        <G transform={`translate(0 ${bajada})`}>
          {dibujo.poligonos.map((p, i) => (
            <Path key={i} d={p.d} fill={p.fill} fillOpacity={p.opacidad} />
          ))}
        </G>
      </Svg>
    </View>
  );

  if (!interactivo && !onParte) return lienzo;
  return <GestureDetector gesture={gesto}>{lienzo}</GestureDetector>;
}

/** Un NaN en un atributo de SVG tumba la pantalla en el teléfono. */
function numero(n: number, respaldo: number): number {
  return Number.isFinite(n) ? n : respaldo;
}

/**
 * Memorizado: en el patio hay varias plantas a la vez y la pantalla se
 * redibuja seguido (la sina camina, los globos flotan). Rehacer cientos de
 * polígonos por planta en cada uno de esos cambios sería tirar el teléfono.
 */
export const Gemelo = memo(GemeloBase);
