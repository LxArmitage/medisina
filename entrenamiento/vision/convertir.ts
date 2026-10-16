/**
 * Convierte el .tflite de plantas al formato de la app.
 *
 *   node .entrenamiento-compilado/entrenamiento/vision/convertir.js <modelo.tflite> <salida.json>
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { convertirTflite } from './tflite';

const [, , origen, destino] = process.argv;
if (!origen || !destino) {
  console.error('Uso: convertir <modelo.tflite> <salida.json>');
  process.exit(1);
}
const red = convertirTflite(readFileSync(origen), 'Google AIY plants_V1 (Apache 2.0) · MobileNet V2');
writeFileSync(destino, JSON.stringify(red));
console.log(
  `${red.ops.length} operaciones · entrada ${red.lado}px · escala ${red.entradaEscala} cero ${red.entradaCero} · ` +
    `${Math.round(red.bytes.length / 1024)} KB en base64`,
);
