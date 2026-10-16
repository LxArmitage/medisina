/**
 * Pruebas del gemelo en 3D.
 *
 * Lo que se protege es lo que se nota al instante: una especie sin forma (sale
 * genérica), un NaN en un trazo (en el teléfono tumba la pantalla), un gemelo
 * que no cambia con la sed (el dibujo dejaría de decir algo), o uno tan pesado
 * que el teléfono no lo pueda girar.
 */

import { ESPECIES } from '../src/dominio/catalogo';
import { aparienciaDe, especiesConForma, formaDe } from '../src/dominio/forma';
import type { Morfologia } from '../src/dominio/morfologia';
import { armarMalla, crecerMalla } from '../src/ui/tresd/malla';
import type { Malla, Recipiente } from '../src/ui/tresd/malla';
import { caraEn, encuadrar, proyectar } from '../src/ui/tresd/proyeccion';

type M = Pick<Morfologia, 'altura' | 'elementos' | 'caida' | 'brotes' | 'flores' | 'frutos' | 'senal' | 'vigor'>;

const SANA: M = { altura: 0.7, elementos: 7, caida: 0.08, brotes: 0, flores: 0, frutos: 0, senal: 'ninguna', vigor: 1 };
const SEDIENTA: M = { ...SANA, caida: 0.6, senal: 'sed', vigor: 0.45 };

function malla(especieId: string, m: M = SANA, recipiente: Recipiente = 'maceta', detalle: 'bajo' | 'alto' = 'alto'): Malla {
  const forma = formaDe(especieId);
  return armarMalla({
    forma,
    morfologia: m,
    apariencia: aparienciaDe(forma, m),
    recipiente,
    detalle,
    semilla: especieId,
  });
}

const VISTA = { giro: -0.5, inclinacion: 0.28, ancho: 300, alto: 330 };

describe('cada especie del catálogo tiene su forma', () => {
  it('ninguna se queda con la genérica', () => {
    const conForma = new Set(especiesConForma());
    expect(ESPECIES.map((e) => e.id).filter((id) => !conForma.has(id))).toEqual([]);
  });

  it('las que más se confundían ya no se parecen', () => {
    // Antes la sábila salía como cactus de columnas y el potos igual que la monstera.
    expect(formaDe('aloe-vera').porte).toBe('roseta');
    expect(formaDe('lophocereus-schottii').porte).toBe('columnas');
    expect(formaDe('epipremnum-aureum').porte).not.toBe(formaDe('monstera-deliciosa').porte);
    expect(formaDe('dracaena-trifasciata').patron).toBe('bandas');
  });
});

describe('se puede dibujar sin romper nada', () => {
  const casos: Array<[string, Recipiente]> = [];
  for (const e of ESPECIES) casos.push([e.id, formaDe(e.id).porte === 'flotante' ? 'agua' : 'maceta']);
  casos.push(['epipremnum-aureum', 'agua'], ['citrus-limon', 'suelo']);

  it.each(casos)('%s en %s', (id, recipiente) => {
    for (const m of [SANA, SEDIENTA, { ...SANA, flores: 3, frutos: 2, brotes: 2 }]) {
      const mm = malla(id, m, recipiente);
      expect(mm.caras.length).toBeGreaterThan(20);
      const coordenadasSanas = mm.caras.every((c) => c.p.every((p) => p.every(Number.isFinite)));
      expect([id, coordenadasSanas]).toEqual([id, true]);
      const dib = proyectar(mm, VISTA, encuadrar(mm));
      expect(dib.poligonos.length).toBeGreaterThan(5);
      const trazosSanos = dib.poligonos.every((p) => !/NaN|Infinity/.test(p.d) && /^#[0-9a-f]{6}$/.test(p.fill));
      expect([id, trazosSanos]).toEqual([id, true]);
    }
  });

  it('con datos rotos (NaN) tampoco', () => {
    const rota = { ...SANA, altura: NaN, elementos: NaN, caida: NaN, vigor: NaN } as M;
    const mm = malla('dracaena-trifasciata', rota);
    const dib = proyectar(mm, VISTA, encuadrar(mm));
    expect(dib.poligonos.every((p) => !/NaN/.test(p.d))).toBe(true);
  });
});

describe('el teléfono la puede girar', () => {
  it.each(ESPECIES.map((e) => e.id))('%s no pasa de un tope de caras', (id) => {
    const alto = malla(id, { ...SANA, elementos: 14, flores: 4, frutos: 3 });
    const bajo = malla(id, { ...SANA, elementos: 14, flores: 4, frutos: 3 }, 'maceta', 'bajo');
    expect(alto.caras.length).toBeLessThan(2600);
    expect(bajo.caras.length).toBeLessThanOrEqual(alto.caras.length);
  });
});

describe('crece con los años', () => {
  it('crecer agranda la planta y deja la maceta igual', () => {
    const hoy = malla('citrus-limon');
    const grande = crecerMalla(hoy, 1.5);
    const alto = (m: Malla, fija: boolean) =>
      Math.max(...m.caras.filter((c) => !!c.fija === fija).flatMap((c) => c.p.map((q) => q[1])));
    const bajo = (m: Malla) => Math.min(...m.caras.filter((c) => c.fija).flatMap((c) => c.p.map((q) => q[1])));
    expect(alto(grande, false)).toBeCloseTo(alto(hoy, false) * 1.5, 5);
    expect(bajo(grande)).toBe(bajo(hoy));
    expect(hoy.caras.some((c) => c.fija)).toBe(true);
  });

  it('un árbol hecho tiene más ramas y tronco más grueso que uno de vivero', () => {
    const joven = malla('citrus-limon', { ...SANA, desarrollo: 0.2 } as M);
    const hecho = malla('citrus-limon', { ...SANA, desarrollo: 0.9 } as M);
    const tallos = (m: Malla) => m.caras.filter((c) => c.parte === 'tallo').length;
    expect(tallos(hecho)).toBeGreaterThan(tallos(joven) * 1.5);
    const radioTronco = (m: Malla) =>
      Math.max(...m.caras.filter((c) => c.parte === 'tallo' && c.indice === 0).flatMap((c) => c.p.filter((q) => q[1] < 0.05).map((q) => Math.hypot(q[0], q[2]))));
    expect(radioTronco(hecho)).toBeGreaterThan(radioTronco(joven) * 1.3);
  });

  it.each(ESPECIES.map((e) => e.id))('%s, adulta y en temporada, tampoco pasa del tope de caras', (id) => {
    const alto = malla(id, { ...SANA, elementos: 14, flores: 4, frutos: 3, desarrollo: 1 } as M);
    expect(alto.caras.length).toBeLessThan(2600);
  });
});

describe('el gemelo dice cómo está la planta', () => {
  /** Qué tan alto llegan en promedio las puntas de las hojas. */
  function alturaDeHojas(mm: Malla): number {
    const ys = mm.caras.filter((c) => c.parte === 'hoja').flatMap((c) => c.p.map((p) => p[1]));
    return ys.reduce((s, y) => s + y, 0) / ys.length;
  }

  it.each(['dracaena-trifasciata', 'ocimum-basilicum', 'nephrolepis-exaltata', 'spathiphyllum-wallisii'])(
    'con sed, las hojas de %s se vencen',
    (id) => {
      expect(alturaDeHojas(malla(id, SEDIENTA))).toBeLessThan(alturaDeHojas(malla(id, SANA)));
    },
  );

  it('con sed, el verde se amarillea', () => {
    const forma = formaDe('ocimum-basilicum');
    const sana = aparienciaDe(forma, SANA);
    const sedienta = aparienciaDe(forma, SEDIENTA);
    const rojoVerde = (hex: string) => parseInt(hex.slice(1, 3), 16) / Math.max(1, parseInt(hex.slice(3, 5), 16));
    expect(rojoVerde(sedienta.hoja)).toBeGreaterThan(rojoVerde(sana.hoja));
  });

  it('el color que se midió en la foto manda sobre el de la especie', () => {
    const forma = formaDe('dracaena-trifasciata');
    const observada = { hoja: '#8FB23A', hojaOscura: '#4E6A1E', acento: '#E8E07A', fecha: '2026-09-24' };
    const ap = aparienciaDe(forma, SANA, observada);
    expect(ap.hoja).toBe('#8fb23a');
    expect(ap.acento).toBe('#E8E07A');
  });

  it('las flores sólo salen en su temporada', () => {
    const sinFlor = malla('hibiscus-rosa-sinensis', SANA);
    const conFlor = malla('hibiscus-rosa-sinensis', { ...SANA, flores: 3 });
    expect(sinFlor.caras.some((c) => c.parte === 'flor')).toBe(false);
    expect(conFlor.caras.some((c) => c.parte === 'flor')).toBe(true);
  });

  it('la misma planta sale igual cada vez', () => {
    const a = proyectar(malla('epipremnum-aureum'), VISTA);
    const b = proyectar(malla('epipremnum-aureum'), VISTA);
    expect(a.poligonos.map((p) => p.d).join()).toBe(b.poligonos.map((p) => p.d).join());
  });
});

describe('al tocarla se sabe qué parte fue', () => {
  it('el centro de una cara devuelve esa parte; fuera de la planta, nada', () => {
    const mm = malla('dracaena-trifasciata');
    const dib = proyectar(mm, VISTA, encuadrar(mm));
    // La cara más cercana a la cámara es la última: tocarla en su centro la encuentra.
    const ultima = dib.caras[dib.caras.length - 1];
    const cx = ultima.puntos.reduce((s, p) => s + p[0], 0) / ultima.puntos.length;
    const cy = ultima.puntos.reduce((s, p) => s + p[1], 0) / ultima.puntos.length;
    expect(caraEn(dib, cx, cy)?.parte).toBe(ultima.parte);
    expect(caraEn(dib, 1, 1)).toBeNull();
  });

  it('la maceta cuenta como sustrato', () => {
    const mm = malla('ocimum-basilicum');
    expect(mm.caras.some((c) => c.parte === 'sustrato')).toBe(true);
  });

  it('con una parte activa, lo demás se deslava', () => {
    const mm = malla('ocimum-basilicum');
    const dib = proyectar(mm, VISTA, encuadrar(mm), { parteActiva: { tipo: 'sustrato' } });
    const macetas = dib.poligonos.filter((p) => p.parte === 'sustrato');
    const resto = dib.poligonos.filter((p) => p.parte !== 'sustrato');
    expect(macetas.every((p) => p.opacidad === 1)).toBe(true);
    expect(resto.every((p) => p.opacidad < 0.5)).toBe(true);
  });
});

describe('cabe en su cuadro, girada como sea', () => {
  it.each(['citrus-limon', 'epipremnum-aureum', 'nephrolepis-exaltata'])('%s', (id) => {
    const mm = malla(id);
    const enc = encuadrar(mm);
    for (const giro of [0, 1, 2, 3, 4, 5]) {
      const dib = proyectar(mm, { ...VISTA, giro }, enc);
      for (const c of dib.caras) {
        for (const [x, y] of c.puntos) {
          expect(x).toBeGreaterThanOrEqual(-1);
          expect(x).toBeLessThanOrEqual(VISTA.ancho + 1);
          expect(y).toBeGreaterThanOrEqual(-1);
          expect(y).toBeLessThanOrEqual(VISTA.alto + 1);
        }
      }
    }
  });
});

describe('se parecen a la planta que representan', () => {
  const puntos = (mm: Malla, parte?: string) => mm.caras.filter((c) => !c.fija && (!parte || c.parte === parte)).flatMap((c) => c.p);

  it('la pitahaya trepa su poste y luego cuelga en cascada, lejos del poste', () => {
    const mm = malla('selenicereus-undatus', { ...SANA, desarrollo: 0.8 } as M);
    const tallos = puntos(mm, 'tallo');
    const tope = Math.max(...tallos.map((p) => p[1]));
    // Tallos que bajan desde arriba por fuera: la cabellera.
    const cuelgan = tallos.filter((p) => Math.hypot(p[0], p[2]) > 0.3 && p[1] < tope * 0.75 && p[1] > 0.1);
    expect(cuelgan.length).toBeGreaterThan(20);
    // Y las raíces aéreas que la amarran a la madera.
    expect(mm.caras.some((c) => c.parte === 'raiz')).toBe(true);
  });

  it('la pitahaya con fruta la lleva rosa; el ave del paraíso, su cresta naranja', () => {
    const pit = malla('selenicereus-undatus', { ...SANA, frutos: 2, desarrollo: 0.8 } as M);
    expect(pit.caras.some((c) => c.parte === 'fruto' && /e2336e/i.test(c.color))).toBe(true);
    const ave = malla('strelitzia-reginae', { ...SANA, flores: 2 });
    expect(ave.caras.some((c) => c.parte === 'flor' && c.color.toLowerCase() === '#3552c8')).toBe(true);
  });

  it('las que cuelgan (potos, cola de burro) bajan hasta el piso y no más: la maceta no flota', () => {
    for (const id of ['epipremnum-aureum', 'sedum-morganianum', 'tradescantia-zebrina', 'hoya-carnosa']) {
      const ys = puntos(malla(id, { ...SANA, elementos: 14 })).map((p) => p[1]);
      expect([id, Math.min(...ys) >= -0.43]).toEqual([id, true]);
    }
  });

  it('el asiento de suegra es una sola bola grande, no un grupito', () => {
    const mm = malla('echinocactus-grusonii', { ...SANA, elementos: 14 });
    const cabezas = new Set(mm.caras.filter((c) => c.parte === 'tallo').map((c) => c.indice));
    expect(cabezas.size).toBe(1);
  });

  it('una palma no es un helecho: sus frondas se sostienen más arriba', () => {
    const alturaMedia = (id: string) => {
      const ys = puntos(malla(id), 'hoja').map((p) => p[1]);
      return ys.reduce((s, y) => s + y, 0) / ys.length / Math.max(...ys);
    };
    expect(alturaMedia('chamaedorea-elegans')).toBeGreaterThan(alturaMedia('nephrolepis-exaltata'));
  });
});
