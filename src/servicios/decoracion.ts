/**
 * Dónde se guarda la decoración del jardín y la maceta de cada planta.
 *
 * Se guarda en el teléfono, con los demás ajustes. Quien decora desde su
 * pantalla y regresa al patio tiene que ver el cambio al instante, sin que el
 * patio se vuelva a cargar entero: por eso hay un aviso (`escuchar…`) al que
 * se suscriben las escenas.
 */

import { useEffect, useState } from 'react';

import { guardarAjuste, leerAjuste } from '../datos/db';
import { DECORACION_INICIAL, limpiarDecoracion, limpiarMacetas } from '../dominio/decoracion';
import type { Decoracion, EstiloMaceta } from '../dominio/decoracion';

const CLAVE = 'patio:decoracion';
const CLAVE_MACETAS = 'patio:macetas';

let decoracion: Decoracion | null = null;
let macetas: Record<string, EstiloMaceta> | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((f) => f());
}

async function leerJson(clave: string): Promise<unknown> {
  const crudo = await leerAjuste(clave).catch(() => null);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as unknown;
  } catch {
    return null;
  }
}

export async function leerDecoracion(): Promise<Decoracion> {
  if (!decoracion) decoracion = limpiarDecoracion(await leerJson(CLAVE));
  return decoracion;
}

export async function guardarDecoracion(nueva: Decoracion): Promise<void> {
  decoracion = limpiarDecoracion(nueva);
  avisar();
  await guardarAjuste(CLAVE, JSON.stringify(decoracion));
}

/**
 * Cambia la decoración a partir de la que está vigente EN ESTE MOMENTO, no de
 * la que tenía la pantalla al dibujarse: dos toques seguidos (barda y piso)
 * no se pisan el uno al otro.
 */
export async function actualizarDecoracion(cambio: (d: Decoracion) => Decoracion): Promise<void> {
  // Ya cargada, se aplica sin esperar nada: así el siguiente toque ve este cambio.
  const vigente = decoracion ?? (await leerDecoracion());
  await guardarDecoracion(cambio(vigente));
}

export async function leerMacetas(): Promise<Record<string, EstiloMaceta>> {
  if (!macetas) macetas = limpiarMacetas(await leerJson(CLAVE_MACETAS));
  return macetas;
}

export async function elegirMaceta(plantaId: string, estilo: EstiloMaceta): Promise<void> {
  macetas = { ...(macetas ?? (await leerMacetas())), [plantaId]: estilo };
  avisar();
  await guardarAjuste(CLAVE_MACETAS, JSON.stringify(macetas));
}

/** Para que una escena se entere cuando alguien decora en otra pantalla. */
export function escucharDecoracion(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** La decoración vigente, y se actualiza sola cuando cambia. */
export function useDecoracion(): Decoracion {
  const [d, setD] = useState<Decoracion>(decoracion ?? DECORACION_INICIAL);
  useEffect(() => {
    let vigente = true;
    const cargar = () => void leerDecoracion().then((x) => vigente && setD(x));
    cargar();
    const soltar = escucharDecoracion(cargar);
    return () => {
      vigente = false;
      soltar();
    };
  }, []);
  return d;
}

/** Las macetas elegidas, y se actualizan solas cuando cambian. */
export function useMacetas(): Record<string, EstiloMaceta> {
  const [m, setM] = useState<Record<string, EstiloMaceta>>(macetas ?? {});
  useEffect(() => {
    let vigente = true;
    const cargar = () => void leerMacetas().then((x) => vigente && setM(x));
    cargar();
    const soltar = escucharDecoracion(cargar);
    return () => {
      vigente = false;
      soltar();
    };
  }, []);
  return m;
}
