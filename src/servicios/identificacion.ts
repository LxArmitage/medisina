/**
 * Identificación por foto — cascada de confianza (§3.1 y §3.2 del documento).
 *
 * Tres etapas, como quedó decidido:
 *   1. Portero de calidad: ¿la foto sirve?
 *   2. Modelo de especie: candidatos con probabilidad.
 *   3. Cascada: confirmado / preliminar / insuficiente.
 *
 * DOS MOTORES, Y EL PRIMERO NO NECESITA NADA.
 *   · El local (`src/ia/vision`): una red que corre dentro del teléfono, sin
 *     internet, sin llave y sin costo. Conoce las especies del catálogo y sabe
 *     decir "ésta no es ninguna de las mías".
 *   · Pl@ntNet, si la persona pegó su llave y hay señal: conoce decenas de
 *     miles de especies. Cuando contesta con seguridad, manda; si no contesta
 *     o duda, queda lo que dijo el local.
 *
 * REGLA DE HONESTIDAD: ningún motor inventa. Si el local no está seguro lo dice
 * así, con sus porcentajes, y la interfaz pide confirmar. Las cifras de qué tan
 * seguido acierta salen de un examen con fotos que el modelo nunca vio.
 */

import { guardarAjuste, leerAjuste } from '../datos/db';
import { ESPECIES, buscarEspecie } from '../dominio/catalogo';
import type { NivelConfianza } from '../dominio/tipos';
import { combinar } from '../ia/vision/cabeza';
import { veredicto } from '../ia/vision/reconocer';

// Umbrales de la cascada. Ver §3.2: el modelo del teléfono nunca es la última
// palabra, sólo una capa de triaje.
const UMBRAL_CONFIRMADO = 0.7;
const UMBRAL_PRELIMINAR = 0.35;

const LADO_MINIMO_PX = 320;

export interface Candidato {
  /** Presente sólo si la especie está en nuestro catálogo. */
  especieId?: string;
  nombreCientifico: string;
  nombreComun?: string;
  probabilidad: number;
  enCatalogo: boolean;
}

export type MotorIdentificacion = 'local' | 'plantnet' | 'sin_modelo';

export interface ResultadoIdentificacion {
  candidatos: Candidato[];
  confianza: NivelConfianza;
  motor: MotorIdentificacion;
  /** Texto que la interfaz debe mostrar tal cual. Nunca se oculta. */
  advertencia?: string;
  /** Lo más probable es que no sea ninguna del catálogo. */
  fueraDeCatalogo?: boolean;
}

/**
 * Qué parte de la planta se fotografió.
 *
 * No es un adorno del formulario: Pl@ntNet identifica MEJOR cuando se le dice
 * qué está viendo, y muchísimo mejor con varios órganos a la vez. Dos especies
 * con la hoja casi igual se separan por la flor; dos con la misma flor se
 * separan por la corteza. Mandar cinco fotos de la misma hoja no sirve de
 * nada; mandar hoja + flor + fruto cambia el resultado.
 *
 * Los nombres viajan tal cual a la API, así que no se traducen aquí.
 */
export type Organo = 'leaf' | 'flower' | 'fruit' | 'bark' | 'habit' | 'auto';

export const ORGANOS: Array<{ organo: Organo; etiqueta: string; pista: string }> = [
  { organo: 'habit', etiqueta: 'La planta entera', pista: 'De cuerpo completo, con su maceta' },
  { organo: 'leaf', etiqueta: 'Una hoja', pista: 'Plana y de cerca, con el envés si puedes' },
  { organo: 'flower', etiqueta: 'Una flor', pista: 'Abierta y de frente' },
  { organo: 'fruit', etiqueta: 'Un fruto', pista: 'Entero, y partido si lo tienes' },
  { organo: 'bark', etiqueta: 'El tallo', pista: 'La corteza o el tronco, de cerca' },
];

export interface Toma {
  uri: string;
  organo: Organo;
  ancho?: number;
  alto?: number;
}

export interface ContextoFoto {
  /** Las fotos del escaneo. Una basta; varias de órganos distintos aciertan más. */
  tomas: Toma[];
  /** Zona Köppen. Reservado para el prior geoclimático de Fase 2. */
  zonaClimatica?: string;
}

// ---------------------------------------------------------------------------
// 1. Portero de calidad
// ---------------------------------------------------------------------------

export type ResultadoPortero = { sirve: true } | { sirve: false; motivo: string };

/**
 * Rechaza antes de inferir. Hoy sólo comprueba lo que se puede comprobar sin
 * abrir los píxeles: que exista y tenga resolución suficiente.
 *
 * El portero completo de §3.1 —¿es una planta?, ¿está enfocada?, ¿bien
 * encuadrada?— es un modelo diminuto de Fase 2. No se finge aquí.
 */
export function porteroDeCalidad(foto: ContextoFoto): ResultadoPortero {
  if (foto.tomas.length === 0) {
    return { sirve: false, motivo: 'Todavía no hay ninguna foto.' };
  }
  for (const toma of foto.tomas) {
    if (!toma.uri) {
      return { sirve: false, motivo: 'No se pudo leer una de las fotos. Intenta de nuevo.' };
    }
    const lado = Math.min(toma.ancho ?? Infinity, toma.alto ?? Infinity);
    if (lado < LADO_MINIMO_PX) {
      return {
        sirve: false,
        motivo: 'Una de las fotos salió muy chica. Acércate a la planta y vuelve a tomarla.',
      };
    }
  }
  return { sirve: true };
}

/**
 * Cuántos órganos DISTINTOS se fotografiaron.
 *
 * Es la cifra que importa, no cuántas fotos hay. Tres fotos de la misma hoja
 * aportan lo mismo que una; hoja, flor y fruto aportan tres veces.
 */
export function organosDistintos(tomas: Toma[]): number {
  return new Set(tomas.filter((t) => t.organo !== 'auto').map((t) => t.organo)).size;
}

/** Qué falta por fotografiar para que el siguiente intento valga más. */
export function siguienteOrganoUtil(tomas: Toma[]): Organo | null {
  const hechos = new Set(tomas.map((t) => t.organo));
  const orden: Organo[] = ['habit', 'leaf', 'flower', 'fruit', 'bark'];
  return orden.find((o) => !hechos.has(o)) ?? null;
}

// ---------------------------------------------------------------------------
// 2 y 3. Identificación + cascada
// ---------------------------------------------------------------------------

/**
 * La llave de Pl@ntNet, que es lo que enciende el reconocimiento.
 *
 * Se lee de DOS sitios, y el orden importa. Primero la que el usuario pegó
 * dentro de la app; si no hay, la variable de entorno del build.
 *
 * Poder pegarla en la app y no sólo en un `.env` es lo que hace que el escaneo
 * se pueda encender sin recompilar ni publicar nada: se saca la llave gratis en
 * my.plantnet.org, se pega, y desde ese momento reconoce. Con la variable de
 * entorno sola, encender el reconocimiento exigía un build nuevo, que en la
 * práctica significaba que nunca se encendía.
 *
 * Se guarda en memoria porque `identificar` no puede ser asíncrono en su
 * lectura sin ensuciar todas las llamadas; `cargarLlaveGuardada` la sube al
 * arrancar y `guardarLlave` la actualiza en caliente.
 */
let llaveEnMemoria: string | undefined;

/** Dónde vive en el almacén de ajustes. */
export const CLAVE_PLANTNET = 'plantnet:llave';

export async function cargarLlaveGuardada(): Promise<void> {
  const guardada = await leerAjuste(CLAVE_PLANTNET).catch(() => null);
  if (guardada && guardada.length > 0) llaveEnMemoria = guardada;
}

export async function guardarLlave(llave: string): Promise<void> {
  const limpia = llave.trim();
  llaveEnMemoria = limpia.length > 0 ? limpia : undefined;
  await guardarAjuste(CLAVE_PLANTNET, limpia).catch(() => undefined);
}

function llaveDePlantnet(): string | undefined {
  if (llaveEnMemoria) return llaveEnMemoria;
  const llave = process.env.EXPO_PUBLIC_PLANTNET_API_KEY;
  return llave && llave.length > 0 ? llave : undefined;
}

/** Si Pl@ntNet está encendido. El reconocimiento local está siempre. */
export function hayPlantnet(): boolean {
  return llaveDePlantnet() !== undefined;
}

/**
 * Comprueba que la llave sirve, contra el servidor.
 *
 * Existe porque una llave mal pegada —con un espacio, cortada a la mitad— falla
 * exactamente igual que no tener ninguna, y sin esto la persona se entera
 * después de fotografiar una planta.
 */
export async function probarLlave(llave: string): Promise<{ sirve: boolean; motivo: string }> {
  const limpia = llave.trim();
  if (limpia.length < 8) {
    return { sirve: false, motivo: 'Esa llave se ve muy corta. Cópiala completa.' };
  }
  try {
    // Una consulta vacía: el servidor contesta 400 si la llave vale y 401 o 403
    // si no. Es la forma de comprobarla sin gastar una identificación.
    const respuesta = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(limpia)}`,
      { method: 'POST', body: new FormData() },
    );
    if (respuesta.status === 401 || respuesta.status === 403) {
      return { sirve: false, motivo: 'El servidor no reconoce esa llave.' };
    }
    if (respuesta.status === 429) {
      return { sirve: true, motivo: 'La llave sirve, pero hoy ya gastaste tus identificaciones.' };
    }
    return { sirve: true, motivo: 'Llave buena. El escaneo ya reconoce plantas.' };
  } catch {
    return { sirve: false, motivo: 'Sin conexión para comprobarla. Guárdala y prueba después.' };
  }
}

/**
 * Cómo leer una foto con el modelo local. La pantalla pasa el de
 * `visionLocal` (que ya empezó a mirar cada foto al tomarla); las pruebas
 * pueden pasar uno falso.
 */
export type LectorLocal = (uri: string) => Promise<number[] | null>;

/** Cuánto se le espera a Pl@ntNet antes de quedarse con lo del teléfono. */
const ESPERA_PLANTNET_MS = 12_000;

export async function identificar(
  foto: ContextoFoto,
  opciones: { leerLocal?: LectorLocal } = {},
): Promise<ResultadoIdentificacion> {
  const local = opciones.leerLocal ? identificarLocal(foto, opciones.leerLocal) : Promise.resolve(null);

  const llave = llaveDePlantnet();
  if (llave) {
    try {
      const candidatos = await conLimite(consultarPlantnet(foto, llave), ESPERA_PLANTNET_MS);
      const enLinea = aplicarCascada(candidatos, 'plantnet');
      // Pl@ntNet manda sólo cuando está seguro; si duda, el local suele saber
      // más de las especies del catálogo, que son las que importan aquí.
      if (enLinea.confianza !== 'insuficiente') return enLinea;
    } catch {
      // Sin señal o sin cuota: sigue el local, que no necesita ninguna de las dos.
    }
  }

  const deTelefono = await local.catch(() => null);
  if (deTelefono) return deTelefono;

  return {
    candidatos: [],
    confianza: 'insuficiente',
    motor: 'sin_modelo',
    advertencia: 'No pude leer las fotos esta vez. Dime cuál es y le abro su expediente.',
  };
}

/**
 * El modelo del teléfono sobre todas las fotos del escaneo.
 *
 * Cada foto da una probabilidad por clase y se combinan: una especie tiene que
 * ser creíble en todas para ganar. Por eso hoja + planta entera acierta más que
 * cualquiera de las dos sola.
 */
export async function identificarLocal(
  foto: ContextoFoto,
  leer: LectorLocal,
): Promise<ResultadoIdentificacion | null> {
  const lecturas = (await Promise.all(foto.tomas.map((t) => leer(t.uri).catch(() => null)))).filter(
    (p): p is number[] => Array.isArray(p) && p.length > 0,
  );
  if (lecturas.length === 0) return null;
  return resultadoLocal(combinar(lecturas));
}

/**
 * De las probabilidades del modelo local al resultado que ve la persona.
 *
 * Aparte de la cascada de siempre, aquí entra la clase "otra": si lo más
 * probable es que no sea ninguna del catálogo, se dice con esas palabras —y se
 * ofrecen igual las más parecidas, por si sí era.
 */
export function resultadoLocal(probs: number[], clases?: string[]): ResultadoIdentificacion {
  const { candidatos, otra } = veredicto(probs, clases);
  const lista: Candidato[] = candidatos.slice(0, 3).map((c) => {
    const especie = buscarEspecie(c.especieId);
    return {
      especieId: c.especieId,
      nombreCientifico: especie?.nombreCientifico ?? c.especieId,
      nombreComun: especie?.nombresComunes[0],
      probabilidad: c.probabilidad,
      enCatalogo: especie !== undefined,
    };
  });

  const mejor = lista[0];
  if (mejor && otra > mejor.probabilidad && otra >= UMBRAL_PRELIMINAR) {
    return {
      candidatos: lista,
      confianza: 'insuficiente',
      motor: 'local',
      fueraDeCatalogo: true,
      advertencia:
        'Se parece poco a las que conozco. Si es alguna de éstas, tócala; si no, búscala por nombre o elige su tipo abajo.',
    };
  }
  return aplicarCascada(lista, 'local');
}

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolver, fallar) => {
    const reloj = setTimeout(() => fallar(new Error('Se tardó demasiado (red)')), ms);
    promesa.then(
      (v) => {
        clearTimeout(reloj);
        resolver(v);
      },
      (e) => {
        clearTimeout(reloj);
        fallar(e);
      },
    );
  });
}

/**
 * Convierte probabilidades en un nivel de confianza.
 *
 * El caso importante es el de en medio: un `preliminar` se muestra como
 * hipótesis, nunca como hecho, y jamás autoriza recomendar un tratamiento
 * químico (ver la regla en `gemelo.ts`).
 */
export function aplicarCascada(
  candidatos: Candidato[],
  motor: MotorIdentificacion,
): ResultadoIdentificacion {
  const ordenados = [...candidatos].sort((a, b) => b.probabilidad - a.probabilidad);
  const mejor = ordenados[0];

  if (!mejor || mejor.probabilidad < UMBRAL_PRELIMINAR) {
    return {
      candidatos: ordenados.slice(0, 3),
      confianza: 'insuficiente',
      motor,
      advertencia:
        motor === 'local'
          ? 'No estoy seguro. Te pongo las que más se parecen; si ninguna es, búscala por nombre abajo. Otra foto de una hoja, con buena luz, me ayuda a atinarle.'
          : 'No me alcanza para decidir. Prueba con una foto de una hoja sola, con buena luz y fondo liso.',
    };
  }

  if (mejor.probabilidad >= UMBRAL_CONFIRMADO) {
    return { candidatos: ordenados.slice(0, 3), confianza: 'confirmado', motor };
  }

  return {
    candidatos: ordenados.slice(0, 3),
    confianza: 'preliminar',
    motor,
    advertencia: 'No estoy seguro del todo. Confirma si le atiné antes de seguir.',
  };
}

// ---------------------------------------------------------------------------
// Pl@ntNet
// ---------------------------------------------------------------------------

interface RespuestaPlantnet {
  results: Array<{
    score: number;
    species: {
      scientificNameWithoutAuthor: string;
      commonNames?: string[];
    };
  }>;
}

async function consultarPlantnet(foto: ContextoFoto, llave: string): Promise<Candidato[]> {
  const formulario = new FormData();
  // Un par images/organs por foto, en el mismo orden. Así es como la API
  // asocia cada imagen con lo que muestra.
  foto.tomas.forEach((toma, i) => {
    formulario.append('images', {
      uri: toma.uri,
      name: `planta-${i}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
    formulario.append('organs', toma.organo);
  });

  const respuesta = await fetch(
    `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(llave)}`,
    { method: 'POST', body: formulario },
  );

  if (!respuesta.ok) {
    throw new Error(`Pl@ntNet respondió ${respuesta.status}`);
  }

  const datos = (await respuesta.json()) as RespuestaPlantnet;
  return datos.results.slice(0, 5).map((resultado) => {
    const cientifico = resultado.species.scientificNameWithoutAuthor;
    const enCatalogo = buscarEnCatalogoPorNombreCientifico(cientifico);
    return {
      especieId: enCatalogo?.id,
      nombreCientifico: cientifico,
      nombreComun: enCatalogo?.nombresComunes[0] ?? resultado.species.commonNames?.[0],
      probabilidad: resultado.score,
      enCatalogo: enCatalogo !== undefined,
    };
  });
}

/**
 * Empata el nombre científico de Pl@ntNet con el catálogo.
 *
 * Se compara sólo género y especie: Pl@ntNet devuelve híbridos y subespecies
 * con notación que nuestro catálogo no lleva (`Citrus × limon` vs `Citrus
 * limon`), y descartarlos por eso sería perder aciertos buenos.
 */
export function buscarEnCatalogoPorNombreCientifico(nombre: string) {
  const objetivo = normalizarBinomio(nombre);
  return ESPECIES.find((especie) => normalizarBinomio(especie.nombreCientifico) === objetivo);
}

function normalizarBinomio(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/×|x\s/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');
}
