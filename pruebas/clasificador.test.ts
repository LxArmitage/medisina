/**
 * Pruebas del modelo de intención.
 *
 * Un modelo no se prueba como una función: no tiene una respuesta correcta por
 * entrada, tiene una tasa de acierto. Así que aquí se mide y se fija un piso.
 * Si un reentrenamiento baja del piso, la prueba truena — que es exactamente
 * lo que se quiere, porque un modelo puede empeorar sin que ninguna línea de
 * código cambie.
 *
 * Los pisos están por debajo de lo medido a propósito. Un piso pegado al
 * resultado de hoy truena con cualquier variación normal y acaba ignorándose.
 */

import { EXAMEN_CIEGO } from '../entrenamiento/examen-ciego';
import { EXAMEN_FINAL } from '../entrenamiento/examen-final';
import { EXAMEN } from '../entrenamiento/prueba';
import { clasificar } from '../src/ia/clasificador';
import { INTENCIONES } from '../src/ia/intenciones';
import type { Intencion } from '../src/ia/intenciones';

function aciertos(casos: Array<[string, Intencion]>): number {
  let bien = 0;
  for (const [texto, esperada] of casos) {
    if (clasificar(texto).intencion === esperada) bien += 1;
  }
  return bien / casos.length;
}

/**
 * Los tres conjuntos, con lo que cada cifra significa de verdad:
 *
 *   · ajuste  — se miró mucho mientras se afinaba. Optimista por construcción.
 *   · control — se miró dos veces. Optimista, pero menos.
 *   · final   — el más limpio de los tres. Es la cifra que hay que creer.
 *
 * La diferencia entre ellos no es ruido: el mismo modelo acierta 96 % en el
 * primero y 82 % en el último. Esos catorce puntos son exactamente lo que uno
 * se engaña cuando mide contra el conjunto con el que ajustó.
 *
 * Los pisos van bajo lo medido a propósito. Un piso pegado al resultado de hoy
 * truena con cualquier variación normal y acaba desactivándose, que es peor
 * que no tenerlo.
 */
describe('qué tan seguido le atina', () => {
  it.each([
    ['ajuste', EXAMEN, 0.88],
    ['control', EXAMEN_CIEGO, 0.88],
    ['final', EXAMEN_FINAL, 0.72],
  ] as Array<[string, Array<[string, Intencion]>, number]>)(
    'conjunto %s: no baja del piso',
    (nombre, casos, piso) => {
      const tasa = aciertos(casos);
      expect({ conjunto: nombre, sobreElPiso: tasa >= piso }).toEqual({
        conjunto: nombre,
        sobreElPiso: true,
      });
    },
  );

  it('ninguna intención se queda sin reconocer del todo', () => {
    // Un modelo puede tener buena tasa global y aun así ignorar una clase
    // entera. Eso se ve horrible en la app y no aparece en el promedio.
    const porIntencion = new Map<Intencion, { bien: number; total: number }>();
    for (const [texto, esperada] of [...EXAMEN, ...EXAMEN_CIEGO, ...EXAMEN_FINAL]) {
      const cuenta = porIntencion.get(esperada) ?? { bien: 0, total: 0 };
      cuenta.total += 1;
      if (clasificar(texto).intencion === esperada) cuenta.bien += 1;
      porIntencion.set(esperada, cuenta);
    }

    const abandonadas = [...porIntencion.entries()]
      .filter(([, c]) => c.bien / c.total < 0.5)
      .map(([intencion]) => intencion);
    expect(abandonadas).toEqual([]);
  });
});

describe('aguanta cómo escribe la gente', () => {
  /**
   * Lo que se exige con una errata no es acertar: es no afirmar sin base.
   *
   * "cuando la riego" y "cuando fue el riego" son riego e historial y se
   * distinguen por una letra; con "riegoo" encima, la frase queda de verdad
   * repartida entre ésas y fenología, que comparten "cuándo". Exigir la misma
   * lectura sería exigir adivinar. Lo exigible es que, si la pierde, lo marque
   * como dudoso — porque entonces la app contesta "creo que va por X, si era Y
   * dímelo" en vez de afirmar una de las tres.
   */
  it.each([
    ['cuando la riego', 'cuando la riegoo'],
    ['esta amarilla', 'esta amarrilla'],
    ['cuando florece', 'cuando floreze'],
    ['que tal la tierra', 'que tal la tiera'],
  ])(
    'con errata, o mantiene la lectura o admite que duda: "%s" vs "%s"',
    (buena, conErrata) => {
      const esperada = clasificar(buena).intencion;
      const conflicto = clasificar(conErrata);
      // Lo exigible no es acertar siempre — "cuando la riegoo" pierde la
      // palabra clave y queda genuinamente a medias entre riego, historial y
      // fenología, que comparten "cuándo". Lo exigible es no equivocarse con
      // aplomo: si ya no la reconoce, tiene que marcarlo como dudoso para que
      // la app ofrezca la otra lectura en vez de afirmar.
      expect({
        frase: conErrata,
        aceptable:
          conflicto.intencion === esperada ||
          conflicto.alternativa === esperada ||
          !conflicto.segura,
      }).toEqual({ frase: conErrata, aceptable: true });
    },
  );

  it('no se equivoca con aplomo: lo dudoso viene marcado', () => {
    // La propiedad que hace utilizable un modelo que acierta 8 de cada 10.
    const dudosa = clasificar('cuando la riegoo');
    expect(dudosa.intencion === 'riego' || !dudosa.segura).toBe(true);
  });

  it('da lo mismo con acentos que sin ellos', () => {
    expect(clasificar('¿cuándo floreces?').intencion).toBe(clasificar('cuando floreces').intencion);
  });

  it('da lo mismo en mayúsculas', () => {
    expect(clasificar('¿CUÁNDO TE RIEGO?').intencion).toBe(clasificar('¿cuándo te riego?').intencion);
  });
});

describe('sabe cuándo no sabe', () => {
  it.each([
    '',
    '   ',
    'asdkjfh qwerty',
    'xxxxx zzzzz',
  ])('no inventa una intención para "%s"', (basura) => {
    expect(clasificar(basura).intencion).toBe('desconocida');
  });

  it('ofrece una segunda lectura cuando la tiene', () => {
    // Sirve para que la app pueda decir "¿me preguntabas de la tierra?".
    const lectura = clasificar('¿cuándo te riego?');
    expect(lectura.alternativa === null || INTENCIONES.includes(lectura.alternativa)).toBe(true);
  });
});

describe('es el mismo modelo en cada llamada', () => {
  /**
   * Determinismo. Es lo que permite que un error reportado por un usuario se
   * pueda reproducir, y lo que separa esto de un modelo de lenguaje.
   */
  it('la misma pregunta da siempre la misma lectura', () => {
    const preguntas = ['¿cuándo te riego?', 'estás amarilla', 'hola', 'cuál es la capital'];
    for (const pregunta of preguntas) {
      const primera = clasificar(pregunta);
      for (let i = 0; i < 5; i += 1) {
        expect(clasificar(pregunta)).toEqual(primera);
      }
    }
  });

  it('la confianza es una probabilidad', () => {
    for (const [texto] of EXAMEN) {
      const { confianza } = clasificar(texto);
      expect(confianza).toBeGreaterThanOrEqual(0);
      expect(confianza).toBeLessThanOrEqual(1);
    }
  });
});
