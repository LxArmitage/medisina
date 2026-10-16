/**
 * El reconocimiento dentro del teléfono, pegado a la cámara.
 *
 * Aquí está lo que toca el sistema: encoger la foto, sacarle los píxeles y
 * pasárselos a la red (`src/ia/vision`). Y el orden de trabajo: la red tarda
 * unos segundos por foto en el teléfono, así que cada foto se empieza a mirar
 * EN CUANTO SE TOMA, una detrás de otra, mientras la persona toma la
 * siguiente. Cuando toca "identificar", casi siempre ya está hecho.
 *
 * Cada foto se mira una sola vez: el resultado queda guardado por su dirección.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { desdeBase64 } from '../ia/vision/formato';
import { Cancelado, LADO_VISION, mirar } from '../ia/vision/reconocer';

/**
 * A qué ancho se encoge la foto antes de mirarla: el doble de lo que ve la
 * red. Así el recorte del centro todavía tiene de dónde promediar, y decodificar
 * el JPEG en JavaScript tarda milésimas y no segundos.
 */
const ANCHO_PREVIO = LADO_VISION * 2;

const lecturas = new Map<string, Promise<number[] | null>>();
const avances = new Map<string, number>();
const olvidadas = new Set<string>();
const oyentes = new Set<() => void>();
let cola: Promise<unknown> = Promise.resolve();

const respirar = () => new Promise<void>((r) => setTimeout(r, 0));

function avisar() {
  for (const o of oyentes) {
    try {
      o();
    } catch {
      // Un oyente que truena no detiene la lectura.
    }
  }
}

/**
 * Empieza a mirar una foto (o devuelve lo que ya se vio).
 *
 * Resuelve con la probabilidad de cada clase, o `null` si la foto no se pudo
 * leer. Nunca rechaza: una foto rara no puede tumbar el escaneo.
 */
export function analizarFoto(uri: string): Promise<number[] | null> {
  const ya = lecturas.get(uri);
  if (ya) return ya;
  olvidadas.delete(uri);
  avances.set(uri, 0);
  const promesa = cola.then(() => leer(uri)).catch(() => null);
  cola = promesa;
  lecturas.set(uri, promesa);
  avisar();
  return promesa;
}

/** Deja de mirar una foto que la persona quitó. */
export function olvidarFoto(uri: string): void {
  olvidadas.add(uri);
  lecturas.delete(uri);
  avances.delete(uri);
  avisar();
}

/** De 0 a 1, cuánto lleva mirada esa foto. */
export function avanceDe(uri: string): number {
  return avances.get(uri) ?? 0;
}

export function escucharAvance(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

async function leer(uri: string): Promise<number[] | null> {
  if (olvidadas.has(uri)) return null;
  try {
    const contexto = ImageManipulator.manipulate(uri);
    contexto.resize({ width: ANCHO_PREVIO });
    const imagen = await contexto.renderAsync();
    const guardada = await imagen.saveAsync({ base64: true, compress: 0.92, format: SaveFormat.JPEG });
    if (!guardada.base64) return null;

    const crudo = decode(desdeBase64(guardada.base64), { useTArray: true, formatAsRGBA: true });
    await respirar();

    let ultimo = 0;
    const probs = await mirar(
      { ancho: crudo.width, alto: crudo.height, datos: crudo.data },
      {
        respirar,
        cancelado: () => olvidadas.has(uri),
        alAvanzar: (f) => {
          avances.set(uri, f);
          // Avisar cada 4 %: más seguido sólo gasta renders.
          if (f - ultimo >= 0.04) {
            ultimo = f;
            avisar();
          }
        },
      },
    );
    avances.set(uri, 1);
    avisar();
    return probs;
  } catch (error) {
    if (!(error instanceof Cancelado)) avances.set(uri, 1);
    avisar();
    return null;
  }
}
