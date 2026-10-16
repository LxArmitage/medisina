/**
 * Fenología — "¿en qué temporada le saldrá una nueva rama u hoja?"
 *
 * Es lo que convierte la app de reactiva ("tu planta está enferma") a
 * anticipatoria ("en dos semanas debería brotar; si no brota, avísame").
 *
 * La ventana base viene del catálogo por especie y zona climática, pero se
 * corrige con el historial real de *esta* planta: si lleva dos años brotando
 * dos semanas antes que el promedio, la predicción se mueve. Eso es el
 * expediente clínico trabajando.
 */

import type { Especie, Evento, VentanaFenologica } from './tipos';

export type Fenomeno = VentanaFenologica['fenomeno'];

export interface EventoEsperado {
  fenomeno: Fenomeno;
  /** ISO YYYY-MM-DD */
  inicio: string;
  fin: string;
  diasParaInicio: number;
  enCurso: boolean;
  /** `historial` significa que la ventana se ajustó con observaciones de esta planta. */
  fuente: 'catalogo' | 'historial';
  confianza: 'alta' | 'media' | 'baja';
  /** Desplazamiento aplicado respecto al catálogo, en días. */
  ajusteDias: number;
}

const MS_POR_DIA = 86_400_000;

// ---------------------------------------------------------------------------

function aFecha(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_POR_DIA);
}

function diferenciaDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_POR_DIA);
}

/** Día del año (1-366) en UTC. */
export function diaDelAno(fecha: Date): number {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 1);
  return Math.floor((fecha.getTime() - inicio) / MS_POR_DIA) + 1;
}

/**
 * Convierte una ventana de meses a fechas concretas de un año dado.
 * Soporta ventanas que cruzan el año (mesInicio 11 → mesFin 2).
 */
function materializar(ventana: VentanaFenologica, ano: number): { inicio: Date; fin: Date } {
  const inicio = new Date(Date.UTC(ano, ventana.mesInicio - 1, 1));
  const cruzaAno = ventana.mesFin < ventana.mesInicio;
  const anoFin = cruzaAno ? ano + 1 : ano;
  // Día 0 del mes siguiente = último día del mes indicado.
  const fin = new Date(Date.UTC(anoFin, ventana.mesFin, 0));
  return { inicio, fin };
}

function aplicaEnZona(ventana: VentanaFenologica, zona?: string): boolean {
  if (!ventana.zonas || ventana.zonas.length === 0) return true;
  if (!zona) return true;
  return ventana.zonas.includes(zona);
}

// ---------------------------------------------------------------------------
// Ajuste por historial
// ---------------------------------------------------------------------------

/**
 * Cuánto se desvía esta planta del catálogo, en días.
 *
 * Se calcula con las observaciones registradas del fenómeno. Con menos de dos
 * observaciones no se ajusta nada: una sola primavera no es una tendencia.
 */
export function ajustePorHistorial(
  fenomeno: Fenomeno,
  ventana: VentanaFenologica,
  eventos: Evento[],
): { dias: number; observaciones: number } {
  const tipoEvento = fenomeno === 'floracion' ? 'floracion' : 'brote';
  const observados = eventos.filter((e) => e.tipo === tipoEvento);
  if (observados.length < 2) return { dias: 0, observaciones: observados.length };

  const desviaciones = observados.map((evento) => {
    const fecha = aFecha(evento.fecha);
    const { inicio } = materializar(ventana, fecha.getUTCFullYear());
    return diferenciaDias(fecha, inicio);
  });

  const promedio = desviaciones.reduce((s, d) => s + d, 0) / desviaciones.length;
  // Se limita el ajuste: el historial corrige, no reinventa la biología.
  const acotado = Math.max(-30, Math.min(30, Math.round(promedio)));
  return { dias: acotado, observaciones: observados.length };
}

// ---------------------------------------------------------------------------
// API principal
// ---------------------------------------------------------------------------

export interface EntradaFenologia {
  especie: Especie;
  /** Clasificación Köppen de la ubicación, si se conoce. */
  zonaClimatica?: string;
  /** Bitácora de la planta, para ajustar con su historial real. */
  eventos?: Evento[];
  /** Fecha de referencia. Por defecto, hoy. */
  hoy?: Date;
}

/**
 * Devuelve los fenómenos esperados, ordenados por cercanía.
 * Los que ya están en curso aparecen primero.
 */
export function proximosEventos(entrada: EntradaFenologia): EventoEsperado[] {
  const hoy = entrada.hoy ?? new Date();
  const eventos = entrada.eventos ?? [];
  const resultado: EventoEsperado[] = [];

  for (const ventana of entrada.especie.fenologia) {
    if (!aplicaEnZona(ventana, entrada.zonaClimatica)) continue;
    if (ventana.fenomeno === 'reposo') continue;

    const { dias: ajuste, observaciones } = ajustePorHistorial(ventana.fenomeno, ventana, eventos);

    // Se prueba este año y el siguiente, y se toma la primera ocurrencia vigente.
    for (const ano of [hoy.getUTCFullYear() - 1, hoy.getUTCFullYear(), hoy.getUTCFullYear() + 1]) {
      const base = materializar(ventana, ano);
      const inicio = sumarDias(base.inicio, ajuste);
      const fin = sumarDias(base.fin, ajuste);
      if (fin < hoy) continue;

      const enCurso = inicio <= hoy && hoy <= fin;
      resultado.push({
        fenomeno: ventana.fenomeno,
        inicio: aIso(inicio),
        fin: aIso(fin),
        diasParaInicio: Math.max(0, diferenciaDias(inicio, hoy)),
        enCurso,
        fuente: ajuste !== 0 ? 'historial' : 'catalogo',
        confianza: observaciones >= 3 ? 'alta' : observaciones >= 2 ? 'media' : 'baja',
        ajusteDias: ajuste,
      });
      break;
    }
  }

  return resultado.sort((a, b) => {
    if (a.enCurso !== b.enCurso) return a.enCurso ? -1 : 1;
    return a.diasParaInicio - b.diasParaInicio;
  });
}

// ---------------------------------------------------------------------------

export function etiquetaFenomeno(fenomeno: Fenomeno): string {
  return {
    brote: 'brotes nuevos',
    floracion: 'floración',
    fructificacion: 'fruto',
    reposo: 'reposo',
  }[fenomeno];
}

/**
 * Edad de la planta en meses de calendario.
 *
 * Se cuentan meses de calendario y no bloques de 30.44 días porque es como lo
 * lee una persona: del 15 de enero al 15 de junio son cinco meses, no cuatro.
 */
export function edadEnMeses(fechaAdquisicion: string, hoy: Date = new Date()): number {
  const desde = aFecha(fechaAdquisicion);
  const meses =
    (hoy.getUTCFullYear() - desde.getUTCFullYear()) * 12 +
    (hoy.getUTCMonth() - desde.getUTCMonth()) -
    (hoy.getUTCDate() < desde.getUTCDate() ? 1 : 0);
  return Math.max(0, meses);
}

/** "2 años y 3 meses" — para la ficha. */
export function edadLegible(fechaAdquisicion: string, hoy: Date = new Date()): string {
  const meses = edadEnMeses(fechaAdquisicion, hoy);
  if (meses < 1) return 'recién llegada';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const parteAnos = `${anos} ${anos === 1 ? 'año' : 'años'}`;
  return resto === 0 ? parteAnos : `${parteAnos} y ${resto} ${resto === 1 ? 'mes' : 'meses'}`;
}
