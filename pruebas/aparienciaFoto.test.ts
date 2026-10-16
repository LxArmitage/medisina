/**
 * Medir la planta en la foto del escaneo, con imágenes hechas a mano.
 *
 * Lo que importa: que tome el verde de la planta y no el de la pared, que vea
 * las bandas de una lengua de suegra como un segundo color, que no confunda la
 * maceta de barro con una hoja, y que si no hay planta lo diga.
 */

import { esVegetal, medirPlanta } from '../src/dominio/aparienciaFoto';
import { hexARgb } from '../src/dominio/forma';

type RGB = [number, number, number];

function imagen(ancho: number, alto: number, pintar: (x: number, y: number) => RGB) {
  const datos = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y += 1)
    for (let x = 0; x < ancho; x += 1) {
      const [r, g, b] = pintar(x, y);
      datos.set([r, g, b, 255], (y * ancho + x) * 4);
    }
  return { ancho, alto, datos };
}

const PARED: RGB = [214, 208, 198];
const BARRO: RGB = [184, 104, 63];
const VERDE: RGB = [60, 110, 55];
const BANDA: RGB = [150, 190, 120];

describe('qué cuenta como planta', () => {
  it.each([
    ['verde de hoja', VERDE, true],
    ['verde-azulado de agave', [120, 160, 166] as RGB, true],
    ['maceta de barro', BARRO, false],
    ['pared', PARED, false],
    ['tierra', [74, 53, 38] as RGB, false],
    ['blanco', [245, 245, 240] as RGB, false],
  ])('%s', (_n, [r, g, b], esperado) => {
    expect(esVegetal(r, g, b)).toBe(esperado);
  });
});

describe('medir la planta', () => {
  it('sin planta en la foto, no inventa', () => {
    expect(medirPlanta(imagen(80, 80, () => PARED))).toBeNull();
  });

  it('toma el verde de la planta, no el de la pared ni el de la maceta', () => {
    const img = imagen(80, 100, (x, y) => (y > 70 ? BARRO : x > 25 && x < 55 ? VERDE : PARED));
    const m = medirPlanta(img)!;
    const [r, g, b] = hexARgb(m.hoja);
    expect(g).toBeGreaterThan(r);
    expect(Math.abs(g - VERDE[1])).toBeLessThan(20);
    expect(b).toBeLessThan(90);
  });

  it('una planta alta y angosta sale alta; una baja y ancha, baja', () => {
    const alta = medirPlanta(imagen(80, 100, (x, y) => (x > 32 && x < 48 && y < 90 ? VERDE : PARED)))!;
    const ancha = medirPlanta(imagen(100, 80, (x, y) => (y > 50 && y < 70 && x > 5 && x < 95 ? VERDE : PARED)))!;
    expect(alta.proporcion).toBeGreaterThan(2);
    expect(ancha.proporcion).toBeLessThan(0.5);
  });

  it('las bandas claras cuentan como segundo color', () => {
    const conBandas = medirPlanta(imagen(80, 100, (x, y) => (x > 20 && x < 60 ? (Math.floor(y / 6) % 3 === 0 ? BANDA : VERDE) : PARED)))!;
    expect(conBandas.acento).toBeDefined();
    const [r, g] = hexARgb(conBandas.acento!);
    expect(g).toBeGreaterThan(150);
    expect(r).toBeGreaterThan(110);
  });

  it('una hoja lisa con sombra NO es de dos colores', () => {
    // El mismo verde más claro y más oscuro: es luz, no patrón.
    const lisa = medirPlanta(
      imagen(80, 100, (x, y) => {
        if (x <= 20 || x >= 60) return PARED;
        const k = 0.6 + 0.8 * (x - 20) / 40;
        return [VERDE[0] * k, VERDE[1] * k, VERDE[2] * k];
      }),
    )!;
    expect(lisa.acento).toBeUndefined();
  });

  it('con datos rotos no truena', () => {
    expect(medirPlanta({ ancho: 0, alto: 0, datos: new Uint8Array(0) })).toBeNull();
    expect(medirPlanta({ ancho: 10, alto: 10, datos: new Uint8Array(4) })).toBeNull();
  });
});
