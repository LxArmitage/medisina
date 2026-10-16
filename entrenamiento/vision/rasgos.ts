/**
 * Pasa cada foto de entrenamiento por la red y guarda su vector de rasgos.
 *
 * Es la parte cara del entrenamiento —una red completa por foto y por
 * variante—, así que se reparte entre todos los núcleos y el resultado queda
 * en disco: entrenar la última capa con esos vectores tarda segundos y se
 * puede repetir cuantas veces haga falta.
 *
 * Cada foto se mira de varias formas (entera, más de cerca, en espejo): así la
 * última capa aprende la planta y no el encuadre de una foto en particular.
 *
 *   node .entrenamiento-compilado/entrenamiento/vision/rasgos.js <fotos> <red.json> <salida.json> <lado> [previo.json]
 *
 * Con `previo.json` sólo se procesan las fotos que no estaban ahí: agregar
 * fotos no obliga a recalcular las viejas.
 */

import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

// jpeg-js no trae tipos; se usa sólo aquí.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jpeg = require('jpeg-js') as {
  decode(datos: Buffer, opciones: { useTArray: true; formatAsRGBA: true; maxMemoryUsageInMB?: number }): {
    width: number;
    height: number;
    data: Uint8Array;
  };
};

import { desempacarRed } from '../../src/ia/vision/formato';
import type { RedEmpacada } from '../../src/ia/vision/formato';
import { cuadroCentral, espejo } from '../../src/ia/vision/imagen';
import { correr, prepararEntrada } from '../../src/ia/vision/red';

export interface Muestra {
  especie: string;
  foto: string;
  /** Variantes: [entera, entera en espejo, de cerca, de cerca en espejo]. */
  rasgos: number[][];
}

/** Las variantes con que se mira cada foto. La primera es como la ve el teléfono. */
export const VARIANTES: Array<{ zoom: number; espejo: boolean }> = [
  { zoom: 1, espejo: false },
  { zoom: 1, espejo: true },
  { zoom: 0.75, espejo: false },
  { zoom: 0.75, espejo: true },
];

interface Tarea {
  especie: string;
  foto: string;
  ruta: string;
}

/**
 * Los rasgos se guardan un renglón por foto (JSON Lines), con un renglón de
 * encabezado. En un solo JSON ya no caben: con 28 mil fotos pasa del medio
 * giga, que es lo más largo que Node puede armar como texto.
 */
export function escribirRasgos(destino: string, lado: number, muestras: Muestra[]) {
  const fd = openSync(destino, 'w');
  try {
    writeSync(fd, JSON.stringify({ lado, variantes: VARIANTES, formato: 'lineas' }) + '\n');
    for (const m of muestras) writeSync(fd, JSON.stringify(m) + '\n');
  } finally {
    closeSync(fd);
  }
}

/** Lee rasgos en cualquiera de los dos formatos: el de renglones o el JSON de antes. */
export function leerRasgos(ruta: string): { lado: number; muestras: Muestra[] } {
  const fd = openSync(ruta, 'r');
  try {
    const bloque = Buffer.alloc(64 * 1024 * 1024);
    let resto = '';
    let encabezado: { lado: number; formato?: string } | null = null;
    const muestras: Muestra[] = [];
    for (;;) {
      const leidos = readSync(fd, bloque, 0, bloque.length, null);
      if (leidos === 0) break;
      const texto = resto + bloque.toString('utf8', 0, leidos);
      const renglones = texto.split('\n');
      resto = renglones.pop() ?? '';
      for (const r of renglones) {
        if (!r) continue;
        if (!encabezado) {
          // El formato viejo es un solo JSON: no tiene saltos de línea.
          encabezado = JSON.parse(r) as { lado: number; formato?: string };
          continue;
        }
        muestras.push(JSON.parse(r) as Muestra);
      }
    }
    if (!encabezado) {
      const viejo = JSON.parse(resto) as { lado: number; muestras: Muestra[] };
      return viejo;
    }
    if (resto) muestras.push(JSON.parse(resto) as Muestra);
    return { lado: encabezado.lado, muestras };
  } finally {
    closeSync(fd);
  }
}

function trabajar() {
  const { redJson, lado, tareas } = workerData as { redJson: string; lado: number; tareas: Tarea[] };
  const red = desempacarRed(JSON.parse(readFileSync(redJson, 'utf8')) as RedEmpacada, lado);
  const salida: Muestra[] = [];
  for (const t of tareas) {
    try {
      const img = jpeg.decode(readFileSync(t.ruta), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 });
      const rasgos = VARIANTES.map((v) => {
        let cuadro = cuadroCentral({ ancho: img.width, alto: img.height, datos: img.data }, lado, v.zoom);
        if (v.espejo) cuadro = espejo(cuadro, lado);
        return Array.from(correr(red, prepararEntrada(red, cuadro, lado)), (n) => Number(n.toFixed(4)));
      });
      salida.push({ especie: t.especie, foto: t.foto, rasgos });
    } catch {
      // Una foto corrupta no detiene el entrenamiento.
    }
    parentPort?.postMessage({ avance: 1 });
  }
  parentPort?.postMessage({ listo: salida });
}

async function principal() {
  const [, , carpeta, redJson, destino, ladoTexto, previoRuta] = process.argv;
  const lado = Number(ladoTexto ?? 160);
  // Sólo las que siguen en su carpeta: una foto que se mudó de "otra" a su
  // especie no puede quedarse con la etiqueta vieja.
  const previas: Muestra[] = (previoRuta && existsSync(previoRuta) ? leerRasgos(previoRuta).muestras : []).filter((m) =>
    existsSync(join(carpeta, m.especie, m.foto)),
  );
  const hechasAntes = new Set(previas.map((m) => `${m.especie}/${m.foto}`));
  const tareas: Tarea[] = [];
  for (const especie of readdirSync(carpeta)) {
    for (const foto of readdirSync(join(carpeta, especie)).filter((f) => f.endsWith('.jpg'))) {
      if (hechasAntes.has(`${especie}/${foto}`)) continue;
      tareas.push({ especie, foto, ruta: join(carpeta, especie, foto) });
    }
  }
  console.log(`${previas.length} ya calculadas · ${tareas.length} nuevas`);
  const hilos = Math.max(1, cpus().length - 1);
  const porHilo = Array.from({ length: hilos }, (_, h) => tareas.filter((_, i) => i % hilos === h));
  let hechas = 0;
  const inicio = Date.now();

  const resultados = await Promise.all(
    porHilo.map(
      (lote) =>
        new Promise<Muestra[]>((resolver, fallar) => {
          const w = new Worker(__filename, { workerData: { redJson, lado, tareas: lote } });
          w.on('message', (m: { avance?: number; listo?: Muestra[] }) => {
            if (m.avance) {
              hechas += 1;
              if (hechas % 100 === 0) {
                const s = (Date.now() - inicio) / 1000;
                console.log(`${hechas}/${tareas.length} · ${s.toFixed(0)} s`);
              }
            }
            if (m.listo) resolver(m.listo);
          });
          w.on('error', fallar);
        }),
    ),
  );
  const todas = [...previas, ...resultados.flat()];
  escribirRasgos(destino, lado, todas);
  console.log(`${todas.length} fotos · ${lado} px → ${destino}`);
}

// `volcar.ts` importa de aquí para leer los rasgos: sólo se corre si es el
// programa principal, no por importarlo.
if (!isMainThread) {
  trabajar();
} else if (require.main === module) {
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
