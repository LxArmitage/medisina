/**
 * Los jardines de la comunidad: el tuyo listo para compartir, y los que te
 * compartieron guardados en el teléfono.
 *
 * Sin servidor: ver `dominio/jardinCompartido.ts`.
 */

import { guardarAjuste, leerAjuste, listarPlantas, nuevoId } from '../datos/db';
import type { Perfil } from '../dominio/cuenta';
import { lugarDe, infoLugar } from '../dominio/lugares';
import type { JardinCompartido } from '../dominio/jardinCompartido';
import { MAXIMO_PLANTAS, jardinDeEjemplo, leerJardin } from '../dominio/jardinCompartido';
import type { Racha } from '../dominio/racha';
import { agendaDeHoy } from './agenda';
import type { EstadoDePlanta } from './agenda';
import { rachaDe } from './racha';

const CLAVE_ID = 'comunidad:id';
const CLAVE_RECIBIDOS = 'comunidad:jardines';
const CLAVE_EJEMPLO = 'comunidad:ejemplo';
/** Más que suficiente para un ranking entre amigos; evita que crezca sin fin. */
const MAXIMO_GUARDADOS = 60;

/** Tu identificador para compartir: se crea una vez y no cambia. */
async function miId(): Promise<string> {
  const ya = await leerAjuste(CLAVE_ID).catch(() => null);
  if (ya) return ya;
  const nuevo = nuevoId();
  await guardarAjuste(CLAVE_ID, nuevo).catch(() => undefined);
  return nuevo;
}

/** Tu jardín tal como se ve hoy, listo para el QR. Las que más urgen no se esconden. */
export async function miJardin(estados: EstadoDePlanta[], racha: Racha | null, perfil: Perfil | null): Promise<JardinCompartido> {
  const plantas = estados.slice(0, MAXIMO_PLANTAS).map((e) => ({
    especieId: e.especie.id,
    apodo: e.planta.apodo,
    zona: infoLugar(lugarDe(e.planta.ubicacion)).zona,
    nivel: e.estadoHoy.nivel,
    alturaCm: e.planta.medidas?.alturaCm,
    elementos: e.planta.medidas?.elementos,
    hoja: e.planta.apariencia?.hoja,
  }));
  return {
    id: await miId(),
    dueno: (perfil?.nombre ?? 'Yo').split(/\s+/)[0],
    ciudad: perfil?.ciudad?.nombre,
    racha: racha?.dias ?? 0,
    mejorRacha: Math.max(racha?.mejor ?? 0, racha?.dias ?? 0),
    fecha: new Date().toISOString().slice(0, 10),
    plantas,
  };
}

/** Tu jardín de hoy, armado desde la base: plantas, agenda y racha. */
export async function cargarMiJardin(perfil: Perfil | null): Promise<JardinCompartido> {
  const agenda = await agendaDeHoy(await listarPlantas());
  const racha = await rachaDe(agenda).catch(() => null);
  return miJardin(agenda, racha, perfil);
}

export async function jardinesRecibidos(): Promise<JardinCompartido[]> {
  const crudo = await leerAjuste(CLAVE_RECIBIDOS).catch(() => null);
  if (!crudo) return [];
  try {
    const lista = JSON.parse(crudo) as unknown;
    return Array.isArray(lista) ? (lista as JardinCompartido[]) : [];
  } catch {
    return [];
  }
}

export type ResultadoAgregar =
  | { ok: true; jardin: JardinCompartido; nuevo: boolean }
  | { ok: false; motivo: string };

/** Guarda un jardín que llegó por QR o por texto. Si ya estaba, lo actualiza. */
export async function agregarJardin(codigo: string): Promise<ResultadoAgregar> {
  const jardin = leerJardin(codigo);
  if (!jardin) return { ok: false, motivo: 'Ese código no es de un jardín de MEDISINA.' };
  if (jardin.id === (await miId())) return { ok: false, motivo: 'Ése es tu propio jardín.' };
  const lista = await jardinesRecibidos();
  const i = lista.findIndex((j) => j.id === jardin.id);
  const nuevo = i < 0;
  if (nuevo) lista.unshift(jardin);
  else lista[i] = jardin;
  await guardarAjuste(CLAVE_RECIBIDOS, JSON.stringify(lista.slice(0, MAXIMO_GUARDADOS)));
  return { ok: true, jardin, nuevo };
}

/** Pone el jardín de ejemplo la primera vez que se abre Jardines. */
export async function asegurarJardinDeEjemplo(): Promise<void> {
  if (await leerAjuste(CLAVE_EJEMPLO).catch(() => null)) return;
  const lista = await jardinesRecibidos();
  if (!lista.some((j) => j.id === 'ejemplo-mariana')) {
    lista.push(jardinDeEjemplo());
    await guardarAjuste(CLAVE_RECIBIDOS, JSON.stringify(lista));
  }
  await guardarAjuste(CLAVE_EJEMPLO, 'sembrado');
}

export async function quitarJardin(id: string): Promise<void> {
  const lista = (await jardinesRecibidos()).filter((j) => j.id !== id);
  await guardarAjuste(CLAVE_RECIBIDOS, JSON.stringify(lista));
}

export async function esMiJardin(id: string): Promise<boolean> {
  return id === (await miId());
}
