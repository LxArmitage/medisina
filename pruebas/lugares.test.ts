/**
 * Mover plantas de zona.
 *
 * Lo que se protege: que la zona que se ve en Hoy y la luz con que se calcula
 * el riego nunca se contradigan, que mudarla no borre la ciudad ni el clima de
 * la planta, y que la app avise ANTES de llevar un helecho al sol.
 */

import { buscarEspecie } from '../src/dominio/catalogo';
import { LUGARES, lugarDe, lugarParaAviso, mejorLugarEn, ubicacionEn, veredictoMudanza, zonaDe } from '../src/dominio/lugares';
import type { Especie, Ubicacion } from '../src/dominio/tipos';

const especie = (id: string): Especie => buscarEspecie(id)!;

const PATIO: Ubicacion = { exposicion: 'semisol', techado: false, interior: false, zonaClimatica: 'BSh', lat: 19.43, lon: -99.13, municipio: 'CDMX' };

describe('lugar y luz son la misma cosa', () => {
  it.each(LUGARES.map((l) => l.lugar))('%s ida y vuelta', (lugar) => {
    const u = ubicacionEn(lugar, PATIO);
    expect(lugarDe(u)).toBe(lugar);
  });

  it('adentro siempre tiene techo y cuenta como interior', () => {
    const u = ubicacionEn('casa_adentro', PATIO);
    expect(u.interior).toBe(true);
    expect(u.techado).toBe(true);
    expect(zonaDe(u)).toBe('casa');
  });

  it('al sacarla de la casa ya le llueve; afuera conserva su techo', () => {
    const adentro = ubicacionEn('casa_ventana', PATIO);
    expect(ubicacionEn('patio_sol', adentro).techado).toBe(false);
    const conTecho = { ...PATIO, techado: true };
    expect(ubicacionEn('sombra', conTecho).techado).toBe(true);
  });

  it('mudarla no le borra la ciudad ni el clima', () => {
    const u = ubicacionEn('sombra', PATIO);
    expect(u.lat).toBe(19.43);
    expect(u.municipio).toBe('CDMX');
    expect(u.zonaClimatica).toBe('BSh');
  });
});

describe('al soltarla en una zona, cae en el mejor rincón para ella', () => {
  it('la sina en el patio va al sol; el potos en la casa, junto a la ventana', () => {
    expect(mejorLugarEn('patio', especie('lophocereus-schottii'))).toBe('patio_sol');
    expect(mejorLugarEn('casa', especie('epipremnum-aureum'))).toBe('casa_ventana');
  });

  it('una que no aguanta ninguna opción de esa zona va a la más parecida a su ideal', () => {
    // El nopal sólo quiere sol pleno: en la casa, lo más cercano es la ventana.
    expect(mejorLugarEn('casa', especie('opuntia-ficus-indica'))).toBe('casa_ventana');
  });
});

describe('avisa antes de moverla a donde le va mal', () => {
  it('su lugar ideal se dice', () => {
    expect(veredictoMudanza(especie('lophocereus-schottii'), 'patio_sol').nivel).toBe('ideal');
  });

  it('donde la aguanta, se dice que prefiere otro', () => {
    const v = veredictoMudanza(especie('lophocereus-schottii'), 'patio_medio');
    expect(v.nivel).toBe('aguanta');
    expect(v.texto).toMatch(/sol pleno/);
  });

  it('un helecho al sol se quema; una sina adentro se estira', () => {
    const helecho = veredictoMudanza(especie('nephrolepis-exaltata'), 'patio_sol', 'Rulo');
    expect(helecho.nivel).toBe('mal');
    expect(helecho.texto).toMatch(/quem/);
    const sina = veredictoMudanza(especie('lophocereus-schottii'), 'casa_adentro', 'Sinita');
    expect(sina.nivel).toBe('mal');
    expect(sina.texto).toMatch(/luz/);
    expect(sina.texto).toMatch(/Sinita/);
  });
});

describe('los avisos del clima dicen a dónde', () => {
  it('calor → sombra, helada → adentro, lluvia → sólo techo', () => {
    const e = especie('nephrolepis-exaltata');
    expect(lugarParaAviso('sombra', e)).toBe('sombra');
    expect(lugarParaAviso('adentro', e)).toBe('casa_ventana');
    expect(lugarParaAviso('techo', e)).toBeNull();
  });

  it('por la luz, a su banda ideal', () => {
    expect(lugarParaAviso('mas_luz', especie('lophocereus-schottii'))).toBe('patio_sol');
  });
});
