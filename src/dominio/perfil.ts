/**
 * Quién cuida, deducido de cómo cuida.
 *
 * Esto es lo que hace que el asistente no sea el mismo para todos. No sale de
 * un cuestionario de bienvenida — sale de treinta días de expediente, que es un
 * dato mucho más honesto que lo que uno contesta sobre sí mismo. Nadie marca
 * "riego de más" en un formulario; todo el mundo lo hace.
 *
 * Con esto el asistente puede:
 *   · Hablarle distinto a quien empieza que a quien ya tiene mano.
 *   · Adelantarse al error que ESA persona comete, no al error promedio.
 *   · Nombrar a la planta que peor la está pasando y a la que mejor va.
 *
 * Y sigue sin costar nada ni necesitar red: son cuentas sobre datos que ya
 * están en el teléfono.
 */

import type { MotivoFallo, PlantaEnRacha } from './racha';

/** Por debajo de esto no hay historia suficiente para afirmar nada. */
const DIAS_MINIMOS = 10;
/** Qué tanto tiene que inclinarse la balanza para llamarle tendencia. */
const VENTAJA_PARA_TENDENCIA = 1.5;

export type Tendencia = 'riega_de_mas' | 'riega_de_menos' | 'atinada' | 'sin_datos';
export type Experiencia = 'nueva' | 'en_camino' | 'con_mano';

export interface PlantaSenalada {
  plantaId: string;
  apodo: string;
  dias: number;
}

export interface PerfilDeCuidado {
  plantas: number;
  diasObservados: number;
  diasConSed: number;
  diasConAhogo: number;
  tendencia: Tendencia;
  experiencia: Experiencia;
  /** La que más días lleva fuera de rango, y por qué. */
  puntoDebil: (PlantaSenalada & { motivo: MotivoFallo }) | null;
  /** La que más días seguidos lleva en verde. */
  orgullo: PlantaSenalada | null;
}

export interface EntradaPerfil {
  plantas: PlantaEnRacha[];
  hoy?: Date;
  /** Cuántos días hacia atrás se miran. Un mes es suficiente para ver el hábito. */
  ventanaDias?: number;
}

// ---------------------------------------------------------------------------

export function construirPerfil({
  plantas,
  hoy = new Date(),
  ventanaDias = 30,
}: EntradaPerfil): PerfilDeCuidado {
  const limite = new Date(hoy.getTime() - ventanaDias * 86_400_000).toISOString().slice(0, 10);
  const tope = hoy.toISOString().slice(0, 10);

  const fechas = new Set<string>();
  let sed = 0;
  let ahogo = 0;
  let peor: (PlantaSenalada & { motivo: MotivoFallo }) | null = null;
  let mejor: PlantaSenalada | null = null;

  for (const planta of plantas) {
    let diasSed = 0;
    let diasAhogo = 0;
    let verdeSeguidos = 0;
    let mejorVerde = 0;

    for (const estado of planta.estados) {
      if (estado.esPronostico || estado.fecha < limite || estado.fecha > tope) continue;
      fechas.add(estado.fecha);

      if (estado.nivel === 'critico') {
        diasSed += 1;
        verdeSeguidos = 0;
      } else if (estado.nivel === 'encharcado') {
        diasAhogo += 1;
        verdeSeguidos = 0;
      } else {
        verdeSeguidos += 1;
        if (verdeSeguidos > mejorVerde) mejorVerde = verdeSeguidos;
      }
    }

    sed += diasSed;
    ahogo += diasAhogo;

    const suMotivo: MotivoFallo = diasAhogo >= diasSed ? 'ahogo' : 'sed';
    const susDias = Math.max(diasAhogo, diasSed);
    if (susDias > 0 && (peor === null || susDias > peor.dias)) {
      peor = { plantaId: planta.id, apodo: planta.apodo, motivo: suMotivo, dias: susDias };
    }
    if (mejorVerde > 0 && (mejor === null || mejorVerde > mejor.dias)) {
      mejor = { plantaId: planta.id, apodo: planta.apodo, dias: mejorVerde };
    }
  }

  const diasObservados = fechas.size;

  return {
    plantas: plantas.length,
    diasObservados,
    diasConSed: sed,
    diasConAhogo: ahogo,
    tendencia: deducirTendencia(diasObservados, sed, ahogo),
    experiencia: deducirExperiencia(diasObservados, plantas.length, sed + ahogo),
    puntoDebil: peor,
    orgullo: mejor,
  };
}

/**
 * Se exige ventaja clara antes de etiquetar a alguien.
 *
 * Decirle "riegas de más" a quien tuvo tres días de encharcamiento y dos de
 * sequía sería inventar un patrón donde hay ruido, y encima le haría corregir
 * hacia el lado equivocado. Ante la duda, "atinada".
 */
function deducirTendencia(dias: number, sed: number, ahogo: number): Tendencia {
  if (dias < DIAS_MINIMOS) return 'sin_datos';
  if (sed === 0 && ahogo === 0) return 'atinada';
  if (ahogo > sed * VENTAJA_PARA_TENDENCIA) return 'riega_de_mas';
  if (sed > ahogo * VENTAJA_PARA_TENDENCIA) return 'riega_de_menos';
  return 'atinada';
}

/**
 * Cuánto hay que explicarle.
 *
 * No es un rango que se gane con puntos: es cuánto contexto necesita la
 * persona para que el consejo le sirva. A quien lleva tres meses sin un susto
 * no hay que volverle a explicar qué es capacidad de campo.
 */
function deducirExperiencia(dias: number, plantas: number, fallos: number): Experiencia {
  if (dias < 14 || plantas === 0) return 'nueva';
  if (dias >= 45 && fallos <= dias * 0.1) return 'con_mano';
  return 'en_camino';
}
