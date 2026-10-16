/**
 * Jardines compartidos por QR.
 *
 * Lo que se protege: que un jardín vaya y regrese igual por el código, que un
 * código escrito a mano no meta basura (especies que no existen, textos
 * enormes, números fuera de rango), que el código se encuentre aunque venga en
 * medio de un mensaje de WhatsApp, y que la tabla premie cuidar sobre
 * acumular.
 */

import { calificar, codificarJardin, leerJardin, mensajeDeJardin, ordenarTop } from '../src/dominio/jardinCompartido';
import type { JardinCompartido, PlantaCompartida } from '../src/dominio/jardinCompartido';
import { estadosDeVisita } from '../src/ui/visita';
import { zonaDe } from '../src/dominio/lugares';

const planta = (especieId: string, extra: Partial<PlantaCompartida> = {}): PlantaCompartida => ({
  especieId,
  apodo: especieId.split('-')[0],
  zona: 'patio',
  nivel: 'optimo',
  ...extra,
});

const jardin = (extra: Partial<JardinCompartido> = {}): JardinCompartido => ({
  id: 'abc123-xyz',
  dueno: 'Lupita',
  ciudad: 'Culiacán',
  racha: 12,
  mejorRacha: 20,
  fecha: '2026-09-20',
  plantas: [
    planta('aloe-vera', { apodo: 'Sábila', alturaCm: 35, hoja: '#5A8F3C' }),
    planta('monstera-deliciosa', { zona: 'casa', nivel: 'seco', elementos: 9 }),
    planta('epipremnum-aureum', { zona: 'sombra' }),
  ],
  ...extra,
});

describe('ida y vuelta por el código', () => {
  test('el jardín regresa igual', () => {
    const j = jardin();
    expect(leerJardin(codificarJardin(j))).toEqual(j);
  });

  test('se encuentra en medio de un mensaje, con texto antes y después', () => {
    const j = jardin();
    const pegado = `[20/9 10:31] Lupita: ${mensajeDeJardin(j)}\n\n`;
    expect(leerJardin(pegado)?.dueno).toBe('Lupita');
  });

  test('un jardín grande cabe en un QR que se lee bien', () => {
    const ids = ['aloe-vera', 'monstera-deliciosa', 'epipremnum-aureum', 'opuntia-ficus-indica', 'lophocereus-schottii', 'phalaenopsis'];
    const j = jardin({
      plantas: Array.from({ length: 40 }, (_, i) =>
        planta(ids[i % ids.length], { apodo: 'Una planta con nombre largo', alturaCm: 120, elementos: 30, hoja: '#123456' }),
      ),
    });
    const codigo = codificarJardin(j);
    // Sólo viajan 24, y el texto no pasa de lo que un QR nivel L aguanta holgado.
    expect(leerJardin(codigo)?.plantas).toHaveLength(24);
    expect(codigo.length).toBeLessThan(2000);
  });
});

describe('lo que llega no se cree', () => {
  test('lo que no es de MEDISINA no pasa', () => {
    expect(leerJardin('hola')).toBeNull();
    expect(leerJardin('https://ejemplo.com')).toBeNull();
    expect(leerJardin('MEDISINA1:{no es json')).toBeNull();
    expect(leerJardin('MEDISINA1:[1,2,3]')).toBeNull();
  });

  test('un id raro o sin nombre no pasa', () => {
    expect(leerJardin(codificarJardin(jardin({ id: '../../etc' })))).toBeNull();
    expect(leerJardin(codificarJardin(jardin({ dueno: '   ' })))).toBeNull();
  });

  test('las especies que no existen se descartan; las demás se quedan', () => {
    const j = jardin({ plantas: [planta('aloe-vera'), planta('planta-inventada')] });
    expect(leerJardin(codificarJardin(j))?.plantas.map((p) => p.especieId)).toEqual(['aloe-vera']);
  });

  test('números fuera de rango y colores inválidos se corrigen', () => {
    const codigo = 'MEDISINA1:' + JSON.stringify(['abcd1234', 'Beto<script>', '', -5, 3, 'ayer', [['aloe-vera', '', 9, 99, 99999, -3, 'zzzzzz']]]);
    const j = leerJardin(codigo)!;
    expect(j.dueno).toBe('Betoscript');
    expect(j.racha).toBe(0);
    expect(j.mejorRacha).toBe(3);
    expect(j.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const p = j.plantas[0];
    expect(p.zona).toBe('sombra');
    expect(p.nivel).toBe('critico');
    expect(p.alturaCm).toBe(2000);
    expect(p.elementos).toBeUndefined();
    expect(p.hoja).toBeUndefined();
    // Sin apodo, se llama como su especie.
    expect(p.apodo.length).toBeGreaterThan(0);
  });
});

describe('la tabla', () => {
  test('tres plantas bien cuidadas le ganan a veinte con sed', () => {
    const cuidado = jardin({ racha: 20, plantas: [planta('aloe-vera'), planta('monstera-deliciosa'), planta('epipremnum-aureum')] });
    const abandonado = jardin({
      id: 'otro-jardin',
      racha: 0,
      plantas: Array.from({ length: 20 }, () => planta('aloe-vera', { nivel: 'critico' })),
    });
    expect(calificar(cuidado).total).toBeGreaterThan(calificar(abandonado).total);
  });

  test('la calificación va de 0 a 100 y sus partes suman el total', () => {
    const vacio = calificar(jardin({ racha: 0, plantas: [] }));
    expect(vacio.total).toBe(0);
    const ids = ['aloe-vera', 'monstera-deliciosa', 'epipremnum-aureum', 'opuntia-ficus-indica', 'lophocereus-schottii', 'phalaenopsis',
      'ficus-elastica', 'mammillaria', 'cycas-revoluta', 'nerium-oleander', 'plumeria-rubra', 'mangifera-indica'];
    const lleno = calificar(jardin({ racha: 400, plantas: ids.map((id, i) => planta(id, { zona: (['patio', 'casa', 'sombra'] as const)[i % 3] })).concat(ids.slice(0, 4).map((id) => planta(id))) }));
    expect(lleno.total).toBe(100);
    const p = lleno.partes;
    expect(p.salud + p.constancia + p.variedad + p.tamano).toBe(lleno.total);
    expect(lleno.insignias.map((i) => i.clave)).toEqual(expect.arrayContaining(['mes', 'verde', 'coleccion', 'tres']));
  });

  test('empate de puntos: gana la racha más larga', () => {
    const a = { jardin: jardin({ id: 'aaaa', racha: 30, mejorRacha: 30 }) };
    const b = { jardin: jardin({ id: 'bbbb', racha: 31, mejorRacha: 31 }) };
    // Con racha de 30 y 31 la constancia ya está al tope: mismos puntos.
    expect(calificar(a.jardin).total).toBe(calificar(b.jardin).total);
    expect(ordenarTop([a, b]).map((f) => f.jardin.id)).toEqual(['bbbb', 'aaaa']);
  });
});

describe('de visita', () => {
  test('cada planta aparece en la zona donde vive su dueño', () => {
    const estados = estadosDeVisita(jardin());
    expect(estados.map((e) => zonaDe(e.planta.ubicacion))).toEqual(['patio', 'casa', 'sombra']);
    expect(estados.map((e) => e.estadoHoy.nivel)).toEqual(['optimo', 'seco', 'optimo']);
    // De visita no se riega: nada pide agua.
    expect(estados.every((e) => e.recomendacion.accion === 'no_regar')).toBe(true);
  });
});
