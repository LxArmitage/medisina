/**
 * Pruebas de anclaje del gemelo digital.
 *
 * Es la suite más importante del sistema: verifica que la planta nunca afirme
 * nada que no esté en su snapshot. Un LLM suelto sobre datos de jardinería
 * genera agronomía falsa con voz simpática, y eso daña plantas reales.
 */

import { recomendarRiego, simularBalance } from '../src/dominio/balanceHidrico';
import { construirSnapshot, verificarAnclaje, vozDeterminista } from '../src/dominio/gemelo';
import type { SnapshotGemelo } from '../src/dominio/gemelo';
import type { Diagnostico } from '../src/dominio/tipos';
import { HOY, especie, planta, riego, serieClima } from './ayudas';

function snapshotDe(opciones: {
  et0?: number;
  lluviaPronostico?: number;
  techado?: boolean;
  tieneDrenaje?: boolean;
  riegos?: ReturnType<typeof riego>[];
  diagnostico?: Diagnostico;
  toleranciaEncharcamientoDias?: number;
  /** Cambia la semilla de la voz: sirve para recorrer todas las variantes. */
  id?: string;
} = {}): SnapshotGemelo {
  const sujeto = planta({
    id: opciones.id ?? 'planta-prueba',
    ubicacion: { techado: opciones.techado ?? false },
    contenedor: {
      tipo: 'maceta',
      volumenL: 3,
      material: 'plastico',
      tieneDrenaje: opciones.tieneDrenaje ?? true,
    },
  });
  const sp = especie({
    toleranciaEncharcamientoDias: opciones.toleranciaEncharcamientoDias ?? 3,
  });
  const eventos = opciones.riegos ?? [];
  const historico = serieClima(10, { et0: opciones.et0 ?? 7 });
  const pronostico = serieClima(3, {
    et0: opciones.et0 ?? 7,
    lluvia: opciones.lluviaPronostico ?? 0,
    desde: 1,
  });

  const estados = simularBalance({ planta: sujeto, especie: sp, eventos, clima: historico });
  const estadoHoy = estados[estados.length - 1];
  const recomendacion = recomendarRiego({
    planta: sujeto,
    especie: sp,
    estadoHoy,
    pronostico,
  });

  return construirSnapshot({
    planta: sujeto,
    especie: sp,
    estadoHoy,
    recomendacion,
    eventos,
    clima: { hoy: historico[historico.length - 1], pronostico },
    diagnostico: opciones.diagnostico,
    hoy: HOY,
  });
}

// ---------------------------------------------------------------------------

describe('construcción del snapshot', () => {
  it('registra cada dato con su origen', () => {
    const snapshot = snapshotDe({ riegos: [riego(3, 400)] });
    const origenes = new Set(snapshot.hechos.map((h) => h.origen));
    expect(origenes.has('balance')).toBe(true);
    expect(origenes.has('bitacora')).toBe(true);
    expect(origenes.has('clima')).toBe(true);
  });

  it('calcula los días desde el último riego a partir de la bitácora', () => {
    const snapshot = snapshotDe({ riegos: [riego(4, 400), riego(9, 400)] });
    expect(snapshot.hidrico.diasDesdeUltimoRiego).toBe(4);
  });

  it('deja el riego en null cuando nunca se ha registrado uno', () => {
    expect(snapshotDe().hidrico.diasDesdeUltimoRiego).toBeNull();
  });
});

describe('la voz determinista siempre está anclada', () => {
  const escenarios: Array<[string, Parameters<typeof snapshotDe>[0]]> = [
    ['planta con sed', { et0: 9 }],
    ['planta recién regada', { et0: 3, riegos: [riego(0, 600)] }],
    ['viene lluvia', { et0: 9, lluviaPronostico: 40 }],
    ['bajo techo con lluvia pronosticada', { et0: 9, lluviaPronostico: 40, techado: true }],
    [
      'encharcada sin drenaje',
      {
        et0: 1,
        tieneDrenaje: false,
        toleranciaEncharcamientoDias: 1,
        riegos: [riego(0, 900), riego(1, 900), riego(2, 900), riego(3, 900)],
      },
    ],
  ];

  it.each(escenarios)('%s: no inventa ningún número', (_nombre, opciones) => {
    const snapshot = snapshotDe(opciones);
    const frase = vozDeterminista(snapshot);
    const resultado = verificarAnclaje(frase, snapshot);

    expect(resultado.numerosSinRespaldo).toEqual([]);
    expect(resultado.anclado).toBe(true);
  });

  it('habla en primera persona', () => {
    const frase = vozDeterminista(snapshotDe({ et0: 9 }));
    expect(frase.length).toBeGreaterThan(10);
    expect(/\b(mi|me|estoy|tengo|siento|necesito)\b/i.test(frase)).toBe(true);
  });
});

describe('la voz nunca contradice a la recomendación', () => {
  /**
   * Regresión: una planta puede estar en estado crítico y aun así convenir no
   * regarla porque viene lluvia. Si la voz pide agua mientras la tarjeta dice
   * "no la riegues", la app se desmiente a sí misma y el usuario deja de
   * creerle a las dos.
   */
  it('en crítico con lluvia pronosticada, no pide agua', () => {
    const snapshot = snapshotDe({ et0: 12, lluviaPronostico: 40 });

    expect(snapshot.hidrico.nivel).toBe('critico');
    expect(snapshot.hidrico.accionSugerida).toBe('esperar_lluvia');

    const frase = vozDeterminista(snapshot);
    expect(frase).not.toMatch(/necesito agua/i);
    expect(frase).toMatch(/lluvia/i);
    expect(verificarAnclaje(frase, snapshot).anclado).toBe(true);
  });

  it('en crítico sin lluvia, sí pide agua', () => {
    const snapshot = snapshotDe({ et0: 12 });

    expect(snapshot.hidrico.accionSugerida).toBe('regar');
    expect(vozDeterminista(snapshot)).toMatch(/necesito agua/i);
  });

  it('la acción sugerida y la voz coinciden en todos los escenarios', () => {
    const pideAgua = (frase: string) => /necesito agua|con \d+ ml quedo bien/i.test(frase);

    const casos: Parameters<typeof snapshotDe>[0][] = [
      { et0: 12, lluviaPronostico: 40 },
      { et0: 12, lluviaPronostico: 40, techado: true },
      { et0: 12 },
      { et0: 2, riegos: [riego(0, 600)] },
    ];

    for (const caso of casos) {
      const snapshot = snapshotDe(caso);
      const frase = vozDeterminista(snapshot);
      const debePedirAgua = snapshot.hidrico.accionSugerida === 'regar';
      expect(pideAgua(frase)).toBe(debePedirAgua);
    }
  });
});

describe('verificarAnclaje detecta al LLM inventando', () => {
  const snapshot = snapshotDe({ riegos: [riego(3, 400)] });

  it('marca un número que no existe en el snapshot', () => {
    const resultado = verificarAnclaje(
      'Llevo 47 días sin agua y mi pH bajó a 3.2.',
      snapshot,
    );
    expect(resultado.anclado).toBe(false);
    expect(resultado.numerosSinRespaldo).toContain(47);
  });

  it('acepta una frase construida sólo con datos del snapshot', () => {
    const resultado = verificarAnclaje(
      `Mi sustrato está al ${snapshot.hidrico.porcentajeSustrato} % y mi último riego fue hace ${snapshot.hidrico.diasDesdeUltimoRiego} días.`,
      snapshot,
    );
    expect(resultado.anclado).toBe(true);
  });
});

describe('regla dura: nada de químicos sin diagnóstico confirmado', () => {
  const hallazgos = [{ clave: 'oidio', nombre: 'oídio', probabilidad: 0.62 }];

  it('bloquea la recomendación de fungicida con diagnóstico preliminar', () => {
    const snapshot = snapshotDe({
      diagnostico: {
        id: 'd1',
        plantaId: 'planta-prueba',
        fecha: HOY.toISOString(),
        hallazgos,
        confianza: 'preliminar',
        enColaDeConfirmacion: true,
      },
    });

    const resultado = verificarAnclaje(
      'Ponme un fungicida a base de cobre esta semana.',
      snapshot,
    );
    expect(resultado.anclado).toBe(false);
    expect(resultado.violaciones).toHaveLength(1);
  });

  it('lo permite cuando el diagnóstico ya está confirmado', () => {
    const snapshot = snapshotDe({
      diagnostico: {
        id: 'd1',
        plantaId: 'planta-prueba',
        fecha: HOY.toISOString(),
        hallazgos,
        confianza: 'confirmado',
        enColaDeConfirmacion: false,
      },
    });

    const resultado = verificarAnclaje(
      'Ponme un fungicida a base de cobre esta semana.',
      snapshot,
    );
    expect(resultado.violaciones).toEqual([]);
  });

  it('la voz determinista avisa de la incertidumbre en vez de recetar', () => {
    const snapshot = snapshotDe({
      diagnostico: {
        id: 'd1',
        plantaId: 'planta-prueba',
        fecha: HOY.toISOString(),
        hallazgos,
        confianza: 'preliminar',
        enColaDeConfirmacion: true,
      },
    });
    const frase = vozDeterminista(snapshot);
    expect(frase).toContain('no estoy segura');
    expect(verificarAnclaje(frase, snapshot).anclado).toBe(true);
  });
});

describe('sin consejo médico para personas', () => {
  it('detecta la sugerencia de uso medicinal humano', () => {
    const snapshot = snapshotDe();
    const resultado = verificarAnclaje(
      'Mi fruto cura el dolor: puedes tomar un té con él.',
      snapshot,
    );
    expect(resultado.violaciones.length).toBeGreaterThan(0);
  });
});

describe('todas las variantes de la voz se portan bien', () => {
  /**
   * La voz ahora elige entre varias frases por situación. Probar sólo la que
   * toca hoy dejaría las demás sin red: basta que alguien agregue una variante
   * con un número inventado para que la planta mienta un día al azar.
   *
   * Se recorren muchas semillas para tocar todas las opciones de cada grupo.
   */
  const semillas = Array.from({ length: 40 }, (_, i) => `planta-${i}`);

  const escenarios: Array<{
    nombre: string;
    opciones: Parameters<typeof snapshotDe>[0];
    /** Marca que TODAS las variantes de ese grupo deben conservar. */
    marca: RegExp;
  }> = [
    { nombre: 'pide agua', opciones: { et0: 12 }, marca: /agua|ml/i },
    { nombre: 'espera lluvia', opciones: { et0: 12, lluviaPronostico: 40 }, marca: /lluvia/i },
    {
      nombre: 'encharcada',
      opciones: {
        et0: 1,
        tieneDrenaje: false,
        toleranciaEncharcamientoDias: 1,
        riegos: [riego(0, 900), riego(1, 900), riego(2, 900), riego(3, 900)],
      },
      marca: /no me riegues|déjame secar|me pudro|aguántate/i,
    },
    { nombre: 'tranquila', opciones: { et0: 2, riegos: [riego(0, 600)] }, marca: /%/ },
  ];

  it.each(escenarios.map((e) => [e.nombre, e] as const))(
    '%s: ninguna variante inventa números ni pierde su marca',
    (_nombre, escenario) => {
      const vistas = new Set<string>();

      for (const id of semillas) {
        const snapshot = snapshotDe({ ...escenario.opciones, id });
        const frase = vozDeterminista(snapshot);
        vistas.add(frase);

        expect(verificarAnclaje(frase, snapshot).numerosSinRespaldo).toEqual([]);
        expect(frase).toMatch(escenario.marca);
      }

      // Si sólo saliera una frase, la variedad sería decorativa.
      expect(vistas.size).toBeGreaterThan(1);
    },
  );

  it('la frase no cambia dos veces el mismo día para la misma planta', () => {
    const snapshot = snapshotDe({ et0: 9, id: 'estable' });
    const primera = vozDeterminista(snapshot);
    for (let i = 0; i < 5; i += 1) {
      expect(vozDeterminista(snapshot)).toBe(primera);
    }
  });

  it('dos plantas en el mismo estado no siempre dicen lo mismo', () => {
    const frases = semillas.map((id) => vozDeterminista(snapshotDe({ et0: 9, id })));
    expect(new Set(frases).size).toBeGreaterThan(1);
  });
});
