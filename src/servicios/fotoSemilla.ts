/**
 * De una foto de semilla a sus medidas.
 *
 * Aquí está la parte que toca el sistema: encoger la foto, sacarle los píxeles
 * y pasárselos al dominio, que es quien mide. La separación permite que toda la
 * visión (`dominio/vision.ts`) se pruebe con imágenes sintéticas en Jest, sin
 * cámara y sin dispositivo.
 *
 * SE ENCOGE A 260 PÍXELES a propósito. Una foto de teléfono son doce millones
 * de píxeles; recorrerlos en JavaScript tarda segundos y llena la memoria. Para
 * medir la proporción y el color de una semilla, 260 sobran — y a esa escala
 * todo el análisis tarda menos de lo que dura el parpadeo del obturador.
 *
 * El decodificador de JPEG es JavaScript puro. No hace falta nada nativo, así
 * que esto corre dentro de Expo Go igual que en un build de tienda.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { medirSemilla } from '../dominio/vision';
import type { Medicion } from '../dominio/vision';

/** Lado máximo al que se encoge antes de mirarla. */
const LADO = 260;

export async function medirFotoDeSemilla(
  uri: string,
  opciones: { monedaMm?: number } = {},
): Promise<Medicion> {
  try {
    const contexto = ImageManipulator.manipulate(uri);
    contexto.resize({ width: LADO });
    const imagen = await contexto.renderAsync();
    const guardada = await imagen.saveAsync({
      base64: true,
      compress: 1,
      format: SaveFormat.JPEG,
    });

    if (!guardada.base64) {
      return { notas: ['No pude leer la foto.'], sirvio: false };
    }

    const crudo = decode(aBytes(guardada.base64), { useTArray: true, formatAsRGBA: true });
    return medirSemilla(
      { ancho: crudo.width, alto: crudo.height, datos: crudo.data },
      opciones,
    );
  } catch (error) {
    return {
      notas: [
        error instanceof Error && error.message
          ? `No pude analizar la foto: ${error.message}`
          : 'No pude analizar la foto.',
      ],
      sirvio: false,
    };
  }
}

/**
 * Base64 a bytes, sin depender de `Buffer` ni de `atob`.
 *
 * Hermes no trae `Buffer`, y `atob` existe en web y en React Native reciente
 * pero no en todas las versiones. Treinta líneas propias evitan un polyfill
 * entero por una función.
 */
function aBytes(base64: string): Uint8Array {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const limpio = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const largo = Math.floor((limpio.length * 3) / 4);
  const salida = new Uint8Array(largo);

  let acumulado = 0;
  let bits = 0;
  let escritos = 0;

  for (let i = 0; i < limpio.length; i += 1) {
    acumulado = (acumulado << 6) | abc.indexOf(limpio[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      salida[escritos] = (acumulado >> bits) & 0xff;
      escritos += 1;
      if (escritos >= largo) break;
    }
  }

  return salida;
}
