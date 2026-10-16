/**
 * Pruebas del conversador sin costo.
 *
 * Lo más importante que se protege aquí es la propiedad que justifica no usar
 * un LLM: **ninguna respuesta puede inventar un número**. Se recorren todas las
 * intenciones contra todos los estados y se pasa cada respuesta por el mismo
 * verificador de anclaje que vigilaría a un modelo de lenguaje.
 */

import { recomendarRiego, simularBalance } from '../src/dominio/balanceHidrico';
import { construirSnapshot, verificarAnclaje } from '../src/dominio/gemelo';
import type { SnapshotGemelo } from '../src/dominio/gemelo';
import {
  PREGUNTAS_SUGERIDAS,
  detectarIntencion,
  responder,
} from '../src/dominio/preguntas';
import type { Intencion } from '../src/dominio/preguntas';
import { HOY, especie, planta, riego, serieClima } from './ayudas';

function snapshotDe(opciones: { et0?: number; lluvia?: number; riegos?: ReturnType<typeof riego>[] } = {}): SnapshotGemelo {
  const sujeto = planta();
  const sp = especie();
  const eventos = opciones.riegos ?? [];
  const historico = serieClima(10, { et0: opciones.et0 ?? 7 });
  const pronostico = serieClima(3, { et0: opciones.et0 ?? 7, lluvia: opciones.lluvia ?? 0, desde: 1 });
  const estados = simularBalance({ planta: sujeto, especie: sp, eventos, clima: historico });
  const estadoHoy = estados[estados.length - 1];
  return construirSnapshot({
    planta: sujeto,
    especie: sp,
    estadoHoy,
    recomendacion: recomendarRiego({ planta: sujeto, especie: sp, estadoHoy, pronostico }),
    eventos,
    clima: { hoy: historico[historico.length - 1], pronostico },
    hoy: HOY,
  });
}

// ---------------------------------------------------------------------------

describe('reconocer de qué se está preguntando', () => {
  it.each([
    ['¿Cuándo te riego?', 'riego'],
    ['cuanta agua te pongo', 'riego'],
    ['¿por qué te ves así?', 'sintoma'],
    ['estás amarilla', 'sintoma'],
    ['¿te doy más sol?', 'luz'],
    ['¿cuándo floreces?', 'fenologia'],
    ['¿cuánto vas a crecer?', 'crecimiento'],
    ['¿qué tal la tierra?', 'sustrato'],
    ['hola, ¿cómo estás?', 'estado'],
  ] as Array<[string, Intencion]>)('"%s" → %s', (pregunta, esperada) => {
    expect(detectarIntencion(pregunta)).toBe(esperada);
  });

  /**
   * "Cuándo" aparece en dos preguntas muy frecuentes. El riego gana porque es
   * lo que la gente pregunta todo el tiempo; la floración se distingue por su
   * propia palabra.
   */
  it('desempata "cuándo te riego" contra "cuándo floreces"', () => {
    expect(detectarIntencion('¿cuándo te riego?')).toBe('riego');
    expect(detectarIntencion('¿cuándo floreces?')).toBe('fenologia');
  });

  it('no inventa una intención cuando no reconoce nada', () => {
    expect(detectarIntencion('cuál es la capital de Francia')).toBe('desconocida');
    expect(detectarIntencion('')).toBe('desconocida');
  });
});

describe('ninguna respuesta inventa números', () => {
  const escenarios: Array<[string, Parameters<typeof snapshotDe>[0]]> = [
    ['con sed', { et0: 12 }],
    ['con lluvia en camino', { et0: 12, lluvia: 40 }],
    ['recién regada', { et0: 2, riegos: [riego(0, 600)] }],
  ];

  const preguntas = [
    ...PREGUNTAS_SUGERIDAS,
    'cuánta agua',
    'estás amarilla',
    'qué tal la tierra',
    'hola',
    'cuál es la capital de Francia',
  ];

  it.each(escenarios)(
    '%s: todas las respuestas pasan el anclaje',
    (_nombre, ops) => {
      const snapshot = snapshotDe(ops);
      for (const pregunta of preguntas) {
        const respuesta = responder(pregunta, snapshot, especie());
        const control = verificarAnclaje(
          `${respuesta.texto} ${respuesta.dato ?? ''}`,
          snapshot,
        );
        expect({ pregunta, sinRespaldo: control.numerosSinRespaldo }).toEqual({
          pregunta,
          sinRespaldo: [],
        });
      }
    },
  );
});

describe('el riego contesta según el estado, no con una frase fija', () => {
  it('con sed dice que sí y cuánto', () => {
    const snapshot = snapshotDe({ et0: 12 });
    const r = responder('¿cuándo te riego?', snapshot, especie());
    expect(r.texto).toMatch(/hoy sí/i);
    expect(r.texto).toMatch(/\d+ ml/);
  });

  it('con lluvia en camino dice que todavía no', () => {
    const snapshot = snapshotDe({ et0: 12, lluvia: 40 });
    const r = responder('¿cuándo te riego?', snapshot, especie());
    expect(r.texto).toMatch(/todavía no/i);
  });

  it('las dos respuestas son distintas', () => {
    const conSed = responder('¿cuándo te riego?', snapshotDe({ et0: 12 }), especie()).texto;
    const conLluvia = responder('¿cuándo te riego?', snapshotDe({ et0: 12, lluvia: 40 }), especie()).texto;
    expect(conSed).not.toBe(conLluvia);
  });
});

describe('cuando no sabe, lo dice', () => {
  /** Es la diferencia entre no saber y inventar. */
  it('admite el límite y ofrece lo que sí puede contestar', () => {
    const r = responder('cuál es la capital de Francia', snapshotDe(), especie());
    expect(r.intencion).toBe('desconocida');
    expect(r.texto).toMatch(/de eso no sé/i);
    expect(r.texto).toMatch(/expediente/i);
  });
});

/**
 * Las respuestas que se abrieron al darle datos botánicos.
 *
 * La prueba que más importa aquí es la de toxicidad: si la app le dice a
 * alguien que su potos es seguro para el gato, el daño es real y no lo arregla
 * una disculpa. Por eso se verifica contra especies concretas y no contra una
 * frase genérica.
 */
describe('lo que sabe de su especie', () => {
  const conEspecie = (id: string) => {
    const sp = especie({ id });
    const sujeto = planta();
    const historico = serieClima(10, { et0: 5 });
    const estados = simularBalance({ planta: sujeto, especie: sp, eventos: [], clima: historico });
    const estadoHoy = estados[estados.length - 1];
    return {
      snapshot: construirSnapshot({
        planta: sujeto,
        especie: sp,
        estadoHoy,
        recomendacion: recomendarRiego({
          planta: sujeto,
          especie: sp,
          estadoHoy,
          pronostico: serieClima(3, { et0: 5, desde: 1 }),
        }),
        eventos: [],
        hoy: HOY,
      }),
      sp,
    };
  };

  it('avisa que el potos es tóxico para perros y gatos', () => {
    const { snapshot, sp } = conEspecie('epipremnum-aureum');
    const r = responder('¿eres tóxica para mi gato?', snapshot, sp);
    expect({ intencion: r.intencion, avisa: /sí, soy tóxica/i.test(r.texto) }).toEqual({
      intencion: 'toxicidad',
      avisa: true,
    });
  });

  it('no asusta con la albahaca, que es segura', () => {
    const { snapshot, sp } = conEspecie('ocimum-basilicum');
    const r = responder('¿le hace daño a mi perro?', snapshot, sp);
    expect(r.texto).toMatch(/segura/i);
  });

  /** Sin datos de su especie, no supone: dice que trate como tóxica. */
  it('con una especie que no conoce, se pone del lado seguro', () => {
    const { snapshot, sp } = conEspecie('especie-inventada-xyz');
    const r = responder('¿eres venenosa?', snapshot, sp);
    expect(r.texto).toMatch(/no tengo mi toxicidad registrada/i);
  });

  it('explica cómo sacarle un esqueje, con método y temporada', () => {
    const { snapshot, sp } = conEspecie('epipremnum-aureum');
    const r = responder('¿cómo te saco un esqueje?', snapshot, sp);
    expect({ intencion: r.intencion, menciona: /nudo/i.test(r.texto) }).toEqual({
      intencion: 'propagacion',
      menciona: true,
    });
  });

  it('da el rango de temperatura que aguanta', () => {
    const { snapshot, sp } = conEspecie('lophocereus-schottii');
    const r = responder('¿aguantas el frío?', snapshot, sp);
    expect({ intencion: r.intencion, grados: /°C/.test(r.texto) }).toEqual({
      intencion: 'tolerancia',
      grados: true,
    });
  });

  it('enumera las plagas típicas de esa especie, no de cualquiera', () => {
    const { snapshot, sp } = conEspecie('rosa-hybrida');
    const r = responder('¿qué plagas te dan?', snapshot, sp);
    expect(r.texto).toMatch(/pulgón|oídio|mancha negra|araña roja/i);
  });

  it('sabe decir qué se le puede preguntar', () => {
    const { snapshot, sp } = conEspecie('epipremnum-aureum');
    const r = responder('¿qué te puedo preguntar?', snapshot, sp);
    expect(r.intencion).toBe('ayuda');
  });
});
