/**
 * MEDISINA — Modelo del gemelo digital.
 *
 * Una planta no es una foto: es una entidad con expediente. Este archivo define
 * qué se guarda (identidad, ambiente, bitácora) y qué se deriva (estado hídrico,
 * fenología). La regla que rige todo el sistema: lo derivado se calcula, nunca
 * se captura a mano.
 */

// ---------------------------------------------------------------------------
// Vocabulario compartido
// ---------------------------------------------------------------------------

/** Banda de luz. Ordenada de más a menos radiación: el orden importa para calcular compatibilidad. */
export const BANDAS_LUZ = [
  'sol_pleno',
  'semisol',
  'sombra',
  'interior_luminoso',
  'interior_bajo',
] as const;
export type BandaLuz = (typeof BANDAS_LUZ)[number];

/** Perfil hídrico. Ordenado de menos a más agua: el orden importa para compatibilidad. */
export const PERFILES_HIDRICOS = ['xerico', 'bajo', 'medio', 'alto', 'acuatico'] as const;
export type PerfilHidrico = (typeof PERFILES_HIDRICOS)[number];

/** Agrupación funcional — la mecánica de "equipos". */
export type FamiliaFuncional =
  | 'cactacea_suculenta'
  | 'arborea'
  | 'arbustiva'
  | 'herbacea'
  | 'trepadora'
  | 'acuatica'
  | 'palmera'
  | 'helecho';

export type Drenaje = 'rapido' | 'medio' | 'retentivo';

export type MaterialMaceta = 'barro' | 'plastico' | 'ceramica' | 'tela' | 'metal';

// ---------------------------------------------------------------------------
// Catálogo de especies
// ---------------------------------------------------------------------------

/** Ventana fenológica esperada, en meses del año (1 = enero). */
export interface VentanaFenologica {
  fenomeno: 'brote' | 'floracion' | 'fructificacion' | 'reposo';
  mesInicio: number;
  mesFin: number;
  /** Zonas Köppen donde aplica. Vacío = todas. */
  zonas?: string[];
}

export interface Especie {
  id: string;
  nombreCientifico: string;
  nombresComunes: string[];
  /**
   * Cómo se le dice en inglés. Mucha gente conoce su planta por el nombre de
   * internet ("dragon fruit", "snake plant") y la busca así.
   */
  nombresIngles?: string[];
  familiaFuncional: FamiliaFuncional;

  /** Bandas de luz que tolera. La primera es la óptima. */
  bandasToleradas: BandaLuz[];
  perfilHidrico: PerfilHidrico;

  /** Coeficiente de cultivo (Kc). Multiplica la ET₀ para obtener la demanda real. */
  kc: number;
  /** Agua útil que retiene su sustrato típico, en mm de lámina. */
  aguaUtilMm: number;
  /** Fracción de agotamiento a partir de la cual entra en estrés (0-1). */
  umbralEstres: number;
  /** Días seguidos por encima de capacidad de campo antes de riesgo de pudrición. */
  toleranciaEncharcamientoDias: number;

  drenajeRequerido: Drenaje;
  phMin: number;
  phMax: number;
  /** 1 = raíz discreta, 3 = invasiva (no comparte maceta). */
  agresividadRaiz: 1 | 2 | 3;

  /** Crecimiento típico en centímetros por año, con buen cuidado. */
  crecimientoCmPorAno: number;
  /** Altura a la que se estabiliza en maceta o jardín de casa. */
  alturaMaximaCm: number;

  fenologia: VentanaFenologica[];
  /** Nota corta que se muestra en la ficha. */
  nota?: string;
}

// ---------------------------------------------------------------------------
// La planta (instancia del gemelo)
// ---------------------------------------------------------------------------

export interface Ubicacion {
  exposicion: BandaLuz;
  /** Techado = no recibe lluvia. Es el matiz que una pauta rígida no puede saber. */
  techado: boolean;
  interior: boolean;
  /** Clasificación Köppen (BWh, BSh, Aw, Cwa…). Alimenta el prior geoclimático. */
  zonaClimatica?: string;
  municipio?: string;
  /** Latitud/longitud redondeadas a 2 decimales (~1 km). El prior no necesita más. */
  lat?: number;
  lon?: number;
}

/**
 * Dónde vive la raíz.
 *
 * `agua` es el esqueje en frasco o botella: no hay sustrato que se seque, así
 * que no existe el riego. Lo que sí existe es que el agua se estanque, y ese
 * es otro problema con otro remedio.
 */
export interface Contenedor {
  tipo: 'maceta' | 'suelo' | 'agua';
  volumenL?: number;
  material?: MaterialMaceta;
  /** ¿Tiene agujero de drenaje? Sin él, el exceso se queda y cuenta como encharcamiento. */
  tieneDrenaje: boolean;
}

/**
 * Lo que la persona observó al escanear.
 *
 * No es lo que el modelo calcula: es lo que sus ojos ven. Sirve para dos cosas
 * distintas y las dos importan — calibrar el dibujo a esta planta concreta, y
 * contrastarse contra el balance hídrico. Cuando el ojo y el modelo no
 * coinciden, esa discrepancia es información, no ruido.
 */
export interface MedidasObservadas {
  /** Altura aproximada en centímetros. */
  alturaCm?: number;
  /** Cuántas hojas, tallos o brazos se le ven. */
  elementos?: number;
  /** Daño visible al momento del escaneo. */
  danoVisible?: 'ninguno' | 'manchas' | 'hojas_amarillas' | 'hojas_secas' | 'plaga';
  /** ISO 8601. Las medidas envejecen: una planta crece. */
  fecha: string;
}

/**
 * Cómo se ve la planta en la foto del escaneo.
 *
 * Es lo que vuelve al gemelo SU planta y no una de catálogo: el verde exacto de
 * sus hojas, si tiene bandas o bordes de otro color, y qué tan alta es contra
 * lo ancha. Sale de mirar los píxeles (`dominio/vision.ts`).
 */
export interface AparienciaObservada {
  hoja: string;
  hojaOscura: string;
  /** El segundo color de la hoja (bandas, bordes, variegado), si se vio. */
  acento?: string;
  /** Alto entre ancho de la silueta de la planta en la foto. */
  proporcion?: number;
  /** ISO 8601. */
  fecha: string;
}

export interface Planta {
  id: string;
  apodo: string;
  especieId: string;
  /** ISO 8601. De aquí sale la edad. */
  fechaAdquisicion: string;
  ubicacion: Ubicacion;
  contenedor: Contenedor;
  fotoPortadaUri?: string;
  /** Medidas tomadas al escanear. Sin ellas, el gemelo se dibuja por edad. */
  medidas?: MedidasObservadas;
  /** Colores y proporción medidos en la foto del escaneo. */
  apariencia?: AparienciaObservada;
  creadaEn: string;
  archivada?: boolean;
}

// ---------------------------------------------------------------------------
// Bitácora — el expediente clínico
// ---------------------------------------------------------------------------

export type TipoEvento =
  | 'riego'
  | 'cambio_agua'
  | 'fertilizacion'
  | 'trasplante'
  | 'poda'
  | 'tratamiento'
  | 'observacion'
  | 'foto'
  | 'diagnostico'
  | 'brote'
  | 'floracion';

export interface Evento {
  id: string;
  plantaId: string;
  tipo: TipoEvento;
  /** ISO 8601. */
  fecha: string;
  /** Riego: mililitros aplicados. */
  cantidadMl?: number;
  nota?: string;
  fotoUri?: string;
  /** Payload libre por tipo (diagnóstico, tratamiento aplicado, etc.). */
  datos?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Diagnóstico — cascada de confianza
// ---------------------------------------------------------------------------

/**
 * Nivel de certeza de un diagnóstico. Regla dura del producto: nunca se
 * recomienda un producto químico desde un diagnóstico `preliminar`.
 */
export type NivelConfianza = 'confirmado' | 'preliminar' | 'insuficiente';

export interface Diagnostico {
  id: string;
  plantaId: string;
  fecha: string;
  /** Etiquetas del modelo de patología. Es multietiqueta: pueden coexistir. */
  hallazgos: Array<{ clave: string; nombre: string; probabilidad: number }>;
  confianza: NivelConfianza;
  /** true mientras espera reproceso contra el modelo grande en la nube. */
  enColaDeConfirmacion: boolean;
  /** Se llena cuando la comunidad o la nube corrigen el diagnóstico original. */
  correccion?: { clave: string; nombre: string; fuente: 'nube' | 'comunidad'; fecha: string };
  fotoUri?: string;
}

// ---------------------------------------------------------------------------
// Clima
// ---------------------------------------------------------------------------

export interface DiaClima {
  /** YYYY-MM-DD */
  fecha: string;
  /** Evapotranspiración de referencia FAO-56, en mm. */
  et0Mm: number;
  lluviaMm: number;
  tMaxC: number;
  tMinC: number;
  /** true si viene del pronóstico y no de la observación. */
  esPronostico: boolean;
}
