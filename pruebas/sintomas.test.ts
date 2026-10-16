/**
 * Pruebas del lector de síntomas.
 *
 * Lo que se protege aquí no es que acierte —eso no se puede prometer sin una
 * planta delante— sino que NO SE CONTRADIGA CON EL EXPEDIENTE. Decirle a
 * alguien que riegue una planta encharcada es peor que no decirle nada: la
 * mata, y lo hace con la autoridad de la app. Varias pruebas de abajo existen
 * sólo para que eso no pueda pasar.
 *
 * La otra mitad protege el silencio. Una frase que no describe nada tiene que
 * salir sin causas, para que quien llama diga "no sé" en vez de rellenar.
 */

import {
  causasProbables,
  leerSenales,
  redactarCausas,
} from '../src/dominio/sintomas';
import type { Contexto } from '../src/dominio/sintomas';

function contexto(cambios: Partial<Contexto> = {}): Contexto {
  return {
    nivel: 'optimo',
    porcentajeSustrato: 60,
    diasEncharcado: 0,
    diasEnEstres: 0,
    diasDesdeUltimoRiego: 5,
    exposicion: 'interior luminoso',
    interior: true,
    humedadQuePrefiere: 'media',
    plagasDeLaEspecie: [],
    conocimientoDeSuEspecie: true,
    ...cambios,
  };
}

const nombres = (texto: string, c: Contexto = contexto()) =>
  causasProbables(leerSenales(texto), c).map((causa) => causa.nombre);

// ---------------------------------------------------------------------------

describe('leer lo que se describe', () => {
  it('saca la parte y el aspecto', () => {
    const s = leerSenales('se le están poniendo las puntas cafés y secas');
    expect(s.partes).toContain('punta');
    expect(s.aspectos).toEqual(expect.arrayContaining(['cafe', 'seca']));
    expect(s.vacia).toBe(false);
  });

  it('no le pide acentos a nadie', () => {
    const con = leerSenales('las puntas están cafés');
    const sin = leerSenales('las puntas estan cafes');
    expect(sin.aspectos).toEqual(con.aspectos);
  });

  it('distingue las hojas de abajo de las nuevas', () => {
    expect(leerSenales('las hojas de abajo están amarillas').partes).toContain('hojaVieja');
    expect(leerSenales('los brotes nuevos salen chiquitos').partes).toContain('hojaNueva');
  });

  it('una frase sin síntoma sale vacía', () => {
    expect(leerSenales('hola, qué tal').vacia).toBe(true);
    expect(leerSenales('mírale las hojas').vacia).toBe(true);
  });
});

describe('no contradecir el expediente', () => {
  /**
   * La prueba más importante del archivo. Con el sustrato empapado, "le falta
   * agua" no es una causa poco probable: es imposible, y decirla mata la
   * planta que ya se estaba ahogando.
   */
  it('con el sustrato empapado nunca dice que le falta agua', () => {
    const empapada = contexto({ nivel: 'encharcado', porcentajeSustrato: 96, diasEncharcado: 4 });
    expect(nombres('está toda caída y amarilla', empapada)).not.toContain('Le falta agua');
  });

  it('con el sustrato seco nunca dice que le sobra agua', () => {
    const seca = contexto({ nivel: 'critico', porcentajeSustrato: 8, diasEnEstres: 6 });
    expect(nombres('está toda caída y amarilla', seca)).not.toContain('Exceso de agua');
  });

  it('a una planta de ambiente seco no le echa la culpa al aire seco', () => {
    // Mandar a humidificar una sansevieria es el consejo equivocado clásico.
    const sansevieria = contexto({ humedadQuePrefiere: 'seca' });
    const causas = nombres('las puntas se le están poniendo cafés', sansevieria);
    expect(causas[0]).not.toBe('Aire seco');
    expect(causas).toContain('Sales acumuladas en el sustrato');
  });

  it('a una de ambiente húmedo sí se lo propone', () => {
    const helecho = contexto({ humedadQuePrefiere: 'alta' });
    expect(nombres('las puntas se le están poniendo cafés', helecho)).toContain('Aire seco');
  });

  it('no culpa al sol a una planta que vive en la sombra', () => {
    const sombra = contexto({ exposicion: 'interior de poca luz' });
    expect(nombres('le salieron manchas cafés', sombra)).not.toContain('Quemadura de sol');
  });
});

describe('el síntoma que hay que atrapar', () => {
  it('base blanda y con olor es pudrición, y va primero', () => {
    const causas = causasProbables(
      leerSenales('la base está blanda y huele feo'),
      contexto({ nivel: 'encharcado', porcentajeSustrato: 92, diasEncharcado: 3 }),
    );
    expect(causas[0].nombre).toBe('Pudrición en la base');
    // Y dice qué hacer hoy, no qué pasó.
    expect(causas[0].queHacer).toMatch(/corta|saca/i);
  });

  it('las puntas cafés dejan de contestarse con el agua', () => {
    // El caso exacto que hizo falta: sustrato bien, puntas mal.
    const causas = nombres('se le están poniendo las puntas cafés y secas, qué hago');
    expect(causas.length).toBeGreaterThan(0);
    expect(causas).not.toContain('Le falta agua');
    expect(causas).not.toContain('Exceso de agua');
  });
});

describe('cada plaga por lo que se ve, no por deducción', () => {
  it.each([
    ['tiene como telarañas entre las hojas', 'Araña roja'],
    ['le salieron bolitas blancas de algodón', 'Cochinilla algodonosa'],
    ['las hojas están pegajosas', 'Pulgón o escama'],
    ['tiene un polvo blanco encima', 'Cenicilla'],
    ['las hojas tienen agujeros', 'Algo se la está comiendo'],
  ])('%s → %s', (frase, esperada) => {
    expect(nombres(frase)[0]).toBe(esperada);
  });
});

describe('callarse cuando no se sabe', () => {
  it('sin señales no propone nada', () => {
    expect(causasProbables(leerSenales('hola'), contexto())).toEqual([]);
    expect(redactarCausas([])).toBe('');
  });

  it('nunca suelta más de tres', () => {
    const muchas = causasProbables(
      leerSenales('está amarilla, caída, arrugada, con manchas y pálida'),
      contexto(),
    );
    expect(muchas.length).toBeLessThanOrEqual(3);
  });

  it('cuando una causa gana claro, no siembra dudas', () => {
    const texto = redactarCausas([
      { nombre: 'Araña roja', porque: 'p', queHacer: 'q', fuerza: 0.92 },
      { nombre: 'Le falta agua', porque: 'p2', queHacer: 'q2', fuerza: 0.5 },
    ]);
    expect(texto).not.toMatch(/Le falta agua/);
  });

  it('cuando dos empatan, ofrece la segunda', () => {
    const texto = redactarCausas([
      { nombre: 'Sales acumuladas en el sustrato', porque: 'p', queHacer: 'q', fuerza: 0.8 },
      { nombre: 'Aire seco', porque: 'p2', queHacer: 'q2', fuerza: 0.75 },
    ]);
    expect(texto).toMatch(/aire seco/i);
  });
});

describe('toda causa viene con qué hacer', () => {
  it.each([
    'las puntas están cafés',
    'las hojas de abajo amarillean',
    'está estirada y pálida',
    'la base está blanda',
    'tiene telarañas',
  ])('%s', (frase) => {
    for (const causa of causasProbables(leerSenales(frase), contexto())) {
      expect([causa.nombre, causa.queHacer.length > 30]).toEqual([causa.nombre, true]);
      expect([causa.nombre, causa.porque.length > 30]).toEqual([causa.nombre, true]);
    }
  });
});
