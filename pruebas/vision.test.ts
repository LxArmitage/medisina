/**
 * Pruebas de la medición de semillas en foto.
 *
 * Se prueba con imágenes sintéticas: se pintan manchas de tamaño, forma y color
 * conocidos sobre un fondo, y se comprueba que lo que sale es lo que se pintó.
 * Sin cámara y sin dispositivo, que es lo que permite que esto tenga pruebas.
 *
 * Lo que más se protege es lo que la medición NO hace. Sin moneda no hay
 * escala, y sin escala cualquier tamaño en milímetros sería inventado: la
 * prueba exige que en ese caso el tamaño venga vacío, no estimado.
 */

import {
  alargamientoDe,
  buscarManchas,
  colorDeMancha,
  colorDelFondo,
  formaDeMancha,
  medirSemilla,
  tamanoDe,
} from '../src/dominio/vision';
import type { Imagen } from '../src/dominio/vision';

/** Lienzo de un color liso, como una hoja de papel. */
function lienzo(ancho: number, alto: number, fondo: [number, number, number]): Imagen {
  const datos = new Uint8ClampedArray(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i += 1) {
    datos[i * 4] = fondo[0];
    datos[i * 4 + 1] = fondo[1];
    datos[i * 4 + 2] = fondo[2];
    datos[i * 4 + 3] = 255;
  }
  return { ancho, alto, datos };
}

function pintarElipse(
  img: Imagen,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: [number, number, number],
): void {
  for (let y = Math.max(0, cy - ry); y <= Math.min(img.alto - 1, cy + ry); y += 1) {
    for (let x = Math.max(0, cx - rx); x <= Math.min(img.ancho - 1, cx + rx); x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const i = (y * img.ancho + x) * 4;
      img.datos[i] = color[0];
      img.datos[i + 1] = color[1];
      img.datos[i + 2] = color[2];
    }
  }
}

const PAPEL: [number, number, number] = [242, 240, 236];
const NEGRO: [number, number, number] = [26, 24, 22];
const CREMA: [number, number, number] = [226, 208, 168];
const PLATA: [number, number, number] = [176, 178, 180];

// ---------------------------------------------------------------------------

describe('separar el objeto del fondo', () => {
  it('lee el color del papel del marco de la foto', () => {
    const img = lienzo(120, 120, PAPEL);
    pintarElipse(img, 60, 60, 30, 30, NEGRO);
    expect(colorDelFondo(img)).toEqual(PAPEL);
  });

  it('encuentra una mancha y la mide', () => {
    const img = lienzo(120, 120, PAPEL);
    pintarElipse(img, 60, 60, 20, 20, NEGRO);
    const manchas = buscarManchas(img);
    expect(manchas.length).toBe(1);
    // Un círculo de radio 20 mide 41 px de ancho, con tolerancia de bordes.
    expect(Math.abs(manchas[0].x1 - manchas[0].x0 - 40)).toBeLessThanOrEqual(2);
  });

  it('no confunde dos objetos separados con uno solo', () => {
    const img = lienzo(200, 120, PAPEL);
    pintarElipse(img, 50, 60, 26, 26, PLATA);
    pintarElipse(img, 150, 60, 8, 5, NEGRO);
    expect(buscarManchas(img).length).toBe(2);
  });

  it('ignora el polvo', () => {
    const img = lienzo(120, 120, PAPEL);
    pintarElipse(img, 60, 60, 20, 20, NEGRO);
    pintarElipse(img, 15, 15, 1, 1, NEGRO);
    expect(buscarManchas(img).length).toBe(1);
  });
});

describe('leer la forma', () => {
  it('un círculo es redondo', () => {
    const img = lienzo(120, 120, PAPEL);
    pintarElipse(img, 60, 60, 22, 22, NEGRO);
    expect(formaDeMancha(buscarManchas(img)[0])).toBe('redonda');
  });

  it('un grano de arroz es alargado', () => {
    const img = lienzo(160, 120, PAPEL);
    pintarElipse(img, 80, 60, 40, 12, NEGRO);
    expect(formaDeMancha(buscarManchas(img)[0])).toBe('alargada');
  });

  it('algo intermedio se propone como de gota', () => {
    const img = lienzo(160, 120, PAPEL);
    pintarElipse(img, 80, 60, 34, 21, CREMA);
    expect(formaDeMancha(buscarManchas(img)[0])).toBe('de_gota');
  });

  it('el alargamiento no depende de la orientación', () => {
    const tumbada = lienzo(160, 160, PAPEL);
    pintarElipse(tumbada, 80, 80, 40, 12, NEGRO);
    const parada = lienzo(160, 160, PAPEL);
    pintarElipse(parada, 80, 80, 12, 40, NEGRO);
    const a = alargamientoDe(buscarManchas(tumbada)[0]);
    const b = alargamientoDe(buscarManchas(parada)[0]);
    expect(Math.abs(a - b)).toBeLessThan(0.2);
  });
});

describe('leer el color', () => {
  it.each([
    ['negra', NEGRO],
    ['clara', CREMA],
    ['gris', PLATA],
  ] as Array<[string, [number, number, number]]>)('%s', (esperado, color) => {
    const img = lienzo(120, 120, PAPEL);
    pintarElipse(img, 60, 60, 22, 22, color);
    expect(colorDeMancha(buscarManchas(img)[0])).toBe(esperado);
  });
});

describe('el tamaño sólo con referencia', () => {
  /**
   * La prueba que sostiene la honestidad de todo esto. Una foto sin nada de
   * tamaño conocido no tiene escala: un número de milímetros ahí sería puro
   * invento, y con semillas un invento cuesta meses de maceta.
   */
  it('sin moneda no inventa milímetros', () => {
    const img = lienzo(160, 160, PAPEL);
    pintarElipse(img, 80, 80, 20, 12, NEGRO);
    const medicion = medirSemilla(img);
    expect({ tamano: medicion.tamano, largoMm: medicion.largoMm, sirvio: medicion.sirvio }).toEqual({
      tamano: undefined,
      largoMm: undefined,
      sirvio: true,
    });
    // Pero sí lee lo que sí se puede leer.
    expect(medicion.color).toBe('negra');
  });

  it('con moneda de 10 pesos saca los milímetros', () => {
    // Moneda de 28 mm dibujada con 56 px de diámetro → 0.5 mm por píxel.
    // Semilla de 20 px de largo → 10 mm.
    const img = lienzo(260, 140, PAPEL);
    pintarElipse(img, 60, 70, 28, 28, PLATA);
    pintarElipse(img, 190, 70, 10, 6, NEGRO);

    const medicion = medirSemilla(img, { monedaMm: 28 });
    expect(medicion.largoMm).toBeGreaterThan(9);
    expect(medicion.largoMm).toBeLessThan(12);
    expect(medicion.tamano).toBe('grande');
  });

  it('distingue la moneda de la semilla por lo redonda que es', () => {
    const img = lienzo(260, 140, PAPEL);
    pintarElipse(img, 60, 70, 28, 28, PLATA);
    pintarElipse(img, 190, 70, 24, 7, NEGRO);
    const medicion = medirSemilla(img, { monedaMm: 28 });
    // Si hubiera tomado la moneda por semilla, la vería redonda.
    expect(medicion.forma).toBe('alargada');
  });

  it('avisa cuando la moneda y la semilla se tocan', () => {
    const img = lienzo(200, 140, PAPEL);
    pintarElipse(img, 90, 70, 30, 30, PLATA);
    const medicion = medirSemilla(img, { monedaMm: 28 });
    expect(medicion.notas.join(' ')).toMatch(/sepárala|un solo objeto/i);
  });

  it('avisa cuando no hay nada que medir', () => {
    const medicion = medirSemilla(lienzo(120, 120, PAPEL));
    expect(medicion.sirvio).toBe(false);
  });
});

describe('los cortes de tamaño', () => {
  it.each([
    [1.5, 'diminuta'],
    [3, 'chica'],
    [7, 'mediana'],
    [11, 'grande'],
  ] as Array<[number, string]>)('%s mm → %s', (mm, esperado) => {
    expect(tamanoDe(mm)).toBe(esperado);
  });
});
