/**
 * API pública de persistencia.
 *
 * Todo lo demás de la app habla con este módulo y no sabe —ni le importa— si
 * detrás hay SQLite o un almacén en memoria. La elección la hace `motor`, según
 * la plataforma.
 */

import { motor } from './motor';

export const abrirBd = () => motor.iniciar();

export const guardarPlanta = motor.guardarPlanta.bind(motor);
export const listarPlantas = motor.listarPlantas.bind(motor);
export const obtenerPlanta = motor.obtenerPlanta.bind(motor);
export const archivarPlanta = motor.archivarPlanta.bind(motor);

export const registrarEvento = motor.registrarEvento.bind(motor);
export const listarEventos = motor.listarEventos.bind(motor);
export const eliminarEvento = motor.eliminarEvento.bind(motor);

export const guardarDiagnostico = motor.guardarDiagnostico.bind(motor);
export const ultimoDiagnostico = motor.ultimoDiagnostico.bind(motor);
export const colaDeConfirmacion = motor.colaDeConfirmacion.bind(motor);

export const guardarClimaEnCache = motor.guardarClimaEnCache.bind(motor);
export const leerClimaDeCache = motor.leerClimaDeCache.bind(motor);

export const guardarAjuste = motor.guardarAjuste.bind(motor);
export const leerAjuste = motor.leerAjuste.bind(motor);

export const borrarTodo = motor.borrarTodo.bind(motor);

/** Identificador corto, ordenable por tiempo de creación. */
export function nuevoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type { Repositorio } from './contrato';
