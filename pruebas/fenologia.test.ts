/**
 * Pruebas de fenología — la parte anticipatoria del producto.
 */

import { buscarEspecie } from '../src/dominio/catalogo';
import {
  ajustePorHistorial,
  edadEnMeses,
  edadLegible,
  proximosEventos,
} from '../src/dominio/fenologia';
import type { Evento, VentanaFenologica } from '../src/dominio/tipos';
import { HOY, especie } from './ayudas';

function observacion(fecha: string, tipo: Evento['tipo'] = 'brote'): Evento {
  return { id: `e-${fecha}`, plantaId: 'p', tipo, fecha: `${fecha}T08:00:00Z` };
}

describe('ventanas del catálogo', () => {
  it('marca en curso lo que cae dentro de la ventana', () => {
    // 15 de junio de 2026, con ventana de brote de marzo a septiembre.
    const eventos = proximosEventos({
      especie: especie({ fenologia: [{ fenomeno: 'brote', mesInicio: 3, mesFin: 9 }] }),
      hoy: HOY,
    });
    expect(eventos[0].enCurso).toBe(true);
    expect(eventos[0].diasParaInicio).toBe(0);
  });

  it('calcula cuántos días faltan para una ventana futura', () => {
    const eventos = proximosEventos({
      especie: especie({ fenologia: [{ fenomeno: 'floracion', mesInicio: 9, mesFin: 10 }] }),
      hoy: HOY,
    });
    expect(eventos[0].enCurso).toBe(false);
    expect(eventos[0].diasParaInicio).toBeGreaterThan(70);
    expect(eventos[0].diasParaInicio).toBeLessThan(90);
  });

  it('maneja ventanas que cruzan el año', () => {
    const eventos = proximosEventos({
      especie: especie({ fenologia: [{ fenomeno: 'floracion', mesInicio: 11, mesFin: 2 }] }),
      hoy: HOY,
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0].inicio).toBe('2026-11-01');
    expect(eventos[0].fin).toBe('2027-02-28');
  });

  it('ignora el reposo: no es algo que el usuario deba esperar', () => {
    const eventos = proximosEventos({
      especie: especie({
        fenologia: [
          { fenomeno: 'reposo', mesInicio: 11, mesFin: 2 },
          { fenomeno: 'brote', mesInicio: 3, mesFin: 9 },
        ],
      }),
      hoy: HOY,
    });
    expect(eventos.map((e) => e.fenomeno)).toEqual(['brote']);
  });

  it('filtra por zona climática cuando la ventana la especifica', () => {
    const fenologia: VentanaFenologica[] = [
      { fenomeno: 'floracion', mesInicio: 6, mesFin: 7, zonas: ['Aw'] },
    ];
    const enZona = proximosEventos({ especie: especie({ fenologia }), zonaClimatica: 'Aw', hoy: HOY });
    const fueraDeZona = proximosEventos({
      especie: especie({ fenologia }),
      zonaClimatica: 'BWh',
      hoy: HOY,
    });
    expect(enZona).toHaveLength(1);
    expect(fueraDeZona).toHaveLength(0);
  });

  it('ordena primero lo que está en curso', () => {
    const eventos = proximosEventos({
      especie: especie({
        fenologia: [
          { fenomeno: 'fructificacion', mesInicio: 9, mesFin: 10 },
          { fenomeno: 'brote', mesInicio: 3, mesFin: 9 },
        ],
      }),
      hoy: HOY,
    });
    expect(eventos[0].fenomeno).toBe('brote');
    expect(eventos[0].enCurso).toBe(true);
  });
});

describe('ajuste por historial de la planta', () => {
  const ventana: VentanaFenologica = { fenomeno: 'brote', mesInicio: 4, mesFin: 6 };

  it('una sola observación no basta: una primavera no es una tendencia', () => {
    const { dias, observaciones } = ajustePorHistorial(
      'brote',
      ventana,
      [observacion('2025-03-20')],
    );
    expect(observaciones).toBe(1);
    expect(dias).toBe(0);
  });

  it('con dos o más, desplaza la ventana hacia el comportamiento real', () => {
    // Brotó el 20 de marzo dos años seguidos: doce días antes del 1 de abril.
    const { dias } = ajustePorHistorial('brote', ventana, [
      observacion('2025-03-20'),
      observacion('2024-03-20'),
    ]);
    expect(dias).toBe(-12);
  });

  it('acota el ajuste para no reinventar la biología', () => {
    const { dias } = ajustePorHistorial('brote', ventana, [
      observacion('2025-01-01'),
      observacion('2024-01-01'),
    ]);
    expect(dias).toBe(-30);
  });

  it('el evento ajustado se marca como proveniente del historial', () => {
    const eventos = proximosEventos({
      especie: especie({ fenologia: [{ fenomeno: 'brote', mesInicio: 8, mesFin: 9 }] }),
      eventos: [observacion('2025-08-15'), observacion('2024-08-15')],
      hoy: HOY,
    });
    expect(eventos[0].fuente).toBe('historial');
    expect(eventos[0].ajusteDias).toBe(14);
    expect(eventos[0].confianza).toBe('media');
  });

  it('con tres observaciones la confianza sube', () => {
    const eventos = proximosEventos({
      especie: especie({ fenologia: [{ fenomeno: 'brote', mesInicio: 8, mesFin: 9 }] }),
      eventos: [
        observacion('2025-08-15'),
        observacion('2024-08-15'),
        observacion('2023-08-15'),
      ],
      hoy: HOY,
    });
    expect(eventos[0].confianza).toBe('alta');
  });
});

describe('edad de la planta', () => {
  it('cuenta los meses desde la adquisición', () => {
    expect(edadEnMeses('2025-06-15', HOY)).toBe(12);
  });

  it('se lee en lenguaje natural', () => {
    expect(edadLegible('2026-06-10', HOY)).toBe('recién llegada');
    expect(edadLegible('2026-01-15', HOY)).toBe('5 meses');
    expect(edadLegible('2025-06-15', HOY)).toBe('1 año');
    expect(edadLegible('2024-03-15', HOY)).toBe('2 años y 3 meses');
  });
});

describe('las especies del catálogo producen fenología utilizable', () => {
  it('la sina anuncia floración o fruto en verano', () => {
    const sina = buscarEspecie('lophocereus-schottii');
    expect(sina).toBeDefined();
    const eventos = proximosEventos({ especie: sina!, zonaClimatica: 'BSh', hoy: HOY });
    expect(eventos.some((e) => e.enCurso)).toBe(true);
  });
});
