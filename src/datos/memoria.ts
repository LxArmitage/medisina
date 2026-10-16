/**
 * Almacén en memoria — web y pruebas.
 *
 * Guarda todo en mapas y, cuando el entorno lo permite (navegador), persiste
 * en localStorage para que la demo sobreviva a un refresco. En Jest no hay
 * localStorage y simplemente vive en memoria, que es justo lo que se quiere
 * para que cada prueba arranque limpia.
 */

import type { Diagnostico, Evento, Planta } from '../dominio/tipos';
import type { SerieClima } from './clima';
import type { Repositorio } from './contrato';

const CLAVE_ALMACEN = 'medisina:almacen:v1';

interface Estado {
  plantas: Record<string, Planta>;
  eventos: Record<string, Evento>;
  diagnosticos: Record<string, Diagnostico>;
  clima: Record<string, { serie: SerieClima; actualizadoEn: string }>;
  ajustes: Record<string, string>;
}

function estadoVacio(): Estado {
  return { plantas: {}, eventos: {}, diagnosticos: {}, clima: {}, ajustes: {} };
}

let estado: Estado = estadoVacio();

// ---------------------------------------------------------------------------
// Persistencia opcional
// ---------------------------------------------------------------------------

function almacenDelNavegador(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Modo privado o cookies bloqueadas: se sigue en memoria y ya.
    return null;
  }
}

function cargar(): void {
  const almacen = almacenDelNavegador();
  if (!almacen) return;
  try {
    const guardado = almacen.getItem(CLAVE_ALMACEN);
    if (guardado) estado = { ...estadoVacio(), ...(JSON.parse(guardado) as Estado) };
  } catch {
    estado = estadoVacio();
  }
}

function persistir(): void {
  const almacen = almacenDelNavegador();
  if (!almacen) return;
  try {
    almacen.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
  } catch {
    // Cuota llena: la sesión sigue funcionando en memoria.
  }
}

// ---------------------------------------------------------------------------

function porFechaDesc<T extends { fecha: string }>(a: T, b: T): number {
  return b.fecha.localeCompare(a.fecha);
}

export const motorMemoria: Repositorio = {
  async iniciar() {
    cargar();
  },

  async guardarPlanta(planta) {
    estado.plantas[planta.id] = { ...planta };
    persistir();
  },

  async listarPlantas() {
    return Object.values(estado.plantas)
      .filter((planta) => !planta.archivada)
      .sort((a, b) => a.apodo.localeCompare(b.apodo, 'es'));
  },

  async obtenerPlanta(id) {
    return estado.plantas[id] ? { ...estado.plantas[id] } : null;
  },

  async archivarPlanta(id) {
    const planta = estado.plantas[id];
    if (planta) {
      planta.archivada = true;
      persistir();
    }
  },

  async registrarEvento(evento) {
    estado.eventos[evento.id] = { ...evento };
    persistir();
  },

  async listarEventos(plantaId, limite = 200) {
    return Object.values(estado.eventos)
      .filter((evento) => evento.plantaId === plantaId)
      .sort(porFechaDesc)
      .slice(0, limite);
  },

  async eliminarEvento(id) {
    delete estado.eventos[id];
    persistir();
  },

  async guardarDiagnostico(diagnostico) {
    estado.diagnosticos[diagnostico.id] = { ...diagnostico };
    persistir();
  },

  async ultimoDiagnostico(plantaId) {
    const encontrados = Object.values(estado.diagnosticos)
      .filter((d) => d.plantaId === plantaId)
      .sort(porFechaDesc);
    return encontrados[0] ?? null;
  },

  async colaDeConfirmacion() {
    return Object.values(estado.diagnosticos)
      .filter((d) => d.enColaDeConfirmacion)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  async guardarClimaEnCache(clave, serie) {
    estado.clima[clave] = { serie, actualizadoEn: new Date().toISOString() };
    persistir();
  },

  async leerClimaDeCache(clave) {
    const guardado = estado.clima[clave];
    if (!guardado) return null;
    return { ...guardado.serie, fuente: 'cache' };
  },

  async guardarAjuste(clave, valor) {
    estado.ajustes[clave] = valor;
    persistir();
  },

  async leerAjuste(clave) {
    return estado.ajustes[clave] ?? null;
  },

  async borrarTodo() {
    estado = estadoVacio();
    persistir();
  },
};
