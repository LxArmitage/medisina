/**
 * Datos de ejemplo.
 *
 * YA NO SE SIEMBRAN SOLOS, y la razón vale la pena apuntarla: llenar la app de
 * plantas que no son tuyas arruina justo lo que la hace útil. La racha contaba
 * los descuidos de un potos inventado, el patio se veía lleno de macetas
 * ajenas, y el asistente hablaba de un helecho que nadie tiene. Un expediente
 * con datos falsos deja de ser un expediente.
 *
 * Siguen aquí por dos motivos: `limpiarEjemplos` necesita saber cuáles eran
 * para poder quitarlos de las instalaciones donde ya se sembraron, y sirven
 * para probar el motor a mano cuando hace falta.
 */

import {
  archivarPlanta,
  guardarAjuste,
  guardarPlanta,
  leerAjuste,
  listarPlantas,
  nuevoId,
  registrarEvento,
} from './db';
import type { Planta } from '../dominio/tipos';

const DIA_MS = 86_400_000;

function haceDias(dias: number): string {
  return new Date(Date.now() - dias * DIA_MS).toISOString();
}

function haceMeses(meses: number): string {
  return new Date(Date.now() - meses * 30.44 * DIA_MS).toISOString().slice(0, 10);
}

interface Plantilla {
  planta: Omit<Planta, 'id' | 'creadaEn'>;
  riegos: Array<{ diasAtras: number; ml: number }>;
}

const PLANTILLAS: Plantilla[] = [
  {
    planta: {
      apodo: 'Doña Sina',
      medidas: { fecha: haceDias(0), alturaCm: 52, elementos: 3, danoVisible: 'ninguno' },
      especieId: 'lophocereus-schottii',
      fechaAdquisicion: haceMeses(26),
      ubicacion: {
        exposicion: 'sol_pleno',
        techado: false,
        interior: false,
        zonaClimatica: 'BSh',
        municipio: 'Culiacán',
        lat: 24.81,
        lon: -107.39,
      },
      contenedor: { tipo: 'maceta', volumenL: 8, material: 'barro', tieneDrenaje: true },
    },
    riegos: [{ diasAtras: 11, ml: 700 }],
  },
  {
    planta: {
      apodo: 'El Helechón',
      medidas: { fecha: haceDias(0), alturaCm: 34, elementos: 9, danoVisible: 'hojas_secas' },
      especieId: 'nephrolepis-exaltata',
      fechaAdquisicion: haceMeses(8),
      ubicacion: {
        exposicion: 'sombra',
        // Bajo el porche: por más que llueva, no le llega una gota.
        techado: true,
        interior: false,
        zonaClimatica: 'BSh',
        municipio: 'Culiacán',
        lat: 24.81,
        lon: -107.39,
      },
      contenedor: { tipo: 'maceta', volumenL: 4, material: 'plastico', tieneDrenaje: true },
    },
    riegos: [
      { diasAtras: 6, ml: 500 },
      { diasAtras: 12, ml: 500 },
    ],
  },
  {
    planta: {
      apodo: 'El Limón del patio',
      medidas: { fecha: haceDias(0), alturaCm: 165, elementos: 11, danoVisible: 'ninguno' },
      especieId: 'citrus-limon',
      fechaAdquisicion: haceMeses(38),
      ubicacion: {
        exposicion: 'sol_pleno',
        techado: false,
        interior: false,
        zonaClimatica: 'BSh',
        municipio: 'Culiacán',
        lat: 24.81,
        lon: -107.39,
      },
      contenedor: { tipo: 'suelo', tieneDrenaje: true },
    },
    riegos: [
      { diasAtras: 4, ml: 6000 },
      { diasAtras: 9, ml: 6000 },
    ],
  },
  {
    planta: {
      apodo: 'Verdoso',
      medidas: { fecha: haceDias(0), alturaCm: 46, elementos: 7, danoVisible: 'hojas_amarillas' },
      especieId: 'epipremnum-aureum',
      fechaAdquisicion: haceMeses(14),
      ubicacion: {
        exposicion: 'interior_luminoso',
        techado: true,
        interior: true,
        zonaClimatica: 'BSh',
        municipio: 'Culiacán',
        lat: 24.81,
        lon: -107.39,
      },
      contenedor: { tipo: 'maceta', volumenL: 2, material: 'ceramica', tieneDrenaje: false },
    },
    riegos: [
      { diasAtras: 2, ml: 400 },
      { diasAtras: 5, ml: 400 },
      { diasAtras: 8, ml: 450 },
    ],
  },
  {
    planta: {
      apodo: 'La de la reja',
      medidas: { fecha: haceDias(0), alturaCm: 190, elementos: 12, danoVisible: 'ninguno' },
      especieId: 'bougainvillea-glabra',
      fechaAdquisicion: haceMeses(52),
      ubicacion: {
        exposicion: 'sol_pleno',
        techado: false,
        interior: false,
        zonaClimatica: 'BSh',
        municipio: 'Culiacán',
        lat: 24.81,
        lon: -107.39,
      },
      contenedor: { tipo: 'suelo', tieneDrenaje: true },
    },
    riegos: [{ diasAtras: 8, ml: 4000 }],
  },
  {
    // Comparte equipo con Doña Sina: mismo sol, misma sed.
    planta: {
      apodo: 'El Nopalito',
      medidas: { fecha: haceDias(0), alturaCm: 58, elementos: 4, danoVisible: 'ninguno' },
      especieId: 'opuntia-ficus-indica',
      fechaAdquisicion: haceMeses(19),
      ubicacion: {
        exposicion: 'sol_pleno',
        techado: false,
        interior: false,
        zonaClimatica: 'BSh',
        municipio: 'Culiacán',
        lat: 24.81,
        lon: -107.39,
      },
      contenedor: { tipo: 'maceta', volumenL: 10, material: 'barro', tieneDrenaje: true },
    },
    riegos: [{ diasAtras: 14, ml: 900 }],
  },
  {
    // Riega igual que Verdoso y comparte equipo con él, pero su raíz invasiva
    // hace que nunca deban compartir maceta. Es el conflicto que la pantalla
    // de equipos tiene que saber señalar.
    planta: {
      apodo: 'El Ficus de la sala',
      medidas: { fecha: haceDias(0), alturaCm: 120, elementos: 10, danoVisible: 'ninguno' },
      especieId: 'ficus-benjamina',
      fechaAdquisicion: haceMeses(30),
      ubicacion: {
        exposicion: 'interior_luminoso',
        techado: true,
        interior: true,
        zonaClimatica: 'BSh',
        municipio: 'Culiacán',
        lat: 24.81,
        lon: -107.39,
      },
      contenedor: { tipo: 'maceta', volumenL: 12, material: 'plastico', tieneDrenaje: true },
    },
    riegos: [
      { diasAtras: 3, ml: 1200 },
      { diasAtras: 10, ml: 1200 },
    ],
  },
];

/**
 * Quita las plantas de ejemplo que se sembraron en versiones anteriores.
 *
 * Se identifican por apodo Y especie a la vez, que es una combinación que
 * nadie repite por accidente. Si alguien le cambió el nombre o la especie a
 * una, se queda: pasó a ser suya, y borrar algo que la persona hizo propio
 * sería mucho peor que dejar una maceta de más.
 *
 * Corre una sola vez y deja constancia, para no andar revisando en cada
 * arranque.
 */
export async function limpiarEjemplos(): Promise<number> {
  const yaSeHizo = await leerAjuste(CLAVE_LIMPIEZA).catch(() => null);
  if (yaSeHizo === 'listo') return 0;

  const existentes = await listarPlantas();
  const sonEjemplo = new Set(
    PLANTILLAS.map((p) => `${p.planta.apodo}|${p.planta.especieId}`),
  );

  let quitadas = 0;
  for (const planta of existentes) {
    if (!sonEjemplo.has(`${planta.apodo}|${planta.especieId}`)) continue;
    await archivarPlanta(planta.id).catch(() => undefined);
    quitadas += 1;
  }

  await guardarAjuste(CLAVE_LIMPIEZA, 'listo').catch(() => undefined);
  return quitadas;
}

const CLAVE_LIMPIEZA = 'ejemplos:limpiados';

/**
 * Inserta los ejemplos. Ya no se llama al arrancar: queda para poder llenar la
 * app a mano cuando se está probando el motor.
 */
export async function sembrarEjemplos(): Promise<boolean> {
  const existentes = await listarPlantas();
  if (existentes.length > 0) return false;

  for (const plantilla of PLANTILLAS) {
    const id = nuevoId();
    await guardarPlanta({
      ...plantilla.planta,
      id,
      creadaEn: new Date().toISOString(),
    });
    for (const riego of plantilla.riegos) {
      await registrarEvento({
        id: nuevoId(),
        plantaId: id,
        tipo: 'riego',
        fecha: haceDias(riego.diasAtras),
        cantidadMl: riego.ml,
      });
    }
  }
  return true;
}
