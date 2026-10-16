/**
 * Pruebas del asistente que acompaña por toda la app.
 *
 * Dos cosas se protegen aquí, y son las dos que se pidieron:
 *
 *   1. Que NO invente. El asistente cita la racha, el perfil y varias plantas
 *      a la vez, así que tiene mucha más superficie para colar un número que
 *      la ficha de una planta. Se le aplica el mismo verificador de anclaje,
 *      sobre el jardín entero.
 *
 *   2. Que NO sea un árbol de respuestas fijas. Se comprueba que la misma
 *      pregunta cambia según a quién se le conteste — distinto jardín,
 *      distinta tendencia de riego, y distinto si ya se había preguntado.
 */

import { recomendarRiego, simularBalance } from '../src/dominio/balanceHidrico';
import { construirSnapshot, numerosPermitidos, numerosSinRespaldoEn } from '../src/dominio/gemelo';
import { detectarNombre, responderEnJardin } from '../src/dominio/asistente';
import type { Jardin, PlantaEnJardin, Turno } from '../src/dominio/asistente';
import { construirPerfil } from '../src/dominio/perfil';
import { buscarSaber } from '../src/dominio/saber';
import { calcularRacha } from '../src/dominio/racha';
import type { PlantaEnRacha } from '../src/dominio/racha';
import { HOY, especie, planta, riego, serieClima } from './ayudas';

function plantaEnJardin(
  id: string,
  apodo: string,
  opciones: { et0?: number; riegos?: ReturnType<typeof riego>[] } = {},
): PlantaEnJardin {
  const sujeto = planta({ id, apodo });
  const sp = especie();
  const eventos = opciones.riegos ?? [];
  const historico = serieClima(12, { et0: opciones.et0 ?? 6 });
  const pronostico = serieClima(3, { et0: opciones.et0 ?? 6, desde: 1 });
  const estados = simularBalance({ planta: sujeto, especie: sp, eventos, clima: historico });
  const estadoHoy = estados[estados.length - 1];
  const snapshot = construirSnapshot({
    planta: sujeto,
    especie: sp,
    estadoHoy,
    recomendacion: recomendarRiego({ planta: sujeto, especie: sp, estadoHoy, pronostico }),
    eventos,
    clima: { hoy: historico[historico.length - 1], pronostico },
    hoy: HOY,
  });
  return { id, apodo, snapshot, especie: sp };
}


function jardinCon(plantas: PlantaEnJardin[], extra: Partial<Jardin> = {}): Jardin {
  const paraRacha: PlantaEnRacha[] = plantas.map((p) => ({
    id: p.id,
    apodo: p.apodo,
    estados: simularBalance({
      planta: planta({ id: p.id, apodo: p.apodo }),
      especie: especie(),
      eventos: [],
      clima: serieClima(12, { et0: 3 }),
    }),
  }));
  return {
    perfil: construirPerfil({ plantas: paraRacha, hoy: HOY }),
    racha: calcularRacha({ cuidados: [], plantas: paraRacha, hoy: HOY }),
    plantas,
    ...extra,
  };
}

const PREGUNTAS = [
  '¿cuál necesita agua?',
  '¿es tóxica para mi gato?',
  '¿cómo le saco un esqueje?',
  '¿la podo?',
  '¿le salieron pulgones?',
  '¿aguanta el frío?',
  '¿qué te puedo preguntar?',
  '¿cuál va peor?',
  '¿cómo voy?',
  '¿va a llover?',
  '¿quién eres?',
  '¿cuánto va a crecer?',
  'hola',
  '¿cuál es la capital de Francia?',
];

// ---------------------------------------------------------------------------

describe('no inventa un solo número', () => {
  const jardines: Array<[string, Jardin]> = [
    ['vacío', jardinCon([])],
    ['una planta con sed', jardinCon([plantaEnJardin('p1', 'El Nopalito', { et0: 13 })])],
    [
      'varias, mezcladas',
      jardinCon([
        plantaEnJardin('p1', 'El Nopalito', { et0: 13 }),
        plantaEnJardin('p2', 'La Monstera', { et0: 2, riegos: [riego(0, 900)] }),
        plantaEnJardin('p3', 'El Potos', { et0: 6 }),
      ]),
    ],
  ];

  it.each(jardines)('jardín %s: todo lo que dice tiene respaldo', (_nombre, jardin) => {
    // El permitido es el jardín ENTERO: snapshots, racha y perfil. Si el
    // asistente menciona un número que no salga de ahí, se lo inventó.
    const permitidos = numerosPermitidos(jardin);
    for (const pregunta of PREGUNTAS) {
      const r = responderEnJardin(pregunta, jardin);
      // Si contestó con lo que sabe de jardinería en general, sus números
      // salen de ese tema curado de `saber.ts` — y sólo de ése.
      const conSaber = r.saberId ? numerosPermitidos(buscarSaber(pregunta)?.respuesta ?? '', new Set(permitidos)) : permitidos;
      const sueltos = numerosSinRespaldoEn(`${r.texto} ${r.dato ?? ''}`, conSaber);
      expect({ pregunta, sueltos }).toEqual({ pregunta, sueltos: [] });
    }
  });
});

describe('contesta sobre el jardín, no sobre una planta genérica', () => {
  it('dice a cuál regar y a cuál no tocar, por su nombre', () => {
    const jardin = jardinCon([
      plantaEnJardin('p1', 'El Nopalito', { et0: 13 }),
      plantaEnJardin('p2', 'La Monstera', { et0: 1, riegos: [riego(0, 1200)] }),
    ]);
    const r = responderEnJardin('¿cuál necesita agua?', jardin);
    expect(r.texto).toMatch(/El Nopalito/);
  });

  it('redacta bien cuando lo único que hay es una planta que NO regar', () => {
    // Salió en pantalla: "Hoy y a Verdoso ni te acerques". La "y" sobra
    // cuando no hay nada antes que enlazar.
    const jardin = jardinCon([
      plantaEnJardin('p1', 'Verdoso', { et0: 1, riegos: [riego(0, 4000), riego(1, 4000)] }),
    ]);
    const r = responderEnJardin('¿cuál necesita agua?', jardin);
    expect(r.texto).not.toMatch(/^Hoy y a /);
  });

  it('lleva a la planta de la que habló, para poder abrirla', () => {
    const jardin = jardinCon([plantaEnJardin('p1', 'El Nopalito', { et0: 13 })]);
    const r = responderEnJardin('¿cuál necesita agua?', jardin);
    expect(r.irA).toEqual({ plantaId: 'p1', apodo: 'El Nopalito' });
  });

  it('sin plantas no finge: dice que no hay de qué hablar', () => {
    const r = responderEnJardin('¿cuál necesita agua?', jardinCon([]));
    expect(r.texto).toMatch(/todavía no tienes/i);
  });

  it('con una planta enfocada, contesta como esa planta', () => {
    const jardin = jardinCon([plantaEnJardin('p1', 'El Nopalito', { et0: 13 })], {
      enfoque: 'p1',
    });
    const r = responderEnJardin('¿cuándo te riego?', jardin);
    // En primera persona: es la planta hablando, no el asistente del jardín.
    expect(r.texto).toMatch(/me repongo|hace falta|ni se te ocurra|todavía no/i);
  });
});

describe('se ajusta a quién le pregunta', () => {
  /**
   * Es la prueba que distingue "asistente" de "chatbot con guion". La misma
   * pregunta, el mismo día, y la respuesta cambia porque la persona es otra.
   */
  it('a quien riega de más le dice otra cosa que a quien se olvida', () => {
    const plantas = [plantaEnJardin('p1', 'El Nopalito')];
    // Con el día en juego manda la urgencia y la personalidad se calla, que es
    // lo correcto. Para ver el ajuste al perfil hace falta un día tranquilo.
    const tranquilo = (j: Jardin): Jardin => ({
      ...j,
      // Tranquilo es también que hoy ya se registró algo: si no, lo primero
      // que dice es cómo no perder la racha, y con razón.
      racha: { ...j.racha, enPeligro: false, hoyCuenta: true, dias: 12, paraSalvarla: [] },
    });
    const deMas = tranquilo(jardinCon(plantas));
    deMas.perfil = { ...deMas.perfil, tendencia: 'riega_de_mas', diasObservados: 30, diasConAhogo: 9 };
    const deMenos = tranquilo(jardinCon(plantas));
    deMenos.perfil = { ...deMenos.perfil, tendencia: 'riega_de_menos', diasObservados: 30, diasConSed: 9 };

    const a = responderEnJardin('¿cómo voy?', deMas).texto;
    const b = responderEnJardin('¿cómo voy?', deMenos).texto;
    expect(a).not.toBe(b);
    expect(a).toMatch(/encharcad|de más|mano/i);
    expect(b).toMatch(/olvid|sed|se te pasa/i);
  });

  it('usa el nombre de quien cuida, si lo dio', () => {
    const jardin = jardinCon([plantaEnJardin('p1', 'El Nopalito')], { nombre: 'Alonso' });
    expect(responderEnJardin('hola', jardin).texto).toMatch(/Alonso/);
  });

  it('no se repite palabra por palabra cuando le preguntas dos veces', () => {
    const jardin = jardinCon([plantaEnJardin('p1', 'El Nopalito')]);
    const primera = responderEnJardin('hola', jardin);
    const historial: Turno[] = [{ mia: 'hola', suya: primera }];
    const segunda = responderEnJardin('hola', jardin, historial);
    expect(segunda.texto).not.toBe(primera.texto);
  });
});

describe('cuando no entiende, no cierra la puerta', () => {
  it('ofrece algo útil de ESTE jardín', () => {
    const jardin = jardinCon([plantaEnJardin('p1', 'El Nopalito', { et0: 13 })]);
    const r = responderEnJardin('¿cuál es la capital de Francia?', jardin);
    expect(r.intencion).toBe('desconocida');
    expect(r.seguir.length).toBeGreaterThan(0);
  });

  it('siempre propone qué preguntar después', () => {
    const jardin = jardinCon([plantaEnJardin('p1', 'El Nopalito')]);
    for (const pregunta of PREGUNTAS) {
      expect(responderEnJardin(pregunta, jardin).seguir.length).toBeGreaterThan(0);
    }
  });
});

describe('presentarse: el "inicio de sesión" sin cuenta', () => {
  it.each([
    ['me llamo Alonso', 'Alonso'],
    ['Mi nombre es German', 'German'],
    ['soy alonso', 'Alonso'],
    ['llámame Alo', 'Alo'],
  ])('"%s" → %s', (frase, esperado) => {
    expect(detectarNombre(frase)).toBe(esperado);
  });

  /** "soy de Culiacán" y "soy nueva en esto" no son presentaciones. */
  it.each(['soy de Culiacán', 'soy nueva en esto', 'dime que hago', '¿cuándo la riego?'])(
    'no confunde "%s" con un nombre',
    (frase) => {
      expect(detectarNombre(frase)).toBeNull();
    },
  );
});

describe('conversa como alguien que conoce tus plantas, no como un chatbot', () => {
  const jardin = () =>
    jardinCon([
      plantaEnJardin('p1', 'El Nopalito', { et0: 13 }),
      plantaEnJardin('p2', 'La Monstera', { et0: 2, riegos: [riego(0, 900)] }),
      plantaEnJardin('p3', 'Helecho Rulo', { et0: 6 }),
    ]);

  it('si nombras a una, contesta ella, aunque sólo digas una parte del apodo', () => {
    const r = responderEnJardin('¿cuándo riego el helecho?', jardin());
    expect(r.irA?.apodo).toBe('Helecho Rulo');
    expect(r.texto).toMatch(/^Helecho Rulo dice:/);
  });

  it('"¿y ella?" sigue hablando de la de antes', () => {
    const j = jardin();
    const primera = responderEnJardin('¿cómo está la monstera?', j);
    const segunda = responderEnJardin('¿y ella aguanta el frío?', j, [{ mia: '¿cómo está la monstera?', suya: primera }]);
    expect(segunda.irA?.apodo).toBe('La Monstera');
  });

  it('una pregunta de planta sin decir cuál se contesta de todas, no con "ábreme la ficha"', () => {
    for (const pregunta of ['¿cómo se podan?', '¿son tóxicas para mi gato?', '¿aguantan el frío?']) {
      const r = responderEnJardin(pregunta, jardin());
      expect(r.texto).not.toMatch(/depende de cu[aá]l|[AÁ]breme la ficha/i);
    }
  });

  it('sabe de jardinería en general: abono, vacaciones, plagas por su nombre', () => {
    expect(responderEnJardin('¿qué abono les pongo?', jardin()).saberId).toBe('abono');
    expect(responderEnJardin('me voy de vacaciones dos semanas', jardin()).saberId).toBe('vacaciones');
    expect(responderEnJardin('le salieron bolitas blancas como algodón', jardin()).saberId).toBe('cochinilla');
  });

  it('las respuestas no son de una línea: dicen qué, por qué y qué sigue', () => {
    const r = responderEnJardin('¿cuándo riego el nopalito?', jardin());
    expect(r.texto.split(/[.!?]\s/).length).toBeGreaterThanOrEqual(2);
  });

  it('con pronóstico, el clima habla de los días que vienen y de a quién mover', () => {
    const j = jardinCon([plantaEnJardin('p1', 'El Nopalito')], {
      clima: {
        dias: [
          { fecha: '2026-09-24', tMaxC: 39, tMinC: 25, lluviaMm: 0, cielo: 'sol', nombre: 'Hoy' },
          { fecha: '2026-09-25', tMaxC: 37, tMinC: 24, lluviaMm: 9, cielo: 'lluvia', nombre: 'Mañana' },
        ],
        avisos: [
          { plantaId: 'p1', apodo: 'El Nopalito', motivo: 'calor', destino: 'sombra', fecha: '2026-09-24', enDias: 0, texto: 'Hoy llega a 39 °C: pásalo a la sombra.' },
        ],
      },
    });
    const r = responderEnJardin('¿va a llover?', j);
    expect(r.texto).toMatch(/mañana/);
    expect(r.texto).toMatch(/sombra/);
  });
});
