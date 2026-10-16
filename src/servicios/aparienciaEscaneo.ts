/**
 * Del escaneo al color del gemelo.
 *
 * Encoge la foto (160 px sobran para sacar colores y proporción, y así tarda
 * milésimas) y se la pasa al dominio, que es quien mide (`aparienciaFoto.ts`).
 * Si algo falla, no pasa nada: el gemelo usa los colores de su especie.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { medirPlanta } from '../dominio/aparienciaFoto';
import type { AparienciaObservada } from '../dominio/tipos';
import { desdeBase64 } from '../ia/vision/formato';

export async function medirAparienciaDeFoto(uri: string): Promise<AparienciaObservada | undefined> {
  try {
    const contexto = ImageManipulator.manipulate(uri);
    contexto.resize({ width: 160 });
    const imagen = await contexto.renderAsync();
    const r = await imagen.saveAsync({ base64: true, compress: 0.9, format: SaveFormat.JPEG });
    if (!r.base64) return undefined;
    const crudo = decode(desdeBase64(r.base64), { useTArray: true, formatAsRGBA: true });
    const medida = medirPlanta({ ancho: crudo.width, alto: crudo.height, datos: crudo.data });
    if (!medida) return undefined;
    return {
      hoja: medida.hoja,
      hojaOscura: medida.hojaOscura,
      acento: medida.acento,
      proporcion: medida.proporcion,
      fecha: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}
