/**
 * Pruebas de la clave de semillas.
 *
 * Lo que más se protege aquí es lo que la clave NO hace. Una clave que nombra
 * una especie con un solo rasgo coincidente es peor que no tener clave: alguien
 * siembra tres meses algo que no era y se entera cuando brota. Así que se
 * verifica que la confianza sólo sea "clara" cuando de verdad queda una sola en
 * pie, y que decir "de semilla no se hace" también cuente como respuesta.
 */

import {
  confianzaDeClave,
  esBuenaEpoca,
  fechaEsperada,
  identificarSemilla,
  perfilDeSemilla,
  semillasSembrables,
  siguientePregunta,
} from '../src/dominio/semillas';

describe('la clave descarta', () => {
  it('con un solo rasgo ya deja fuera a las que no encajan', () => {
    const candidatas = identificarSemilla({ tamano: 'grande' });
    const ids = candidatas.filter((c) => c.encaje === 1).map((c) => c.perfil.especieId);
    expect(ids).toEqual(expect.arrayContaining(['citrus-limon', 'monstera-deliciosa']));
    expect(ids).not.toContain('ocimum-basilicum');
  });

  it('tres rasgos dejan una sola en pie', () => {
    // Grande, de gota y clara: sólo el limón.
    const candidatas = identificarSemilla({ tamano: 'grande', forma: 'de_gota', color: 'clara' });
    expect(candidatas[0].perfil.especieId).toBe('citrus-limon');
    expect(confianzaDeClave(candidatas)).toBe('clara');
  });

  it('separa el limón de la monstera, que son las dos grandes', () => {
    const limon = identificarSemilla({ tamano: 'grande', color: 'clara' });
    const monstera = identificarSemilla({ tamano: 'grande', color: 'verde' });
    expect(limon[0].perfil.especieId).toBe('citrus-limon');
    expect(monstera[0].perfil.especieId).toBe('monstera-deliciosa');
  });

  it('sin respuestas no propone nada', () => {
    expect(identificarSemilla({})).toEqual([]);
    expect(confianzaDeClave([])).toBe('ninguna');
  });
});

describe('no afirma de más', () => {
  /** La prueba que justifica todo el diseño. */
  it('con un encaje parcial la confianza es dudosa, no clara', () => {
    const candidatas = identificarSemilla({ tamano: 'chica', forma: 'redonda', color: 'verde' });
    expect(confianzaDeClave(candidatas)).toBe('dudosa');
  });

  it('con dos empatadas al 100 % tampoco la nombra', () => {
    // Diminuta y redonda: la sina y el nenúfar empatan hasta que entra el color.
    const candidatas = identificarSemilla({ tamano: 'diminuta', forma: 'redonda' });
    const perfectas = candidatas.filter((c) => c.encaje === 1);
    expect(perfectas.length).toBeGreaterThan(1);
    expect(confianzaDeClave(candidatas)).toBe('dudosa');
  });

  it('explica en qué coincidió y en qué no', () => {
    const candidatas = identificarSemilla({ tamano: 'grande', color: 'clara' });
    const limon = candidatas.find((c) => c.perfil.especieId === 'citrus-limon');
    expect(limon?.coincide.length).toBe(2);
    expect(limon?.difiere).toEqual([]);
  });
});

describe('pregunta primero lo que más separa', () => {
  it('propone el rasgo que reparte mejor a las que siguen vivas', () => {
    const candidatas = identificarSemilla({ tamano: 'diminuta' });
    const siguiente = siguientePregunta({ tamano: 'diminuta' }, candidatas);
    expect(['forma', 'color']).toContain(siguiente);
  });

  it('deja de preguntar cuando ya no hace falta', () => {
    const candidatas = identificarSemilla({
      tamano: 'grande',
      forma: 'de_gota',
      color: 'clara',
    });
    expect(siguientePregunta({ tamano: 'grande', forma: 'de_gota', color: 'clara' }, candidatas)).toBeNull();
  });
});

describe('las que no se hacen de semilla', () => {
  /**
   * Es media función de la herramienta. Decirle a alguien que un helecho no
   * tiene semillas le ahorra meses de maceta vacía.
   */
  it('el helecho no tiene semillas, tiene esporas, y lo dice', () => {
    const perfil = perfilDeSemilla('nephrolepis-exaltata');
    expect(perfil?.deSemilla).toBe(false);
    expect(perfil?.senal).toMatch(/espora/i);
  });

  it('cada una que no va por semilla propone qué hacer en su lugar', () => {
    const noSembrables = ['epipremnum-aureum', 'ficus-benjamina', 'bougainvillea-glabra'];
    for (const id of noSembrables) {
      const perfil = perfilDeSemilla(id);
      expect({ id, deSemilla: perfil?.deSemilla, tieneAlternativa: !!perfil?.enLugarDe }).toEqual({
        id,
        deSemilla: false,
        tieneAlternativa: true,
      });
    }
  });

  it('las sembrables sí traen instrucciones completas', () => {
    for (const perfil of semillasSembrables()) {
      expect({
        id: perfil.especieId,
        tieneDias: perfil.siembra.diasMax > 0,
        tieneMeses: perfil.siembra.meses.length > 0,
      }).toEqual({ id: perfil.especieId, tieneDias: true, tieneMeses: true });
    }
  });
});

describe('cuándo asoma y cuándo sembrarla', () => {
  it('calcula la ventana desde el día de la siembra', () => {
    const perfil = perfilDeSemilla('ocimum-basilicum');
    const ventana = fechaEsperada(perfil!.siembra, new Date('2026-04-01T12:00:00Z'));
    expect(ventana).toEqual({ desde: '2026-04-06', hasta: '2026-04-11' });
  });

  it('sabe si el mes de hoy es buena época', () => {
    const albahaca = perfilDeSemilla('ocimum-basilicum')!.siembra;
    expect(esBuenaEpoca(albahaca, new Date('2026-05-10T12:00:00Z'))).toBe(true);
    expect(esBuenaEpoca(albahaca, new Date('2026-12-10T12:00:00Z'))).toBe(false);
  });

  /** El rosal es el caso raro: se siembra en invierno porque necesita frío. */
  it('el rosal pide frío y su temporada es el invierno', () => {
    const rosal = perfilDeSemilla('rosa-hybrida')!;
    expect(rosal.siembra.tratamiento).toMatch(/refrigerador|frío/i);
    expect(esBuenaEpoca(rosal.siembra, new Date('2026-01-10T12:00:00Z'))).toBe(true);
  });
});
