/**
 * Dónde viven las fotos de las plantas.
 *
 * EL PROBLEMA QUE ARREGLA. La cámara y la galería entregan la foto en la caché
 * de la app, y iOS vacía esa carpeta cuando le falta espacio. El expediente
 * guardaba esa dirección tal cual, así que tarde o temprano la foto "no
 * cargaba": la ficha mostraba un hueco y el 3D se quedaba sin su textura.
 *
 * Ahora cada foto se copia a la carpeta de documentos, que el sistema no toca,
 * y de paso se encoge: una foto de doce megapíxeles como textura de 3D pesa
 * 48 MB en la tarjeta de video y en algunos teléfonos ni cabe. A 1280 px se ve
 * igual en la pantalla de un teléfono y carga al instante.
 *
 * En el navegador no hay sistema de archivos: la foto se guarda encogida como
 * texto (data URI), que sí sobrevive a recargar la página.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** Lado mayor con que se guarda una foto en el teléfono. */
const LADO_TELEFONO = 1280;
/** En el navegador va dentro del almacén de texto, que es chico. */
const LADO_NAVEGADOR = 720;

/**
 * Copia la foto a un lugar permanente y devuelve su nueva dirección.
 *
 * Si algo falla se devuelve la dirección original: perder la copia es malo,
 * pero perder el registro de la planta sería peor.
 */
export async function guardarFoto(uri: string, medidas?: { ancho?: number; alto?: number }): Promise<string> {
  if (!uri) return uri;
  try {
    const web = Platform.OS === 'web';
    const lado = web ? LADO_NAVEGADOR : LADO_TELEFONO;
    const ancho = medidas?.ancho ?? 0;
    const alto = medidas?.alto ?? 0;

    const contexto = ImageManipulator.manipulate(uri);
    // Sólo se encoge, nunca se agranda. Si no se sabe el tamaño, se encoge por
    // el ancho, que es lo que casi siempre sobra en una foto de teléfono.
    if (ancho === 0 || alto === 0) contexto.resize({ width: lado });
    else if (ancho >= alto && ancho > lado) contexto.resize({ width: lado });
    else if (alto > ancho && alto > lado) contexto.resize({ height: lado });
    const imagen = await contexto.renderAsync();

    if (web) {
      const r = await imagen.saveAsync({ base64: true, compress: 0.72, format: SaveFormat.JPEG });
      return r.base64 ? `data:image/jpeg;base64,${r.base64}` : r.uri;
    }

    const r = await imagen.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
    // Se pide aquí y no arriba: en el navegador este módulo no existe.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Directory, File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const carpeta = new Directory(Paths.document, 'fotos');
    carpeta.create({ idempotent: true, intermediates: true });
    const destino = new File(carpeta, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    await new File(r.uri).copy(destino);
    return destino.uri;
  } catch {
    return uri;
  }
}

/**
 * Si una foto guardada sigue existiendo.
 *
 * Las fotos viejas —de antes de que se guardaran en documentos— pueden haber
 * desaparecido con la caché. Saberlo evita pedirle al 3D una textura que no
 * está y mostrar un hueco en la ficha.
 */
export function fotoExiste(uri: string | undefined): boolean {
  if (!uri) return false;
  if (!uri.startsWith('file:')) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    return new File(uri).exists;
  } catch {
    // Si no se puede comprobar, se intenta cargar: el cargador tiene su propio respaldo.
    return true;
  }
}

/** Lado de la foto que se usa como textura del 3D. Más no se nota en una hoja. */
const LADO_TEXTURA = 512;
const texturas = new Map<string, Promise<string | null>>();

/**
 * La foto, lista para ponerla de textura en el 3D.
 *
 * Se encoge a 512 px antes de dársela a la tarjeta de video: las fotos viejas
 * se guardaban tal como salían de la cámara (doce megapíxeles), y subir eso
 * como textura tardaba, gastaba decenas de megas y en algunos teléfonos
 * fallaba. Devuelve `null` si la foto ya no existe o no se pudo leer: el 3D se
 * dibuja con su verde de siempre.
 */
export function fotoParaTextura(uri: string | undefined): Promise<string | null> {
  if (!uri || !fotoExiste(uri)) return Promise.resolve(null);
  if (Platform.OS === 'web') return Promise.resolve(uri);
  const ya = texturas.get(uri);
  if (ya) return ya;
  const promesa = (async () => {
    try {
      const contexto = ImageManipulator.manipulate(uri);
      contexto.resize({ width: LADO_TEXTURA });
      const imagen = await contexto.renderAsync();
      const r = await imagen.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      return r.uri;
    } catch {
      return null;
    }
  })();
  texturas.set(uri, promesa);
  return promesa;
}
