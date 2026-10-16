/**
 * Pruebas del motor de balance hídrico (§8 — casos sintéticos).
 *
 * Cada bloque corresponde a un escenario que la app promete resolver mejor que
 * la competencia. Si uno de estos se rompe, la promesa del producto se rompe.
 */

import {
  areaEvaporacionM2,
  demandaDiaria,
  lluviaEfectiva,
  mlAMm,
  mmAMl,
  recomendarRiego,
  simularBalance,
} from '../src/dominio/balanceHidrico';
import { especie, planta, riego, serieClima } from './ayudas';

describe('geometría y conversiones', () => {
  it('convierte mililitros a lámina y de vuelta sin perder el valor', () => {
    const area = areaEvaporacionM2({ tipo: 'maceta', volumenL: 4, tieneDrenaje: true });
    const mm = mlAMm(500, area);
    expect(mmAMl(mm, area)).toBeCloseTo(500, 6);
  });

  it('una maceta más grande tiene más área de evaporación', () => {
    const chica = areaEvaporacionM2({ tipo: 'maceta', volumenL: 1, tieneDrenaje: true });
    const grande = areaEvaporacionM2({ tipo: 'maceta', volumenL: 20, tieneDrenaje: true });
    expect(grande).toBeGreaterThan(chica);
  });
});

describe('demanda diaria', () => {
  it('la sombra consume menos agua que el sol pleno', () => {
    const clima = serieClima(1)[0];
    const sp = demandaDiaria(clima, especie(), planta({ ubicacion: { exposicion: 'sol_pleno' } }));
    const sombra = demandaDiaria(clima, especie(), planta({ ubicacion: { exposicion: 'sombra' } }));
    expect(sombra).toBeLessThan(sp);
  });

  it('el barro seca más rápido que el plástico', () => {
    const clima = serieClima(1)[0];
    const barro = demandaDiaria(
      clima,
      especie(),
      planta({ contenedor: { tipo: 'maceta', volumenL: 4, material: 'barro', tieneDrenaje: true } }),
    );
    const plastico = demandaDiaria(
      clima,
      especie(),
      planta({ contenedor: { tipo: 'maceta', volumenL: 4, material: 'plastico', tieneDrenaje: true } }),
    );
    expect(barro).toBeGreaterThan(plastico);
  });
});

describe('lluvia efectiva', () => {
  const dia = serieClima(1, { lluvia: 30 })[0];

  it('a la intemperie, la lluvia llega completa', () => {
    expect(lluviaEfectiva(dia, planta().ubicacion)).toBe(30);
  });

  it('bajo techo no le llega una gota, por más que llueva', () => {
    const bajoTecho = planta({ ubicacion: { techado: true } }).ubicacion;
    expect(lluviaEfectiva(dia, bajoTecho)).toBe(0);
  });

  it('en interior tampoco', () => {
    const adentro = planta({ ubicacion: { interior: true } }).ubicacion;
    expect(lluviaEfectiva(dia, adentro)).toBe(0);
  });
});

describe('escenario: ola de calor', () => {
  it('con ET₀ alta y sin riegos, la planta llega a estrés y se recomienda regar', () => {
    const sujeto = planta();
    const sp = especie();
    const estados = simularBalance({
      planta: sujeto,
      especie: sp,
      eventos: [],
      clima: serieClima(10, { et0: 8 }),
    });

    const hoy = estados[estados.length - 1];
    expect(hoy.fraccionDisponible).toBeLessThan(sp.umbralEstres);

    const recomendacion = recomendarRiego({
      planta: sujeto,
      especie: sp,
      estadoHoy: hoy,
      pronostico: serieClima(3, { et0: 8, desde: 1 }),
    });
    expect(recomendacion.accion).toBe('regar');
    expect(recomendacion.mlSugeridos).toBeGreaterThan(0);
  });
});

describe('escenario: viene lluvia', () => {
  it('no manda regar si el pronóstico cubre el déficit y está a la intemperie', () => {
    const sujeto = planta();
    const sp = especie();
    const estados = simularBalance({
      planta: sujeto,
      especie: sp,
      eventos: [],
      clima: serieClima(10, { et0: 8 }),
    });

    const recomendacion = recomendarRiego({
      planta: sujeto,
      especie: sp,
      estadoHoy: estados[estados.length - 1],
      pronostico: serieClima(3, { et0: 5, lluvia: 40, desde: 1 }),
    });

    expect(recomendacion.accion).toBe('esperar_lluvia');
    expect(recomendacion.mlSugeridos).toBe(0);
  });

  /**
   * Este es EL caso que separa a MEDISINA de una pauta rígida: misma lluvia,
   * misma especie, mismo déficit — pero bajo techo la respuesta se invierte.
   */
  it('sí manda regar la que está bajo techo, con el mismo pronóstico de lluvia', () => {
    const bajoTecho = planta({ ubicacion: { exposicion: 'sol_pleno', techado: true } });
    const sp = especie();
    const estados = simularBalance({
      planta: bajoTecho,
      especie: sp,
      eventos: [],
      clima: serieClima(10, { et0: 8, lluvia: 40 }),
    });

    const recomendacion = recomendarRiego({
      planta: bajoTecho,
      especie: sp,
      estadoHoy: estados[estados.length - 1],
      pronostico: serieClima(3, { et0: 5, lluvia: 40, desde: 1 }),
    });

    expect(recomendacion.accion).toBe('regar');
    expect(recomendacion.motivo).toContain('techada');
  });
});

describe('escenario: maceta sin drenaje', () => {
  it('acumula encharcamiento y termina mandando suspender el riego', () => {
    const sinDrenaje = planta({
      contenedor: { tipo: 'maceta', volumenL: 2, material: 'ceramica', tieneDrenaje: false },
      ubicacion: { exposicion: 'interior_bajo', interior: true, techado: true },
    });
    const sp = especie({ toleranciaEncharcamientoDias: 2 });

    const riegos = [riego(1, 800), riego(3, 800), riego(5, 800), riego(7, 800)];
    const estados = simularBalance({
      planta: sinDrenaje,
      especie: sp,
      eventos: riegos,
      clima: serieClima(10, { et0: 2 }),
    });

    const hoy = estados[estados.length - 1];
    expect(hoy.nivel).toBe('encharcado');
    expect(hoy.diasConsecutivosEncharcado).toBeGreaterThan(sp.toleranciaEncharcamientoDias);

    const recomendacion = recomendarRiego({
      planta: sinDrenaje,
      especie: sp,
      estadoHoy: hoy,
      pronostico: serieClima(3, { et0: 2, desde: 1 }),
    });
    expect(recomendacion.accion).toBe('suspender_riego');
    expect(recomendacion.urgencia).toBe('alta');
  });

  it('con drenaje, el mismo riego excesivo no encharca', () => {
    const conDrenaje = planta({
      contenedor: { tipo: 'maceta', volumenL: 2, material: 'ceramica', tieneDrenaje: true },
      ubicacion: { exposicion: 'interior_bajo', interior: true, techado: true },
    });
    const estados = simularBalance({
      planta: conDrenaje,
      especie: especie({ toleranciaEncharcamientoDias: 2 }),
      eventos: [riego(1, 800), riego(3, 800), riego(5, 800), riego(7, 800)],
      clima: serieClima(10, { et0: 2 }),
    });
    expect(estados[estados.length - 1].diasConsecutivosEncharcado).toBe(0);
  });
});

describe('escenario: el riego registrado sí cuenta', () => {
  it('regar hoy sube la humedad respecto a no regar', () => {
    const sujeto = planta();
    const sp = especie();
    const base = { planta: sujeto, especie: sp, clima: serieClima(8, { et0: 7 }) };

    const sinRiego = simularBalance({ ...base, eventos: [] });
    const conRiego = simularBalance({ ...base, eventos: [riego(0, 600)] });

    expect(conRiego[conRiego.length - 1].fraccionDisponible).toBeGreaterThan(
      sinRiego[sinRiego.length - 1].fraccionDisponible,
    );
  });
});

describe('cactáceas', () => {
  it('una especie xérica aguanta la misma sequía que estresa a una de riego medio', () => {
    const clima = serieClima(12, { et0: 7 });
    const sujeto = planta();

    const cactus = especie({ kc: 0.2, aguaUtilMm: 14, umbralEstres: 0.12 });
    const tropical = especie({ kc: 0.9, aguaUtilMm: 34, umbralEstres: 0.5 });

    const estadoCactus = simularBalance({ planta: sujeto, especie: cactus, eventos: [], clima });
    const estadoTropical = simularBalance({ planta: sujeto, especie: tropical, eventos: [], clima });

    const recCactus = recomendarRiego({
      planta: sujeto,
      especie: cactus,
      estadoHoy: estadoCactus[estadoCactus.length - 1],
      pronostico: serieClima(2, { et0: 7, desde: 1 }),
    });
    const recTropical = recomendarRiego({
      planta: sujeto,
      especie: tropical,
      estadoHoy: estadoTropical[estadoTropical.length - 1],
      pronostico: serieClima(2, { et0: 7, desde: 1 }),
    });

    // Lo importante no es el número exacto, sino que el cactus no se trate igual
    // que una planta de riego frecuente bajo el mismo clima.
    expect(recTropical.urgencia).not.toBe('ninguna');
    expect(recCactus.mlSugeridos).toBeLessThan(recTropical.mlSugeridos);
  });
});

describe('esqueje en frasco: no se riega, se renueva', () => {
  const frasco = () =>
    planta({ contenedor: { tipo: 'agua', tieneDrenaje: true } });

  /**
   * La raíz está literalmente dentro del agua. Si el motor intentara simular
   * un balance aquí, produciría un número sin sentido y acabaría diciéndole a
   * la gente que riegue un frasco.
   */
  it('nunca se seca, por más calor que haga', () => {
    const estados = simularBalance({
      planta: frasco(),
      especie: especie(),
      eventos: [],
      clima: serieClima(30, { et0: 12 }),
    });
    for (const estado of estados) {
      expect(estado.nivel).toBe('optimo');
      expect(estado.fraccionDisponible).toBe(1);
      expect(estado.demandaMm).toBe(0);
    }
  });

  it('pide cambio de agua pasada una semana', () => {
    const recomendacion = recomendarRiego({
      planta: frasco(),
      especie: especie(),
      estadoHoy: simularBalance({
        planta: frasco(),
        especie: especie(),
        eventos: [],
        clima: serieClima(3),
      })[2],
      pronostico: serieClima(2, { desde: 1 }),
      diasDesdeCambioAgua: 9,
    });
    expect(recomendacion.accion).toBe('cambiar_agua');
    expect(recomendacion.mlSugeridos).toBe(0);
  });

  it('no molesta si el agua es reciente', () => {
    const recomendacion = recomendarRiego({
      planta: frasco(),
      especie: especie(),
      estadoHoy: simularBalance({
        planta: frasco(),
        especie: especie(),
        eventos: [],
        clima: serieClima(3),
      })[2],
      pronostico: serieClima(2, { desde: 1 }),
      diasDesdeCambioAgua: 2,
    });
    expect(recomendacion.accion).toBe('no_regar');
  });

  it('sube la urgencia cuando ya lleva el doble de lo recomendado', () => {
    const base = {
      planta: frasco(),
      especie: especie(),
      estadoHoy: simularBalance({
        planta: frasco(),
        especie: especie(),
        eventos: [],
        clima: serieClima(3),
      })[2],
      pronostico: serieClima(2, { desde: 1 }),
    };
    expect(recomendarRiego({ ...base, diasDesdeCambioAgua: 8 }).urgencia).toBe('media');
    expect(recomendarRiego({ ...base, diasDesdeCambioAgua: 20 }).urgencia).toBe('alta');
  });

  /** Al frasco le da igual el pronóstico: su raíz no se moja con la lluvia. */
  it('la lluvia no cambia nada para un esqueje', () => {
    const base = {
      planta: frasco(),
      especie: especie(),
      estadoHoy: simularBalance({
        planta: frasco(),
        especie: especie(),
        eventos: [],
        clima: serieClima(3),
      })[2],
      diasDesdeCambioAgua: 10,
    };
    const conLluvia = recomendarRiego({ ...base, pronostico: serieClima(2, { lluvia: 50, desde: 1 }) });
    const sinLluvia = recomendarRiego({ ...base, pronostico: serieClima(2, { desde: 1 }) });
    expect(conLluvia.accion).toBe('cambiar_agua');
    expect(sinLluvia.accion).toBe('cambiar_agua');
  });
});
