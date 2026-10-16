/**
 * Pruebas de la racha y del perfil.
 *
 * La racha cuenta días en los que registraste un cuidado, como en Duolingo. Lo
 * que más se protege aquí son tres cosas:
 *
 *   1. Que "la revisé" cuente igual que un riego. Es la salvaguarda del diseño:
 *      si sólo regar sumara, mantener la racha exigiría regar a diario, que es
 *      justo lo que mata a una planta de casa. Si alguien quita eso, truena.
 *   2. Que el día sea el del reloj del teléfono, no UTC. Un riego a las nueve
 *      de la noche en México es de madrugada en UTC; contado en UTC, se
 *      apuntaría a mañana y hoy aparecería olvidado.
 *   3. Que el protector no reescriba el pasado: un olvido cubierto hace semanas
 *      no se convierte en ruptura cuando llega un olvido nuevo.
 *
 * Las fechas se construyen con la hora LOCAL a propósito: así las pruebas dan
 * lo mismo en una máquina en México que en una en UTC.
 */

import type { EstadoHidrico, NivelHidrico } from '../src/dominio/balanceHidrico';
import { construirPerfil } from '../src/dominio/perfil';
import { calcularRacha, diaLocal } from '../src/dominio/racha';
import type { Cuidado, PlantaEnRacha } from '../src/dominio/racha';
import type { TipoEvento } from '../src/dominio/tipos';
import { HOY, dia } from './ayudas';

/** Hoy, a mediodía local. */
const HOY_LOCAL = new Date(2026, 8, 23, 12, 0);

/** Un cuidado hace `diasAtras` días, a la hora local indicada. */
function cuidado(diasAtras: number, tipo: TipoEvento = 'riego', hora = 10): Cuidado {
  const instante = new Date(2026, 8, 23 - diasAtras, hora, 0);
  return { fecha: instante.toISOString(), plantaId: 'p1', apodo: 'Doña Sina', tipo };
}

/**
 * Cuidados a partir de una cadena: 'x' = cuidó, '.' = no. El último carácter
 * es hoy. Se escribe la historia que se quiere probar y se lee de un vistazo.
 */
function historia(dibujo: string): Cuidado[] {
  const salida: Cuidado[] = [];
  const n = dibujo.length;
  for (let i = 0; i < n; i += 1) {
    if (dibujo[i] === 'x') salida.push(cuidado(n - 1 - i));
  }
  return salida;
}

function racha(dibujo: string) {
  return calcularRacha({ cuidados: historia(dibujo), hoy: HOY_LOCAL });
}

// ---------------------------------------------------------------------------

describe('qué suma', () => {
  it('un riego hoy enciende la racha en ese momento', () => {
    const r = racha('x');
    expect({ dias: r.dias, hoyCuenta: r.hoyCuenta }).toEqual({ dias: 1, hoyCuenta: true });
  });

  it('cuenta días seguidos', () => {
    expect(racha('xxxxx').dias).toBe(5);
  });

  it('varios cuidados el mismo día cuentan como un día', () => {
    const r = calcularRacha({
      cuidados: [cuidado(0, 'riego', 8), cuidado(0, 'observacion', 13), cuidado(0, 'foto', 19)],
      hoy: HOY_LOCAL,
    });
    expect(r.dias).toBe(1);
    expect(r.semana[r.semana.length - 1].cuidados).toBe(3);
  });

  /**
   * La salvaguarda. Si esta prueba se cae, mantener la racha vuelve a exigir
   * regar, y la app vuelve a enseñar a ahogar plantas.
   */
  it('revisar la planta cuenta exactamente igual que regarla', () => {
    const regando = calcularRacha({ cuidados: [cuidado(1, 'riego'), cuidado(0, 'riego')], hoy: HOY_LOCAL });
    const revisando = calcularRacha({
      cuidados: [cuidado(1, 'observacion'), cuidado(0, 'observacion')],
      hoy: HOY_LOCAL,
    });
    expect(revisando.dias).toBe(regando.dias);
  });

  it.each<TipoEvento>(['riego', 'cambio_agua', 'fertilizacion', 'poda', 'brote', 'foto', 'observacion'])(
    'un %s también es un avance que cuenta',
    (tipo) => {
      expect(calcularRacha({ cuidados: [cuidado(0, tipo)], hoy: HOY_LOCAL }).dias).toBe(1);
    },
  );
});

describe('el día es el del teléfono', () => {
  it('un riego a las 11 de la noche cuenta para hoy, no para mañana', () => {
    const r = calcularRacha({ cuidados: [cuidado(0, 'riego', 23)], hoy: new Date(2026, 8, 23, 23, 30) });
    expect(r.hoyCuenta).toBe(true);
  });

  it('diaLocal usa la fecha local', () => {
    expect(diaLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('lo registrado en el futuro no cuenta', () => {
    const r = calcularRacha({ cuidados: [cuidado(-2)], hoy: HOY_LOCAL });
    expect(r.dias).toBe(0);
  });
});

describe('hoy todavía se puede salvar', () => {
  it('sin nada hoy, la racha de ayer sigue en pie pero en peligro', () => {
    const r = racha('xxx.');
    expect({ dias: r.dias, hoyCuenta: r.hoyCuenta, enPeligro: r.enPeligro }).toEqual({
      dias: 3,
      hoyCuenta: false,
      enPeligro: true,
    });
  });

  it('hoy aparece pendiente, no perdido', () => {
    const r = racha('xxx.');
    expect(r.semana[r.semana.length - 1]).toMatchObject({ estado: 'pendiente', esHoy: true });
  });

  it('la explicación dice qué hacer para llegar al siguiente', () => {
    expect(racha('xxx.').explicacion).toMatch(/riega o revisa/i);
    expect(racha('xxx.').explicacion).toMatch(/4 días/);
  });
});

describe('el protector', () => {
  it('un olvido suelto no borra la racha', () => {
    const r = racha('xxx.xx');
    expect(r.dias).toBe(5);
    expect(r.calendario.find((d) => d.estado === 'protegido')).toBeDefined();
  });

  it('dos olvidos seguidos sí la cortan', () => {
    expect(racha('xxx..xx').dias).toBe(2);
  });

  it('hay uno solo: dos olvidos separados en menos de una semana cortan', () => {
    expect(racha('xx.xx.x').dias).toBe(1);
  });

  it('se recarga a los siete días seguidos', () => {
    // Un olvido, siete días seguidos (recarga), otro olvido: los dos cubiertos.
    expect(racha('xx.xxxxxxx.x').dias).toBe(10);
  });

  /**
   * Recorriendo hacia atrás desde hoy, el olvido viejo —cubierto en su día—
   * se convertía en ruptura al aparecer uno nuevo, y la racha caía de golpe.
   * Hacia adelante, cada día se decide con lo que había ese día.
   */
  it('no reescribe el pasado', () => {
    const antes = racha('xxx.xxxxxxxxx');
    const despues = racha('xxx.xxxxxxxxx.x');
    expect(despues.dias).toBe(antes.dias + 1);
  });

  it('avisa cuando ayer se gastó el protector', () => {
    // El último punto es hoy, que sigue pendiente: ayer lo cubre el protector.
    const r = racha('xxx..');
    expect({ dias: r.dias, enPeligro: r.enPeligro }).toEqual({ dias: 3, enPeligro: true });
    expect(r.explicacion).toMatch(/protector/i);
    expect(racha('xxxx.').explicacion).toMatch(/Llevas 4/);
  });

  it('dos días completos sin nada, más hoy sin nada, ya la cortaron', () => {
    const r = racha('xxx...');
    expect(r.dias).toBe(0);
    expect(r.explicacion).toMatch(/se cortó/);
  });
});

describe('sin historia no inventa nada', () => {
  it('sin cuidados, la racha es cero y dice cómo empezar', () => {
    const r = calcularRacha({ cuidados: [], hoy: HOY_LOCAL });
    expect({ dias: r.dias, mejor: r.mejor, peligro: r.enPeligro }).toEqual({
      dias: 0,
      mejor: 0,
      peligro: false,
    });
    expect(r.explicacion).toMatch(/empieza/);
  });

  it('la semana siempre tiene siete casillas, aunque empieces hoy', () => {
    expect(racha('x').semana).toHaveLength(7);
    expect(calcularRacha({ cuidados: [], hoy: HOY_LOCAL }).semana).toHaveLength(7);
  });

  it('los días antes del primer cuidado no son olvidos', () => {
    const r = racha('x');
    expect(r.semana.slice(0, 6).every((d) => d.estado === 'antes')).toBe(true);
  });

  it('una fecha rota se ignora sin tronar', () => {
    const r = calcularRacha({
      cuidados: [{ fecha: 'no-es-fecha', plantaId: 'p1', apodo: 'x', tipo: 'riego' }],
      hoy: HOY_LOCAL,
    });
    expect(r.dias).toBe(0);
  });
});

describe('la mejor racha', () => {
  it('recuerda la más larga aunque la actual sea menor', () => {
    const r = racha('xxxxxx..xx');
    expect({ dias: r.dias, mejor: r.mejor }).toEqual({ dias: 2, mejor: 6 });
  });
});

describe('logros por días', () => {
  it('tres días desbloquean el primero', () => {
    expect(racha('xxx').logros.find((l) => l.clave === 'tres')?.logrado).toBe(true);
  });

  it('dice cuánto falta para el siguiente', () => {
    const r = racha('xxxx');
    expect(r.siguienteMeta).toMatchObject({ clave: 'semana', faltan: 3 });
  });
});

// ---------------------------------------------------------------------------
// La salud sigue midiéndose aparte
// ---------------------------------------------------------------------------

/** Serie de estados a partir de una cadena de niveles, del más viejo al de hoy. */
function serie(niveles: NivelHidrico[]): EstadoHidrico[] {
  return niveles.map((nivel, i) => ({
    fecha: dia(i - niveles.length + 1),
    aguaDisponibleMm: 10,
    fraccionDisponible: nivel === 'encharcado' ? 1.2 : 0.5,
    demandaMm: 5,
    aporteMm: 0,
    diasConsecutivosEncharcado: 0,
    diasConsecutivosEnEstres: 0,
    nivel,
    esPronostico: false,
  }));
}

function conPlanta(niveles: NivelHidrico[], id = 'p1', apodo = 'La verde'): PlantaEnRacha {
  return { id, apodo, estados: serie(niveles) };
}

const V: NivelHidrico = 'optimo';
const SED: NivelHidrico = 'critico';
const AHOGO: NivelHidrico = 'encharcado';

describe('la salud, aparte de la racha', () => {
  /**
   * Lo que evita que la racha nueva esconda un problema: una maceta encharcada
   * se sigue señalando aunque llevar la racha vaya perfecto.
   */
  it('una planta encharcada hoy se señala aunque la racha vaya bien', () => {
    const r = calcularRacha({
      cuidados: historia('xxxxx'),
      plantas: [conPlanta([V, V, AHOGO], 'p1', 'Doña Sina')],
      hoy: HOY,
    });
    expect(r.paraSalvarla).toEqual([{ plantaId: 'p1', apodo: 'Doña Sina', motivo: 'ahogo' }]);
  });

  it('cuenta cuántas están en rango hoy', () => {
    const r = calcularRacha({
      cuidados: [],
      plantas: [conPlanta([V, V]), conPlanta([V, SED], 'p2', 'Otra')],
      hoy: HOY,
    });
    expect(r.salud).toEqual({ enVerde: 1, total: 2 });
  });

  it('"mano ligera" se pierde con un solo encharcamiento en el mes', () => {
    const limpia = calcularRacha({ cuidados: [], plantas: [conPlanta(Array(30).fill(V))], hoy: HOY });
    const conAhogo = calcularRacha({
      cuidados: [],
      plantas: [conPlanta([...Array(29).fill(V), AHOGO].reverse())],
      hoy: HOY,
    });
    expect({
      limpia: limpia.logros.find((l) => l.clave === 'mano_ligera')?.logrado,
      conAhogo: conAhogo.logros.find((l) => l.clave === 'mano_ligera')?.logrado,
    }).toEqual({ limpia: true, conAhogo: false });
  });

  it('reconoce el rescate: fallar y componerlo', () => {
    const r = calcularRacha({ cuidados: [], plantas: [conPlanta([V, SED, V, V, V])], hoy: HOY });
    expect(r.logros.find((l) => l.clave === 'rescate')?.logrado).toBe(true);
  });

  it('devuelve los días de salud para apuntarlos en el diario', () => {
    const r = calcularRacha({ cuidados: [], plantas: [conPlanta([V, V, V])], hoy: HOY });
    expect(r.paraApuntar).toHaveLength(3);
  });
});


// ---------------------------------------------------------------------------

describe('el perfil de quien cuida', () => {
  it('detecta a quien riega de más', () => {
    const perfil = construirPerfil({
      plantas: [conPlanta([...Array(20).fill(V), ...Array(8).fill(AHOGO)])],
      hoy: HOY,
    });
    expect(perfil.tendencia).toBe('riega_de_mas');
  });

  it('detecta a quien se olvida', () => {
    const perfil = construirPerfil({
      plantas: [conPlanta([...Array(20).fill(V), ...Array(8).fill(SED)])],
      hoy: HOY,
    });
    expect(perfil.tendencia).toBe('riega_de_menos');
  });

  /** Tres de un lado y dos del otro es ruido, no un hábito. */
  it('no inventa un patrón cuando hay de los dos', () => {
    const perfil = construirPerfil({
      plantas: [conPlanta([...Array(20).fill(V), SED, AHOGO, SED, AHOGO])],
      hoy: HOY,
    });
    expect(perfil.tendencia).toBe('atinada');
  });

  it('con poca historia dice que no sabe', () => {
    const perfil = construirPerfil({ plantas: [conPlanta([V, AHOGO, AHOGO])], hoy: HOY });
    expect(perfil.tendencia).toBe('sin_datos');
  });

  it('señala la planta que peor la pasa y la que mejor va', () => {
    const perfil = construirPerfil({
      plantas: [
        conPlanta(Array(20).fill(V), 'p1', 'La orgullosa'),
        conPlanta([...Array(14).fill(V), ...Array(6).fill(AHOGO)], 'p2', 'La sufrida'),
      ],
      hoy: HOY,
    });
    expect({
      debil: perfil.puntoDebil?.apodo,
      motivo: perfil.puntoDebil?.motivo,
      orgullo: perfil.orgullo?.apodo,
    }).toEqual({ debil: 'La sufrida', motivo: 'ahogo', orgullo: 'La orgullosa' });
  });

  it('a quien lleva poco no lo trata como experto', () => {
    const perfil = construirPerfil({ plantas: [conPlanta(Array(5).fill(V))], hoy: HOY });
    expect(perfil.experiencia).toBe('nueva');
  });
});
