/**
 * Pruebas del contraste ojo–modelo.
 *
 * Lo que se protege: que cruzar el síntoma con el estado hídrico cambie la
 * conclusión. Si el mismo síntoma diera siempre el mismo consejo, pedirle
 * medidas a la persona sería hacerle perder el tiempo.
 */

import type { EstadoHidrico } from '../src/dominio/balanceHidrico';
import { contrastarObservacion, medidasVencidas } from '../src/dominio/contraste';
import type { MedidasObservadas } from '../src/dominio/tipos';
import { HOY, especie } from './ayudas';

function estado(nivel: EstadoHidrico['nivel']): EstadoHidrico {
  return {
    fecha: '2026-06-15',
    aguaDisponibleMm: 20,
    fraccionDisponible: 0.5,
    demandaMm: 3,
    aporteMm: 0,
    diasConsecutivosEncharcado: nivel === 'encharcado' ? 4 : 0,
    diasConsecutivosEnEstres: nivel === 'critico' || nivel === 'seco' ? 3 : 0,
    nivel,
    esPronostico: false,
  };
}

function medidas(sobrescribir: Partial<MedidasObservadas> = {}): MedidasObservadas {
  return { fecha: HOY.toISOString(), ...sobrescribir };
}

// ---------------------------------------------------------------------------

describe('sin medidas no hay nada que contrastar', () => {
  it('devuelve vacío', () => {
    expect(
      contrastarObservacion({ estado: estado('optimo'), especie: especie(), hoy: HOY }),
    ).toEqual([]);
  });
});

describe('hojas amarillas: el mismo síntoma, tres conclusiones distintas', () => {
  const amarillas = medidas({ danoVisible: 'hojas_amarillas' });

  /**
   * El caso que justifica todo el módulo. La gente ve amarillo, asume sed y
   * riega más — que con el agua ya en su punto es justo lo que sobra.
   */
  it('con el agua bien, descarta la sed y apunta a nutrientes o luz', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: amarillas,
      estado: estado('optimo'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.clave).toBe('amarillo_sin_sed');
    expect(hallazgo.explicacion).toMatch(/nitrógeno|hierro/i);
    expect(hallazgo.explicacion).toMatch(/no la va a arreglar/i);
  });

  it('con el sustrato encharcado, confirma el exceso de agua', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: amarillas,
      estado: estado('encharcado'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.clave).toBe('amarillo_por_ahogo');
    expect(hallazgo.severidad).toBe('urgente');
  });

  it('con el sustrato seco, confirma la sed', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: amarillas,
      estado: estado('critico'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.clave).toBe('amarillo_por_sed');
  });

  it('las tres conclusiones son realmente distintas', () => {
    const claves = (['optimo', 'encharcado', 'critico'] as const).map(
      (nivel) =>
        contrastarObservacion({
          medidas: amarillas,
          estado: estado(nivel),
          especie: especie(),
          hoy: HOY,
        })[0].clave,
    );
    expect(new Set(claves).size).toBe(3);
  });
});

describe('puntas secas', () => {
  const secas = medidas({ danoVisible: 'hojas_secas' });

  it('con agua suficiente, descarta el riego y apunta a aire seco o sales', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: secas,
      estado: estado('optimo'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.clave).toBe('secas_sin_sed');
    expect(hallazgo.explicacion).toMatch(/sales|aire muy seco/i);
  });

  it('con el sustrato seco, es consecuencia directa', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: secas,
      estado: estado('seco'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.clave).toBe('secas_por_sed');
  });
});

describe('manchas', () => {
  it('con encharcamiento manda corregir el drenaje antes que tratar', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: medidas({ danoVisible: 'manchas' }),
      estado: estado('encharcado'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.clave).toBe('manchas_con_encharcamiento');
    expect(hallazgo.explicacion).toMatch(/drenaje/i);
  });

  /** Sin diagnóstico por imagen no se puede afirmar qué mancha es. */
  it('sin encharcamiento no inventa una enfermedad', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: medidas({ danoVisible: 'manchas' }),
      estado: estado('optimo'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.clave).toBe('manchas_sin_encharcamiento');
    expect(hallazgo.explicacion).toMatch(/no se distingue sin verla/i);
  });
});

describe('plaga', () => {
  it('siempre es urgente', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: medidas({ danoVisible: 'plaga' }),
      estado: estado('optimo'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.severidad).toBe('urgente');
  });

  it('si además pasa sed, el riego es parte del tratamiento', () => {
    const [hallazgo] = contrastarObservacion({
      medidas: medidas({ danoVisible: 'plaga' }),
      estado: estado('critico'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgo.explicacion).toMatch(/parte del tratamiento/i);
  });
});

describe('cactácea encharcada', () => {
  /** El daño por exceso en una xérica no se ve hasta que ya es pudrición. */
  it('avisa aunque no se reporte ningún daño visible', () => {
    const hallazgos = contrastarObservacion({
      medidas: medidas({ danoVisible: 'ninguno' }),
      estado: estado('encharcado'),
      especie: especie({ perfilHidrico: 'xerico' }),
      hoy: HOY,
    });
    expect(hallazgos.some((h) => h.clave === 'xerica_encharcada')).toBe(true);
  });

  it('no molesta a una especie de riego frecuente', () => {
    const hallazgos = contrastarObservacion({
      medidas: medidas({ danoVisible: 'ninguno' }),
      estado: estado('encharcado'),
      especie: especie({ perfilHidrico: 'alto' }),
      hoy: HOY,
    });
    expect(hallazgos.some((h) => h.clave === 'xerica_encharcada')).toBe(false);
  });
});

describe('vigencia de las medidas', () => {
  const haceMeses = (n: number) =>
    new Date(HOY.getTime() - n * 30.44 * 86_400_000).toISOString();

  it('las recientes no caducan', () => {
    expect(medidasVencidas(medidas({ fecha: haceMeses(2) }), HOY)).toBeNull();
  });

  it('pasados seis meses avisa que ya no describen a la planta', () => {
    expect(medidasVencidas(medidas({ fecha: haceMeses(8) }), HOY)).toBe(8);

    const hallazgos = contrastarObservacion({
      medidas: medidas({ fecha: haceMeses(8), danoVisible: 'ninguno' }),
      estado: estado('optimo'),
      especie: especie(),
      hoy: HOY,
    });
    expect(hallazgos.some((h) => h.clave === 'medidas_viejas')).toBe(true);
  });
});
