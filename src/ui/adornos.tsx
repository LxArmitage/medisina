/**
 * Los adornos con que cada quien decora su patio, su casa y su sombra.
 *
 * Cada adorno es un dibujito en SVG, en las coordenadas del mundo del patio
 * (`mundoPatio.ts`). Van detrás de las plantas: decoran, no estorban. De
 * noche se oscurecen, y los que dan luz (foquitos, faroles, farolitos) se
 * prenden.
 *
 * Las mismas funciones dibujan la muestrita de cada botón en la pantalla de
 * decorar (`MuestraAdorno`): lo que eliges es exactamente lo que vas a ver.
 */

import type { ReactElement } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import { lugaresDeAdornos } from '../dominio/decoracion';
import type { AdornoCasa, AdornoPatio, AdornoSombra, Barda, Decoracion, PisoPatio, PisoSombra } from '../dominio/decoracion';
import { BARDAS } from '../dominio/decoracion';
import { mezclar } from '../dominio/forma';
import { ventanasCasa } from './escenasPatio';
import { ALTO_MUNDO, CAMINO, HORIZONTE } from './mundoPatio';
import type { Momento } from './mundoPatio';

const PAPEL = ['#E0508C', '#F2B233', '#3E9AD6', '#7BC043', '#9B59B6', '#F26B3A'];
const MADERA = '#9A6A3E';
const MADERA_OSCURA = '#6E4A2A';

function fraccion(n: number): number {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

/** De noche los colores se apagan hacia un azul oscuro. */
function sombreado(color: string, noche: boolean): string {
  return noche ? mezclar(color, '#1A2340', 0.55) : color;
}

// ---------------------------------------------------------------------------
// El patio
// ---------------------------------------------------------------------------

/** Dónde se paran los adornos del patio: al fondo, detrás de las plantas. */
const BASE_PATIO = HORIZONTE + 40;

/** La barda pintada que cierra el patio. Con "madera" no se dibuja: queda la cerca de siempre. */
export function BardaPatio({ ancho, barda, momento }: { ancho: number; barda: Barda; momento: Momento }) {
  if (barda === 'madera') return null;
  const noche = momento === 'noche';
  const color = sombreado(BARDAS.find((b) => b.valor === barda)?.color ?? '#F1ECE2', noche);
  const arriba = HORIZONTE - 50;
  const manchas: number[] = [];
  for (let x = 30; x < ancho; x += 90) manchas.push(x + fraccion(x) * 40);
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      <Rect x={0} y={arriba} width={ancho} height={HORIZONTE + 12 - arriba} fill={color} />
      {/* El aplanado: manchitas de otro tono, como pintura sobre repello. */}
      {manchas.map((x, i) => (
        <Ellipse key={x} cx={x} cy={arriba + 18 + (i % 3) * 12} rx={16 + (i % 4) * 6} ry={5 + (i % 2) * 3} fill={i % 2 ? '#FFFFFF' : '#000000'} opacity={0.05} />
      ))}
      {/* La cornisa de arriba y el rodapié oscuro de abajo. */}
      <Rect x={0} y={arriba - 6} width={ancho} height={8} fill={mezclar(color, '#000000', 0.18)} />
      <Rect x={0} y={arriba - 8} width={ancho} height={3} fill="#FFFFFF" opacity={noche ? 0.05 : 0.25} />
      <Rect x={0} y={HORIZONTE - 2} width={ancho} height={14} fill={mezclar(color, '#000000', 0.22)} />
    </Svg>
  );
}

/** El suelo del patio cuando no es pasto. El pasto ya lo pinta la escena. */
export function PisoDelPatio({ ancho, piso }: { ancho: number; piso: PisoPatio }) {
  if (piso === 'pasto') return null;
  const alto = ALTO_MUNDO - HORIZONTE;
  const lineas: ReactElement[] = [];
  let fondo = '#B98F5E';
  if (piso === 'tierra') {
    fondo = '#BE9564';
    for (let i = 0; i < ancho / 22; i += 1) {
      const x = fraccion(i * 3.7) * ancho;
      const y = HORIZONTE + 12 + fraccion(i * 9.1) * (alto - 20);
      lineas.push(<Ellipse key={i} cx={x} cy={y} rx={2.5 + fraccion(i) * 3} ry={1.6} fill={i % 3 ? '#8C6A44' : '#E3C9A0'} opacity={0.6} />);
    }
    for (let x = 20; x < ancho; x += 70) {
      const y = HORIZONTE + 20 + fraccion(x * 1.3) * 100;
      lineas.push(<Path key={`m${x}`} d={`M${x} ${y} l3 -8 l2 8 l3 -6 l2 6 Z`} fill="#6E9A48" opacity={0.7} />);
    }
  } else if (piso === 'ladrillo') {
    fondo = '#C4673F';
    let fila = 0;
    for (let y = HORIZONTE + 10; y < ALTO_MUNDO; y += 14, fila += 1) {
      lineas.push(<Rect key={`f${y}`} x={0} y={y} width={ancho} height={1.6} fill="#7A3A22" opacity={0.45} />);
      for (let x = (fila % 2) * 18; x < ancho; x += 36) {
        lineas.push(<Rect key={`j${y}-${x}`} x={x} y={y} width={1.6} height={14} fill="#7A3A22" opacity={0.4} />);
      }
    }
  } else if (piso === 'piedra') {
    fondo = '#8E9088';
    for (let y = HORIZONTE + 8; y < ALTO_MUNDO; y += 26) {
      for (let x = -10 + fraccion(y) * 20; x < ancho; x += 44) {
        const w = 34 + fraccion(x * y) * 10;
        lineas.push(<Rect key={`${x}-${y}`} x={x} y={y} width={w} height={20} rx={7} fill={fraccion(x + y) > 0.5 ? '#B8BAB0' : '#ACAEA4'} />);
      }
    }
  } else {
    fondo = '#B6875A';
    let fila = 0;
    for (let y = HORIZONTE + 10; y < ALTO_MUNDO; y += 12, fila += 1) {
      lineas.push(<Rect key={`f${y}`} x={0} y={y} width={ancho} height={1.4} fill="#6E4A2A" opacity={0.4} />);
      for (let x = (fila % 3) * 50; x < ancho; x += 150) {
        lineas.push(<Rect key={`j${y}-${x}`} x={x} y={y} width={1.4} height={12} fill="#6E4A2A" opacity={0.35} />);
      }
    }
  }
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      <Rect x={0} y={HORIZONTE} width={ancho} height={alto} fill={fondo} />
      {lineas}
      <Rect x={0} y={HORIZONTE} width={ancho} height={4} fill="#FFFFFF" opacity={0.12} />
      {/* El camino de la sina, más claro, para que se siga viendo por dónde anda. */}
      <Rect x={6} y={CAMINO - 14} width={ancho - 12} height={30} rx={15} fill="#FFFFFF" opacity={0.14} />
    </Svg>
  );
}

/** Todos los adornos del patio, repartidos a lo largo. */
export function AdornosPatio({ ancho, adornos, momento }: { ancho: number; adornos: AdornoPatio[]; momento: Momento }) {
  if (adornos.length === 0) return null;
  const noche = momento === 'noche';
  const deSuelo = adornos.filter((a) => a !== 'papelPicado' && a !== 'foquitos');
  const lugares = lugaresDeAdornos(ancho, deSuelo.length);
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      {deSuelo.map((a, i) => (
        <G key={a}>{adornoPatio(a, lugares[i] + (fraccion(i + 1) - 0.5) * 40, BASE_PATIO, noche)}</G>
      ))}
      {adornos.includes('foquitos') && <Foquitos ancho={ancho} y={78} noche={noche} />}
      {adornos.includes('papelPicado') && <PapelPicado ancho={ancho} y={22} noche={noche} />}
    </Svg>
  );
}

function adornoPatio(a: AdornoPatio, x: number, base: number, noche: boolean): ReactElement | null {
  switch (a) {
    case 'banca':
      return banca(x, base, noche);
    case 'fuente':
      return fuente(x, base, noche);
    case 'hamaca':
      return hamaca(x, base, noche);
    case 'faroles':
      return faroles(x, base, noche);
    case 'perrito':
      return perrito(x, base, noche);
    case 'bebedero':
      return bebedero(x, base, noche);
    default:
      return null;
  }
}

function PapelPicado({ ancho, y, noche }: { ancho: number; y: number; noche: boolean }) {
  const banderas: ReactElement[] = [];
  const paso = 30;
  for (let i = 0, x = 6; x < ancho; i += 1, x += paso) {
    // El hilo cuelga: más abajo a media distancia de cada poste imaginario.
    const tramo = (x % 240) / 240;
    const yy = y + Math.sin(tramo * Math.PI) * 14;
    const color = sombreado(PAPEL[i % PAPEL.length], noche);
    banderas.push(
      <G key={x}>
        <Path d={`M${x} ${yy} L${x + 24} ${yy} L${x + 22} ${yy + 26} L${x + 12} ${yy + 22} L${x + 2} ${yy + 26} Z`} fill={color} opacity={0.95} />
        {/* Los calados del papel. */}
        <Circle cx={x + 12} cy={yy + 9} r={3.2} fill="#FFFFFF" opacity={0.35} />
        <Path d={`M${x + 6} ${yy + 15} l3 3 l-3 3 l-3 -3 Z`} fill="#FFFFFF" opacity={0.3} />
        <Path d={`M${x + 18} ${yy + 15} l3 3 l-3 3 l-3 -3 Z`} fill="#FFFFFF" opacity={0.3} />
      </G>,
    );
  }
  let hilo = `M0 ${y}`;
  for (let x = 0; x <= ancho; x += 20) hilo += ` L${x} ${y + Math.sin(((x % 240) / 240) * Math.PI) * 14}`;
  return (
    <G>
      <Path d={hilo} stroke={noche ? '#555' : '#8A7A66'} strokeWidth={1.2} fill="none" />
      {banderas}
    </G>
  );
}

function Foquitos({ ancho, y, noche }: { ancho: number; y: number; noche: boolean }) {
  const focos: ReactElement[] = [];
  let hilo = `M0 ${y}`;
  const colgado = (x: number) => y + Math.sin(((x % 180) / 180) * Math.PI) * 20;
  for (let x = 0; x <= ancho; x += 15) hilo += ` L${x} ${colgado(x)}`;
  for (let x = 10; x < ancho; x += 26) {
    const yy = colgado(x) + 4;
    focos.push(
      <G key={x}>
        {noche && <Circle cx={x} cy={yy + 3} r={13} fill="#FFD66B" opacity={0.28} />}
        <Rect x={x - 1.5} y={yy - 4} width={3} height={4} fill="#444" />
        <Circle cx={x} cy={yy + 3} r={4} fill={noche ? '#FFE9A0' : '#F6E7B8'} />
      </G>,
    );
  }
  return (
    <G>
      <Path d={hilo} stroke="#3A3A3A" strokeWidth={1.2} fill="none" />
      {focos}
    </G>
  );
}

function banca(x: number, base: number, noche: boolean): ReactElement {
  const m = sombreado(MADERA, noche);
  const o = sombreado(MADERA_OSCURA, noche);
  return (
    <G>
      <Ellipse cx={x} cy={base + 2} rx={42} ry={5} fill="#000" opacity={0.12} />
      <Rect x={x - 34} y={base - 24} width={4} height={24} fill={o} />
      <Rect x={x + 30} y={base - 24} width={4} height={24} fill={o} />
      <Rect x={x - 38} y={base - 28} width={76} height={7} rx={2} fill={m} />
      <Rect x={x - 34} y={base - 52} width={4} height={26} fill={o} />
      <Rect x={x + 30} y={base - 52} width={4} height={26} fill={o} />
      <Rect x={x - 38} y={base - 52} width={76} height={6} rx={2} fill={m} />
      <Rect x={x - 38} y={base - 42} width={76} height={6} rx={2} fill={m} />
    </G>
  );
}

function fuente(x: number, base: number, noche: boolean): ReactElement {
  const piedra = sombreado('#BDB7AA', noche);
  const agua = noche ? '#3C6E96' : '#6EC0E8';
  return (
    <G>
      <Ellipse cx={x} cy={base} rx={38} ry={8} fill="#000" opacity={0.12} />
      <Path d={`M${x - 36} ${base - 16} L${x + 36} ${base - 16} L${x + 30} ${base} L${x - 30} ${base} Z`} fill={piedra} />
      <Ellipse cx={x} cy={base - 16} rx={36} ry={7} fill={mezclar(piedra, '#FFFFFF', 0.2)} />
      <Ellipse cx={x} cy={base - 16} rx={31} ry={5} fill={agua} />
      <Rect x={x - 4} y={base - 46} width={8} height={30} fill={piedra} />
      <Ellipse cx={x} cy={base - 46} rx={17} ry={4.5} fill={mezclar(piedra, '#FFFFFF', 0.2)} />
      <Ellipse cx={x} cy={base - 46} rx={13} ry={3} fill={agua} />
      {/* El chorrito que sube y cae de los dos lados. */}
      <Path d={`M${x} ${base - 48} Q${x - 4} ${base - 64} ${x - 12} ${base - 50} Q${x - 18} ${base - 40} ${x - 22} ${base - 18}`} stroke={agua} strokeWidth={2} fill="none" opacity={0.85} />
      <Path d={`M${x} ${base - 48} Q${x + 4} ${base - 64} ${x + 12} ${base - 50} Q${x + 18} ${base - 40} ${x + 22} ${base - 18}`} stroke={agua} strokeWidth={2} fill="none" opacity={0.85} />
      <Circle cx={x - 2} cy={base - 60} r={1.4} fill="#FFFFFF" opacity={0.8} />
    </G>
  );
}

function hamaca(x: number, base: number, noche: boolean): ReactElement {
  const o = sombreado(MADERA_OSCURA, noche);
  const franjas = ['#E0508C', '#F2B233', '#3E9AD6', '#7BC043'].map((c) => sombreado(c, noche));
  const izq = x - 52;
  const der = x + 52;
  return (
    <G>
      <Ellipse cx={x} cy={base + 2} rx={54} ry={5} fill="#000" opacity={0.1} />
      <Rect x={izq - 3} y={base - 72} width={6} height={72} fill={o} />
      <Rect x={der - 3} y={base - 72} width={6} height={72} fill={o} />
      <Line x1={izq} y1={base - 62} x2={izq + 16} y2={base - 50} stroke="#E8DCC0" strokeWidth={1.2} />
      <Line x1={der} y1={base - 62} x2={der - 16} y2={base - 50} stroke="#E8DCC0" strokeWidth={1.2} />
      {franjas.map((c, i) => (
        <Path
          key={c}
          d={`M${izq + 16} ${base - 50 + i * 3} Q${x} ${base - 18 + i * 3} ${der - 16} ${base - 50 + i * 3} L${der - 16} ${base - 47 + i * 3} Q${x} ${base - 15 + i * 3} ${izq + 16} ${base - 47 + i * 3} Z`}
          fill={c}
        />
      ))}
    </G>
  );
}

function faroles(x: number, base: number, noche: boolean): ReactElement {
  return (
    <G>
      {[-30, 0, 30].map((d) => (
        <G key={d}>
          {noche && <Circle cx={x + d} cy={base - 34} r={18} fill="#FFD27A" opacity={0.3} />}
          <Rect x={x + d - 1.5} y={base - 30} width={3} height={30} fill={sombreado('#3A3A3A', noche)} />
          <Rect x={x + d - 6} y={base - 42} width={12} height={12} rx={2} fill={noche ? '#FFE3A0' : '#F3EAD2'} />
          <Path d={`M${x + d - 8} ${base - 42} L${x + d} ${base - 50} L${x + d + 8} ${base - 42} Z`} fill={sombreado('#3A3A3A', noche)} />
        </G>
      ))}
    </G>
  );
}

function perrito(x: number, base: number, noche: boolean): ReactElement {
  const techo = sombreado('#B5453A', noche);
  const casa = sombreado('#E7C98E', noche);
  const perro = sombreado('#B07A4A', noche);
  return (
    <G>
      <Ellipse cx={x} cy={base + 2} rx={44} ry={5} fill="#000" opacity={0.12} />
      <Rect x={x - 30} y={base - 34} width={44} height={34} fill={casa} />
      <Path d={`M${x - 36} ${base - 32} L${x - 8} ${base - 56} L${x + 20} ${base - 32} Z`} fill={techo} />
      <Path d={`M${x - 16} ${base} L${x - 16} ${base - 14} Q${x - 8} ${base - 26} ${x} ${base - 14} L${x} ${base} Z`} fill="#3A2A1C" />
      {/* El perro, echado afuera, dormido. */}
      <Ellipse cx={x + 28} cy={base - 6} rx={17} ry={7} fill={perro} />
      <Circle cx={x + 44} cy={base - 9} r={7} fill={perro} />
      <Ellipse cx={x + 42} cy={base - 13} rx={3} ry={5} fill={mezclar(perro, '#000000', 0.3)} />
      <Path d={`M${x + 46} ${base - 9} l3 0`} stroke="#3A2A1C" strokeWidth={1.2} />
      <Path d={`M${x + 12} ${base - 7} q-6 -4 -4 -10`} stroke={perro} strokeWidth={3} fill="none" strokeLinecap="round" />
    </G>
  );
}

function bebedero(x: number, base: number, noche: boolean): ReactElement {
  const piedra = sombreado('#C9C2B2', noche);
  const agua = noche ? '#3C6E96' : '#7CC8EC';
  const ave = sombreado('#D2553F', noche);
  return (
    <G>
      <Ellipse cx={x} cy={base + 1} rx={20} ry={4} fill="#000" opacity={0.12} />
      <Path d={`M${x - 12} ${base} L${x + 12} ${base} L${x + 5} ${base - 8} L${x + 4} ${base - 34} L${x - 4} ${base - 34} L${x - 5} ${base - 8} Z`} fill={piedra} />
      <Path d={`M${x - 24} ${base - 38} Q${x} ${base - 26} ${x + 24} ${base - 38} Z`} fill={piedra} />
      <Ellipse cx={x} cy={base - 38} rx={24} ry={5} fill={mezclar(piedra, '#FFFFFF', 0.2)} />
      <Ellipse cx={x} cy={base - 38} rx={20} ry={3.5} fill={agua} />
      {/* Un cardenal parado en la orilla. */}
      <Ellipse cx={x + 18} cy={base - 46} rx={6} ry={5} fill={ave} />
      <Circle cx={x + 22} cy={base - 51} r={3.5} fill={ave} />
      <Path d={`M${x + 25} ${base - 51} l3 1 l-3 1 Z`} fill="#F2B233" />
      <Path d={`M${x + 13} ${base - 46} l-6 -3 l1 5 Z`} fill={mezclar(ave, '#000000', 0.25)} />
    </G>
  );
}

// ---------------------------------------------------------------------------
// La casa
// ---------------------------------------------------------------------------

/**
 * Los adornos de la sala, cada uno en su lugar de la casa: el sillón y el
 * reloj en el rincón de la lámpara (entre ventana y ventana), la guitarra en
 * el siguiente, y lo que cuelga —el pajarito, la piñata— frente a una
 * ventana, donde no choca con las lámparas.
 */
export function AdornosCasa({ ancho, adornos, momento, piso }: { ancho: number; adornos: AdornoCasa[]; momento: Momento; piso: number }) {
  const cuales = adornos.filter((a) => a !== 'gato');
  if (cuales.length === 0) return null;
  const noche = momento === 'noche';
  const ventanas = ventanasCasa(ancho);
  const rincones = ventanas.map((x) => x + 185).filter((x) => x < ancho - 50);
  const repartidos = lugaresDeAdornos(ancho, 2);
  const rincon = (i: number) => rincones[i] ?? (rincones.length > 0 ? rincones[rincones.length - 1] + 70 * i : repartidos[i % 2]);
  const frente = (i: number) => (ventanas[i] !== undefined ? ventanas[i] + 60 : (ventanas[0] ?? repartidos[0]) + 60 + 40 * i);
  const lugar: Record<Exclude<AdornoCasa, 'gato'>, number> = {
    sillon: rincon(0),
    reloj: rincon(0),
    guitarra: rincones.length > 1 ? rincon(1) : rincon(0) + 62,
    jaula: frente(0) + 30,
    pinata: ventanas.length > 1 ? frente(1) - 20 : frente(0) - 30,
  };
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      {cuales.map((a) => (
        <G key={a}>{adornoCasa(a, lugar[a as Exclude<AdornoCasa, 'gato'>], piso, noche)}</G>
      ))}
    </Svg>
  );
}

function adornoCasa(a: AdornoCasa, x: number, piso: number, noche: boolean): ReactElement | null {
  switch (a) {
    case 'sillon':
      return sillon(x, piso, noche);
    case 'reloj':
      return reloj(x, piso, noche);
    case 'guitarra':
      return guitarra(x, piso, noche);
    case 'jaula':
      return jaula(x, noche);
    case 'pinata':
      return pinata(x, noche);
    default:
      return null;
  }
}

function sillon(x: number, piso: number, noche: boolean): ReactElement {
  const tela = sombreado('#5E7FB0', noche);
  const oscura = mezclar(tela, '#000000', 0.25);
  return (
    <G>
      <Ellipse cx={x} cy={piso + 14} rx={46} ry={5} fill="#000" opacity={0.15} />
      <Rect x={x - 34} y={piso - 46} width={68} height={36} rx={10} fill={oscura} />
      <Rect x={x - 38} y={piso - 18} width={76} height={26} rx={6} fill={tela} />
      <Rect x={x - 44} y={piso - 30} width={14} height={38} rx={6} fill={oscura} />
      <Rect x={x + 30} y={piso - 30} width={14} height={38} rx={6} fill={oscura} />
      <Rect x={x - 28} y={piso - 24} width={56} height={10} rx={4} fill={mezclar(tela, '#FFFFFF', 0.15)} />
      <Rect x={x - 36} y={piso + 8} width={4} height={6} fill={MADERA_OSCURA} />
      <Rect x={x + 32} y={piso + 8} width={4} height={6} fill={MADERA_OSCURA} />
    </G>
  );
}

function reloj(x: number, piso: number, noche: boolean): ReactElement {
  const y = piso - 110;
  return (
    <G>
      <Circle cx={x} cy={y} r={17} fill={sombreado('#6B4A2F', noche)} />
      <Circle cx={x} cy={y} r={13.5} fill={sombreado('#FBF7EC', noche)} />
      {[0, 1, 2, 3].map((k) => (
        <Circle key={k} cx={x + Math.cos((k * Math.PI) / 2) * 10.5} cy={y + Math.sin((k * Math.PI) / 2) * 10.5} r={1.2} fill="#3A3A3A" />
      ))}
      <Line x1={x} y1={y} x2={x} y2={y - 9} stroke="#2A2A2A" strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={x} y1={y} x2={x + 6} y2={y + 2} stroke="#2A2A2A" strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={x} cy={y} r={1.6} fill="#C0392B" />
    </G>
  );
}

function guitarra(x: number, piso: number, noche: boolean): ReactElement {
  const cuerpo = sombreado('#C9803A', noche);
  const brazo = sombreado('#5A3A20', noche);
  return (
    <G transform={`rotate(-12 ${x} ${piso})`}>
      <Ellipse cx={x} cy={piso + 8} rx={24} ry={4} fill="#000" opacity={0.15} />
      <Rect x={x - 3} y={piso - 96} width={6} height={60} fill={brazo} />
      <Rect x={x - 5} y={piso - 106} width={10} height={12} rx={2} fill={brazo} />
      <Circle cx={x} cy={piso - 28} r={17} fill={cuerpo} />
      <Circle cx={x} cy={piso - 6} r={21} fill={cuerpo} />
      <Circle cx={x} cy={piso - 22} r={6} fill="#2A1A0A" />
      <Rect x={x - 8} y={piso - 4} width={16} height={3} fill={brazo} />
      {[-1.5, 0, 1.5].map((d) => (
        <Line key={d} x1={x + d} y1={piso - 104} x2={x + d} y2={piso - 3} stroke="#EDE3C8" strokeWidth={0.5} />
      ))}
    </G>
  );
}

function jaula(x: number, noche: boolean): ReactElement {
  const metal = sombreado('#C9A24A', noche);
  const ave = sombreado('#F2D23C', noche);
  return (
    <G>
      <Line x1={x} y1={0} x2={x} y2={40} stroke={metal} strokeWidth={1.5} />
      <Path d={`M${x - 22} 90 L${x - 22} 62 Q${x} 30 ${x + 22} 62 L${x + 22} 90 Z`} fill="none" stroke={metal} strokeWidth={1.6} />
      {[-14, -7, 0, 7, 14].map((d) => (
        <Line key={d} x1={x + d} y1={44 + Math.abs(d) * 0.9} x2={x + d} y2={90} stroke={metal} strokeWidth={1} />
      ))}
      <Rect x={x - 25} y={88} width={50} height={5} rx={2} fill={metal} />
      <Line x1={x - 18} y1={74} x2={x + 18} y2={74} stroke={MADERA} strokeWidth={2} />
      {/* El canario, en su palito. */}
      <Ellipse cx={x} cy={68} rx={6} ry={5} fill={ave} />
      <Circle cx={x + 5} cy={63} r={3.5} fill={ave} />
      <Path d={`M${x + 8} ${63} l3 1 l-3 1 Z`} fill="#E07A2A" />
      <Path d={`M${x - 5} ${69} l-6 3 l5 1 Z`} fill={mezclar(ave, '#8A6A00', 0.3)} />
    </G>
  );
}

function pinata(x: number, noche: boolean): ReactElement {
  const picos: ReactElement[] = [];
  const cy = 78;
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * 34;
    const py = cy + Math.sin(a) * 34;
    const l = a + Math.PI / 2;
    picos.push(
      <G key={i}>
        <Polygon
          points={`${x + Math.cos(l) * 8 + Math.cos(a) * 12},${cy + Math.sin(l) * 8 + Math.sin(a) * 12} ${px},${py} ${x - Math.cos(l) * 8 + Math.cos(a) * 12},${cy - Math.sin(l) * 8 + Math.sin(a) * 12}`}
          fill={sombreado(PAPEL[i % PAPEL.length], noche)}
        />
        {/* Las tiras de papel que cuelgan de cada pico. */}
        <Path d={`M${px} ${py} q2 8 -1 14`} stroke={sombreado(PAPEL[(i + 2) % PAPEL.length], noche)} strokeWidth={2} fill="none" />
      </G>,
    );
  }
  return (
    <G>
      <Line x1={x} y1={0} x2={x} y2={cy - 14} stroke="#8A7A66" strokeWidth={1.2} />
      {picos}
      <Circle cx={x} cy={cy} r={15} fill={sombreado('#F2B233', noche)} />
      <Circle cx={x} cy={cy} r={9} fill={sombreado('#E0508C', noche)} />
    </G>
  );
}

// ---------------------------------------------------------------------------
// La sombra
// ---------------------------------------------------------------------------

export function PisoDeSombra({ ancho, piso, momento }: { ancho: number; piso: PisoSombra; momento: Momento }) {
  if (piso === 'pasto') return null;
  const noche = momento === 'noche';
  const cosas: ReactElement[] = [];
  if (piso === 'hojarasca') {
    const colores = ['#B8793A', '#D19A45', '#9A5A2A', '#C8A04A'];
    for (let i = 0; i < ancho / 7; i += 1) {
      const x = fraccion(i * 5.3) * ancho;
      const y = HORIZONTE + 8 + fraccion(i * 2.9) * (ALTO_MUNDO - HORIZONTE - 12);
      cosas.push(
        <Ellipse key={i} cx={x} cy={y} rx={4 + fraccion(i) * 3} ry={2} fill={sombreado(colores[i % 4], noche)} opacity={0.85} transform={`rotate(${fraccion(i * 7) * 180} ${x} ${y})`} />,
      );
    }
  } else {
    cosas.push(<Rect key="g" x={0} y={HORIZONTE} width={ancho} height={ALTO_MUNDO - HORIZONTE} fill={sombreado('#A8A49A', noche)} opacity={0.9} />);
    for (let i = 0; i < ancho / 4; i += 1) {
      const x = fraccion(i * 3.1) * ancho;
      const y = HORIZONTE + 4 + fraccion(i * 7.3) * (ALTO_MUNDO - HORIZONTE - 6);
      cosas.push(<Circle key={`p${i}`} cx={x} cy={y} r={1.2 + fraccion(i) * 1.5} fill={i % 2 ? '#7E7A70' : '#D4D0C4'} opacity={0.8} />);
    }
  }
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      {cosas}
    </Svg>
  );
}

export function AdornosSombra({ ancho, adornos, momento }: { ancho: number; adornos: AdornoSombra[]; momento: Momento }) {
  // Los hongos van al pie de los troncos, en el fondo de la sombra.
  const cuales = adornos.filter((a) => a !== 'hongos');
  if (cuales.length === 0) return null;
  const noche = momento === 'noche';
  const lugares = lugaresDeAdornos(ancho, cuales.length);
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      {cuales.map((a, i) => (
        <G key={a}>{adornoSombra(a, lugares[i] + (fraccion(i + 3) - 0.5) * 40, noche)}</G>
      ))}
    </Svg>
  );
}

function adornoSombra(a: AdornoSombra, x: number, noche: boolean): ReactElement | null {
  const base = HORIZONTE + 40;
  switch (a) {
    case 'columpio':
      return columpio(x, base, noche);
    case 'farolitos':
      return farolitos(x, noche);
    case 'banca':
      return banca(x, base, noche);
    case 'bebedero':
      return bebedero(x, base, noche);
    case 'ranita':
      return ranita(x, base, noche);
    default:
      return null;
  }
}

function columpio(x: number, base: number, noche: boolean, rama = 70): ReactElement {
  const cuerda = noche ? '#8A7E68' : '#B8A47E';
  return (
    <G>
      <Line x1={x - 20} y1={rama} x2={x - 20} y2={base - 26} stroke={cuerda} strokeWidth={1.8} />
      <Line x1={x + 20} y1={rama} x2={x + 20} y2={base - 26} stroke={cuerda} strokeWidth={1.8} />
      <Rect x={x - 26} y={base - 28} width={52} height={7} rx={2} fill={sombreado(MADERA, noche)} />
      <Ellipse cx={x} cy={base + 4} rx={26} ry={4} fill="#000" opacity={0.15} />
    </G>
  );
}

function farolitos(x: number, noche: boolean): ReactElement {
  const colores = ['#E0508C', '#F2B233', '#3E9AD6', '#F26B3A'];
  return (
    <G>
      {[-54, -18, 18, 54].map((d, i) => {
        const y = 118 + (i % 2) * 22;
        const c = colores[i];
        return (
          <G key={d}>
            <Line x1={x + d} y1={70} x2={x + d} y2={y - 12} stroke="#5A4A3A" strokeWidth={1} />
            {noche && <Circle cx={x + d} cy={y} r={22} fill={c} opacity={0.25} />}
            <Ellipse cx={x + d} cy={y} rx={11} ry={13} fill={noche ? mezclar(c, '#FFF3C0', 0.45) : c} />
            <Rect x={x + d - 5} y={y - 15} width={10} height={3} fill="#3A3A3A" />
            <Rect x={x + d - 5} y={y + 12} width={10} height={3} fill="#3A3A3A" />
            {[-5, 0, 5].map((k) => (
              <Line key={k} x1={x + d + k} y1={y - 12} x2={x + d + k} y2={y + 12} stroke="#000" strokeWidth={0.6} opacity={0.15} />
            ))}
          </G>
        );
      })}
    </G>
  );
}

function ranita(x: number, base: number, noche: boolean): ReactElement {
  const barro = sombreado('#5E9A4A', noche);
  const oscuro = mezclar(barro, '#000000', 0.25);
  return (
    <G>
      <Ellipse cx={x} cy={base + 1} rx={20} ry={4} fill="#000" opacity={0.15} />
      <Ellipse cx={x} cy={base - 10} rx={16} ry={11} fill={barro} />
      <Ellipse cx={x - 12} cy={base - 3} rx={7} ry={4} fill={oscuro} />
      <Ellipse cx={x + 12} cy={base - 3} rx={7} ry={4} fill={oscuro} />
      <Circle cx={x - 7} cy={base - 21} r={5} fill={barro} />
      <Circle cx={x + 7} cy={base - 21} r={5} fill={barro} />
      <Circle cx={x - 7} cy={base - 22} r={2.2} fill="#1A1A1A" />
      <Circle cx={x + 7} cy={base - 22} r={2.2} fill="#1A1A1A" />
      <Path d={`M${x - 7} ${base - 12} Q${x} ${base - 7} ${x + 7} ${base - 12}`} stroke="#1A1A1A" strokeWidth={1.2} fill="none" />
    </G>
  );
}

// ---------------------------------------------------------------------------
// Las muestras de la pantalla de decorar
// ---------------------------------------------------------------------------

/** El dibujo de un adorno, chiquito, para su botón. */
export function MuestraAdorno({ zona, adorno, lado = 56 }: { zona: keyof Decoracion; adorno: string; lado?: number }) {
  const base = 100;
  let dibujo: ReactElement | null = null;
  if (zona === 'patio') {
    if (adorno === 'papelPicado') dibujo = <PapelPicado ancho={110} y={30} noche={false} />;
    else if (adorno === 'foquitos') dibujo = <Foquitos ancho={110} y={40} noche={false} />;
    else dibujo = adornoPatio(adorno as AdornoPatio, 50, base - 14, false);
  } else if (zona === 'casa') {
    if (adorno === 'gato') dibujo = gatito(50, base - 14);
    else if (adorno === 'jaula' || adorno === 'pinata') dibujo = <G transform="translate(0 -10)">{adornoCasa(adorno as AdornoCasa, 50, base, false)}</G>;
    else dibujo = adornoCasa(adorno as AdornoCasa, 50, base - 14, false);
  } else if (adorno === 'hongos') {
    dibujo = <G transform="translate(50 70) scale(2) translate(-50 -70)">{hongos(50, 76)}</G>;
  } else if (adorno === 'farolitos') {
    dibujo = <G transform="translate(0 -40)">{farolitos(50, false)}</G>;
  } else if (adorno === 'columpio') {
    dibujo = columpio(50, 100, false, 4);
  } else if (adorno === 'ranita') {
    dibujo = <G transform="translate(50 84) scale(1.7) translate(-50 -84)">{ranita(50, 90, false)}</G>;
  } else if (adorno === 'bebedero') {
    dibujo = bebedero(50, 96, false);
  } else {
    dibujo = banca(50, 90, false);
  }
  const vista = zona === 'sombra' && adorno === 'farolitos' ? `-35 20 170 150` : `-5 0 110 110`;
  return (
    <Svg width={lado} height={lado} viewBox={vista}>
      {dibujo}
    </Svg>
  );
}

function gatito(x: number, base: number): ReactElement {
  return (
    <G>
      <Ellipse cx={x} cy={base - 12} rx={16} ry={13} fill="#E08A3A" />
      <Circle cx={x} cy={base - 32} r={11} fill="#E08A3A" />
      <Path d={`M${x - 10} ${base - 38} l2 -10 l7 7 Z`} fill="#E08A3A" />
      <Path d={`M${x + 10} ${base - 38} l-2 -10 l-7 7 Z`} fill="#E08A3A" />
      <Circle cx={x - 4} cy={base - 33} r={1.6} fill="#2A2A2A" />
      <Circle cx={x + 4} cy={base - 33} r={1.6} fill="#2A2A2A" />
      <Path d={`M${x + 14} ${base - 8} q12 -4 8 -22`} stroke="#E08A3A" strokeWidth={4} fill="none" strokeLinecap="round" />
    </G>
  );
}

function hongos(x: number, base: number): ReactElement {
  return (
    <G>
      {[-12, 0, 12].map((d, k) => {
        const r = k === 1 ? 11 : 8;
        const y = base - (k === 1 ? 6 : 0);
        return (
          <G key={d}>
            <Rect x={x + d - 2.5} y={y - 4} width={5} height={14} rx={2.5} fill="#F1E6CF" />
            <Path d={`M${x + d - r} ${y - 2} Q${x + d} ${y - r * 1.7} ${x + d + r} ${y - 2} Z`} fill="#D2553F" />
            <Circle cx={x + d - r * 0.3} cy={y - r * 0.6} r={1.6} fill="#FFFFFF" />
          </G>
        );
      })}
    </G>
  );
}
