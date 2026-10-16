/**
 * El momento en que la racha sube.
 *
 * Vive en la raíz de la app y escucha los cuidados (`servicios/cuidado`). Da
 * igual dónde riegues —la agenda, la ficha, el patio—: si ese riego encendió
 * el día, aquí aparece la llama y el número pasa de 16 a 17 delante de ti.
 *
 * POR QUÉ SE ANIMA: es el tramo "raro" del presupuesto de animación — ocurre una
 * vez al día como mucho — y su propósito es exactamente premiar. Un número que
 * cambia sin transición se lee como una actualización; uno que se da vuelta
 * mientras vibra el teléfono se lee como un logro.
 *
 * Y cuando el día YA contaba, no hay fiesta: sólo un aviso chico de "anotado".
 * Celebrar el tercer riego del día igual que el primero le quitaría el valor
 * al primero.
 *
 * Con "reducir movimiento" no hay escala ni desplazamientos: el número cambia
 * con un fundido, que sigue contando qué pasó sin mover nada.
 */

import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DiaDeRacha } from '../dominio/racha';
import { escucharCuidados } from '../servicios/cuidado';
import type { AvisoDeCuidado } from '../servicios/cuidado';
import { Llama } from './Llama';
import { AVISO, AVISO_SALE, DESAPARECE, EASE_IN_OUT, EASE_OUT, Llegada, VELO_SALE } from './movimiento';
import { espacio, fuente, radio, useTema } from './tema';

/** Cuánto se queda la celebración antes de irse sola. */
const DURACION_FIESTA = 2800;
/** Cuánto se queda el aviso chico. */
const DURACION_AVISO = 1700;
/** Pausa antes de dar vuelta al número: primero se ve el viejo. */
const ANTES_DEL_GIRO = 380;
/** Alto de la ventana por la que pasa el número. */
const ALTO_NUMERO = 76;

const VERBO: Partial<Record<AvisoDeCuidado['tipo'], string>> = {
  riego: 'Regaste a',
  cambio_agua: 'Le cambiaste el agua a',
  observacion: 'Revisaste a',
  fertilizacion: 'Fertilizaste a',
  poda: 'Podaste a',
  brote: 'Anotaste un brote de',
  floracion: 'Anotaste la flor de',
  foto: 'Le tomaste foto a',
  diagnostico: 'Escaneaste a',
  trasplante: 'Trasplantaste a',
  tratamiento: 'Trataste a',
};

export function Celebracion() {
  const [actual, setActual] = useState<{ aviso: AvisoDeCuidado; id: number } | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cuenta = useRef(0);

  useEffect(() => {
    const dejar = escucharCuidados((nuevo) => {
      if (reloj.current) clearTimeout(reloj.current);
      cuenta.current += 1;
      setActual({ aviso: nuevo, id: cuenta.current });
      reloj.current = setTimeout(
        () => setActual(null),
        nuevo.subio ? DURACION_FIESTA : DURACION_AVISO,
      );
    });
    return () => {
      dejar();
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, []);

  if (!actual) return null;

  const cerrar = () => {
    if (reloj.current) clearTimeout(reloj.current);
    setActual(null);
  };

  // La key es el número de aviso: dos riegos seguidos montan dos fiestas
  // distintas, cada una con su animación desde el principio.
  return actual.aviso.subio ? (
    <Fiesta key={actual.id} aviso={actual.aviso} alCerrar={cerrar} />
  ) : (
    <AvisoChico key={actual.id} aviso={actual.aviso} />
  );
}

// ---------------------------------------------------------------------------

function Fiesta({ aviso, alCerrar }: { aviso: AvisoDeCuidado; alCerrar: () => void }) {
  const tema = useTema();
  const reducido = useReducedMotion();

  const entrada = useSharedValue(0);
  const giro = useSharedValue(0);

  useEffect(() => {
    entrada.set(
      reducido
        ? withTiming(1, { duration: 200 })
        : withSpring(1, { duration: 420, dampingRatio: 0.72 }),
    );
    giro.set(
      withDelay(
        ANTES_DEL_GIRO,
        withTiming(1, { duration: reducido ? 200 : 460, easing: reducido ? EASE_OUT : EASE_IN_OUT }),
      ),
    );
    // La vibración va en el MISMO instante en que el número se da vuelta, no
    // al abrir: es el número subiendo lo que se celebra.
    const id = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }, ANTES_DEL_GIRO);
    return () => clearTimeout(id);
  }, [entrada, giro, reducido]);

  const estiloFondo = useAnimatedStyle(() => ({ opacity: Math.min(1, entrada.get()) * 0.62 }));
  const estiloTarjeta = useAnimatedStyle(() => ({
    opacity: Math.min(1, entrada.get()),
    // Nunca desde cero: nada aparece de la nada.
    transform: reducido ? [] : [{ scale: 0.92 + entrada.get() * 0.08 }],
  }));
  const estiloViejo = useAnimatedStyle(() => ({
    opacity: 1 - giro.get(),
    transform: reducido ? [] : [{ translateY: -ALTO_NUMERO * giro.get() }],
  }));
  const estiloNuevo = useAnimatedStyle(() => ({
    opacity: giro.get(),
    transform: reducido ? [] : [{ translateY: ALTO_NUMERO * (1 - giro.get()) }],
  }));
  const estiloLlama = useAnimatedStyle(() => ({
    transform: reducido ? [] : [{ scale: 0.9 + giro.get() * 0.1 }],
  }));

  const { despues, racha, logroNuevo, apodo, tipo } = aviso;
  const titulo = despues === 1 ? '¡Empezó tu racha!' : `¡${despues} días seguidos!`;
  const verbo = VERBO[tipo] ?? 'Cuidaste a';

  // La entrada la llevan los valores de arriba; la salida, `exiting`: cuando
  // la fiesta se desmonta ya no hay render en el que mover nada. Se van el
  // velo y la tarjeta juntos, en un solo fundido, en vez de desaparecer de golpe.
  return (
    <Animated.View
      exiting={VELO_SALE}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
    >
    <Pressable
      onPress={alCerrar}
      accessibilityRole="button"
      accessibilityLabel={`${titulo} Toca para cerrar.`}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }, estiloFondo]}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl }}>
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 340,
              backgroundColor: tema.superficie,
              borderRadius: radio.lg + 8,
              paddingVertical: espacio.xl,
              paddingHorizontal: espacio.lg,
              alignItems: 'center',
              gap: espacio.md,
            },
            estiloTarjeta,
          ]}
        >
          <Animated.View style={estiloLlama}>
            <Llama tamano={72} />
          </Animated.View>

          {/* La ventana del número: el viejo sale por arriba, el nuevo entra
              por abajo. Recortada para que no se vean los dos a la vez. */}
          <View style={{ height: ALTO_NUMERO, overflow: 'hidden', alignSelf: 'stretch' }}>
            <Animated.Text style={[estiloNumero(tema.texto), estiloViejo]}>{aviso.antes}</Animated.Text>
            <Animated.Text style={[estiloNumero('#FF7A1A'), estiloNuevo]}>{despues}</Animated.Text>
          </View>

          <Text style={{ fontFamily: fuente.titulo, fontSize: 22, color: tema.texto, textAlign: 'center' }}>
            {titulo}
          </Text>
          <Text
            style={{
              fontFamily: fuente.cuerpo,
              fontSize: 14,
              lineHeight: 20,
              color: tema.textoSuave,
              textAlign: 'center',
            }}
          >
            {apodo ? `${verbo} ${apodo}. ` : ''}Vuelve mañana y llegas a {despues + 1}.
          </Text>

          <FilaSemana semana={racha.semana} encender={giro} reducido={reducido} />

          {logroNuevo && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: espacio.sm,
                backgroundColor: tema.primarioSuave,
                borderRadius: radio.completo,
                paddingHorizontal: espacio.md,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.primario }}>
                Logro: {logroNuevo.titulo}
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

function estiloNumero(color: string) {
  return {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: ALTO_NUMERO,
    lineHeight: ALTO_NUMERO,
    textAlign: 'center' as const,
    fontFamily: fuente.titulo,
    fontSize: 64,
    color,
  };
}

/**
 * La semana, con hoy encendiéndose al mismo tiempo que el número.
 *
 * Es la parte que enseña la regla sin palabras: siete casillas, y la de hoy se
 * llena porque hiciste algo hoy.
 */
function FilaSemana({
  semana,
  encender,
  reducido,
}: {
  semana: DiaDeRacha[];
  encender: SharedValue<number>;
  reducido: boolean;
}) {
  const tema = useTema();
  const estiloHoy = useAnimatedStyle(() => ({
    opacity: encender.get(),
    transform: reducido ? [] : [{ scale: 0.9 + encender.get() * 0.1 }],
  }));

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: espacio.xs }}>
      {semana.map((dia) => {
        const lleno = dia.estado === 'cuidado' && !dia.esHoy;
        return (
          <View key={dia.fecha} style={{ alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                borderWidth: 2,
                borderColor: lleno || dia.esHoy ? '#FF7A1A' : tema.borde,
                backgroundColor: lleno ? '#FF7A1A' : dia.estado === 'protegido' ? '#8FC9E8' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {dia.esHoy && (
                <Animated.View
                  style={[
                    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FF7A1A' },
                    estiloHoy,
                  ]}
                />
              )}
            </View>
            <Text
              style={{
                fontFamily: dia.esHoy ? fuente.cuerpoFuerte : fuente.cuerpo,
                fontSize: 11,
                color: dia.esHoy ? tema.texto : tema.textoSuave,
              }}
            >
              {dia.letra}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Cuando el día ya contaba: un "anotado" arriba, sin interrumpir nada.
 *
 * Baja un poco desde el borde de arriba al llegar y sube al irse: entra y sale
 * por el mismo lado, así se lee como una sola cosa que pasó de visita.
 */
function AvisoChico({ aviso }: { aviso: AvisoDeCuidado }) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const reducido = useReducedMotion();

  return (
    <Llegada
      entrada={AVISO}
      exiting={reducido ? DESAPARECE : AVISO_SALE}
      style={{
        position: 'absolute',
        top: insets.top + espacio.sm,
        alignSelf: 'center',
        zIndex: 50,
        pointerEvents: 'none',
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.sm,
        backgroundColor: tema.superficie,
        borderRadius: radio.completo,
        borderWidth: 1,
        borderColor: tema.borde,
        paddingHorizontal: espacio.md,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Llama tamano={18} encendida={aviso.racha.hoyCuenta} />
      <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.texto }}>
        Anotado · hoy ya cuenta · {aviso.despues} {aviso.despues === 1 ? 'día' : 'días'}
      </Text>
    </Llegada>
  );
}
