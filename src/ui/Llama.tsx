/**
 * La llama de la racha.
 *
 * Encendida cuando hoy ya registraste algo, apagada —gris— cuando todavía no.
 * Es la señal que Duolingo hizo famosa y por eso funciona sin explicación:
 * nadie necesita que le digan que una llama gris es algo pendiente.
 *
 * Es SVG y no un emoji porque el emoji se dibuja distinto en cada teléfono, y
 * en algunos Android sale como un cuadrito.
 */

import Svg, { Path } from 'react-native-svg';

export interface LlamaProps {
  tamano?: number;
  encendida?: boolean;
}

const ENCENDIDA = { fuera: '#FF7A1A', medio: '#FFB22E', dentro: '#FFE58A' };
const APAGADA = { fuera: '#8C877C', medio: '#A7A195', dentro: '#C9C3B6' };

export function Llama({ tamano = 28, encendida = true }: LlamaProps) {
  const c = encendida ? ENCENDIDA : APAGADA;
  return (
    <Svg width={tamano} height={tamano * 1.2} viewBox="0 0 40 48">
      {/* Tres capas: la de afuera da la forma, las de adentro dan el calor. */}
      <Path
        d="M20 2 C24 12 34 16 34 30 C34 40 27 46 20 46 C13 46 6 40 6 30 C6 22 11 18 13 12 C15 17 17 19 19 19 C19 12 18 7 20 2 Z"
        fill={c.fuera}
      />
      <Path
        d="M20 16 C23 22 28 25 28 33 C28 39 24 43 20 43 C16 43 12 39 12 33 C12 28 15 25 16 21 C17 24 19 25 20 25 C20 22 19 19 20 16 Z"
        fill={c.medio}
      />
      <Path d="M20 28 C22 31 24 33 24 36 C24 39 22 41 20 41 C18 41 16 39 16 36 C16 33 18 31 20 28 Z" fill={c.dentro} />
    </Svg>
  );
}
