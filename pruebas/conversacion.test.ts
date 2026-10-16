/**
 * Pruebas de la lectura conversacional.
 *
 * Lo que se protege es el equilibrio: que herede el tema cuando la frase de
 * verdad se apoya en la anterior, y que NO lo herede cuando simplemente no
 * entendió. Lo segundo importa más — una app que contesta del riego a "cuál es
 * la capital de Francia" porque antes se habló de riego es peor que una que
 * dice que no sabe.
 */

import { leerPregunta } from '../src/ia/conversacion';

describe('el seguimiento', () => {
  it('"¿y de sol?" se entiende sin repetir la pregunta', () => {
    const lectura = leerPregunta('¿y de sol?', { previas: ['riego'] });
    expect(lectura.principal.intencion).toBe('luz');
  });

  it('hereda el tema cuando la frase se apoya en lo anterior', () => {
    const lectura = leerPregunta('¿y eso?', { previas: ['sintoma'] });
    expect({ intencion: lectura.principal.intencion, heredada: lectura.heredada }).toEqual({
      intencion: 'sintoma',
      heredada: true,
    });
  });

  it('lo heredado se marca como dudoso, para que la app lo diga', () => {
    const lectura = leerPregunta('¿por qué?', { previas: ['riego'] });
    expect(lectura.principal.segura).toBe(false);
  });

  /** La prueba que impide que el contexto se vuelva una excusa para adivinar. */
  it('NO hereda cuando simplemente no entendió', () => {
    const lectura = leerPregunta('cuál es la capital de Francia', { previas: ['riego'] });
    expect(lectura.principal.intencion).toBe('desconocida');
  });

  it('sin historial no inventa contexto', () => {
    expect(leerPregunta('¿y eso?').principal.intencion).toBe('desconocida');
  });
});

describe('preguntas dobles', () => {
  it('"¿la riego y la podo?" contesta las dos', () => {
    const lectura = leerPregunta('¿la riego y la podo?');
    const temas = [lectura.principal.intencion, lectura.secundaria?.intencion];
    expect(temas).toEqual(expect.arrayContaining(['riego', 'poda']));
  });

  it('una pregunta de un solo tema no se parte', () => {
    const lectura = leerPregunta('¿cuándo la riego?');
    expect(lectura.secundaria).toBeNull();
  });

  it('no parte cuando la segunda mitad no se entiende', () => {
    const lectura = leerPregunta('¿cuándo la riego y ya?');
    expect(lectura.secundaria).toBeNull();
  });
});

describe('lo de siempre sigue igual', () => {
  it.each([
    ['¿cuándo te riego?', 'riego'],
    ['¿eres tóxica para mi gato?', 'toxicidad'],
    ['¿qué plagas te dan?', 'plaga'],
  ])('"%s" → %s', (texto, esperada) => {
    expect(leerPregunta(texto).principal.intencion).toBe(esperada);
  });
});
