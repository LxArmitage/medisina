/**
 * Pruebas de la morfología del gemelo visual.
 *
 * Lo que se protege aquí es que el dibujo siga siendo un dato y no un adorno:
 * si la planta está sufriendo, tiene que verse sufriendo, y por la razón
 * correcta.
 */

import type { EstadoHidrico } from '../src/dominio/balanceHidrico';
import type { EventoEsperado } from '../src/dominio/fenologia';
import { buscarEspecie } from '../src/dominio/catalogo';
import { alturaEstimadaCm, calcularMorfologia, describirMorfologia, mezclar } from '../src/dominio/morfologia';
import { especie } from './ayudas';

function estado(nivel: EstadoHidrico['nivel'], fraccion = 0.5): EstadoHidrico {
  return {
    fecha: '2026-06-15',
    aguaDisponibleMm: 20,
    fraccionDisponible: fraccion,
    demandaMm: 3,
    aporteMm: 0,
    diasConsecutivosEncharcado: nivel === 'encharcado' ? 4 : 0,
    diasConsecutivosEnEstres: nivel === 'critico' || nivel === 'seco' ? 3 : 0,
    nivel,
    esPronostico: false,
  };
}

function enCurso(fenomeno: EventoEsperado['fenomeno']): EventoEsperado {
  return {
    fenomeno,
    inicio: '2026-05-01',
    fin: '2026-08-01',
    diasParaInicio: 0,
    enCurso: true,
    fuente: 'catalogo',
    confianza: 'media',
    ajusteDias: 0,
  };
}

// ---------------------------------------------------------------------------

describe('arquetipo según la familia funcional', () => {
  it.each([
    ['cactacea_suculenta', 'cactacea'],
    ['helecho', 'fronda'],
    ['trepadora', 'trepadora'],
    ['arborea', 'arbol'],
    ['acuatica', 'flotante'],
  ] as const)('%s se dibuja como %s', (familia, arquetipo) => {
    const m = calcularMorfologia({
      especie: especie({ familiaFuncional: familia }),
      estado: estado('optimo'),
    });
    expect(m.arquetipo).toBe(arquetipo);
  });
});

describe('la caída refleja el estado, no el gusto', () => {
  it('una planta sana está erguida', () => {
    const m = calcularMorfologia({ especie: especie(), estado: estado('optimo') });
    expect(m.caida).toBeLessThan(0.15);
    expect(m.senal).toBe('ninguna');
  });

  it('en crítico se vence casi del todo', () => {
    const m = calcularMorfologia({ especie: especie(), estado: estado('critico') });
    expect(m.caida).toBeGreaterThan(0.8);
  });

  /**
   * El punto central del módulo: el exceso de riego pudre la raíz, la raíz
   * podrida no sube agua, y la planta se marchita aunque le sobre. Si sólo se
   * dibujara la caída, el usuario leería "sed" y regaría más, que es justo lo
   * que la mata.
   */
  it('la encharcada también se cae, pero la señal la distingue de la sed', () => {
    const ahogada = calcularMorfologia({ especie: especie(), estado: estado('encharcado') });
    const sedienta = calcularMorfologia({ especie: especie(), estado: estado('seco') });

    expect(ahogada.caida).toBeGreaterThan(0.5);
    expect(sedienta.caida).toBeGreaterThan(0.3);

    expect(ahogada.senal).toBe('ahogo');
    expect(sedienta.senal).toBe('sed');
    expect(ahogada.verde).not.toBe(sedienta.verde);
  });

  it('el texto de accesibilidad nunca confunde ahogo con sed', () => {
    const ahogada = calcularMorfologia({ especie: especie(), estado: estado('encharcado') });
    expect(describirMorfologia(ahogada)).toMatch(/exceso de agua/i);
    expect(describirMorfologia(ahogada)).not.toMatch(/falta de agua/i);
  });
});

describe('rigidez por arquetipo', () => {
  it('un cactus en crítico se dobla mucho menos que un helecho en crítico', () => {
    const cactus = calcularMorfologia({
      especie: especie({ familiaFuncional: 'cactacea_suculenta' }),
      estado: estado('critico'),
    });
    const helecho = calcularMorfologia({
      especie: especie({ familiaFuncional: 'helecho' }),
      estado: estado('critico'),
    });
    expect(cactus.caida).toBeLessThan(helecho.caida / 2);
  });
});

describe('ornamentos', () => {
  it('sólo aparecen si la fenología está en curso', () => {
    const sinTemporada = calcularMorfologia({ especie: especie(), estado: estado('optimo') });
    expect(sinTemporada.flores).toBe(0);
    expect(sinTemporada.frutos).toBe(0);

    const enFloracion = calcularMorfologia({
      especie: especie(),
      estado: estado('optimo'),
      fenologia: [enCurso('floracion')],
    });
    expect(enFloracion.flores).toBeGreaterThan(0);
  });

  /** Una planta que se está muriendo no gasta energía en florecer. */
  it('una planta sin vigor no florece aunque sea temporada', () => {
    const m = calcularMorfologia({
      especie: especie(),
      estado: estado('critico'),
      fenologia: [enCurso('floracion')],
    });
    expect(m.flores).toBe(0);
  });
});

describe('edad', () => {
  it('una planta vieja es más grande y tiene más hojas que una recién llegada', () => {
    const bebe = calcularMorfologia({ especie: especie(), estado: estado('optimo'), edadMeses: 0 });
    const adulta = calcularMorfologia({
      especie: especie(),
      estado: estado('optimo'),
      edadMeses: 48,
    });
    expect(adulta.altura).toBeGreaterThan(bebe.altura);
    expect(adulta.elementos).toBeGreaterThan(bebe.elementos);
  });

  it('el tamaño se estabiliza en el de su especie adulta: no crece para siempre', () => {
    const sp = especie();
    const veinteAnos = calcularMorfologia({ especie: sp, estado: estado('optimo'), edadMeses: 240 });
    const cuarentaAnos = calcularMorfologia({ especie: sp, estado: estado('optimo'), edadMeses: 480 });
    expect(Math.abs(cuarentaAnos.altura - veinteAnos.altura)).toBeLessThan(0.02);
    expect(alturaEstimadaCm(sp, 480)).toBeLessThanOrEqual(sp.alturaMaximaCm);
    expect(cuarentaAnos.desarrollo).toBeGreaterThan(0.95);
  });

  /** Lo que se reportó: el limonero de vivero y una echeveria se veían igual de grandes. */
  it('sin medir, cada especie llega a casa con su tamaño: un limonero no es una echeveria', () => {
    const limon = buscarEspecie('citrus-limon')!;
    const echeveria = buscarEspecie('echeveria-elegans')!;
    expect(alturaEstimadaCm(limon, 0)).toBeGreaterThan(alturaEstimadaCm(echeveria, 0) * 4);
    const a = calcularMorfologia({ especie: limon, estado: estado('optimo'), edadMeses: 0 });
    const b = calcularMorfologia({ especie: echeveria, estado: estado('optimo'), edadMeses: 0 });
    expect(a.altura).toBeGreaterThan(b.altura);
  });

  it('una planta muy chica todavía no da fruta aunque sea temporada', () => {
    const limon = buscarEspecie('citrus-limon')!;
    const fruta = [enCurso('fructificacion')];
    const vara = calcularMorfologia({ especie: limon, estado: estado('optimo'), fenologia: fruta, medidas: { fecha: '2026-06-15', alturaCm: 15 } });
    const arbol = calcularMorfologia({ especie: limon, estado: estado('optimo'), fenologia: fruta, medidas: { fecha: '2026-06-15', alturaCm: 180 } });
    expect(vara.frutos).toBe(0);
    expect(arbol.frutos).toBeGreaterThan(0);
    expect(arbol.desarrollo).toBeGreaterThan(vara.desarrollo);
  });
});

describe('mezclar colores', () => {
  it('devuelve los extremos sin tocarlos', () => {
    expect(mezclar('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mezclar('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('el punto medio queda a medio camino', () => {
    expect(mezclar('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('acota proporciones fuera de rango', () => {
    expect(mezclar('#000000', '#ffffff', -3)).toBe('#000000');
    expect(mezclar('#000000', '#ffffff', 9)).toBe('#ffffff');
  });
});
