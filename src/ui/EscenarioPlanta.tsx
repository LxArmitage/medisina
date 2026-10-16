/**
 * El escenario de una planta: su gemelo en 3D, en grande y tocable.
 *
 * Una sola vista que hace las dos cosas que antes estaban separadas en "3D" y
 * "Dibujo": se gira arrastrando el dedo y, al tocar una parte, dice qué le
 * pasa. El gemelo se arma con la forma de su especie, el color de su foto y el
 * estado de hoy (ver `Gemelo.tsx`).
 *
 * DÓNDE VA EL COMENTARIO DE CADA PARTE. Encima del escenario, flotando, y no
 * debajo. Puesto abajo obligaba a mirar el gemelo, bajar la vista a leer, y
 * volver a subir para ver cuál parte estaba resaltada: tres movimientos para
 * una frase. Encima, el texto y la zona iluminada se ven a la vez.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { edadEnMeses } from '../dominio/fenologia';
import { alturaEstimadaCm, calcularMorfologia, describirMorfologia } from '../dominio/morfologia';
import { explicarParte } from '../dominio/partes';
import type { ExplicacionParte, ParteGemelo } from '../dominio/partes';
import { proyectarCrecimiento } from '../dominio/proyeccion';
import type { EstadoDePlanta } from '../servicios/agenda';
import { useMacetas } from '../servicios/decoracion';
import { Frontera } from './Frontera';
import { Gemelo } from './Gemelo';
import { colorDeMaceta } from './macetas';
import { espacio, fuente, radio, useTema } from './tema';

/** Alto del escenario. */
const ALTO = 330;

export interface EscenarioPlantaProps {
  estado: EstadoDePlanta;
  /** Animación de nacimiento, la primera vez que se abre tras escanearla. */
  naciendo?: boolean;
}

export function EscenarioPlanta({ estado, naciendo }: EscenarioPlantaProps) {
  const tema = useTema();
  const reducido = useReducedMotion();
  const macetas = useMacetas();

  const [mesesVista, setMesesVista] = useState(0);
  // En cuanto se viaja al futuro, la cámara se fija en la planta más grande y
  // ya no se mueve —tampoco al volver a "Hoy"—: sólo así se compara a ojo.
  const [viajando, setViajando] = useState(false);
  // Se guarda la parte además del texto: el gemelo necesita saber cuál
  // resaltar, y el texto solo no lo dice.
  const [parte, setParte] = useState<{ cual: ParteGemelo; texto: ExplicacionParte } | null>(null);
  const [ancho, setAncho] = useState(320);
  const alMedir = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - ancho) > 1) setAncho(w);
  };

  const morfologiaHoy = useMemo(
    () =>
      calcularMorfologia({
        especie: estado.especie,
        estado: estado.estadoHoy,
        fenologia: estado.snapshot.fenologia,
        edadMeses: edadEnMeses(estado.planta.fechaAdquisicion),
        medidas: estado.planta.medidas,
      }),
    [estado],
  );

  // La misma altura con que se dibuja hoy (medida o estimada por su especie y
  // su edad): si "Hoy" en la línea del tiempo partiera de otra, el primer paso
  // ya sería un salto que no existe.
  const alturaHoyCm = useMemo(
    () => estado.planta.medidas?.alturaCm ?? alturaEstimadaCm(estado.especie, edadEnMeses(estado.planta.fechaAdquisicion)),
    [estado],
  );

  const proyeccion = useMemo(
    () =>
      proyectarCrecimiento({
        especie: estado.especie,
        alturaCm: alturaHoyCm,
        elementos: estado.planta.medidas?.elementos ?? morfologiaHoy.elementos,
        zonaClimatica: estado.planta.ubicacion.zonaClimatica,
      }),
    [estado, morfologiaHoy, alturaHoyCm],
  );

  const pasoActual = proyeccion.find((p) => p.meses === mesesVista) ?? proyeccion[0];
  const enFuturo = mesesVista > 0;
  const morfologia = enFuturo ? pasoActual.morfologia : morfologiaHoy;
  const ultimo = proyeccion[proyeccion.length - 1];
  const marco = useMemo(
    () => (viajando ? { morfologia: ultimo.morfologia, crecimiento: ultimo.crecimiento } : null),
    [viajando, ultimo],
  );
  const ganancia = pasoActual.alturaCm - proyeccion[0].alturaCm;
  const { planta, snapshot } = estado;

  const alTocarParte = useCallback(
    (p: ParteGemelo) => {
      // En el futuro proyectado no hay estado real que explicar.
      if (enFuturo) return;
      setParte({
        cual: p,
        texto: explicarParte(p, {
          morfologia: morfologiaHoy,
          estado: estado.estadoHoy,
          especie: estado.especie,
          enFrasco: planta.contenedor.tipo === 'agua',
          diasSinCambioAgua: snapshot.hidrico.diasDesdeCambioAgua,
        }),
      });
    },
    [enFuturo, morfologiaHoy, estado, planta.contenedor.tipo, snapshot.hidrico.diasDesdeCambioAgua],
  );

  return (
    <View
      style={{
        backgroundColor: tema.superficieAlta,
        borderRadius: radio.lg,
        overflow: 'hidden',
        paddingTop: espacio.md,
        paddingBottom: espacio.md,
        alignItems: 'center',
      }}
    >
      <View onLayout={alMedir} style={{ alignSelf: 'stretch', height: ALTO, alignItems: 'center' }}>
        <Frontera zona="el gemelo de la planta" tema={tema}>
          <Animated.View entering={naciendo && !reducido ? FadeIn.duration(500) : undefined}>
            <Gemelo
              especieId={estado.especie.id}
              morfologia={morfologia}
              apariencia={planta.apariencia}
              recipiente={planta.contenedor.tipo}
              diasSinCambioAgua={snapshot.hidrico.diasDesdeCambioAgua}
              colorMaceta={colorDeMaceta(planta.contenedor.material)}
              estiloMaceta={macetas[planta.id]}
              semilla={planta.id}
              ancho={ancho}
              alto={ALTO}
              interactivo
              detalle="alto"
              onParte={enFuturo ? undefined : alTocarParte}
              parteActiva={parte?.cual ?? null}
              crecimiento={enFuturo ? pasoActual.crecimiento : 1}
              marco={marco}
            />
          </Animated.View>
        </Frontera>
      </View>

      {/* El comentario de la parte, flotando ENCIMA del escenario. Así se lee
          la frase sin perder de vista la zona que se iluminó. */}
      {parte && (
        <Animated.View
          entering={reducido ? undefined : FadeIn.duration(180)}
          style={{
            position: 'absolute',
            top: espacio.md,
            left: espacio.md,
            right: espacio.md,
            backgroundColor: tema.esOscuro ? 'rgba(16,22,19,0.94)' : 'rgba(255,255,255,0.96)',
            borderRadius: radio.lg,
            borderWidth: 1,
            borderColor: tema.primario,
            padding: espacio.md,
            gap: 5,
            // Sombra: va encima del dibujo y necesita despegarse de él.
            shadowColor: '#000',
            shadowOpacity: 0.22,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
            <Ionicons name="finger-print-outline" size={15} color={tema.primario} />
            <Text
              style={{
                flex: 1,
                fontFamily: fuente.cuerpoFuerte,
                fontSize: 13.5,
                color: tema.texto,
              }}
            >
              {parte.texto.titulo}
            </Text>
            <Pressable onPress={() => setParte(null)} hitSlop={12}>
              <Ionicons name="close" size={17} color={tema.textoSuave} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13.5, lineHeight: 19, color: tema.texto }}>
            {parte.texto.texto}
          </Text>
          {parte.texto.dato && (
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11.5, color: tema.primario }}>
              {parte.texto.dato}
            </Text>
          )}
        </Animated.View>
      )}

      <Text
        style={{
          fontFamily: fuente.cuerpo,
          fontSize: 12,
          color: tema.textoSuave,
          marginTop: espacio.xs,
          textAlign: 'center',
          paddingHorizontal: espacio.lg,
        }}
      >
        {enFuturo
          ? `Así se vería · ${pasoActual.alturaCm} cm${ganancia >= 1 ? ` (${ganancia} cm más que hoy)` : ''}`
          : viajando
            ? `Hoy · unos ${proyeccion[0].alturaCm} cm`
            : 'Arrástrala para girarla · toca una hoja, el tallo o la maceta'}
      </Text>

      {/* Viaje en el tiempo */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: espacio.sm,
          marginTop: espacio.md,
          paddingHorizontal: espacio.md,
        }}
      >
        {proyeccion.map((paso) => {
          const activo = paso.meses === mesesVista;
          return (
            <Pressable
              key={paso.meses}
              onPress={() => {
                setMesesVista(paso.meses);
                if (paso.meses > 0) setViajando(true);
                setParte(null);
              }}
              style={({ pressed }) => ({
                backgroundColor: activo ? tema.primario : tema.superficie,
                borderColor: activo ? tema.primario : tema.borde,
                borderWidth: 1,
                borderRadius: radio.completo,
                paddingHorizontal: espacio.md,
                minHeight: 34,
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: fuente.cuerpoFuerte,
                  fontSize: 12.5,
                  color: activo ? (tema.esOscuro ? '#0B1A13' : '#fff') : tema.textoSuave,
                }}
              >
                {paso.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {enFuturo && (
        <Text
          style={{
            fontFamily: fuente.cuerpo,
            fontSize: 11.5,
            color: tema.textoSuave,
            textAlign: 'center',
            marginTop: espacio.sm,
            paddingHorizontal: espacio.lg,
          }}
        >
          Es una proyección con cuidado ideal: riego a tiempo y su luz.
          Lo que pase de verdad depende de cómo la lleves.
        </Text>
      )}

      {!enFuturo && (
        <Text
          style={{
            fontFamily: fuente.cuerpo,
            fontSize: 11.5,
            color: tema.textoSuave,
            textAlign: 'center',
            marginTop: espacio.sm,
            paddingHorizontal: espacio.lg,
          }}
        >
          {describirMorfologia(morfologia)}
        </Text>
      )}
    </View>
  );
}
