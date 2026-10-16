/**
 * El retrato de una planta: su gemelo —el mismo del patio— sobre un fondo de
 * su zona (cielo y pasto, pared y piso, o la sombra de los árboles).
 *
 * Es lo que hace que Mis plantas se lea de un vistazo: la monstera se ve
 * monstera, con su maceta y su color, en vez de un renglón de texto que obliga
 * a leer para reconocer.
 */

import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

import { edadEnMeses } from '../dominio/fenologia';
import { zonaDe } from '../dominio/lugares';
import type { Zona } from '../dominio/lugares';
import { calcularMorfologia } from '../dominio/morfologia';
import type { EstadoDePlanta } from '../servicios/agenda';
import { useMacetas } from '../servicios/decoracion';
import { Gemelo } from './Gemelo';
import { colorDeMaceta } from './macetas';

/** Cielo arriba y suelo abajo, por zona. */
export const FONDO_ZONA: Record<Zona, { arriba: string; abajo: string; suelo: string }> = {
  patio: { arriba: '#BFE3F7', abajo: '#E6F4FB', suelo: '#8CC86A' },
  casa: { arriba: '#F4E9D3', abajo: '#EBDDC2', suelo: '#C8935E' },
  sombra: { arriba: '#4E8F55', abajo: '#6FAA66', suelo: '#3F7A40' },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function RetratoBase({ estado, ancho, alto }: { estado: EstadoDePlanta; ancho: number; alto: number }) {
  const { planta, especie, estadoHoy, snapshot } = estado;
  const macetas = useMacetas();
  const zona = zonaDe(planta.ubicacion);
  const fondo = FONDO_ZONA[zona];
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
  const piso = Math.round(alto * 0.78);
  const lado = Math.min(ancho, alto) * 0.98;
  const id = `retrato-${planta.id}`;

  return (
    <View style={{ width: ancho, height: alto, overflow: 'hidden' }}>
      <Svg width={ancho} height={alto} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fondo.arriba} />
            <Stop offset="1" stopColor={fondo.abajo} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={ancho} height={piso} fill={`url(#${id})`} />
        <Rect x={0} y={piso} width={ancho} height={alto - piso} fill={fondo.suelo} />
        {zona === 'casa' && <Rect x={0} y={piso - 5} width={ancho} height={5} fill="#8C6441" />}
        <Ellipse cx={ancho / 2} cy={piso + 6} rx={lado * 0.26} ry={6} fill="#000" opacity={0.18} />
      </Svg>
      <View style={{ position: 'absolute', left: (ancho - lado) / 2, top: piso + 8 - lado * 1.1, width: lado, height: lado * 1.1 }}>
        <Gemelo
          especieId={especie.id}
          morfologia={morfologia}
          apariencia={planta.apariencia}
          recipiente={planta.contenedor.tipo}
          diasSinCambioAgua={snapshot.hidrico.diasDesdeCambioAgua}
          colorMaceta={colorDeMaceta(planta.contenedor.material)}
          estiloMaceta={macetas[planta.id]}
          semilla={planta.id}
          ancho={lado}
          alto={Math.round(lado * 1.1)}
          giro={-1.1 + hash(planta.id) * 1.4}
          inclinacion={0.22}
          detalle="bajo"
          sombra={false}
          apoyado
        />
      </View>
    </View>
  );
}

/** Memorizado: en una cuadrícula hay muchos, y cada uno arma su malla. */
export const RetratoPlanta = memo(RetratoBase);
