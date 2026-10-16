/**
 * Paleta y tokens visuales.
 *
 * La identidad sale de la sina: verde cactus, arena del desierto y el rojo
 * intenso de su fruto como color de acento y de alerta.
 */

import { useColorScheme } from 'react-native';

export interface Tema {
  fondo: string;
  superficie: string;
  superficieAlta: string;
  borde: string;
  texto: string;
  textoSuave: string;
  primario: string;
  primarioSuave: string;
  acento: string;
  /** Colores por nivel hídrico. */
  encharcado: string;
  humedo: string;
  optimo: string;
  seco: string;
  critico: string;
  esOscuro: boolean;
}

const CLARO: Tema = {
  fondo: '#F7F3EA',
  superficie: '#FFFFFF',
  superficieAlta: '#F0EADC',
  borde: '#E2D9C7',
  texto: '#1C2B26',
  textoSuave: '#6B7A73',
  primario: '#0F7A54',
  primarioSuave: '#D2F0E0',
  acento: '#E03B2C',
  encharcado: '#1189C4',
  humedo: '#35B0DC',
  optimo: '#12A55F',
  seco: '#E8940C',
  critico: '#E03B2C',
  esOscuro: false,
};

const OSCURO: Tema = {
  fondo: '#12100D',
  superficie: '#1D1A16',
  superficieAlta: '#272219',
  borde: '#3A342A',
  texto: '#F2EDE2',
  textoSuave: '#A79E8D',
  primario: '#2FD98B',
  primarioSuave: '#123528',
  acento: '#FF6B5A',
  encharcado: '#3FB6EC',
  humedo: '#66CFF0',
  optimo: '#2FD98B',
  seco: '#FFB021',
  critico: '#FF6B5A',
  esOscuro: true,
};

export function useTema(): Tema {
  return useColorScheme() === 'dark' ? OSCURO : CLARO;
}

/**
 * Tipografía.
 *
 * Fraunces para los títulos: es una serif con carácter, de las que tienen
 * "wonk" — remates ligeramente torcidos que la hacen sentir orgánica en vez de
 * corporativa. Para una app de plantas eso cuenta.
 *
 * Plus Jakarta Sans para el cuerpo: geométrica pero cálida, y con una x-height
 * alta que se lee bien a 13 px en un teléfono a pleno sol.
 *
 * Nada de Inter, Roboto ni System: son las que hacen que todo se vea igual.
 */
export const fuente = {
  titulo: 'Fraunces_700Bold',
  tituloItalica: 'Fraunces_700Bold_Italic',
  cuerpo: 'PlusJakartaSans_400Regular',
  cuerpoMedio: 'PlusJakartaSans_500Medium',
  cuerpoFuerte: 'PlusJakartaSans_700Bold',
  cuerpoNegro: 'PlusJakartaSans_800ExtraBold',
} as const;

export const espacio = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radio = {
  sm: 8,
  md: 12,
  lg: 18,
  completo: 999,
} as const;

export type NivelHidricoColoreable =
  | 'encharcado'
  | 'humedo'
  | 'optimo'
  | 'seco'
  | 'critico';

export function colorDeNivel(tema: Tema, nivel: NivelHidricoColoreable): string {
  return tema[nivel];
}

export function etiquetaNivel(nivel: NivelHidricoColoreable): string {
  return {
    encharcado: 'Encharcado',
    humedo: 'Húmedo',
    optimo: 'En su punto',
    seco: 'Seco',
    critico: 'Crítico',
  }[nivel];
}
