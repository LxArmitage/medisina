/**
 * Registrar un cuidado, y avisar si movió la racha.
 *
 * Antes había tres sitios que guardaban eventos —la agenda, la ficha y el
 * escáner— y ninguno sabía nada de la racha: el número se recalculaba la
 * próxima vez que alguien abriera "Hoy". Así la racha no podía "subir"; como
 * mucho, aparecía distinta más tarde, y eso no se siente como un logro.
 *
 * Ahora todo cuidado pasa por aquí. Se compara la racha antes y después de
 * guardar, y se avisa a quien escuche —la celebración que vive en la raíz de
 * la app— con el número de antes y el de ahora. El número que sube delante de
 * tus ojos, en el mismo instante en que regaste, es todo el truco de Duolingo.
 */

import { listarEventos, listarPlantas, registrarEvento } from '../datos/db';
import { calcularRacha, cuidadoDe } from '../dominio/racha';
import type { Cuidado, Logro, Racha } from '../dominio/racha';
import type { Evento } from '../dominio/tipos';

export interface AvisoDeCuidado {
  /** Este cuidado encendió el día: la racha subió. */
  subio: boolean;
  antes: number;
  despues: number;
  racha: Racha;
  /** Un logro por días que se acaba de conseguir con este cuidado. */
  logroNuevo: Logro | null;
  tipo: Evento['tipo'];
  apodo: string;
}

type Oyente = (aviso: AvisoDeCuidado) => void;

const oyentes = new Set<Oyente>();

/** Para la celebración. Devuelve cómo dejar de escuchar. */
export function escucharCuidados(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Guarda el evento y avisa.
 *
 * La racha de "antes" se calcula con los cuidados guardados, y la de "después"
 * con los mismos más éste — sin volver a leer la base. Si leer falla, el
 * evento se guarda igual: perder la celebración es aceptable, perder el riego
 * que la persona registró no.
 */
export async function registrarCuidado(evento: Evento): Promise<AvisoDeCuidado> {
  const [previos, apodo] = await Promise.all([
    cuidadosGuardados().catch((): Cuidado[] => []),
    apodoDe(evento.plantaId).catch(() => ''),
  ]);

  await registrarEvento(evento);

  const antes = calcularRacha({ cuidados: previos });
  const despues = calcularRacha({ cuidados: [...previos, cuidadoDe(evento, apodo)] });

  const aviso: AvisoDeCuidado = {
    subio: !antes.hoyCuenta && despues.hoyCuenta,
    antes: antes.dias,
    despues: despues.dias,
    racha: despues,
    logroNuevo:
      despues.logros.find(
        (l) =>
          l.faltan !== undefined &&
          l.logrado &&
          !antes.logros.find((a) => a.clave === l.clave)?.logrado,
      ) ?? null,
    tipo: evento.tipo,
    apodo,
  };

  for (const oyente of oyentes) {
    // Un oyente que truena no puede tumbar el registro de un riego.
    try {
      oyente(aviso);
    } catch {
      // nada
    }
  }

  return aviso;
}

async function cuidadosGuardados(): Promise<Cuidado[]> {
  const plantas = await listarPlantas();
  const listas = await Promise.all(
    plantas.map(async (planta) =>
      (await listarEventos(planta.id)).map((ev) => cuidadoDe(ev, planta.apodo)),
    ),
  );
  return listas.flat();
}

async function apodoDe(plantaId: string): Promise<string> {
  const plantas = await listarPlantas();
  return plantas.find((p) => p.id === plantaId)?.apodo ?? '';
}
