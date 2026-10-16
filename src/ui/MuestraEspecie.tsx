/**
 * Una especie dibujada sola, sin ser la planta de nadie: para el escaneo
 * ("creo que es…"), para el catálogo de plantas y para su ficha.
 *
 * Se dibuja en su mejor día —bien regada, de un año— sobre el fondo del lugar
 * donde mejor vive: cielo y pasto si es de sol, pared y piso si es de adentro,
 * verde de árboles si es de sombra. Con `enFlor` se pinta con flores y frutos
 * aunque no sea su temporada, para conocerla completa.
 */

import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { EstiloMaceta } from '../dominio/decoracion';
import { formaDe } from '../dominio/forma';
import type { Zona } from '../dominio/lugares';
import { calcularMorfologia } from '../dominio/morfologia';
import type { Morfologia } from '../dominio/morfologia';
import type { AparienciaObservada, Especie } from '../dominio/tipos';
import { Gemelo } from './Gemelo';
import { FONDO_ZONA } from './RetratoPlanta';

const CACHE = new Map<string, Morfologia>();

/** La morfología de una especie en su mejor día. `enFlor` le pone flores y frutos. */
export function morfologiaDeMuestra(especie: Especie, enFlor = false, edadMeses = 12): Morfologia {
  const clave = `${especie.id}|${enFlor ? 1 : 0}|${edadMeses}`;
  const ya = CACHE.get(clave);
  if (ya) return ya;
  const base = calcularMorfologia({
    especie,
    estado: {
      fecha: '',
      aguaDisponibleMm: especie.aguaUtilMm,
      fraccionDisponible: 0.7,
      demandaMm: 0,
      aporteMm: 0,
      diasConsecutivosEncharcado: 0,
      diasConsecutivosEnEstres: 0,
      nivel: 'optimo',
      esPronostico: false,
    },
    edadMeses,
  });
  const forma = formaDe(especie.id);
  const m: Morfologia = enFlor
    ? {
        ...base,
        flores: forma.flor ? Math.max(base.flores, 3) : 0,
        frutos: forma.fruto ? Math.max(base.frutos, 2) : 0,
        desarrollo: Math.max(base.desarrollo, 0.6),
      }
    : base;
  CACHE.set(clave, m);
  return m;
}

/** Dónde vive mejor una especie, para el fondo de su retrato. */
export function zonaIdeal(especie: Especie): Zona {
  const banda = especie.bandasToleradas[0];
  if (banda === 'sombra') return 'sombra';
  if (banda === 'interior_luminoso' || banda === 'interior_bajo') return 'casa';
  return 'patio';
}

interface Props {
  especie: Especie;
  ancho: number;
  alto: number;
  apariencia?: AparienciaObservada;
  /** Con flores y frutos, aunque no sea temporada. */
  enFlor?: boolean;
  /** Con el fondo de su lugar. Sin él, transparente (sobre una tarjeta). */
  conFondo?: boolean;
  detalle?: 'bajo' | 'alto';
  /** Se puede girar con el dedo. */
  interactivo?: boolean;
  /** Con la maceta que le escogieron. */
  estiloMaceta?: EstiloMaceta;
  /** Para dibujar la de una planta en particular (su id). */
  semilla?: string;
}

function MuestraBase({
  especie,
  ancho,
  alto,
  apariencia,
  enFlor = false,
  conFondo = false,
  detalle = 'bajo',
  interactivo = false,
  estiloMaceta,
  semilla,
}: Props) {
  // En flor se muestra ya adulta (tres años): así se conoce la especie completa.
  const morfologia = useMemo(() => morfologiaDeMuestra(especie, enFlor, enFlor ? 36 : 12), [especie, enFlor]);
  const flotante = formaDe(especie.id).porte === 'flotante';
  if (!conFondo) {
    return (
      <Gemelo
        especieId={especie.id}
        morfologia={morfologia}
        apariencia={apariencia}
        recipiente={flotante ? 'agua' : 'maceta'}
        ancho={ancho}
        alto={alto}
        detalle={detalle}
        sombra={false}
        interactivo={interactivo}
        semilla={semilla ?? especie.id}
        estiloMaceta={estiloMaceta}
      />
    );
  }
  const zona = zonaIdeal(especie);
  const fondo = FONDO_ZONA[zona];
  const id = `muestra-${especie.id}-${ancho}`;
  const piso = Math.round(alto * 0.8);
  // El gemelo parado en el piso, como en el patio.
  const lado = Math.min(ancho, alto / 1.1) * 0.98;
  return (
    <View style={{ width: ancho, height: alto, overflow: 'hidden' }}>
      <Svg width={ancho} height={alto} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fondo.arriba} />
            <Stop offset="1" stopColor={fondo.abajo} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={ancho} height={alto} fill={`url(#${id})`} />
        <Rect x={0} y={piso} width={ancho} height={alto - piso} fill={fondo.suelo} />
        {zona === 'casa' && <Rect x={0} y={piso - 5} width={ancho} height={5} fill="#8C6441" />}
        <Ellipse cx={ancho / 2} cy={piso + 6} rx={lado * 0.26} ry={6} fill="#000" opacity={0.18} />
      </Svg>
      <View style={{ position: 'absolute', left: (ancho - lado) / 2, top: piso + 8 - lado * 1.1, width: lado, height: lado * 1.1 }}>
        <Gemelo
          especieId={especie.id}
          morfologia={morfologia}
          apariencia={apariencia}
          recipiente={flotante ? 'agua' : 'maceta'}
          ancho={lado}
          alto={Math.round(lado * 1.1)}
          inclinacion={0.22}
          detalle={detalle}
          sombra={false}
          interactivo={interactivo}
          semilla={semilla ?? especie.id}
          estiloMaceta={estiloMaceta}
          apoyado
        />
      </View>
    </View>
  );
}

export const MuestraEspecie = memo(MuestraBase);
