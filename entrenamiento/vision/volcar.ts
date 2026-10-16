/**
 * De `rasgos-*.json` a binario para numpy: los vectores en float32 seguidos,
 * y aparte quién es cada foto.
 *
 *   node --max-old-space-size=14000 .entrenamiento-compilado/entrenamiento/vision/volcar.js rasgos-160.json r160
 *
 * Deja `r160.bin` y `r160.meta.json`, que lee `cabeza_mlp.py`. El JSON de
 * rasgos pesa medio giga; en binario numpy lo abre en un segundo.
 */

import { writeFileSync } from 'node:fs';

import { leerRasgos } from './rasgos';

function principal() {
  const [, , origen, destino] = process.argv;
  if (!origen || !destino) {
    console.error('Uso: volcar.js <rasgos.json> <destino-sin-extension>');
    process.exit(1);
  }
  const datos = leerRasgos(origen);
  const n = datos.muestras.length;
  const v = datos.muestras[0].rasgos.length;
  const dim = datos.muestras[0].rasgos[0].length;
  const buf = new Float32Array(n * v * dim);
  let k = 0;
  const meta: Array<[string, string]> = [];
  for (const m of datos.muestras) {
    for (let j = 0; j < v; j += 1) {
      // Una foto vieja con menos variantes repite la primera.
      const r = m.rasgos[j] ?? m.rasgos[0];
      for (let i = 0; i < dim; i += 1) buf[k++] = r[i];
    }
    meta.push([m.especie, m.foto]);
  }
  writeFileSync(`${destino}.bin`, Buffer.from(buf.buffer));
  writeFileSync(`${destino}.meta.json`, JSON.stringify({ n, v, dim, lado: datos.lado, meta }));
  console.log(`${n} fotos · ${v} variantes · ${dim} rasgos → ${destino}.bin`);
}

principal();
