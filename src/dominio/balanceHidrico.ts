/**
 * Motor de balance hídrico — modelo de cubeta.
 *
 *   agua(t) = agua(t-1) + riego + lluvia_efectiva − ET₀ × Kc × factores
 *
 * Es deliberadamente simple: no pretende ser un modelo agronómico de precisión,
 * sino producir una agenda de riego que reaccione al clima real en lugar de
 * repetir "riega cada 7 días". De aquí salen tanto las alertas como las frases
 * que el gemelo digital verbaliza en primera persona.
 *
 * Todo lo que sale de aquí es puro y determinista: se puede probar sin app,
 * sin red y sin dispositivo.
 */

import type {
  Contenedor,
  DiaClima,
  Especie,
  Evento,
  MaterialMaceta,
  Planta,
  Ubicacion,
} from './tipos';

// ---------------------------------------------------------------------------
// Constantes del modelo (documentadas para que sean discutibles, no mágicas)
// ---------------------------------------------------------------------------

/** Cuánto más rápido pierde agua una maceta según su material. Base: plástico = 1. */
const FACTOR_MATERIAL: Record<MaterialMaceta, number> = {
  plastico: 1.0,
  ceramica: 1.05,
  metal: 1.15,
  barro: 1.35, // poroso: transpira por la pared
  tela: 1.5, // el que más seca
};

/** Fracción de la ET₀ que efectivamente recibe la planta según su exposición. */
const FACTOR_EXPOSICION = {
  sol_pleno: 1.0,
  semisol: 0.75,
  sombra: 0.5,
  interior_luminoso: 0.35,
  interior_bajo: 0.25,
} as const;

/** Área de suelo asumida para una planta plantada en tierra, en m². */
const AREA_SUELO_POR_DEFECTO_M2 = 0.25;

/** Volumen asumido cuando el usuario no lo capturó, en litros. */
const VOLUMEN_MACETA_POR_DEFECTO_L = 3;

/** Al regar, se repone hasta esta fracción de la capacidad (no al 100 %: deja margen a la lluvia). */
const OBJETIVO_REPOSICION = 0.9;

/** Horizonte en días que se mira hacia adelante para decidir si vale la pena esperar la lluvia. */
const HORIZONTE_LLUVIA_DIAS = 2;

/** Fracción del déficit que la lluvia pronosticada debe cubrir para aplazar el riego. */
const COBERTURA_MINIMA_LLUVIA = 0.7;

/**
 * Cada cuánto conviene renovar el agua de un esqueje en frasco.
 *
 * Pasada esa raya el agua se estanca, baja el oxígeno y la raíz se pudre — que
 * es el mismo final que el encharcamiento en maceta, por otro camino.
 */
const DIAS_ENTRE_CAMBIOS_DE_AGUA = 7;

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

/**
 * Área de evaporación en m².
 *
 * Para una maceta se estima a partir del volumen asumiendo una forma donde la
 * altura es aproximadamente igual al diámetro: V = 2πr³.
 */
export function areaEvaporacionM2(contenedor: Contenedor): number {
  // La boca de un frasco es estrecha: casi no evapora, y da igual porque el
  // balance de un esqueje no se simula (ver `simularBalance`).
  if (contenedor.tipo === 'agua') return 0.004;
  if (contenedor.tipo === 'suelo') return AREA_SUELO_POR_DEFECTO_M2;
  const litros = contenedor.volumenL ?? VOLUMEN_MACETA_POR_DEFECTO_L;
  const radioDm = Math.cbrt(litros / (2 * Math.PI)); // 1 L = 1 dm³
  const areaDm2 = Math.PI * radioDm * radioDm;
  return areaDm2 / 100; // dm² → m²
}

/** 1 litro repartido sobre 1 m² equivale a 1 mm de lámina. */
export function mlAMm(ml: number, areaM2: number): number {
  return ml / 1000 / areaM2;
}

export function mmAMl(mm: number, areaM2: number): number {
  return mm * areaM2 * 1000;
}

// ---------------------------------------------------------------------------
// Factores
// ---------------------------------------------------------------------------

/** Las macetas chicas secan más rápido por unidad de área que las grandes. */
function factorTamano(contenedor: Contenedor): number {
  if (contenedor.tipo === 'suelo') return 0.85;
  const litros = contenedor.volumenL ?? VOLUMEN_MACETA_POR_DEFECTO_L;
  const factor = 1 + (VOLUMEN_MACETA_POR_DEFECTO_L - litros) / 12;
  return Math.min(1.35, Math.max(0.8, factor));
}

function factorMaterial(contenedor: Contenedor): number {
  if (contenedor.tipo === 'suelo') return 1.0;
  return FACTOR_MATERIAL[contenedor.material ?? 'plastico'];
}

/**
 * Demanda de agua del día, en mm.
 * Es el punto donde el clima real entra al modelo.
 */
export function demandaDiaria(
  dia: DiaClima,
  especie: Especie,
  planta: Planta,
): number {
  const exposicion = FACTOR_EXPOSICION[planta.ubicacion.exposicion];
  return (
    dia.et0Mm *
    especie.kc *
    exposicion *
    factorMaterial(planta.contenedor) *
    factorTamano(planta.contenedor)
  );
}

/**
 * Lluvia que realmente llega al sustrato.
 *
 * Éste es el matiz que ninguna pauta rígida puede tener: un helecho bajo un
 * porche techado no se moja aunque caigan 30 mm.
 */
export function lluviaEfectiva(dia: DiaClima, ubicacion: Ubicacion): number {
  if (ubicacion.interior || ubicacion.techado) return 0;
  return dia.lluviaMm;
}

// ---------------------------------------------------------------------------
// Simulación
// ---------------------------------------------------------------------------

export type NivelHidrico = 'encharcado' | 'humedo' | 'optimo' | 'seco' | 'critico';

export interface EstadoHidrico {
  fecha: string;
  /** Lámina de agua disponible en el sustrato, en mm. Puede exceder la capacidad. */
  aguaDisponibleMm: number;
  /** aguaDisponible / capacidad. >1 significa por encima de capacidad de campo. */
  fraccionDisponible: number;
  demandaMm: number;
  aporteMm: number;
  diasConsecutivosEncharcado: number;
  diasConsecutivosEnEstres: number;
  nivel: NivelHidrico;
  esPronostico: boolean;
}

function clasificar(
  fraccion: number,
  umbralEstres: number,
): NivelHidrico {
  if (fraccion > 1.0) return 'encharcado';
  if (fraccion > 0.85) return 'humedo';
  if (fraccion > umbralEstres) return 'optimo';
  if (fraccion > umbralEstres / 2) return 'seco';
  return 'critico';
}

export interface EntradaSimulacion {
  planta: Planta;
  especie: Especie;
  /** Eventos de la bitácora. Sólo se usan los de tipo 'riego' y 'trasplante'. */
  eventos: Evento[];
  /** Serie diaria ordenada. Puede mezclar observación y pronóstico. */
  clima: DiaClima[];
  /** Fracción de agua al inicio de la serie. Por defecto, sustrato a capacidad. */
  fraccionInicial?: number;
}

/**
 * Corre el balance día por día sobre la serie de clima.
 * Devuelve un estado por día, en el mismo orden que `clima`.
 */
export function simularBalance(entrada: EntradaSimulacion): EstadoHidrico[] {
  const { planta, especie, eventos, clima } = entrada;
  const capacidad = especie.aguaUtilMm;
  const area = areaEvaporacionM2(planta.contenedor);

  // Un esqueje en frasco no puede secarse: la raíz está literalmente dentro del
  // agua. Simular un balance aquí daría un número sin sentido, así que se
  // declara sano y el cuidado se resuelve en `recomendarRiego`, que mira cada
  // cuándo se renovó el agua.
  if (planta.contenedor.tipo === 'agua') {
    return clima.map((dia) => ({
      fecha: dia.fecha,
      aguaDisponibleMm: capacidad,
      fraccionDisponible: 1,
      demandaMm: 0,
      aporteMm: 0,
      diasConsecutivosEncharcado: 0,
      diasConsecutivosEnEstres: 0,
      nivel: 'optimo' as const,
      esPronostico: dia.esPronostico,
    }));
  }

  // Riegos indexados por día, convertidos a lámina.
  const riegoPorDia = new Map<string, number>();
  for (const evento of eventos) {
    if (evento.tipo !== 'riego' || !evento.cantidadMl) continue;
    const dia = evento.fecha.slice(0, 10);
    riegoPorDia.set(dia, (riegoPorDia.get(dia) ?? 0) + mlAMm(evento.cantidadMl, area));
  }

  let agua = capacidad * (entrada.fraccionInicial ?? 1);
  let diasEncharcado = 0;
  let diasEnEstres = 0;

  return clima.map((dia) => {
    const demanda = demandaDiaria(dia, especie, planta);
    const aporte = (riegoPorDia.get(dia.fecha) ?? 0) + lluviaEfectiva(dia, planta.ubicacion);

    agua = agua + aporte - demanda;

    // Con drenaje, el excedente escurre y el sustrato se queda exactamente en
    // capacidad de campo: mojado, pero no encharcado. Sin drenaje el agua no
    // tiene a dónde irse, se acumula por encima de la capacidad y ahí empieza
    // el riesgo de pudrición.
    const techoSinDrenaje = capacidad * 1.6;
    agua = Math.min(agua, planta.contenedor.tieneDrenaje ? capacidad : techoSinDrenaje);
    agua = Math.max(agua, 0);

    const fraccion = agua / capacidad;
    const nivel = clasificar(fraccion, especie.umbralEstres);

    diasEncharcado = nivel === 'encharcado' ? diasEncharcado + 1 : 0;
    diasEnEstres = nivel === 'seco' || nivel === 'critico' ? diasEnEstres + 1 : 0;

    return {
      fecha: dia.fecha,
      aguaDisponibleMm: redondear(agua, 2),
      fraccionDisponible: redondear(fraccion, 3),
      demandaMm: redondear(demanda, 2),
      aporteMm: redondear(aporte, 2),
      diasConsecutivosEncharcado: diasEncharcado,
      diasConsecutivosEnEstres: diasEnEstres,
      nivel,
      esPronostico: dia.esPronostico,
    };
  });
}

// ---------------------------------------------------------------------------
// Recomendación de riego
// ---------------------------------------------------------------------------

export type AccionRiego =
  | 'regar'
  | 'no_regar'
  | 'esperar_lluvia'
  | 'suspender_riego'
  | 'cambiar_agua';

/**
 * Dato verificable que respalda la recomendación.
 *
 * Existe por dos razones: alimenta las pruebas de anclaje del LLM (§8 del
 * documento de arquitectura) y permite mostrarle al usuario *por qué* se le
 * está diciendo algo, en vez de pedirle fe.
 */
export interface Hecho {
  clave: string;
  valor: string | number | boolean;
  unidad?: string;
  origen: 'balance' | 'bitacora' | 'clima' | 'catalogo' | 'sensor';
}

export interface Recomendacion {
  accion: AccionRiego;
  urgencia: 'ninguna' | 'baja' | 'media' | 'alta';
  mlSugeridos: number;
  /** Frase corta y legible. Siempre incluye el dato que la justifica. */
  motivo: string;
  hechos: Hecho[];
}

export interface EntradaRecomendacion {
  planta: Planta;
  especie: Especie;
  /** Estado de hoy (último día observado). */
  estadoHoy: EstadoHidrico;
  /** Días de pronóstico a partir de mañana. */
  pronostico: DiaClima[];
  /** Fecha del último riego registrado, si existe. */
  ultimoRiego?: string;
  /** Días desde el último cambio de agua. Sólo aplica a esquejes en frasco. */
  diasDesdeCambioAgua?: number | null;
}

export function recomendarRiego(entrada: EntradaRecomendacion): Recomendacion {
  const { planta, especie, estadoHoy, pronostico } = entrada;
  const area = areaEvaporacionM2(planta.contenedor);
  const capacidad = especie.aguaUtilMm;

  const deficitMm = Math.max(0, capacidad * OBJETIVO_REPOSICION - estadoHoy.aguaDisponibleMm);
  const mlParaReponer = Math.round(mmAMl(deficitMm, area));

  const hechos: Hecho[] = [
    { clave: 'humedad_sustrato', valor: estadoHoy.fraccionDisponible, origen: 'balance' },
    { clave: 'nivel', valor: estadoHoy.nivel, origen: 'balance' },
    { clave: 'exposicion', valor: planta.ubicacion.exposicion, origen: 'catalogo' },
    { clave: 'techado', valor: planta.ubicacion.techado, origen: 'catalogo' },
  ];
  if (entrada.ultimoRiego) {
    hechos.push({ clave: 'ultimo_riego', valor: entrada.ultimoRiego, origen: 'bitacora' });
  }

  // 0. En agua no se riega. Se renueva.
  if (planta.contenedor.tipo === 'agua') {
    const dias = entrada.diasDesdeCambioAgua;

    if (dias === null || dias === undefined) {
      return {
        accion: 'cambiar_agua',
        urgencia: 'baja',
        mlSugeridos: 0,
        motivo: 'Todavía no registras ningún cambio de agua. Renuévala y empezamos a contar.',
        hechos,
      };
    }

    hechos.push({
      clave: 'dias_desde_cambio_agua',
      valor: dias,
      unidad: 'días',
      origen: 'bitacora',
    });

    if (dias >= DIAS_ENTRE_CAMBIOS_DE_AGUA) {
      return {
        accion: 'cambiar_agua',
        urgencia: dias >= DIAS_ENTRE_CAMBIOS_DE_AGUA * 2 ? 'alta' : 'media',
        mlSugeridos: 0,
        motivo: `El agua lleva ${dias} días sin renovarse. Cámbiala y enjuaga la raíz.`,
        hechos,
      };
    }

    return {
      accion: 'no_regar',
      urgencia: 'ninguna',
      mlSugeridos: 0,
      motivo: `Le cambiaste el agua hace ${dias} ${dias === 1 ? 'día' : 'días'}. Todavía aguanta.`,
      hechos,
    };
  }

  // 1. Encharcamiento sostenido: riesgo de pudrición de raíz. Manda sobre todo lo demás.
  if (estadoHoy.diasConsecutivosEncharcado > especie.toleranciaEncharcamientoDias) {
    hechos.push({
      clave: 'dias_encharcado',
      valor: estadoHoy.diasConsecutivosEncharcado,
      unidad: 'días',
      origen: 'balance',
    });
    return {
      accion: 'suspender_riego',
      urgencia: 'alta',
      mlSugeridos: 0,
      motivo: `El sustrato lleva ${estadoHoy.diasConsecutivosEncharcado} días por encima de capacidad y no está drenando. Riesgo de pudrición de raíz.`,
      hechos,
    };
  }

  // 2. Todavía hay agua suficiente.
  if (estadoHoy.fraccionDisponible > especie.umbralEstres) {
    return {
      accion: 'no_regar',
      urgencia: 'ninguna',
      mlSugeridos: 0,
      motivo: `El sustrato está al ${Math.round(estadoHoy.fraccionDisponible * 100)} % de su capacidad útil. Todavía no lo necesita.`,
      hechos,
    };
  }

  // 3. Hay déficit. ¿Vale la pena esperar la lluvia?
  const ventana = pronostico.slice(0, HORIZONTE_LLUVIA_DIAS);
  const lluviaPrevistaMm = ventana.reduce(
    (suma, dia) => suma + lluviaEfectiva(dia, planta.ubicacion),
    0,
  );

  if (deficitMm > 0 && lluviaPrevistaMm >= deficitMm * COBERTURA_MINIMA_LLUVIA) {
    hechos.push(
      { clave: 'lluvia_prevista', valor: redondear(lluviaPrevistaMm, 1), unidad: 'mm', origen: 'clima' },
      { clave: 'deficit', valor: redondear(deficitMm, 1), unidad: 'mm', origen: 'balance' },
    );
    return {
      accion: 'esperar_lluvia',
      urgencia: 'baja',
      mlSugeridos: 0,
      motivo: `No la riegues: se esperan ${lluviaPrevistaMm.toFixed(0)} mm de lluvia en los próximos ${HORIZONTE_LLUVIA_DIAS} días y está a la intemperie.`,
      hechos,
    };
  }

  // 4. Regar.
  const urgencia = estadoHoy.nivel === 'critico' ? 'alta' : 'media';
  hechos.push({ clave: 'deficit', valor: redondear(deficitMm, 1), unidad: 'mm', origen: 'balance' });
  if (planta.ubicacion.techado && lluviaPrevistaMm === 0) {
    hechos.push({ clave: 'lluvia_no_le_llega', valor: true, origen: 'clima' });
  }

  const notaTechado =
    planta.ubicacion.techado && ventana.some((d) => d.lluviaMm > 0)
      ? ' Aunque llueva, está techada y no le llega.'
      : '';

  return {
    accion: 'regar',
    urgencia,
    mlSugeridos: mlParaReponer,
    motivo: `El sustrato bajó al ${Math.round(estadoHoy.fraccionDisponible * 100)} % de su capacidad útil.${notaTechado}`,
    hechos,
  };
}

// ---------------------------------------------------------------------------

function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}
