/**
 * Pruebas de las explicaciones por parte.
 *
 * Lo que se protege: que la misma parte diga cosas distintas según el estado.
 * Una hoja caída por sed y una caída por ahogo se ven casi igual y necesitan lo
 * contrario — si el texto fuera el mismo, tocar la hoja sería decoración.
 */

import type { EstadoHidrico } from '../src/dominio/balanceHidrico';
import { calcularMorfologia } from '../src/dominio/morfologia';
import { ESPECIES } from '../src/dominio/catalogo';
import { explicarParte } from '../src/dominio/partes';
import type { ContextoParte, TipoParte } from '../src/dominio/partes';
import { especie } from './ayudas';

function contexto(nivel: EstadoHidrico['nivel'], extra: Partial<ContextoParte> = {}): ContextoParte {
  const sp = extra.especie ?? especie();
  const estado: EstadoHidrico = {
    fecha: '2026-06-15',
    aguaDisponibleMm: 20,
    fraccionDisponible: nivel === 'encharcado' ? 1.4 : nivel === 'critico' ? 0.05 : 0.6,
    demandaMm: 3,
    aporteMm: 0,
    diasConsecutivosEncharcado: nivel === 'encharcado' ? 9 : 0,
    diasConsecutivosEnEstres: nivel === 'critico' ? 3 : 0,
    nivel,
    esPronostico: false,
  };
  return {
    morfologia: calcularMorfologia({ especie: sp, estado }),
    estado,
    especie: sp,
    ...extra,
  };
}

describe('la hoja dice lo contrario según por qué está caída', () => {
  it('ahogada: avisa que regarla la empeora', () => {
    const e = explicarParte({ tipo: 'hoja' }, contexto('encharcado'));
    expect(e.titulo).toMatch(/no de sed/i);
    expect(e.texto).toMatch(/la empeora/i);
    expect(e.dato).toMatch(/9 días encharcado/);
  });

  it('sedienta: dice que se recupera al regarla', () => {
    const e = explicarParte({ tipo: 'hoja' }, contexto('critico'));
    expect(e.titulo).toMatch(/turgencia/i);
    expect(e.texto).toMatch(/se recupera/i);
  });

  it('sana: no inventa un problema', () => {
    const e = explicarParte({ tipo: 'hoja' }, contexto('optimo'));
    expect(e.titulo).toMatch(/sana/i);
  });

  it('los tres textos son realmente distintos', () => {
    const textos = (['encharcado', 'critico', 'optimo'] as const).map(
      (n) => explicarParte({ tipo: 'hoja' }, contexto(n)).texto,
    );
    expect(new Set(textos).size).toBe(3);
  });
});

describe('el tallo depende del arquetipo', () => {
  it('en un cactus explica que almacena agua', () => {
    const e = explicarParte(
      { tipo: 'tallo' },
      contexto('optimo', { especie: especie({ familiaFuncional: 'cactacea_suculenta' }) }),
    );
    expect(e.texto).toMatch(/almacena el agua/i);
  });

  it('en el resto, orienta hacia dónde buscar el problema', () => {
    const e = explicarParte({ tipo: 'tallo' }, contexto('optimo'));
    expect(e.texto).toMatch(/el problema está abajo/i);
  });
});

describe('sustrato', () => {
  it('encharcado explica la asfixia de la raíz', () => {
    const e = explicarParte({ tipo: 'sustrato' }, contexto('encharcado'));
    expect(e.texto).toMatch(/asfixia|aire/i);
    expect(e.dato).toMatch(/días así/);
  });

  it('normal explica de dónde sale el número', () => {
    const e = explicarParte({ tipo: 'sustrato' }, contexto('optimo'));
    expect(e.texto).toMatch(/transpira/i);
    expect(e.dato).toMatch(/% de capacidad útil/);
  });
});

describe('raíz', () => {
  it('en tierra explica por qué el exceso mata', () => {
    const e = explicarParte({ tipo: 'raiz' }, contexto('optimo'));
    expect(e.texto).toMatch(/oxígeno/i);
  });

  it('en frasco cuenta los días desde el cambio', () => {
    const e = explicarParte(
      { tipo: 'raiz' },
      contexto('optimo', { enFrasco: true, diasSinCambioAgua: 11 }),
    );
    expect(e.titulo).toMatch(/en agua/i);
    expect(e.dato).toMatch(/11 días/);
  });

  it('en frasco sin registros lo dice en vez de inventar un número', () => {
    const e = explicarParte(
      { tipo: 'raiz' },
      contexto('optimo', { enFrasco: true, diasSinCambioAgua: null }),
    );
    expect(e.dato).toMatch(/sin cambios/i);
  });
});

/**
 * Barrido completo: toda especie, toda parte, todo estado.
 *
 * Añadido después de que se reportara desde el teléfono que tocar el dibujo
 * "explotaba". Una excepción aquí se lleva la ficha entera, porque el dibujo no
 * tenía frontera de error propia. Que no se pueda reproducir en el navegador no
 * significa que no exista: significa que hay que buscarla con datos, no a ojo.
 */
describe('tocar cualquier parte de cualquier planta nunca revienta', () => {
  const NIVELES: Array<EstadoHidrico['nivel']> = [
    'encharcado',
    'humedo',
    'optimo',
    'seco',
    'critico',
  ];
  const PARTES: TipoParte[] = ['hoja', 'tallo', 'brote', 'flor', 'fruto', 'sustrato', 'raiz'];

  it('devuelve título y texto en todos los casos', () => {
    const rotos: string[] = [];

    for (const sp of ESPECIES) {
      for (const nivel of NIVELES) {
        for (const tipo of PARTES) {
          for (const indice of [undefined, 0, 13]) {
            const caso = `${sp.id} · ${nivel} · ${tipo} · ${indice}`;
            try {
              const ctx = contexto(nivel, { especie: sp });
              const r = explicarParte({ tipo, indice }, ctx);
              if (!r.titulo || !r.texto) rotos.push(`${caso}: vacío`);
            } catch (error) {
              rotos.push(`${caso}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }
    }

    expect(rotos).toEqual([]);
  });

  it('también en frasco de agua, que es el camino menos transitado', () => {
    const rotos: string[] = [];
    for (const sp of ESPECIES) {
      for (const dias of [null, 0, 40]) {
        try {
          const ctx = contexto('optimo', { especie: sp, enFrasco: true, diasSinCambioAgua: dias });
          for (const tipo of PARTES) explicarParte({ tipo }, ctx);
        } catch (error) {
          rotos.push(`${sp.id}/${dias}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    expect(rotos).toEqual([]);
  });
});
