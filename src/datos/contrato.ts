/**
 * Contrato de persistencia.
 *
 * El expediente se guarda distinto según dónde corra la app:
 *
 *   · Nativo (iOS/Android) → SQLite, que es el producto real.
 *   · Web y pruebas        → almacén en memoria.
 *
 * Separarlo en una interfaz no es sólo por la demo en navegador: es lo que
 * permite probar la capa de servicios —incluida la degradación sin red— en
 * Jest, sin emulador y sin dispositivo.
 */

import type { Diagnostico, Evento, Planta } from '../dominio/tipos';
import type { SerieClima } from './clima';

export interface Repositorio {
  iniciar(): Promise<void>;

  guardarPlanta(planta: Planta): Promise<void>;
  listarPlantas(): Promise<Planta[]>;
  obtenerPlanta(id: string): Promise<Planta | null>;
  archivarPlanta(id: string): Promise<void>;

  registrarEvento(evento: Evento): Promise<void>;
  listarEventos(plantaId: string, limite?: number): Promise<Evento[]>;
  eliminarEvento(id: string): Promise<void>;

  guardarDiagnostico(diagnostico: Diagnostico): Promise<void>;
  ultimoDiagnostico(plantaId: string): Promise<Diagnostico | null>;
  colaDeConfirmacion(): Promise<Diagnostico[]>;

  guardarClimaEnCache(clave: string, serie: SerieClima): Promise<void>;
  leerClimaDeCache(clave: string): Promise<SerieClima | null>;

  /**
   * Ajustes sueltos del usuario: su nombre, si ya pasó la bienvenida, qué
   * prefiere. Es un par clave-valor a propósito — meter una tabla con columnas
   * para tres campos que van a cambiar obligaría a migrar la base cada vez.
   */
  guardarAjuste(clave: string, valor: string): Promise<void>;
  leerAjuste(clave: string): Promise<string | null>;

  borrarTodo(): Promise<void>;
}
