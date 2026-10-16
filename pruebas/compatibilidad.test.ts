/**
 * Pruebas de la mecánica de "equipos".
 *
 * El punto crítico: compartir calendario de riego y compartir maceta son dos
 * preguntas distintas, y la app no puede confundirlas.
 */

import { ESPECIES, buscarEspecie } from '../src/dominio/catalogo';
import { conocimientoDe, tieneConocimiento } from '../src/dominio/conocimiento';
import { perfilDeSemilla } from '../src/dominio/semillas';
import {
  agruparEnEquipos,
  bandaCompartida,
  compararEspecies,
} from '../src/dominio/compatibilidad';
import type { MiembroEquipo } from '../src/dominio/compatibilidad';
import type { Especie } from '../src/dominio/tipos';
import { especie, planta } from './ayudas';

function delCatalogo(id: string): Especie {
  const encontrada = buscarEspecie(id);
  if (!encontrada) throw new Error(`Falta ${id} en el catálogo`);
  return encontrada;
}

describe('banda de luz compartida', () => {
  it('encuentra el punto en común cuando lo hay', () => {
    const monstera = delCatalogo('monstera-deliciosa');
    const potos = delCatalogo('epipremnum-aureum');
    expect(bandaCompartida(monstera, potos)).not.toBeNull();
  });

  it('no inventa uno cuando no lo hay', () => {
    const nopal = delCatalogo('opuntia-ficus-indica'); // sólo sol pleno
    const helecho = delCatalogo('nephrolepis-exaltata'); // sombra e interior
    expect(bandaCompartida(nopal, helecho)).toBeNull();
  });
});

describe('agua', () => {
  it('un cactus y un helecho nunca comparten calendario', () => {
    const resultado = compararEspecies(
      delCatalogo('lophocereus-schottii'),
      delCatalogo('nephrolepis-exaltata'),
      'mismo_calendario',
    );
    expect(resultado.veredicto).toBe('incompatible');
    expect(resultado.razones.some((r) => r.aspecto === 'agua' && r.nivel === 'bloqueo')).toBe(true);
  });

  it('dos cactáceas sí', () => {
    const resultado = compararEspecies(
      delCatalogo('lophocereus-schottii'),
      delCatalogo('opuntia-ficus-indica'),
      'mismo_calendario',
    );
    expect(resultado.veredicto).toBe('compatible');
  });
});

describe('lo acuático es un mundo aparte', () => {
  it('bloquea de inmediato contra cualquier terrestre', () => {
    const resultado = compararEspecies(
      delCatalogo('nymphaea-mexicana'),
      delCatalogo('monstera-deliciosa'),
    );
    expect(resultado.veredicto).toBe('incompatible');
    expect(resultado.puntaje).toBe(0);
    expect(resultado.razones[0].aspecto).toBe('habito');
  });
});

describe('calendario compartido no implica maceta compartida', () => {
  it('el ficus riega igual que el potos pero su raíz no los deja convivir', () => {
    const ficus = delCatalogo('ficus-benjamina');
    const potos = delCatalogo('epipremnum-aureum');

    const calendario = compararEspecies(ficus, potos, 'mismo_calendario');
    const maceta = compararEspecies(ficus, potos, 'misma_maceta');

    expect(calendario.veredicto).not.toBe('incompatible');
    expect(maceta.veredicto).toBe('incompatible');
    expect(maceta.razones.some((r) => r.aspecto === 'raiz' && r.nivel === 'bloqueo')).toBe(true);
  });

  it('el pH incompatible sólo importa cuando comparten sustrato', () => {
    const acida = especie({ phMin: 4.5, phMax: 5.5, bandasToleradas: ['semisol'] });
    const alcalina = especie({ phMin: 7.2, phMax: 8.0, bandasToleradas: ['semisol'] });

    expect(compararEspecies(acida, alcalina, 'mismo_calendario').veredicto).toBe('compatible');
    expect(compararEspecies(acida, alcalina, 'misma_maceta').veredicto).toBe('incompatible');
  });
});

describe('agrupación en equipos', () => {
  it('junta por banda de luz y perfil hídrico, no por especie', () => {
    const miembros: MiembroEquipo[] = [
      {
        planta: planta({ id: 'a', apodo: 'Sina', ubicacion: { exposicion: 'sol_pleno' } }),
        especie: delCatalogo('lophocereus-schottii'),
      },
      {
        planta: planta({ id: 'b', apodo: 'Nopal', ubicacion: { exposicion: 'sol_pleno' } }),
        especie: delCatalogo('opuntia-ficus-indica'),
      },
      {
        planta: planta({ id: 'c', apodo: 'Helechón', ubicacion: { exposicion: 'sombra' } }),
        especie: delCatalogo('nephrolepis-exaltata'),
      },
    ];

    const equipos = agruparEnEquipos(miembros);

    expect(equipos).toHaveLength(2);
    // El equipo más numeroso va primero.
    expect(equipos[0].miembros).toHaveLength(2);
    expect(equipos[0].miembros.map((m) => m.planta.apodo).sort()).toEqual(['Nopal', 'Sina']);
    expect(equipos[0].nombre).toContain('Desierto');
  });

  it('la misma especie en dos exposiciones distintas cae en equipos distintos', () => {
    const potos = delCatalogo('epipremnum-aureum');
    const equipos = agruparEnEquipos([
      { planta: planta({ id: 'a', ubicacion: { exposicion: 'sombra' } }), especie: potos },
      { planta: planta({ id: 'b', ubicacion: { exposicion: 'interior_bajo' } }), especie: potos },
    ]);
    expect(equipos).toHaveLength(2);
  });
});

describe('el catálogo es coherente, entero', () => {
  /**
   * Antes esta prueba llevaba los quince ids escritos a mano, así que al
   * duplicar el catálogo las quince especies nuevas entraron SIN QUE NADIE LAS
   * REVISARA — la prueba seguía en verde revisando las de siempre. Una lista
   * fija dentro de una prueba es una prueba que deja de crecer con lo que
   * prueba, y no avisa cuando se queda corta. Ahora recorre `ESPECIES`, así que
   * la número treinta y uno se revisa sola.
   */
  it.each(ESPECIES.map((e) => [e.id, e] as const))('%s tiene valores en rango', (_id, e) => {
    expect(e.bandasToleradas.length).toBeGreaterThan(0);
    expect(e.kc).toBeGreaterThan(0);
    expect(e.aguaUtilMm).toBeGreaterThan(0);
    expect(e.umbralEstres).toBeGreaterThan(0);
    expect(e.umbralEstres).toBeLessThan(1);
    expect(e.phMin).toBeLessThan(e.phMax);
    expect(e.nombresComunes.length).toBeGreaterThan(0);
    expect(e.alturaMaximaCm).toBeGreaterThan(0);
    expect(e.crecimientoCmPorAno).toBeGreaterThan(0);
    expect(e.toleranciaEncharcamientoDias).toBeGreaterThanOrEqual(0);
  });

  it('las ventanas fenológicas usan meses válidos', () => {
    for (const e of ESPECIES) {
      for (const ventana of e.fenologia) {
        expect([e.id, ventana.mesInicio >= 1 && ventana.mesInicio <= 12]).toEqual([e.id, true]);
        expect([e.id, ventana.mesFin >= 1 && ventana.mesFin <= 12]).toEqual([e.id, true]);
      }
    }
  });

  it('no hay ids repetidos', () => {
    expect(new Set(ESPECIES.map((e) => e.id)).size).toBe(ESPECIES.length);
  });

  /**
   * Las tres tablas —catálogo, conocimiento y semillas— se escriben a mano y
   * por separado. Es cuestión de tiempo que alguien agregue una especie y
   * olvide una de las otras dos, y entonces la planta existe pero contesta
   * "no tengo eso registrado" a media conversación.
   */
  it('toda especie tiene su ficha de conocimiento', () => {
    const sinFicha = ESPECIES.filter((e) => !tieneConocimiento(e)).map((e) => e.id);
    expect(sinFicha).toEqual([]);
  });

  it('toda especie tiene su perfil de semilla', () => {
    const sinPerfil = ESPECIES.filter((e) => !perfilDeSemilla(e.id)).map((e) => e.id);
    expect(sinPerfil).toEqual([]);
  });

  it('lo que dice el conocimiento tiene sentido', () => {
    for (const e of ESPECIES) {
      const c = conocimientoDe(e);
      expect([e.id, c.temperaturaMinC < c.temperaturaMaxC]).toEqual([e.id, true]);
      expect([e.id, c.origen.length > 2]).toEqual([e.id, true]);
      expect([e.id, c.toxicidad.detalle.length > 10]).toEqual([e.id, true]);
      expect([e.id, c.trasplanteCadaAnos > 0]).toEqual([e.id, true]);
    }
  });

  /**
   * Una semilla que se propone por foto tiene que tener medidas de verdad. Las
   * que no se siembran en casa se marcan `deSemilla: false` y dicen qué hacer
   * en su lugar — eso es una respuesta honesta, no un hueco.
   */
  it('los perfiles de semilla son usables o dicen que no', () => {
    for (const e of ESPECIES) {
      const perfil = perfilDeSemilla(e.id);
      if (!perfil) continue;
      if (perfil.deSemilla) {
        expect([e.id, perfil.largoMmMin > 0]).toEqual([e.id, true]);
        expect([e.id, perfil.largoMmMax >= perfil.largoMmMin]).toEqual([e.id, true]);
        expect([e.id, perfil.siembra.diasMin > 0]).toEqual([e.id, true]);
        expect([e.id, perfil.siembra.meses.length > 0]).toEqual([e.id, true]);
      } else {
        expect([e.id, (perfil.enLugarDe ?? '').length > 15]).toEqual([e.id, true]);
      }
      expect([e.id, perfil.senal.length > 15]).toEqual([e.id, true]);
    }
  });
});
