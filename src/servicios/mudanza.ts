/**
 * Cambiar una planta de lugar.
 *
 * Guarda la ubicación nueva y lo apunta en su bitácora: "la mudé a la sombra"
 * es parte de su historia, y explica después por qué cambió su riego. Mudarla
 * por el calor o la helada es cuidarla, así que cuenta como un cuidado.
 */

import { guardarPlanta, nuevoId } from '../datos/db';
import { infoLugar, lugarDe, ubicacionEn } from '../dominio/lugares';
import type { Lugar } from '../dominio/lugares';
import type { Planta } from '../dominio/tipos';
import { registrarCuidado } from './cuidado';

export async function mudarPlanta(planta: Planta, lugar: Lugar): Promise<Planta> {
  const de = lugarDe(planta.ubicacion);
  const nueva: Planta = { ...planta, ubicacion: ubicacionEn(lugar, planta.ubicacion) };
  if (de === lugar) return planta;
  await guardarPlanta(nueva);
  await registrarCuidado({
    id: nuevoId(),
    plantaId: planta.id,
    tipo: 'observacion',
    fecha: new Date().toISOString(),
    nota: `La mudé: ${infoLugar(de).titulo.toLowerCase()} → ${infoLugar(lugar).titulo.toLowerCase()}`,
    datos: { mudanza: { de, a: lugar } },
  });
  return nueva;
}

/** Sólo el techo, sin moverla de zona: para la lluvia fuerte. */
export async function ponerBajoTecho(planta: Planta): Promise<Planta> {
  if (planta.ubicacion.techado) return planta;
  const nueva: Planta = { ...planta, ubicacion: { ...planta.ubicacion, techado: true } };
  await guardarPlanta(nueva);
  await registrarCuidado({
    id: nuevoId(),
    plantaId: planta.id,
    tipo: 'observacion',
    fecha: new Date().toISOString(),
    nota: 'La puse bajo techo por la lluvia',
  });
  return nueva;
}
