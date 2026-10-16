/**
 * El reconocimiento de plantas, con el modelo de verdad y fotos de verdad.
 *
 * Las fotos (`pruebas/fotos`) son de iNaturalist y el modelo no las vio al
 * entrenarse. No se escogieron por salir bien: es la primera foto reciente de
 * cada especie. Por eso la prueba no exige 6 de 6, sino lo que el examen del
 * entrenamiento dice que se puede prometer.
 *
 * Además protege el contrato con el catálogo: si alguien agrega una especie y
 * no reentrena, el modelo nunca la va a reconocer — mejor que lo diga una
 * prueba roja que una persona frustrada.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { decode } from 'jpeg-js';

import { especiesReales } from '../src/dominio/catalogo';
import { combinar } from '../src/ia/vision/cabeza';
import { CLASE_OTRA, EXAMEN_VISION, cargarVision, elegirLado, mirar, veredicto } from '../src/ia/vision/reconocer';
import { resultadoLocal } from '../src/servicios/identificacion';

interface FotoDePrueba {
  archivo: string;
  especie: string;
}

const CARPETA = join(__dirname, 'fotos');
const FOTOS = JSON.parse(readFileSync(join(CARPETA, 'lista.json'), 'utf8')) as FotoDePrueba[];

async function leer(archivo: string): Promise<number[]> {
  const img = decode(readFileSync(join(CARPETA, archivo)), { useTArray: true, formatAsRGBA: true });
  return mirar({ ancho: img.width, alto: img.height, datos: img.data }, { lado: 160 });
}

describe('el modelo y el catálogo van de la mano', () => {
  it('conoce todas las especies del catálogo, y la clase "otra"', () => {
    const { cabeza } = cargarVision();
    const faltan = especiesReales().map((e) => e.id).filter((id) => !cabeza.clases.includes(id));
    expect(faltan).toEqual([]);
    expect(cabeza.clases).toContain(CLASE_OTRA);
  });

  it('las dos últimas capas (160 y 128 px) hablan de las mismas clases, en el mismo orden', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chica = require('../src/ia/vision/cabeza-plantas-128.json') as { clases: string[]; lado: number };
    expect(chica.lado).toBe(128);
    expect(chica.clases).toEqual(cargarVision().cabeza.clases);
  });

  it('el tamaño se elige midiendo el teléfono, y es uno de los dos', () => {
    expect([128, 160]).toContain(elegirLado(cargarVision().red));
  });

  it('el examen guardado es de verdad un examen (y no una promesa inflada)', () => {
    expect(EXAMEN_VISION.fotos).toBeGreaterThan(500);
    expect(EXAMEN_VISION.top1).toBeGreaterThan(0.6);
    expect(EXAMEN_VISION.top3).toBeGreaterThanOrEqual(EXAMEN_VISION.top1);
  });
});

describe('fotos reales que nunca vio', () => {
  const lecturas = new Map<string, number[]>();

  beforeAll(async () => {
    for (const f of FOTOS) lecturas.set(f.archivo, await leer(f.archivo));
  }, 60_000);

  it('cada foto da probabilidades sanas', () => {
    for (const f of FOTOS) {
      const p = lecturas.get(f.archivo)!;
      expect([f.archivo, p.every(Number.isFinite)]).toEqual([f.archivo, true]);
      expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    }
  });

  it('la especie correcta sale entre las tres primeras en casi todas', () => {
    const entreTres = FOTOS.filter((f) =>
      veredicto(lecturas.get(f.archivo)!)
        .candidatos.slice(0, 3)
        .some((c) => c.especieId === f.especie),
    );
    // El examen promete ~9 de cada 10 entre las tres primeras.
    expect(entreTres.length).toBeGreaterThanOrEqual(FOTOS.length - 1);
  });

  it('la que dice con seguridad, casi siempre la acierta', () => {
    const seguras = FOTOS.map((f) => ({ f, r: resultadoLocal(lecturas.get(f.archivo)!) })).filter(
      ({ r }) => r.confianza === 'confirmado',
    );
    const erradas = seguras.filter(({ f, r }) => r.candidatos[0]?.especieId !== f.especie);
    expect(erradas.map(({ f }) => f.archivo)).toEqual([]);
  });
});

describe('de las probabilidades a lo que ve la persona', () => {
  const { cabeza } = cargarVision();
  const n = cabeza.clases.length;
  const con = (clase: string, p: number) => {
    const resto = (1 - p) / (n - 1);
    return cabeza.clases.map((c) => (c === clase ? p : resto));
  };

  it('segura → confirmado, con la especie primero', () => {
    const r = resultadoLocal(con('dracaena-trifasciata', 0.9));
    expect(r.confianza).toBe('confirmado');
    expect(r.motor).toBe('local');
    expect(r.candidatos[0].especieId).toBe('dracaena-trifasciata');
    expect(r.candidatos[0].nombreComun).toBe('lengua de suegra');
  });

  it('dudosa → preliminar, y lo dice', () => {
    const r = resultadoLocal(con('aloe-vera', 0.5));
    expect(r.confianza).toBe('preliminar');
    expect(r.advertencia).toBeTruthy();
  });

  it('si parece otra planta, lo dice con esas palabras y aun así ofrece las parecidas', () => {
    const r = resultadoLocal(con(CLASE_OTRA, 0.8));
    expect(r.confianza).toBe('insuficiente');
    expect(r.fueraDeCatalogo).toBe(true);
    expect(r.advertencia).toMatch(/Se parece poco a las que conozco/);
    // Y nunca un callejón sin salida: ofrece las parecidas y la salida por tipo.
    expect(r.candidatos.length).toBe(3);
    expect(r.advertencia).toMatch(/su tipo/);
  });

  it('dos fotos que coinciden suben la seguridad', () => {
    const una = con('epipremnum-aureum', 0.55);
    const juntas = combinar([una, una]);
    const i = cabeza.clases.indexOf('epipremnum-aureum');
    expect(juntas[i]).toBeGreaterThan(una[i]);
  });
});
