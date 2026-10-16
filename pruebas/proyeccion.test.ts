/**
 * Pruebas de la proyección de crecimiento.
 *
 * Es la única predicción que la app se permite hacer, así que tiene que
 * comportarse como la biología: crecer frenándose, nunca pasarse del tamaño
 * adulto, y respetar el calendario de cada especie.
 */

import { buscarEspecie } from '../src/dominio/catalogo';
import {
  proyectarAltura,
  proyectarCrecimiento,
  resumirCrecimiento,
} from '../src/dominio/proyeccion';
import { HOY, especie } from './ayudas';

describe('crecimiento logístico, no lineal', () => {
  it('crece con el tiempo', () => {
    const sp = especie({ crecimientoCmPorAno: 24, alturaMaximaCm: 200 });
    expect(proyectarAltura(sp, 30, 12)).toBeGreaterThan(30);
  });

  /** Una planta no crece 30 cm al año para siempre: se frena al madurar. */
  it('se frena conforme se acerca a su altura adulta', () => {
    const sp = especie({ crecimientoCmPorAno: 24, alturaMaximaCm: 100 });
    const joven = proyectarAltura(sp, 20, 12) - 20;
    const casiAdulta = proyectarAltura(sp, 90, 12) - 90;
    expect(casiAdulta).toBeLessThan(joven);
  });

  it('nunca supera su altura máxima', () => {
    const sp = especie({ crecimientoCmPorAno: 100, alturaMaximaCm: 80 });
    expect(proyectarAltura(sp, 70, 600)).toBeLessThanOrEqual(80);
  });

  it('una especie de crecimiento lento apenas cambia en un año', () => {
    const sina = buscarEspecie('lophocereus-schottii')!;
    const bugambilia = buscarEspecie('bougainvillea-glabra')!;
    const creceSina = proyectarAltura(sina, 50, 12) - 50;
    const creceBugambilia = proyectarAltura(bugambilia, 50, 12) - 50;
    expect(creceBugambilia).toBeGreaterThan(creceSina * 5);
  });
});

describe('pasos de la proyección', () => {
  const sp = especie({
    crecimientoCmPorAno: 36,
    alturaMaximaCm: 250,
    fenologia: [{ fenomeno: 'floracion', mesInicio: 3, mesFin: 5 }],
  });

  it('el primer paso es el presente', () => {
    const pasos = proyectarCrecimiento({ especie: sp, alturaCm: 40, hoy: HOY });
    expect(pasos[0].meses).toBe(0);
    expect(pasos[0].etiqueta).toBe('Hoy');
    expect(pasos[0].alturaCm).toBe(40);
  });

  it('cada hito es más alto que el anterior', () => {
    const pasos = proyectarCrecimiento({ especie: sp, alturaCm: 40, hoy: HOY });
    for (let i = 1; i < pasos.length; i += 1) {
      expect(pasos[i].alturaCm).toBeGreaterThanOrEqual(pasos[i - 1].alturaCm);
    }
  });

  it('el dibujo proyectado siempre está sano: ése es el supuesto', () => {
    const pasos = proyectarCrecimiento({ especie: sp, alturaCm: 40, hoy: HOY });
    for (const paso of pasos) {
      expect(paso.morfologia.senal).toBe('ninguna');
      expect(paso.morfologia.caida).toBeLessThan(0.15);
    }
  });

  /**
   * El valor real de proyectar: saber que en marzo le toca florecer, no sólo
   * que estará más alta.
   */
  it('anuncia la floración cuando el hito cae en su temporada', () => {
    // Desde junio, 9 meses adelante es marzo: dentro de su ventana.
    const pasos = proyectarCrecimiento({
      especie: sp,
      alturaCm: 40,
      hoy: HOY,
      hitos: [0, 9],
    });
    expect(pasos[1].fenomenos).toContain('floracion');
    expect(pasos[0].fenomenos).not.toContain('floracion');
  });

  it('más altura trae más follaje', () => {
    const pasos = proyectarCrecimiento({
      especie: sp,
      alturaCm: 20,
      elementos: 4,
      hoy: HOY,
      hitos: [0, 12],
    });
    expect(pasos[1].morfologia.elementos).toBeGreaterThan(pasos[0].morfologia.elementos);
  });
});

/**
 * Lo que se reportó: "el limonero en un año se ve igual que el actual". El
 * dibujo se ajustaba al cuadro y el tamaño se perdía; ahora cada paso trae
 * cuánto creció y la estructura que tendrá.
 */
describe('se ve crecer', () => {
  const limon = buscarEspecie('citrus-limon')!;
  const pasos = proyectarCrecimiento({ especie: limon, alturaCm: 70, hoy: HOY });

  it('hoy es tamaño 1 y cada paso es más grande que el anterior', () => {
    expect(pasos[0].crecimiento).toBe(1);
    for (let i = 1; i < pasos.length; i += 1) expect(pasos[i].crecimiento).toBeGreaterThan(pasos[i - 1].crecimiento);
    // En un año, un limonero de 70 cm se nota: más de una quinta parte más alto.
    expect(pasos.find((p) => p.meses === 12)!.crecimiento).toBeGreaterThan(1.2);
  });

  it('la proporción es la de hoy en todos los pasos; la estructura madura', () => {
    for (const p of pasos) expect(p.morfologia.altura).toBe(pasos[0].morfologia.altura);
    const ultimo = pasos[pasos.length - 1];
    expect(ultimo.morfologia.desarrollo).toBeGreaterThan(pasos[0].morfologia.desarrollo);
  });

  it('llega a dos años', () => {
    expect(pasos.map((p) => p.etiqueta)).toEqual(['Hoy', 'En 3 meses', 'En 6 meses', 'En un año', 'En 2 años']);
  });

  it('las que cuelgan crecen alargándose, no agrandándose', () => {
    const potos = buscarEspecie('epipremnum-aureum')!;
    const p = proyectarCrecimiento({ especie: potos, alturaCm: 20, hoy: HOY });
    for (const paso of p) expect(paso.crecimiento).toBe(1);
    expect(p[p.length - 1].morfologia.altura).toBeGreaterThan(p[0].morfologia.altura);
  });
});

describe('resumen en palabras', () => {
  it('dice de cuánto a cuánto', () => {
    const pasos = proyectarCrecimiento({
      especie: especie({ crecimientoCmPorAno: 40, alturaMaximaCm: 300 }),
      alturaCm: 30,
      hoy: HOY,
    });
    const resumen = resumirCrecimiento(pasos);
    expect(resumen).toMatch(/30/);
    expect(resumen).toMatch(/si la cuidas bien/i);
  });

  /** No se presume un crecimiento que no se va a notar. */
  it('con una especie lentísima, lo dice en vez de inflarlo', () => {
    const pasos = proyectarCrecimiento({
      especie: especie({ crecimientoCmPorAno: 1, alturaMaximaCm: 60 }),
      alturaCm: 55,
      hoy: HOY,
    });
    expect(resumirCrecimiento(pasos)).toMatch(/muy despacio/i);
  });
});
