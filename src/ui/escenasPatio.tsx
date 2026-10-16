/**
 * Los fondos de las tres escenas: el patio, la casa y la sombra.
 *
 * Antes todas las plantas vivían en un solo patio, con la casa como una
 * franjita a la izquierda. Pero una planta de interior no "vive en el patio":
 * vive en la sala, junto a una ventana. Y las de sombra viven bajo un árbol.
 * Separarlas en tres escenas hace que cada una se vea donde de verdad está, y
 * que la luz de cada lugar se note: el sol que entra por la ventana, la sombra
 * a manchas bajo la copa.
 *
 * La hora manda en las tres. De día entra el sol; al atardecer todo se entibia;
 * de noche se prenden las lámparas de la casa y en la sombra salen las
 * luciérnagas.
 */

import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CORTINAS, DECORACION_INICIAL, PAREDES, TAPETES } from '../dominio/decoracion';
import type { Decoracion } from '../dominio/decoracion';
import { mezclar } from '../dominio/forma';
import type { Zona } from '../dominio/lugares';
import { ALTO_MUNDO, CAMINO, HORIZONTE, SUELO_FONDO, astro } from './mundoPatio';
import type { Momento } from './mundoPatio';

export type Escena = Zona;

/** El piso de la casa empieza aquí: el muro llega hasta este renglón. */
export const PISO_CASA = HORIZONTE + 46;

const CIELO_VENTANA: Record<Momento, [string, string]> = {
  amanecer: ['#8FB5E0', '#FAD1A8'],
  dia: ['#62B8EE', '#D2EFFB'],
  atardecer: ['#565A9E', '#F4A064'],
  noche: ['#0B1530', '#233562'],
};

function fraccion(n: number): number {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// La casa por dentro
// ---------------------------------------------------------------------------

/** Dónde van las ventanas de la casa: las usan el fondo, el gato y el polvo. */
export function ventanasCasa(ancho: number): number[] {
  const ventanas: number[] = [];
  for (let x = 50; x + 120 < ancho; x += 250) ventanas.push(x);
  return ventanas;
}

/** El color del muro a esta hora: el que escogieron, entibiado o apagado según la luz. */
function colorDeMuro(base: string, momento: Momento): string {
  if (momento === 'amanecer') return mezclar(base, '#F4C9A0', 0.14);
  if (momento === 'atardecer') return mezclar(base, '#E0A070', 0.2);
  if (momento === 'noche') return mezclar(base, '#1E1A2E', 0.62);
  return base;
}

export function FondoCasa({
  ancho,
  momento,
  casa = DECORACION_INICIAL.casa,
}: {
  ancho: number;
  momento: Momento;
  casa?: Decoracion['casa'];
}) {
  const noche = momento === 'noche';
  const muro = colorDeMuro(PAREDES.find((p) => p.valor === casa.pared)?.color ?? '#F2E6CE', momento);
  const cortina = CORTINAS.find((c) => c.valor === casa.cortina)?.color ?? '#C7704F';
  const tapete = TAPETES.find((t) => t.valor === casa.tapete)?.color ?? '#A8473A';
  const [cieloA, cieloB] = CIELO_VENTANA[momento];
  const sol = astro();
  const ventanas = ventanasCasa(ancho);
  const lamparas = ventanas.map((x) => x + 185).filter((x) => x < ancho - 30);
  const franjas: number[] = [];
  for (let x = 12; x < ancho; x += 26) franjas.push(x);
  const tablas: number[] = [];
  for (let y = PISO_CASA + 12; y < ALTO_MUNDO; y += 15) tablas.push(y);

  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      <Defs>
        <LinearGradient id="ventanaCielo" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={cieloA} />
          <Stop offset="1" stopColor={cieloB} />
        </LinearGradient>
        <RadialGradient id="luzLampara" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFE2A0" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFD27A" stopOpacity={0} />
        </RadialGradient>
        {/* El piso: más oscuro junto a la pared, más claro hacia quien mira. */}
        <LinearGradient id="pisoCasa" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={noche ? '#4E3522' : '#9A6A40'} />
          <Stop offset="1" stopColor={noche ? '#74502F' : '#C8935E'} />
        </LinearGradient>
        <LinearGradient id="sombraZoclo" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="rayoSol" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF6D0" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#FFF6D0" stopOpacity={0.08} />
        </LinearGradient>
      </Defs>

      {/* Muro con papel tapiz de rayas y moldura arriba */}
      <Rect x={0} y={0} width={ancho} height={PISO_CASA} fill={muro} />
      {franjas.map((x) => (
        <Rect key={x} x={x} y={16} width={4} height={PISO_CASA - 16} fill="#000" opacity={0.035} />
      ))}
      <Rect x={0} y={0} width={ancho} height={16} fill="#000" opacity={0.12} />
      {/* Lambrín: la mitad de abajo del muro, con tableros */}
      <Rect x={0} y={PISO_CASA - 74} width={ancho} height={68} fill="#000" opacity={0.05} />
      <Rect x={0} y={PISO_CASA - 76} width={ancho} height={4} fill="#FFFFFF" opacity={0.35} />
      {franjas
        .filter((_, i) => i % 3 === 0)
        .map((x) => (
          <Rect key={`t${x}`} x={x + 6} y={PISO_CASA - 64} width={66} height={48} rx={3} fill="none" stroke="#000" strokeWidth={1.2} opacity={0.07} />
        ))}

      {/* Ventanas: se ve el cielo de la hora real */}
      {ventanas.map((x, i) => (
        <G key={x}>
          <Rect x={x} y={52} width={120} height={120} rx={4} fill="url(#ventanaCielo)" />
          {i === 0 &&
            (sol.esSol ? (
              <Circle cx={x + 20 + sol.x * 80} cy={62 + sol.y * 90} r={11} fill={momento === 'atardecer' ? '#FFB35C' : '#FFE27A'} />
            ) : (
              <G>
                <Circle cx={x + 80} cy={82} r={9} fill="#F1EBD2" />
                <Circle cx={x + 84} cy={79} r={8} fill={cieloA} />
              </G>
            ))}
          {noche &&
            [0, 1, 2, 3, 4].map((k) => (
              <Circle key={k} cx={x + 10 + fraccion(k * 3.1 + i) * 100} cy={60 + fraccion(k * 7.7 + i) * 90} r={1} fill="#fff" opacity={0.8} />
            ))}
          {/* Marco y cruceta */}
          <Rect x={x} y={52} width={120} height={120} rx={4} fill="none" stroke="#FFFFFF" strokeWidth={6} />
          <Rect x={x + 57} y={52} width={6} height={120} fill="#FFFFFF" />
          <Rect x={x} y={109} width={120} height={6} fill="#FFFFFF" />
          <Rect x={x - 10} y={172} width={140} height={8} rx={2} fill="#C9A77A" />
          {/* Cortinas */}
          <Path d={`M${x - 22} 44 L${x + 4} 44 Q${x - 2} 120 ${x + 8} 196 L${x - 22} 196 Z`} fill={cortina} opacity={0.85} />
          <Path d={`M${x + 142} 44 L${x + 116} 44 Q${x + 122} 120 ${x + 112} 196 L${x + 142} 196 Z`} fill={cortina} opacity={0.85} />
          <Rect x={x - 28} y={40} width={176} height={6} rx={3} fill="#6B4A2F" />
          {/* De día, el sol entra por la ventana y cae al piso */}
          {!noche && (
            <G>
              <Path
                d={`M${x} 172 L${x + 120} 172 L${x + 180} ${PISO_CASA + 70} L${x + 40} ${PISO_CASA + 70} Z`}
                fill="url(#rayoSol)"
                opacity={momento === 'atardecer' ? 0.5 : 0.7}
              />
              {/* La mancha del sol en el piso, con la cruceta de la ventana */}
              <Path
                d={`M${x + 34} ${PISO_CASA + 30} L${x + 150} ${PISO_CASA + 30} L${x + 176} ${PISO_CASA + 66} L${x + 44} ${PISO_CASA + 66} Z`}
                fill="#FFF1B8"
                opacity={momento === 'atardecer' ? 0.16 : 0.24}
              />
            </G>
          )}
        </G>
      ))}

      {/* Entre ventana y ventana: una repisa con macetitas, o un cuadro */}
      {ventanas.slice(0, -1).map((x, i) =>
        i % 2 === 1 ? (
          <G key={`c${x}`}>
            <Rect x={x + 166} y={116} width={40} height={48} rx={2} fill="#6B4A2F" />
            <Rect x={x + 171} y={121} width={30} height={38} fill={['#9CC7A4', '#E7B98C', '#A9B8DD'][i % 3]} />
            <Path d={`M${x + 171} 159 L${x + 181} 142 L${x + 189} 152 L${x + 194} 146 L${x + 201} 159 Z`} fill="#000" opacity={0.18} />
            <Circle cx={x + 194} cy={130} r={4} fill="#FFFFFF" opacity={0.6} />
          </G>
        ) : (
        <G key={`r${x}`}>
          <Rect x={x + 150} y={150} width={70} height={6} rx={2} fill="#8A6240" />
          <Rect x={x + 158} y={136} width={14} height={14} rx={2} fill="#B8683F" />
          <Circle cx={x + 165} cy={130} r={8} fill="#4F9A4A" />
          <Rect x={x + 190} y={138} width={20} height={12} rx={2} fill="#6F8FA8" />
        </G>
        ),
      )}

      {/* Zoclo, piso y tapete */}
      <Rect x={0} y={PISO_CASA - 6} width={ancho} height={6} fill="#8C6441" />
      <PisoDeCasa ancho={ancho} piso={casa.piso} noche={noche} tablas={tablas} />
      <Rect x={0} y={PISO_CASA} width={ancho} height={22} fill="url(#sombraZoclo)" />
      {casa.tapete === 'sarape' ? (
        <G opacity={0.75}>
          {['#E0508C', '#F2B233', '#3E9AD6', '#7BC043', '#F26B3A', '#9B59B6', '#E0508C'].map((c, i) => (
            <Rect key={i} x={16} y={CAMINO - 14 + i * 4} width={ancho - 32} height={4} fill={c} />
          ))}
        </G>
      ) : casa.tapete !== 'ninguno' ? (
        <G>
          <Rect x={16} y={CAMINO - 14} width={ancho - 32} height={28} rx={8} fill={tapete} opacity={0.6} />
          <Rect x={24} y={CAMINO - 9} width={ancho - 48} height={18} rx={5} fill="none" stroke="#E8C98E" strokeWidth={1.5} opacity={0.6} />
        </G>
      ) : null}

      {/* De noche: la casa en penumbra y las lámparas prendidas */}
      {noche && <Rect x={0} y={0} width={ancho} height={ALTO_MUNDO} fill="#0B1024" opacity={0.28} />}
      {/* Las lámparas cuelgan siempre; de noche se prenden */}
      {lamparas.map((x) => (
        <G key={`l${x}`}>
          <Rect x={x - 1} y={0} width={2} height={70} fill="#3A2A1C" />
          <Path d={`M${x - 20} 96 L${x + 20} 96 L${x + 12} 72 L${x - 12} 72 Z`} fill={noche ? '#F2C35C' : '#D9CBB0'} />
          <Rect x={x - 20} y={95} width={40} height={2} fill="#000" opacity={0.15} />
          {noche && <Circle cx={x} cy={150} r={140} fill="url(#luzLampara)" />}
          {noche && <Ellipse cx={x} cy={PISO_CASA + 40} rx={90} ry={22} fill="#FFD98A" opacity={0.13} />}
        </G>
      ))}
    </Svg>
  );
}

/**
 * El piso de la sala: duela (el de siempre), talavera de azulejos azules,
 * barro de cuadros o cemento pulido. Siempre más oscuro junto a la pared.
 */
function PisoDeCasa({ ancho, piso, noche, tablas }: { ancho: number; piso: Decoracion['casa']['piso']; noche: boolean; tablas: number[] }) {
  const alto = ALTO_MUNDO - PISO_CASA;
  if (piso === 'duela') {
    return (
      <G>
        <Rect x={0} y={PISO_CASA} width={ancho} height={alto} fill="url(#pisoCasa)" />
        {tablas.map((y, i) => (
          <G key={y}>
            <Rect x={0} y={y} width={ancho} height={1.5} fill="#000" opacity={0.12} />
            {/* Las juntas de las duelas, cada renglón en otro lugar */}
            {Array.from({ length: Math.ceil(ancho / 140) }, (_, k) => (
              <Rect key={k} x={k * 140 + (i % 3) * 47} y={y - 13.5} width={1.5} height={13.5} fill="#000" opacity={0.08} />
            ))}
          </G>
        ))}
      </G>
    );
  }
  const apagar = (c: string) => (noche ? mezclar(c, '#1E1A2E', 0.55) : c);
  const cosas: ReactElement[] = [];
  let fondo = '#B8B6B0';
  if (piso === 'talavera') {
    fondo = '#EEF1F6';
    let fila = 0;
    for (let y = PISO_CASA; y < ALTO_MUNDO; y += 16, fila += 1) {
      for (let x = 0; x < ancho; x += 32) {
        const cx = x + 16;
        const cy = y + 8;
        cosas.push(<Rect key={`b${x}-${y}`} x={x} y={y} width={32} height={16} fill="none" stroke={apagar('#9AA6BC')} strokeWidth={0.8} />);
        cosas.push(<Path key={`d${x}-${y}`} d={`M${cx} ${cy - 6} L${cx + 10} ${cy} L${cx} ${cy + 6} L${cx - 10} ${cy} Z`} fill={apagar('#2F4FA0')} opacity={0.85} />);
        if ((x / 32 + fila) % 2 === 0) cosas.push(<Circle key={`c${x}-${y}`} cx={cx} cy={cy} r={2.4} fill={apagar('#E3A62E')} />);
      }
    }
  } else if (piso === 'barro') {
    fondo = '#C0673F';
    for (let y = PISO_CASA; y < ALTO_MUNDO; y += 18) cosas.push(<Rect key={`f${y}`} x={0} y={y} width={ancho} height={1.6} fill="#7A3A22" opacity={0.5} />);
    for (let x = 0; x < ancho; x += 36) cosas.push(<Rect key={`c${x}`} x={x} y={PISO_CASA} width={1.6} height={alto} fill="#7A3A22" opacity={0.4} />);
  } else {
    fondo = '#B8B6B0';
    for (let x = 40; x < ancho; x += 220) {
      cosas.push(<Ellipse key={`r${x}`} cx={x} cy={PISO_CASA + 60} rx={70} ry={10} fill="#FFFFFF" opacity={0.12} />);
    }
  }
  return (
    <G>
      <Rect x={0} y={PISO_CASA} width={ancho} height={alto} fill={apagar(fondo)} />
      {cosas}
      <Rect x={0} y={PISO_CASA} width={ancho} height={alto} fill="#000" opacity={0.06} />
    </G>
  );
}

// ---------------------------------------------------------------------------
// Bajo los árboles
// ---------------------------------------------------------------------------

/** Las manchas de sol en el piso de la sombra: el fondo y los destellos. */
function manchasSombra(ancho: number): number[] {
  const manchas: number[] = [];
  for (let x = 20; x < ancho; x += 70) manchas.push(x + fraccion(x * 0.9) * 30);
  return manchas;
}

export function FondoSombra({ ancho, momento, hongos = true }: { ancho: number; momento: Momento; hongos?: boolean }) {
  const noche = momento === 'noche';
  const hojas = noche ? ['#132A1C', '#1A3524', '#0F2216'] : ['#2F6B3A', '#3C7F45', '#245A30'];
  const troncos: number[] = [];
  for (let x = 30; x < ancho; x += 290) troncos.push(x + fraccion(x) * 40);
  const copa: Array<{ x: number; y: number; r: number; c: string }> = [];
  for (let x = -20; x < ancho + 40; x += 38) {
    copa.push({ x, y: 20 + fraccion(x * 0.3) * 60, r: 48 + fraccion(x * 0.7) * 30, c: hojas[Math.floor(fraccion(x) * 3)] });
    copa.push({ x: x + 19, y: 90 + fraccion(x * 1.3) * 50, r: 30 + fraccion(x * 1.9) * 22, c: hojas[Math.floor(fraccion(x * 2) * 3)] });
  }
  const manchas = manchasSombra(ancho);
  const helechos: number[] = [];
  for (let x = 60; x < ancho; x += 150) helechos.push(x + fraccion(x * 2.3) * 60);
  // Rayos de sol entre las copas, bejucos colgando y hongos al pie de los troncos.
  const rayos: number[] = [];
  for (let x = 110; x < ancho; x += 230) rayos.push(x + fraccion(x * 0.37) * 50);
  const bejucos: Array<{ x: number; y: number; largo: number }> = [];
  for (let x = 40; x < ancho; x += 95) bejucos.push({ x: x + fraccion(x * 1.7) * 40, y: 110 + fraccion(x * 0.9) * 40, largo: 40 + fraccion(x * 3.3) * 70 });
  const piedras: number[] = [];
  for (let x = 90; x < ancho; x += 210) piedras.push(x + fraccion(x * 4.1) * 70);

  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }} width={ancho} height={ALTO_MUNDO}>
      <Defs>
        <LinearGradient id="rayoCopa" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF4C2" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#FFF4C2" stopOpacity={0} />
        </LinearGradient>
        <RadialGradient id="brilloHongo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#B8FFE0" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#B8FFE0" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Sombra general sobre el pasto */}
      <Rect x={0} y={HORIZONTE} width={ancho} height={ALTO_MUNDO - HORIZONTE} fill="#0A2414" opacity={noche ? 0.35 : 0.22} />

      {/* Helechos al fondo, sobre el horizonte */}
      {helechos.map((x) => (
        <G key={`h${x}`} opacity={noche ? 0.6 : 0.9}>
          {[-2, -1, 0, 1, 2].map((k) => (
            <Path
              key={k}
              d={`M${x} ${HORIZONTE + 12} Q${x + k * 14} ${HORIZONTE - 22} ${x + k * 26} ${HORIZONTE - 8}`}
              stroke={noche ? '#1E3A26' : '#4E8A45'}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </G>
      ))}

      {/* Musgo y piedras en el suelo */}
      {piedras.map((x, i) => (
        <G key={`p${x}`}>
          <Ellipse cx={x} cy={HORIZONTE + 50 + (i % 2) * 70} rx={34} ry={9} fill={noche ? '#0E2416' : '#2D6B37'} opacity={0.55} />
          <Ellipse cx={x + 8} cy={HORIZONTE + 46 + (i % 2) * 70} rx={11} ry={7} fill={noche ? '#3A4040' : '#8D9490'} />
          <Ellipse cx={x + 5} cy={HORIZONTE + 43 + (i % 2) * 70} rx={5} ry={2.5} fill="#FFFFFF" opacity={noche ? 0.08 : 0.25} />
          <Ellipse cx={x - 10} cy={HORIZONTE + 48 + (i % 2) * 70} rx={7} ry={5} fill={noche ? '#343A3A' : '#7B837F'} />
        </G>
      ))}

      {/* Troncos */}
      {troncos.map((x) => (
        <G key={`t${x}`}>
          <Path d={`M${x - 20} ${HORIZONTE + 30} Q${x - 12} ${HORIZONTE - 60} ${x - 10} 60 L${x + 14} 60 Q${x + 14} ${HORIZONTE - 60} ${x + 24} ${HORIZONTE + 30} Z`} fill={noche ? '#2A1E14' : '#5A3E28'} />
          <Path d={`M${x - 2} 120 Q${x + 2} 160 ${x - 3} 210`} stroke="#000" strokeWidth={2} opacity={0.18} fill="none" />
          <Path d={`M${x + 8} 90 Q${x + 40} 70 ${x + 70} 40`} stroke={noche ? '#2A1E14' : '#5A3E28'} strokeWidth={9} fill="none" strokeLinecap="round" />
          <Path d={`M${x - 6} 110 Q${x - 40} 90 ${x - 64} 70`} stroke={noche ? '#2A1E14' : '#5A3E28'} strokeWidth={7} fill="none" strokeLinecap="round" />
          {/* Raíces que asoman */}
          <Path d={`M${x - 20} ${HORIZONTE + 30} Q${x - 34} ${HORIZONTE + 34} ${x - 42} ${HORIZONTE + 40}`} stroke={noche ? '#2A1E14' : '#5A3E28'} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Path d={`M${x + 24} ${HORIZONTE + 30} Q${x + 38} ${HORIZONTE + 33} ${x + 48} ${HORIZONTE + 38}`} stroke={noche ? '#2A1E14' : '#5A3E28'} strokeWidth={4} fill="none" strokeLinecap="round" />
          {/* Hongos al pie; de noche brillan un poco */}
          {hongos && noche && <Circle cx={x + 34} cy={HORIZONTE + 30} r={22} fill="url(#brilloHongo)" />}
          {(hongos ? [0, 1, 2] : []).map((k) => {
            const hx = x + 26 + k * 9;
            const hy = HORIZONTE + 34 - (k === 1 ? 5 : 0);
            const r = k === 1 ? 6 : 4.5;
            return (
              <G key={k}>
                <Rect x={hx - 1.5} y={hy - 2} width={3} height={7} rx={1.5} fill="#F1E6CF" />
                <Path d={`M${hx - r} ${hy - 1} Q${hx} ${hy - r * 1.6} ${hx + r} ${hy - 1} Z`} fill={noche ? '#7FE3B8' : '#D2553F'} />
                {!noche && <Circle cx={hx - r * 0.3} cy={hy - r * 0.55} r={1} fill="#FFFFFF" />}
              </G>
            );
          })}
        </G>
      ))}

      {/* La copa: cubre el cielo, con huecos */}
      {copa.map((h, i) => (
        <Circle key={i} cx={h.x} cy={h.y} r={h.r} fill={h.c} />
      ))}
      {!noche &&
        copa
          .filter((_, i) => i % 5 === 0)
          .map((h, i) => <Circle key={`b${i}`} cx={h.x - h.r * 0.3} cy={h.y - h.r * 0.35} r={h.r * 0.35} fill="#FFFFFF" opacity={0.07} />)}

      {/* Bejucos que cuelgan de la copa */}
      {bejucos.map((b, i) => (
        <G key={`b${i}`} opacity={noche ? 0.7 : 1}>
          <Path d={`M${b.x} ${b.y} Q${b.x + 6} ${b.y + b.largo * 0.5} ${b.x - 2} ${b.y + b.largo}`} stroke={noche ? '#1B3A24' : '#3F7A3A'} strokeWidth={2} fill="none" />
          {Array.from({ length: Math.floor(b.largo / 14) }, (_, k) => (
            <Ellipse
              key={k}
              cx={b.x + (k % 2 ? 4 : -3) + Math.sin(k) * 2}
              cy={b.y + 10 + k * 14}
              rx={4.5}
              ry={2.6}
              fill={noche ? '#1E4029' : k % 2 ? '#4E9A45' : '#5FAE52'}
              transform={`rotate(${k % 2 ? 30 : -30} ${b.x + (k % 2 ? 4 : -3)} ${b.y + 10 + k * 14})`}
            />
          ))}
        </G>
      ))}

      {/* Rayos de sol entre las copas */}
      {!noche &&
        rayos.map((x) => (
          <Path
            key={`r${x}`}
            d={`M${x} 90 L${x + 26} 90 L${x + 120} ${HORIZONTE + 70} L${x + 40} ${HORIZONTE + 70} Z`}
            fill="url(#rayoCopa)"
            opacity={momento === 'atardecer' ? 0.7 : 1}
          />
        ))}

      {/* Luz que se cuela entre las hojas */}
      {!noche &&
        manchas.map((x, i) => (
          <Ellipse key={`m${x}`} cx={x} cy={HORIZONTE + 30 + (i % 3) * 30} rx={20 + (i % 4) * 6} ry={6 + (i % 3) * 2} fill="#FFF1B8" opacity={momento === 'atardecer' ? 0.1 : 0.16} />
        ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// La noche y las luciérnagas
// ---------------------------------------------------------------------------

/** Velo de la hora sobre el suelo: azul de noche, tibio al atardecer. */
export function VeloDeHora({ ancho, momento }: { ancho: number; momento: Momento }) {
  if (momento === 'dia') return null;
  const color = { amanecer: '#FF9A6A', atardecer: '#FF7A3A', noche: '#0A1230' }[momento];
  const opacidad = { amanecer: 0.08, atardecer: 0.12, noche: 0.34 }[momento];
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: ALTO_MUNDO, backgroundColor: color, opacity: opacidad }}
    />
  );
}

/**
 * Luciérnagas: seis puntitos que suben y bajan despacio. Sólo de noche, sólo
 * afuera, y nada con "reducir movimiento".
 */
export function Luciernagas({ ancho }: { ancho: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t]);
  const n = Math.max(6, Math.round(ancho / 90));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: ALTO_MUNDO }}>
      {Array.from({ length: n }, (_, i) => (
        <Luciernaga key={i} t={t} x={fraccion(i * 5.3) * ancho} y={HORIZONTE - 20 + fraccion(i * 9.1) * 100} fase={fraccion(i * 2.7)} />
      ))}
    </View>
  );
}

function Luciernaga({ t, x, y, fase }: { t: SharedValue<number>; x: number; y: number; fase: number }) {
  const estilo = useAnimatedStyle(() => {
    const u = (t.get() + fase) % 1;
    const a = u * Math.PI * 2;
    return {
      opacity: 0.35 + 0.65 * Math.abs(Math.sin(a * 2)),
      transform: [{ translateX: x + Math.sin(a) * 14 }, { translateY: y + Math.cos(a * 1.3) * 10 }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: '#F6F09A',
          shadowColor: '#F6F09A',
          shadowOpacity: 0.9,
          shadowRadius: 5,
        },
        estilo,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// La vida de cada escena
// ---------------------------------------------------------------------------

/**
 * La casa por dentro: un gato en la primera ventana y, de día, polvo flotando
 * en el rayo de sol. Lo que hace que un cuarto se sienta habitado.
 */
export function VidaCasa({ ancho, momento, reducido, gato = true }: { ancho: number; momento: Momento; reducido: boolean; gato?: boolean }) {
  const ventanas = ventanasCasa(ancho);
  if (ventanas.length === 0) return null;
  const noche = momento === 'noche';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: ALTO_MUNDO }}>
      {!noche && !reducido && ventanas.slice(0, 3).map((x) => <MotasDePolvo key={x} x={x} />)}
      {gato && <Gato x={ventanas[0] + 78} y={173} noche={noche} reducido={reducido} />}
    </View>
  );
}

/** Sentado en el alféizar: de día mira, de noche duerme. La cola se mece. */
function Gato({ x, y, noche, reducido }: { x: number; y: number; noche: boolean; reducido: boolean }) {
  const cola = useSharedValue(0);
  useEffect(() => {
    if (reducido) return;
    const d = noche ? 2800 : 1400;
    cola.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: d, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: d, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(cola);
  }, [cola, noche, reducido]);
  const estiloCola = useAnimatedStyle(() => ({ transform: [{ rotate: `${cola.get() * (noche ? 5 : 16)}deg` }] }));
  // De noche el cuarto está en penumbra: el gato también.
  const pelo = noche ? '#8E5A2E' : '#E08A3C';
  const raya = noche ? '#6A3F1C' : '#B8621E';
  const pecho = noche ? '#B39474' : '#F6D7A8';
  return (
    <>
      <Animated.View
        style={[{ position: 'absolute', left: x + 25, top: y - 5, width: 14, height: 32, transformOrigin: 'top left' }, estiloCola]}
      >
        <Svg width={14} height={32}>
          <Path d="M3 2 Q11 12 6 21 Q3 27 9 30" stroke={pelo} strokeWidth={4.2} fill="none" strokeLinecap="round" />
          <Path d="M7.6 26.5 Q5.6 28.5 9 30" stroke={raya} strokeWidth={4.2} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Svg width={36} height={42} style={{ position: 'absolute', left: x, top: y - 42 }}>
        <Path d="M18 42 C5 42 4 26 10 19 L26 19 C32 26 31 42 18 42 Z" fill={pelo} />
        <Ellipse cx={18} cy={32} rx={5.5} ry={8} fill={pecho} />
        <Path d="M9.5 9 L9 0.5 L16 5 Z" fill={pelo} />
        <Path d="M26.5 9 L27 0.5 L20 5 Z" fill={pelo} />
        <Path d="M10.6 6.5 L10.4 3 L13.4 5 Z" fill="#E9A6A0" />
        <Path d="M25.4 6.5 L25.6 3 L22.6 5 Z" fill="#E9A6A0" />
        <Circle cx={18} cy={14} r={10} fill={pelo} />
        <Path d="M15 5.5 L15.6 9 M18 5 L18 9 M21 5.5 L20.4 9" stroke={raya} strokeWidth={1.3} strokeLinecap="round" />
        <Ellipse cx={18} cy={18.5} rx={4.2} ry={3} fill={pecho} />
        {noche ? (
          <>
            <Path d="M11.8 14 Q14 15.8 16.2 14" stroke="#3A2A1C" strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <Path d="M19.8 14 Q22 15.8 24.2 14" stroke="#3A2A1C" strokeWidth={1.2} fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <Ellipse cx={14} cy={13.6} rx={1.9} ry={2.5} fill="#2F3A1C" />
            <Ellipse cx={22} cy={13.6} rx={1.9} ry={2.5} fill="#2F3A1C" />
            <Circle cx={14.6} cy={12.8} r={0.6} fill="#FFFFFF" />
            <Circle cx={22.6} cy={12.8} r={0.6} fill="#FFFFFF" />
          </>
        )}
        <Path d="M17 17.2 L19 17.2 L18 18.5 Z" fill="#D9776E" />
        <Ellipse cx={13.5} cy={40.5} rx={3.2} ry={1.8} fill={pecho} />
        <Ellipse cx={22.5} cy={40.5} rx={3.2} ry={1.8} fill={pecho} />
      </Svg>
    </>
  );
}

/** Polvo que flota en el rayo de sol de una ventana. */
function MotasDePolvo({ x }: { x: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t]);
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <Mota key={i} t={t} x={x + 24 + fraccion(i * 4.7 + x) * 110} y={196 + fraccion(i * 2.3 + x) * 150} fase={fraccion(i * 6.1)} />
      ))}
    </>
  );
}

function Mota({ t, x, y, fase }: { t: SharedValue<number>; x: number; y: number; fase: number }) {
  const estilo = useAnimatedStyle(() => {
    const u = (t.get() + fase) % 1;
    const a = u * Math.PI * 2;
    // Sube despacio y se ladea con el rayo; aparece y se apaga.
    return {
      opacity: Math.sin(u * Math.PI) * 0.85,
      transform: [{ translateX: x + Math.sin(a * 2 + fase * 9) * 9 + (y - 172) * 0.25 }, { translateY: y - u * 46 }],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFF6D6' }, estilo]}
    />
  );
}

/** En la sombra: las manchas de sol en el piso tiemblan como cuando sopla el aire. */
export function DestellosDeLuz({ ancho, momento }: { ancho: number; momento: Momento }) {
  const manchas = manchasSombra(ancho);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: ALTO_MUNDO }}>
      {manchas.map((x, i) => (
        <Destello
          key={x}
          x={x}
          y={HORIZONTE + 30 + (i % 3) * 30}
          rx={20 + (i % 4) * 6}
          ry={6 + (i % 3) * 2}
          duracion={1800 + fraccion(x) * 1600}
          fuerza={momento === 'atardecer' ? 0.14 : 0.24}
        />
      ))}
    </View>
  );
}

function Destello({
  x,
  y,
  rx,
  ry,
  duracion,
  fuerza,
}: {
  x: number;
  y: number;
  rx: number;
  ry: number;
  duracion: number;
  fuerza: number;
}) {
  const brillo = useSharedValue(0);
  useEffect(() => {
    brillo.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: duracion, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duracion, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(brillo);
  }, [brillo, duracion]);
  const estilo = useAnimatedStyle(() => ({
    opacity: brillo.get() * fuerza,
    transform: [{ scaleY: ry / rx }, { scaleX: 0.85 + brillo.get() * 0.15 }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x - rx, top: y - rx, width: rx * 2, height: rx * 2, borderRadius: rx, backgroundColor: '#FFF1B8' },
        estilo,
      ]}
    />
  );
}

/** Hojas que se sueltan de la copa y bajan meciéndose. */
export function HojasQueCaen({ ancho, momento }: { ancho: number; momento: Momento }) {
  const colores = momento === 'atardecer' ? ['#C9A640', '#B8743A', '#9DAF4A'] : ['#8DB04A', '#6FA046', '#C2B24A'];
  const n = Math.max(3, Math.round(ancho / 140));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: ALTO_MUNDO }}>
      {Array.from({ length: n }, (_, i) => (
        <Hoja
          key={i}
          x={fraccion(i * 3.9 + 1) * ancho}
          duracion={9000 + fraccion(i * 7.3) * 6000}
          fase={fraccion(i * 2.1)}
          color={colores[i % 3]}
        />
      ))}
    </View>
  );
}

function Hoja({ x, duracion, fase, color }: { x: number; duracion: number; fase: number; color: string }) {
  const t = useSharedValue(fase);
  useEffect(() => {
    // Arranca a media caída (su fase) y luego da vueltas completas.
    t.set(
      withSequence(
        withTiming(1, { duration: duracion * (1 - fase), easing: Easing.linear }),
        withRepeat(
          withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: duracion, easing: Easing.linear })),
          -1,
          false,
        ),
      ),
    );
    return () => cancelAnimation(t);
  }, [t, duracion, fase]);
  const estilo = useAnimatedStyle(() => {
    const u = t.get();
    const a = u * Math.PI * 2;
    const opacidad = u < 0.08 ? u / 0.08 : u > 0.85 ? Math.max(0, (1 - u) / 0.15) : 1;
    return {
      opacity: opacidad,
      transform: [
        { translateX: x + Math.sin(a * 1.5 + fase * 6) * 26 + u * 34 },
        { translateY: 70 + u * (CAMINO - 60) },
        { rotate: `${Math.sin(a * 2 + fase * 4) * 60}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, estilo]}>
      <Svg width={14} height={8}>
        <Path d="M1 4 Q7 -1.5 13 4 Q7 9.5 1 4 Z" fill={color} />
        <Path d="M2 4 L12 4" stroke="#000" strokeWidth={0.6} opacity={0.2} />
      </Svg>
    </Animated.View>
  );
}

/** Dos mariposas revoloteando sobre el patio, de día y sin lluvia. */
export function Mariposas({ ancho }: { ancho: number }) {
  const aleteo = useSharedValue(0);
  useEffect(() => {
    aleteo.set(withRepeat(withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(aleteo);
  }, [aleteo]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: ALTO_MUNDO }}>
      <Mariposa
        aleteo={aleteo}
        cx={ancho * 0.3}
        cy={SUELO_FONDO - 110}
        radio={Math.min(90, ancho * 0.2)}
        duracion={17000}
        ala="#F2B134"
        borde="#8A5410"
      />
      <Mariposa
        aleteo={aleteo}
        cx={ancho * 0.72}
        cy={SUELO_FONDO - 80}
        radio={Math.min(70, ancho * 0.16)}
        duracion={22000}
        ala="#8EC3F0"
        borde="#2F5E8A"
      />
    </View>
  );
}

function Mariposa({
  aleteo,
  cx,
  cy,
  radio,
  duracion,
  ala,
  borde,
}: {
  aleteo: SharedValue<number>;
  cx: number;
  cy: number;
  radio: number;
  duracion: number;
  ala: string;
  borde: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: duracion, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t, duracion]);
  const estilo = useAnimatedStyle(() => {
    const a = t.get() * Math.PI * 2;
    return {
      transform: [
        { translateX: cx + Math.sin(a) * radio + Math.sin(a * 3) * 14 - 9 },
        { translateY: cy + Math.sin(a * 2) * 26 + Math.cos(a * 5) * 6 - 7 },
        { scaleX: 0.25 + 0.75 * aleteo.get() },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, estilo]}>
      <Svg width={18} height={15}>
        <Path d="M9 7 Q2 -1 0.8 4 Q0 9 9 8.2 Z" fill={ala} stroke={borde} strokeWidth={0.8} />
        <Path d="M9 7 Q16 -1 17.2 4 Q18 9 9 8.2 Z" fill={ala} stroke={borde} strokeWidth={0.8} />
        <Path d="M9 8.4 Q3 12.5 5 14.2 Q8 13.5 9 9 Z" fill={ala} stroke={borde} strokeWidth={0.8} />
        <Path d="M9 8.4 Q15 12.5 13 14.2 Q10 13.5 9 9 Z" fill={ala} stroke={borde} strokeWidth={0.8} />
        <Rect x={8.4} y={3.5} width={1.2} height={9} rx={0.6} fill="#3A2A1C" />
      </Svg>
    </Animated.View>
  );
}

/** Una parvada que cruza el cielo de vez en cuando. */
export function Pajaros({ ancho }: { ancho: number }) {
  const t = useSharedValue(0);
  const aleteo = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 30000, easing: Easing.linear }), -1, false));
    aleteo.set(withRepeat(withTiming(1, { duration: 240, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      cancelAnimation(t);
      cancelAnimation(aleteo);
    };
  }, [t, aleteo]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: HORIZONTE }}>
      {[
        [0, 0],
        [16, 9],
        [30, -3],
      ].map(([dx, dy], i) => (
        <Pajaro key={i} t={t} aleteo={aleteo} ancho={ancho} dx={dx} dy={dy} />
      ))}
    </View>
  );
}

function Pajaro({
  t,
  aleteo,
  ancho,
  dx,
  dy,
}: {
  t: SharedValue<number>;
  aleteo: SharedValue<number>;
  ancho: number;
  dx: number;
  dy: number;
}) {
  const estilo = useAnimatedStyle(() => {
    // Cruza en el primer 60 % de la vuelta; el resto, cielo tranquilo.
    const p = t.get() / 0.6;
    return {
      opacity: p <= 1 ? 0.8 : 0,
      transform: [
        { translateX: ancho + 30 - p * (ancho + 100) + dx },
        { translateY: 56 + dy + Math.sin(p * 9 + dx) * 4 },
        { scaleY: 0.35 + 0.65 * aleteo.get() },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, estilo]}>
      <Svg width={14} height={7}>
        <Path d="M0.5 5 Q3.5 0.5 7 4.5 Q10.5 0.5 13.5 5" stroke="#3A3A48" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
