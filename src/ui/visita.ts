/**
 * De un jardín compartido a lo que la escena de juego sabe dibujar.
 *
 * `PatioJuego` trabaja con el estado completo de cada planta (balance de agua,
 * clima, bitácora). De un jardín ajeno sólo se sabe lo que viajó en el QR:
 * especie, apodo, zona, cómo anda de agua y su tamaño. Aquí se arma un estado
 * mínimo con eso —sin riegos pendientes: de visita no se riega— para que el
 * jardín de tu amigo se vea con el mismo mundo que el tuyo.
 */

import { buscarEspecie } from '../dominio/catalogo';
import { proximosEventos } from '../dominio/fenologia';
import { mezclar } from '../dominio/forma';
import type { JardinCompartido, NivelCompartido } from '../dominio/jardinCompartido';
import { mejorLugarEn, ubicacionEn } from '../dominio/lugares';
import type { Planta } from '../dominio/tipos';
import type { EstadoDePlanta } from '../servicios/agenda';

const FRACCION: Record<NivelCompartido, number> = {
  encharcado: 1.1,
  humedo: 0.9,
  optimo: 0.6,
  seco: 0.25,
  critico: 0.08,
};

export function estadosDeVisita(j: JardinCompartido, hoy = new Date()): EstadoDePlanta[] {
  const hace = new Date(hoy.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const lista: EstadoDePlanta[] = [];
  j.plantas.forEach((p, i) => {
    const especie = buscarEspecie(p.especieId);
    if (!especie) return;
    const planta: Planta = {
      id: `${j.id}-${i}`,
      apodo: p.apodo,
      especieId: especie.id,
      fechaAdquisicion: hace,
      ubicacion: ubicacionEn(mejorLugarEn(p.zona, especie), { exposicion: 'semisol', techado: false, interior: false }),
      contenedor: { tipo: 'maceta', material: 'barro', tieneDrenaje: true },
      medidas: p.alturaCm || p.elementos ? { alturaCm: p.alturaCm, elementos: p.elementos, fecha: j.fecha } : undefined,
      apariencia: p.hoja ? { hoja: p.hoja, hojaOscura: mezclar(p.hoja, '#000000', 0.35), fecha: j.fecha } : undefined,
      creadaEn: hace,
    };
    const estadoHoy = {
      fecha: j.fecha,
      aguaDisponibleMm: especie.aguaUtilMm * FRACCION[p.nivel],
      fraccionDisponible: FRACCION[p.nivel],
      demandaMm: 0,
      aporteMm: 0,
      diasConsecutivosEncharcado: p.nivel === 'encharcado' ? 2 : 0,
      diasConsecutivosEnEstres: p.nivel === 'critico' ? 3 : 0,
      nivel: p.nivel,
      esPronostico: false,
    };
    const estado = {
      planta,
      especie,
      eventos: [],
      serie: { historico: [], pronostico: [], fuente: 'estimado', actualizadoEn: j.fecha },
      estados: [estadoHoy],
      estadoHoy,
      recomendacion: { accion: 'no_regar', urgencia: 'ninguna', mlSugeridos: 0, motivo: '', hechos: [] },
      snapshot: {
        fenologia: proximosEventos({ especie, hoy }),
        clima: null,
        hidrico: { diasDesdeCambioAgua: null },
      },
      voz: '',
    };
    // Estado mínimo, a propósito: la escena en modo visita sólo lee estos campos.
    lista.push(estado as unknown as EstadoDePlanta);
  });
  return lista;
}
