/**
 * Conocer las plantas: sus nombres, sus datos curiosos y cómo se agrupan.
 *
 * Lo que se cuida aquí es lo que motivó todo esto: que una pitahaya se llame
 * pitahaya —y pitaya, y fruta del dragón, y "dragon fruit"—, que se encuentre
 * por cualquiera de esos nombres, y que cada planta tenga algo cierto que
 * contar.
 */

import { ESPECIES, buscarEspecie, esGenerica, especiesReales, filtrarEspecies } from '../src/dominio/catalogo';
import { enCategoria } from '../src/dominio/categorias';
import { curiosidadesDe, datoDelDia, especiesConCuriosidades } from '../src/dominio/curiosidades';
import { lineaDeNombres, nombresDe } from '../src/dominio/nombres';

describe('la pitahaya existe y se llama como la conoce la gente', () => {
  it('está en el catálogo', () => {
    const p = buscarEspecie('selenicereus-undatus');
    expect(p?.nombresComunes[0]).toBe('pitahaya');
  });

  it('tiene todos sus nombres, sin repetir', () => {
    const n = nombresDe(buscarEspecie('selenicereus-undatus')!);
    expect(n.principal).toBe('Pitahaya');
    expect(n.otros).toEqual(expect.arrayContaining(['pitaya', 'fruta del dragón']));
    expect(n.ingles).toContain('dragon fruit');
    // "pitaya" también está en inglés, pero ya se dijo en español.
    expect(n.ingles).not.toContain('pitaya');
    expect(lineaDeNombres(buscarEspecie('selenicereus-undatus')!)).toBe('También: pitaya, fruta del dragón · En inglés: dragon fruit');
  });

  it.each([
    ['dragon fruit', 'selenicereus-undatus'],
    ['fruta del dragon', 'selenicereus-undatus'],
    ['PITAYA', 'selenicereus-undatus'],
    ['snake plant', 'dracaena-trifasciata'],
    ['pothos', 'epipremnum-aureum'],
    ['bird of paradise', 'strelitzia-reginae'],
    ['te limon', 'cymbopogon-citratus'],
  ])('se encuentra buscando "%s"', (consulta, id) => {
    expect(filtrarEspecies(consulta).map((e) => e.id)).toContain(id);
  });

  it('una especie sin otros nombres no inventa la línea', () => {
    expect(lineaDeNombres({ nombresComunes: ['ruda'], nombreCientifico: 'Ruta graveolens' })).toBe('');
  });
});

describe('cada planta tiene algo que contar', () => {
  it('todas las especies de verdad tienen al menos tres datos, y las genéricas ninguno', () => {
    const sinDatos = especiesReales().filter((e) => curiosidadesDe(e.id).length < 3).map((e) => e.id);
    expect(sinDatos).toEqual([]);
    for (const e of ESPECIES.filter((x) => esGenerica(x.id))) expect(curiosidadesDe(e.id)).toEqual([]);
  });

  it('no hay datos de especies que no existen', () => {
    const ids = new Set(ESPECIES.map((e) => e.id));
    expect(especiesConCuriosidades().filter((id) => !ids.has(id))).toEqual([]);
  });

  it('son frases cortas, terminadas, y ninguna es un consejo médico', () => {
    for (const id of especiesConCuriosidades()) {
      for (const dato of curiosidadesDe(id)) {
        expect([id, dato.length <= 200]).toEqual([id, true]);
        expect([id, /[.!?]$/.test(dato)]).toEqual([id, true]);
        expect([id, /\b(cura|curar|remedio|medicinal|alivia|sana)\b/i.test(dato)]).toEqual([id, false]);
      }
    }
  });

  it('el dato del día es el mismo todo el día, cambia al día siguiente y distingue plantas', () => {
    const manana = new Date(2026, 8, 25, 8);
    const noche = new Date(2026, 8, 25, 22);
    const otroDia = new Date(2026, 8, 26, 8);
    expect(datoDelDia('selenicereus-undatus', manana)).toBe(datoDelDia('selenicereus-undatus', noche));
    expect(datoDelDia('selenicereus-undatus', manana)).not.toBe(datoDelDia('selenicereus-undatus', otroDia));
    const datos = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => datoDelDia('selenicereus-undatus', manana, s)));
    expect(datos.size).toBeGreaterThan(1);
    expect(datoDelDia('generica-flor', manana)).toBeUndefined();
  });
});

describe('las categorías para curiosear', () => {
  const en = (id: string, c: Parameters<typeof enCategoria>[1]) => enCategoria(buscarEspecie(id)!, c);

  it('la pitahaya, el mango y el plátano son frutales; el jitomate es de cocina', () => {
    expect(en('selenicereus-undatus', 'frutales')).toBe(true);
    expect(en('mangifera-indica', 'frutales')).toBe(true);
    expect(en('musa', 'frutales')).toBe(true);
    expect(en('solanum-lycopersicum', 'frutales')).toBe(false);
    expect(en('solanum-lycopersicum', 'cocina')).toBe(true);
  });

  it('la pitahaya también es cactus; la lavanda es de flor; el potos es de interior', () => {
    expect(en('selenicereus-undatus', 'suculentas')).toBe(true);
    expect(en('lavandula', 'flor')).toBe(true);
    expect(en('epipremnum-aureum', 'interior')).toBe(true);
    expect(en('epipremnum-aureum', 'frutales')).toBe(false);
  });

  it('ninguna especie de verdad se queda sin categoría', () => {
    const huerfanas = especiesReales().filter(
      (e) => !(['suculentas', 'interior', 'flor', 'frutales', 'cocina'] as const).some((c) => enCategoria(e, c)),
    );
    // Algunas de patio sin flor vistosa (maguey, pata de elefante…) sólo
    // salen en "Todas"; que no sean demasiadas.
    expect(huerfanas.length).toBeLessThan(8);
  });
});
