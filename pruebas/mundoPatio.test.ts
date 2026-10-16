/**
 * Pruebas del mapa del patio.
 *
 * Lo que se protege es lo que se nota al instante y arruina la escena: una
 * planta fuera del mundo, dos macetas encimadas, un NaN que en el teléfono
 * tumba la pantalla, o una sina que se va a pasear lejos de la planta que
 * necesita agua.
 */

import {
  ALTO_MUNDO,
  HORIZONTE,
  astro,
  armarMundo,
  duracionRuta,
  momentoDelDia,
  posicionSina,
  zonaPara,
} from '../src/ui/mundoPatio';
import type { ClaveZona, HabitanteEntrada } from '../src/ui/mundoPatio';

function planta(id: string, zona: ClaveZona, pideAtencion = false, urgencia = 3): HabitanteEntrada {
  return { id, zona, pideAtencion, urgencia };
}

const esFinito = (n: number) => Number.isFinite(n);

// ---------------------------------------------------------------------------

describe('cada planta en su zona', () => {
  it.each([
    ['maceta', 'sol_pleno', 'sol'],
    ['maceta', 'semisol', 'semisombra'],
    ['maceta', 'sombra', 'sombra'],
    ['maceta', 'interior_luminoso', 'interior'],
    ['maceta', 'interior_bajo', 'interior'],
    ['agua', 'sol_pleno', 'agua'],
  ] as const)('%s + %s → %s', (contenedor, banda, zona) => {
    expect(zonaPara(contenedor, banda)).toBe(zona);
  });

  it('las zonas van de la casa hacia afuera', () => {
    const m = armarMundo([planta('a', 'sol'), planta('b', 'interior'), planta('c', 'agua')], 360);
    expect(m.regiones.map((r) => r.zona)).toEqual(['interior', 'sol', 'agua']);
  });

  it('sólo aparecen las zonas que tienen plantas', () => {
    const m = armarMundo([planta('a', 'interior')], 360);
    expect(m.regiones.map((r) => r.zona)).toEqual(['interior']);
  });
});

describe('nada se sale del mundo', () => {
  const casos: HabitanteEntrada[][] = [
    [planta('solita', 'interior')],
    [planta('a', 'sol'), planta('b', 'sol'), planta('c', 'sol'), planta('d', 'sol'), planta('e', 'sol')],
    ['interior', 'sombra', 'semisombra', 'sol', 'agua'].flatMap((z, i) =>
      [0, 1, 2].map((j) => planta(`${z}-${j}-${i}`, z as ClaveZona)),
    ),
  ];

  it.each(casos.map((c, i) => [i, c] as const))('caso %i', (_i, habitantes) => {
    const m = armarMundo(habitantes, 360);
    for (const s of m.sitios) {
      expect([s.id, esFinito(s.x) && esFinito(s.base) && esFinito(s.escala)]).toEqual([s.id, true]);
      expect([s.id, s.x > 0 && s.x < m.ancho]).toEqual([s.id, true]);
      expect([s.id, s.base > HORIZONTE && s.base < ALTO_MUNDO]).toEqual([s.id, true]);
      const region = m.regiones.find((r) => r.zona === s.zona)!;
      expect([s.id, s.x >= region.x && s.x <= region.x + region.ancho]).toEqual([s.id, true]);
    }
  });

  it('con un ancho de pantalla roto no hay NaN', () => {
    for (const ancho of [NaN, 0, -5, Infinity]) {
      const m = armarMundo([planta('a', 'sol')], ancho);
      expect(esFinito(m.ancho)).toBe(true);
      expect(m.sitios.every((s) => esFinito(s.x))).toBe(true);
    }
  });

  it('sin plantas no truena', () => {
    const m = armarMundo([], 360);
    expect({ sitios: m.sitios.length, ruta: m.ruta.length }).toEqual({ sitios: 0, ruta: 0 });
  });
});

describe('el mundo llena la pantalla', () => {
  it('con pocas plantas se estira hasta el borde', () => {
    const m = armarMundo([planta('a', 'interior')], 400);
    expect(m.ancho).toBe(400);
    const ultima = m.regiones[m.regiones.length - 1];
    expect(ultima.x + ultima.ancho).toBeGreaterThan(360);
  });

  it('con muchas se hace más ancho que la pantalla y se recorre', () => {
    const muchas = Array.from({ length: 8 }, (_, i) => planta(`p${i}`, 'sol'));
    expect(armarMundo(muchas, 360).ancho).toBeGreaterThan(360);
  });
});

describe('no se enciman', () => {
  it('dos plantas de la misma fila guardan distancia', () => {
    const habitantes = Array.from({ length: 6 }, (_, i) => planta(`p${i}`, 'sol'));
    const m = armarMundo(habitantes, 360);
    const adelante = m.sitios.filter((s) => s.escala === 1).sort((a, b) => a.x - b.x);
    for (let i = 1; i < adelante.length; i += 1) {
      expect(adelante[i].x - adelante[i - 1].x).toBeGreaterThan(60);
    }
  });

  it('las de atrás se dibujan primero', () => {
    const habitantes = Array.from({ length: 4 }, (_, i) => planta(`p${i}`, 'sombra'));
    const bases = armarMundo(habitantes, 360).sitios.map((s) => s.base);
    expect([...bases].sort((a, b) => a - b)).toEqual(bases);
  });
});

describe('cada planta tiene su lugar', () => {
  it('la misma planta cae en el mismo sitio cada vez', () => {
    const a = armarMundo([planta('doña-sina', 'interior'), planta('otra', 'sol')], 360);
    const b = armarMundo([planta('otra', 'sol'), planta('doña-sina', 'interior')], 360);
    expect(a.sitios).toEqual(b.sitios);
  });
});

describe('la sina', () => {
  it('va primero a la que más urge', () => {
    const m = armarMundo(
      [planta('tranquila', 'sol'), planta('sedienta', 'sol', true, 0), planta('medio', 'interior', true, 1)],
      360,
    );
    expect(m.ruta[0].visita).toBe('sedienta');
    expect(m.ruta[1].visita).toBe('medio');
  });

  it('si nadie pide nada, pasea por todas', () => {
    const m = armarMundo([planta('a', 'interior'), planta('b', 'sol')], 360);
    expect(m.ruta.filter((p) => p.visita).map((p) => p.visita).sort()).toEqual(['a', 'b']);
  });

  it('la vuelta termina donde empezó, para que al repetirse no salte', () => {
    const m = armarMundo([planta('a', 'interior'), planta('b', 'sol')], 360);
    expect(m.ruta[m.ruta.length - 1].x).toBe(m.inicioSina);
  });

  it('mira hacia donde camina', () => {
    const m = armarMundo([planta('a', 'interior'), planta('b', 'agua')], 360);
    let desde = m.inicioSina;
    for (const p of m.ruta) {
      if (p.x !== desde) expect(p.mira).toBe(p.x > desde ? 1 : -1);
      desde = p.x;
    }
  });

  it('nunca camina en cero milisegundos', () => {
    const m = armarMundo([planta('a', 'interior')], 360);
    expect(m.ruta.every((p) => p.caminar >= 300 && esFinito(p.caminar))).toBe(true);
  });
});

describe('la sina en cada instante', () => {
  const m = armarMundo([planta('a', 'interior'), planta('b', 'sol', true, 0)], 360);
  const total = duracionRuta(m.ruta);

  it('la vuelta dura lo que suman sus tramos', () => {
    expect(total).toBe(m.ruta.reduce((s, p) => s + p.caminar + p.esperar, 0));
  });

  it('empieza y termina en el mismo lugar', () => {
    expect(posicionSina(m.ruta, m.inicioSina, 0).x).toBe(m.inicioSina);
    expect(posicionSina(m.ruta, m.inicioSina, total - 0.001).x).toBeCloseTo(m.inicioSina, 1);
    expect(posicionSina(m.ruta, m.inicioSina, total).x).toBe(m.inicioSina);
  });

  it('parada junto a una planta no se mueve ni brinca, y la mira', () => {
    const p = m.ruta[0];
    const quieta = posicionSina(m.ruta, m.inicioSina, p.caminar + p.esperar / 2);
    expect(quieta).toEqual({ x: p.x, andando: false, mira: 1, pasos: 0 });
  });

  it('a medio camino está entre las dos paradas y mira hacia allá', () => {
    const p = m.ruta[0];
    const medio = posicionSina(m.ruta, m.inicioSina, p.caminar / 2);
    expect(medio.andando).toBe(true);
    expect(medio.mira).toBe(p.mira);
    const [a, b] = [m.inicioSina, p.x].sort((x, y) => x - y);
    expect(medio.x).toBeGreaterThanOrEqual(a);
    expect(medio.x).toBeLessThanOrEqual(b);
  });

  it('nunca da NaN, ni con relojes raros ni sin ruta', () => {
    for (const t of [-500, 0, 1, total * 3.3, NaN, Infinity]) {
      const pos = posicionSina(m.ruta, m.inicioSina, t);
      expect([t, Number.isFinite(pos.x) && Number.isFinite(pos.pasos)]).toEqual([t, true]);
    }
    expect(posicionSina([], 120, 500).x).toBe(120);
  });
});

describe('el cielo sigue la hora', () => {
  it.each([
    [3, 'noche'],
    [7, 'amanecer'],
    [13, 'dia'],
    [19, 'atardecer'],
    [22, 'noche'],
  ] as const)('a las %i es %s', (hora, momento) => {
    expect(momentoDelDia(new Date(2026, 8, 23, hora))).toBe(momento);
  });

  it('el sol está alto a mediodía y bajo al atardecer', () => {
    const mediodia = astro(new Date(2026, 8, 23, 13));
    const tarde = astro(new Date(2026, 8, 23, 19, 30));
    expect(mediodia.esSol).toBe(true);
    expect(mediodia.y).toBeLessThan(tarde.y);
  });

  it('de noche sale la luna', () => {
    expect(astro(new Date(2026, 8, 23, 23)).esSol).toBe(false);
  });
});
