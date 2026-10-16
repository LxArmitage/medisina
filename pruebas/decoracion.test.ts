/**
 * Decorar el jardín y la casa, y la maceta de cada planta.
 *
 * Lo que viene de guardado puede venir de una versión vieja o roto: nunca
 * debe tumbar la escena. Y la maceta es de la maceta: cambiarla no toca a la
 * planta.
 */

import {
  ADORNOS_CASA,
  ADORNOS_PATIO,
  ADORNOS_SOMBRA,
  BARDAS,
  DECORACION_INICIAL,
  MACETAS,
  alternar,
  limpiarDecoracion,
  limpiarMacetas,
  lugaresDeAdornos,
} from '../src/dominio/decoracion';
import { aparienciaDe, formaDe } from '../src/dominio/forma';
import type { Morfologia } from '../src/dominio/morfologia';
import { armarMalla } from '../src/ui/tresd/malla';
import type { Malla } from '../src/ui/tresd/malla';

describe('lo guardado nunca rompe la escena', () => {
  it.each([null, undefined, 42, 'hola', [], { patio: 'x' }])('%p se vuelve la decoración de siempre', (basura) => {
    expect(limpiarDecoracion(basura)).toEqual(DECORACION_INICIAL);
  });

  it('se queda con lo válido y cambia lo que ya no existe', () => {
    const d = limpiarDecoracion({
      patio: { barda: 'rosa', piso: 'lava', adornos: ['hamaca', 'dragon', 'hamaca', 7] },
      casa: { pared: 'azul', tapete: 'sarape', adornos: 'gato' },
    });
    expect(d.patio.barda).toBe('rosa');
    expect(d.patio.piso).toBe('pasto');
    // Sin repetidos y sin lo que no existe.
    expect(d.patio.adornos).toEqual(['hamaca']);
    expect(d.casa.pared).toBe('azul');
    expect(d.casa.tapete).toBe('sarape');
    expect(d.casa.cortina).toBe(DECORACION_INICIAL.casa.cortina);
    expect(d.casa.adornos).toEqual(DECORACION_INICIAL.casa.adornos);
    expect(d.sombra).toEqual(DECORACION_INICIAL.sombra);
  });

  it('las macetas guardadas se limpian una por una', () => {
    expect(limpiarMacetas({ a: 'talavera', b: 'oro', c: 3, d: 'rosa' })).toEqual({ a: 'talavera', d: 'rosa' });
    expect(limpiarMacetas('nada')).toEqual({});
  });

  it('nadie encuentra su patio cambiado: lo de siempre es la cerca, el pasto y el gato', () => {
    expect(DECORACION_INICIAL.patio.barda).toBe('madera');
    expect(DECORACION_INICIAL.patio.piso).toBe('pasto');
    expect(DECORACION_INICIAL.casa.adornos).toContain('gato');
    expect(DECORACION_INICIAL.sombra.adornos).toContain('hongos');
  });
});

describe('las opciones', () => {
  it('no repiten valores y todas tienen nombre', () => {
    for (const lista of [BARDAS, MACETAS, ADORNOS_PATIO, ADORNOS_CASA, ADORNOS_SOMBRA] as Array<Array<{ valor: string; nombre: string }>>) {
      expect(new Set(lista.map((o) => o.valor)).size).toBe(lista.length);
      for (const o of lista) expect(o.nombre.length).toBeGreaterThan(2);
    }
  });

  it('alternar pone y quita', () => {
    expect(alternar(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(alternar(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('los adornos se reparten parejo, dentro de la escena y sin encimarse', () => {
    const x = lugaresDeAdornos(900, 3);
    expect(x).toEqual([150, 450, 750]);
    expect(lugaresDeAdornos(900, 0)).toEqual([]);
    expect(lugaresDeAdornos(Number.NaN, 2)).toEqual([]);
  });
});

describe('la maceta de cada planta', () => {
  const M: Pick<Morfologia, 'altura' | 'elementos' | 'caida' | 'brotes' | 'flores' | 'frutos' | 'senal' | 'vigor'> = {
    altura: 0.7,
    elementos: 7,
    caida: 0.05,
    brotes: 0,
    flores: 0,
    frutos: 0,
    senal: 'ninguna',
    vigor: 1,
  };
  const con = (estilo?: (typeof MACETAS)[number]['valor']): Malla => {
    const forma = formaDe('monstera-deliciosa');
    return armarMalla({ forma, morfologia: M, apariencia: aparienciaDe(forma, M), recipiente: 'maceta', detalle: 'alto', semilla: 'p1', estiloMaceta: estilo });
  };
  const colores = (m: Malla, fija: boolean) => new Set(m.caras.filter((c) => !!c.fija === fija).map((c) => c.color));

  it('la de talavera lleva su azul cobalto y su amarillo', () => {
    const t = colores(con('talavera'), true);
    expect(t.has('#2F4FA0')).toBe(true);
    expect(t.has('#E3A62E')).toBe(true);
  });

  it('cambiar la maceta no cambia la planta', () => {
    const barro = con('barro');
    const rosa = con('rosa');
    expect(colores(rosa, false)).toEqual(colores(barro, false));
    expect(colores(rosa, true)).not.toEqual(colores(barro, true));
    expect(rosa.caras.filter((c) => !c.fija).length).toBe(barro.caras.filter((c) => !c.fija).length);
  });
});
