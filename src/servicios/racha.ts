/**
 * La racha, pegando el dominio con el disco.
 *
 * Los cuidados salen de los eventos que la agenda ya cargó para cada planta —
 * no se vuelve a leer la base—, y la salud, de la misma simulación. Lo único
 * que se toca aparte es el diario de salud, que guarda los días viejos que la
 * simulación ya no alcanza.
 */

import { apuntarEnDiario, leerDiario } from '../datos/diario';
import { calcularRacha, cuidadoDe } from '../dominio/racha';
import type { Racha } from '../dominio/racha';
import type { EstadoDePlanta } from './agenda';

export async function rachaDe(estados: EstadoDePlanta[]): Promise<Racha> {
  const diario = await leerDiario().catch(() => []);

  const racha = calcularRacha({
    cuidados: estados.flatMap((e) => e.eventos.map((ev) => cuidadoDe(ev, e.planta.apodo))),
    plantas: estados.map((e) => ({
      id: e.planta.id,
      apodo: e.planta.apodo,
      estados: e.estados,
    })),
    diario,
  });

  // Apuntar no puede tumbar la pantalla: si falla el disco, la racha de hoy se
  // ve igual, sólo que mañana habrá que recalcular la salud.
  void apuntarEnDiario(racha.paraApuntar).catch(() => undefined);

  return racha;
}
