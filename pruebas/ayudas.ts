/** Constructores de datos para las pruebas del dominio. */

import type { Contenedor, DiaClima, Especie, Evento, Planta, Ubicacion } from '../src/dominio/tipos';

export const HOY = new Date('2026-06-15T12:00:00Z');

export function dia(offsetDias: number): string {
  return new Date(HOY.getTime() + offsetDias * 86_400_000).toISOString().slice(0, 10);
}

export function instante(offsetDias: number): string {
  return new Date(HOY.getTime() + offsetDias * 86_400_000).toISOString();
}

/**
 * Serie de clima sintética.
 * Por defecto: verano seco del noroeste (ET₀ alta, sin lluvia).
 */
export function serieClima(
  dias: number,
  opciones: { et0?: number; lluvia?: number; desde?: number } = {},
): DiaClima[] {
  const { et0 = 6.5, lluvia = 0, desde = -dias + 1 } = opciones;
  return Array.from({ length: dias }, (_, i) => ({
    fecha: dia(desde + i),
    et0Mm: et0,
    lluviaMm: lluvia,
    tMaxC: 38,
    tMinC: 24,
    esPronostico: desde + i > 0,
  }));
}

type SobrescribirPlanta = Partial<Omit<Planta, 'ubicacion' | 'contenedor'>> & {
  ubicacion?: Partial<Ubicacion>;
  contenedor?: Partial<Contenedor>;
};

export function planta(sobrescribir: SobrescribirPlanta = {}): Planta {
  const ubicacion: Ubicacion = {
    exposicion: 'sol_pleno',
    techado: false,
    interior: false,
    zonaClimatica: 'BSh',
    municipio: 'Culiacán',
    ...sobrescribir.ubicacion,
  };
  const contenedor: Contenedor = {
    tipo: 'maceta',
    volumenL: 4,
    material: 'plastico',
    tieneDrenaje: true,
    ...sobrescribir.contenedor,
  };
  return {
    id: 'planta-prueba',
    apodo: 'La de prueba',
    especieId: 'monstera-deliciosa',
    fechaAdquisicion: '2024-06-15',
    creadaEn: instante(-365),
    ...sobrescribir,
    ubicacion,
    contenedor,
  };
}

export function riego(diasAtras: number, ml: number): Evento {
  return {
    id: `riego-${diasAtras}`,
    plantaId: 'planta-prueba',
    tipo: 'riego',
    fecha: instante(-diasAtras),
    cantidadMl: ml,
  };
}

/** Especie genérica y editable, para no depender del catálogo real en pruebas unitarias. */
export function especie(sobrescribir: Partial<Especie> = {}): Especie {
  return {
    id: 'especie-prueba',
    nombreCientifico: 'Testus plantarum',
    nombresComunes: ['planta de prueba'],
    familiaFuncional: 'herbacea',
    bandasToleradas: ['semisol'],
    perfilHidrico: 'medio',
    kc: 0.8,
    aguaUtilMm: 30,
    umbralEstres: 0.35,
    toleranciaEncharcamientoDias: 3,
    drenajeRequerido: 'medio',
    phMin: 6,
    phMax: 7,
    agresividadRaiz: 1,
    crecimientoCmPorAno: 30,
    alturaMaximaCm: 150,
    fenologia: [],
    ...sobrescribir,
  };
}
