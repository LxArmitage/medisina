/**
 * Lo que hace el patio tuyo: acomodar las plantas donde quieras, la
 * felicitación al tocar la racha y el jardín de ejemplo.
 *
 * Lo que se protege: que una planta soltada entre dos quede entre esas dos (y
 * las demás no brinquen), que el mundo respete ese orden y esa fila, que la
 * felicitación diga algo distinto según cómo vas, y que el jardín inventado
 * sea válido de punta a punta (especies que existen, se puede visitar).
 */

import { buscarEspecie } from '../src/dominio/catalogo';
import { mensajeDeRacha } from '../src/dominio/felicitacion';
import { codificarJardin, jardinDeEjemplo, leerJardin } from '../src/dominio/jardinCompartido';
import { reacomodar } from '../src/servicios/acomodo';
import { armarMundo } from '../src/ui/mundoPatio';
import type { HabitanteEntrada } from '../src/ui/mundoPatio';
import { estadosDeVisita } from '../src/ui/visita';

describe('acomodar dentro de su zona', () => {
  const fila = [
    { id: 'a', x: 100, atras: false },
    { id: 'b', x: 220, atras: true },
    { id: 'c', x: 340, atras: false },
  ];

  it('soltada entre dos, queda entre esas dos', () => {
    const r = reacomodar(fila, 'c', 150, true);
    expect(Object.entries(r).sort((x, y) => x[1].orden - y[1].orden).map(([id]) => id)).toEqual(['a', 'c', 'b']);
    expect(r.c.atras).toBe(true);
  });

  it('las demás conservan su fila: no brincan', () => {
    const r = reacomodar(fila, 'a', 400, false);
    expect(r.b.atras).toBe(true);
    expect(r.c.atras).toBe(false);
    expect(r.a.orden).toBe(2);
  });

  it('el mundo respeta el orden y la fila que eligió la persona', () => {
    const base: HabitanteEntrada[] = ['x1', 'x2', 'x3'].map((id, i) => ({ id, zona: 'sol', pideAtencion: false, urgencia: i }));
    const acomodadas = base.map((h) => ({
      ...h,
      acomodo: { x1: { orden: 2, atras: false }, x2: { orden: 0, atras: false }, x3: { orden: 1, atras: true } }[h.id],
    }));
    const mundo = armarMundo(acomodadas, 400);
    const porX = [...mundo.sitios].sort((a, b) => a.x - b.x).map((s) => s.id);
    expect(porX).toEqual(['x2', 'x3', 'x1']);
    expect(mundo.sitios.find((s) => s.id === 'x3')!.escala).toBeLessThan(1);
    expect(mundo.sitios.find((s) => s.id === 'x2')!.escala).toBe(1);
  });
});

describe('felicitar la racha', () => {
  it('con racha y hoy cuidadas: felicidades', () => {
    const m = mensajeDeRacha({ dias: 5, mejor: 9, hoyCuenta: true });
    expect(m.titulo).toMatch(/felicidades por cuidarlas/i);
    expect(m.texto).toMatch(/5 días/);
  });

  it('con hoy pendiente, anima a no romperla', () => {
    expect(mensajeDeRacha({ dias: 5, mejor: 9, hoyCuenta: false }).texto).toMatch(/cuida alguna hoy/i);
  });

  it('sin racha, invita a empezar; y reconoce el récord', () => {
    expect(mensajeDeRacha({ dias: 0, mejor: 4, hoyCuenta: false }).titulo).toMatch(/empieza hoy/i);
    expect(mensajeDeRacha({ dias: 12, mejor: 12, hoyCuenta: true }).texto).toMatch(/mejor racha/i);
    expect(mensajeDeRacha({ dias: 1, mejor: 1, hoyCuenta: true }).texto).toMatch(/primer día/);
    expect(mensajeDeRacha({ dias: 1, mejor: 1, hoyCuenta: true }).texto).not.toMatch(/seguidos/);
  });
});

describe('el jardín de ejemplo', () => {
  const j = jardinDeEjemplo(new Date('2026-09-25T12:00:00Z'));

  it('sus especies existen y tiene plantas en los tres lugares', () => {
    for (const p of j.plantas) expect(buscarEspecie(p.especieId)).toBeDefined();
    expect(new Set(j.plantas.map((p) => p.zona))).toEqual(new Set(['patio', 'casa', 'sombra']));
    expect(j.ejemplo).toBe(true);
  });

  it('se puede visitar: cada planta tiene su estado para dibujarla', () => {
    expect(estadosDeVisita(j)).toHaveLength(j.plantas.length);
  });

  it('el aviso de ejemplo no viaja en los códigos', () => {
    const leido = leerJardin(codificarJardin(j))!;
    expect(leido.ejemplo).toBeUndefined();
    expect(leido.plantas).toHaveLength(j.plantas.length);
  });
});
