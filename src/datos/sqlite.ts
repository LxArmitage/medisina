/**
 * Persistencia real del producto — SQLite en el dispositivo.
 *
 * El expediente vive primero en el teléfono: la app tiene que abrir, registrar
 * un riego y calcular la agenda sin conexión. La sincronización con el backend
 * llega en Fase 3 y se apoya en `actualizado_en` para resolver conflictos.
 *
 * Este módulo sólo se carga en iOS y Android (ver `motor.native.ts`): en web se
 * usa el almacén en memoria, para no arrastrar el WebAssembly de wa-sqlite ni
 * exigir aislamiento entre orígenes.
 */

import * as SQLite from 'expo-sqlite';

import type {
  AparienciaObservada,
  Contenedor,
  Diagnostico,
  Evento,
  MedidasObservadas,
  Planta,
  Ubicacion,
} from '../dominio/tipos';
import type { SerieClima } from './clima';
import type { Repositorio } from './contrato';

const NOMBRE_BD = 'medisina.db';

let conexion: SQLite.SQLiteDatabase | null = null;

async function bd(): Promise<SQLite.SQLiteDatabase> {
  if (conexion) return conexion;
  conexion = await SQLite.openDatabaseAsync(NOMBRE_BD);
  await migrar(conexion);
  return conexion;
}

async function migrar(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS plantas (
      id                TEXT PRIMARY KEY NOT NULL,
      apodo             TEXT NOT NULL,
      especie_id        TEXT NOT NULL,
      fecha_adquisicion TEXT NOT NULL,
      ubicacion         TEXT NOT NULL,
      contenedor        TEXT NOT NULL,
      foto_portada_uri  TEXT,
      creada_en         TEXT NOT NULL,
      archivada         INTEGER NOT NULL DEFAULT 0,
      actualizado_en    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id             TEXT PRIMARY KEY NOT NULL,
      planta_id      TEXT NOT NULL REFERENCES plantas(id) ON DELETE CASCADE,
      tipo           TEXT NOT NULL,
      fecha          TEXT NOT NULL,
      cantidad_ml    REAL,
      nota           TEXT,
      foto_uri       TEXT,
      datos          TEXT,
      actualizado_en TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_eventos_planta ON eventos(planta_id, fecha DESC);

    CREATE TABLE IF NOT EXISTS diagnosticos (
      id         TEXT PRIMARY KEY NOT NULL,
      planta_id  TEXT NOT NULL REFERENCES plantas(id) ON DELETE CASCADE,
      fecha      TEXT NOT NULL,
      hallazgos  TEXT NOT NULL,
      confianza  TEXT NOT NULL,
      en_cola    INTEGER NOT NULL DEFAULT 0,
      correccion TEXT,
      foto_uri   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_diag_planta ON diagnosticos(planta_id, fecha DESC);

    CREATE TABLE IF NOT EXISTS clima_cache (
      clave          TEXT PRIMARY KEY NOT NULL,
      serie          TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ajustes (
      clave TEXT PRIMARY KEY NOT NULL,
      valor TEXT NOT NULL
    );
  `);

  // Columnas que llegaron después. Antes las medidas del escaneo no tenían
  // dónde guardarse en el teléfono: se perdían al guardar la planta y el
  // gemelo se dibujaba "por edad" en vez de con las medidas de la persona.
  const columnas = await db.getAllAsync<{ name: string }>('PRAGMA table_info(plantas)');
  const tiene = new Set(columnas.map((c) => c.name));
  if (!tiene.has('medidas')) await db.execAsync('ALTER TABLE plantas ADD COLUMN medidas TEXT');
  if (!tiene.has('apariencia')) await db.execAsync('ALTER TABLE plantas ADD COLUMN apariencia TEXT');
}

/** JSON que puede venir vacío o roto: mejor sin el dato que sin la planta. */
function leerJson<T>(texto: string | null | undefined): T | undefined {
  if (!texto) return undefined;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Mapeo de filas
// ---------------------------------------------------------------------------

interface FilaPlanta {
  id: string;
  apodo: string;
  especie_id: string;
  fecha_adquisicion: string;
  ubicacion: string;
  contenedor: string;
  foto_portada_uri: string | null;
  creada_en: string;
  archivada: number;
  medidas?: string | null;
  apariencia?: string | null;
}

function aPlanta(fila: FilaPlanta): Planta {
  return {
    id: fila.id,
    apodo: fila.apodo,
    especieId: fila.especie_id,
    fechaAdquisicion: fila.fecha_adquisicion,
    ubicacion: JSON.parse(fila.ubicacion) as Ubicacion,
    contenedor: JSON.parse(fila.contenedor) as Contenedor,
    fotoPortadaUri: fila.foto_portada_uri ?? undefined,
    medidas: leerJson<MedidasObservadas>(fila.medidas),
    apariencia: leerJson<AparienciaObservada>(fila.apariencia),
    creadaEn: fila.creada_en,
    archivada: fila.archivada === 1,
  };
}

interface FilaEvento {
  id: string;
  planta_id: string;
  tipo: string;
  fecha: string;
  cantidad_ml: number | null;
  nota: string | null;
  foto_uri: string | null;
  datos: string | null;
}

function aEvento(fila: FilaEvento): Evento {
  return {
    id: fila.id,
    plantaId: fila.planta_id,
    tipo: fila.tipo as Evento['tipo'],
    fecha: fila.fecha,
    cantidadMl: fila.cantidad_ml ?? undefined,
    nota: fila.nota ?? undefined,
    fotoUri: fila.foto_uri ?? undefined,
    datos: fila.datos ? (JSON.parse(fila.datos) as Record<string, unknown>) : undefined,
  };
}

interface FilaDiagnostico {
  id: string;
  planta_id: string;
  fecha: string;
  hallazgos: string;
  confianza: string;
  en_cola: number;
  correccion: string | null;
  foto_uri: string | null;
}

function aDiagnostico(fila: FilaDiagnostico): Diagnostico {
  return {
    id: fila.id,
    plantaId: fila.planta_id,
    fecha: fila.fecha,
    hallazgos: JSON.parse(fila.hallazgos) as Diagnostico['hallazgos'],
    confianza: fila.confianza as Diagnostico['confianza'],
    enColaDeConfirmacion: fila.en_cola === 1,
    correccion: fila.correccion ? JSON.parse(fila.correccion) : undefined,
    fotoUri: fila.foto_uri ?? undefined,
  };
}

// ---------------------------------------------------------------------------

export const motorSqlite: Repositorio = {
  async iniciar() {
    await bd();
  },

  async guardarPlanta(planta) {
    const db = await bd();
    await db.runAsync(
      `INSERT INTO plantas
         (id, apodo, especie_id, fecha_adquisicion, ubicacion, contenedor,
          foto_portada_uri, creada_en, archivada, actualizado_en, medidas, apariencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         medidas = excluded.medidas,
         apariencia = excluded.apariencia,
         apodo = excluded.apodo,
         especie_id = excluded.especie_id,
         fecha_adquisicion = excluded.fecha_adquisicion,
         ubicacion = excluded.ubicacion,
         contenedor = excluded.contenedor,
         foto_portada_uri = excluded.foto_portada_uri,
         archivada = excluded.archivada,
         actualizado_en = excluded.actualizado_en`,
      [
        planta.id,
        planta.apodo,
        planta.especieId,
        planta.fechaAdquisicion,
        JSON.stringify(planta.ubicacion),
        JSON.stringify(planta.contenedor),
        planta.fotoPortadaUri ?? null,
        planta.creadaEn,
        planta.archivada ? 1 : 0,
        new Date().toISOString(),
        planta.medidas ? JSON.stringify(planta.medidas) : null,
        planta.apariencia ? JSON.stringify(planta.apariencia) : null,
      ],
    );
  },

  async listarPlantas() {
    const db = await bd();
    const filas = await db.getAllAsync<FilaPlanta>(
      'SELECT * FROM plantas WHERE archivada = 0 ORDER BY apodo COLLATE NOCASE',
    );
    return filas.map(aPlanta);
  },

  async obtenerPlanta(id) {
    const db = await bd();
    const fila = await db.getFirstAsync<FilaPlanta>('SELECT * FROM plantas WHERE id = ?', [id]);
    return fila ? aPlanta(fila) : null;
  },

  async archivarPlanta(id) {
    const db = await bd();
    await db.runAsync('UPDATE plantas SET archivada = 1, actualizado_en = ? WHERE id = ?', [
      new Date().toISOString(),
      id,
    ]);
  },

  async registrarEvento(evento) {
    const db = await bd();
    await db.runAsync(
      `INSERT INTO eventos
         (id, planta_id, tipo, fecha, cantidad_ml, nota, foto_uri, datos, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evento.id,
        evento.plantaId,
        evento.tipo,
        evento.fecha,
        evento.cantidadMl ?? null,
        evento.nota ?? null,
        evento.fotoUri ?? null,
        evento.datos ? JSON.stringify(evento.datos) : null,
        new Date().toISOString(),
      ],
    );
  },

  async listarEventos(plantaId, limite = 200) {
    const db = await bd();
    const filas = await db.getAllAsync<FilaEvento>(
      'SELECT * FROM eventos WHERE planta_id = ? ORDER BY fecha DESC LIMIT ?',
      [plantaId, limite],
    );
    return filas.map(aEvento);
  },

  async eliminarEvento(id) {
    const db = await bd();
    await db.runAsync('DELETE FROM eventos WHERE id = ?', [id]);
  },

  async guardarDiagnostico(diagnostico) {
    const db = await bd();
    await db.runAsync(
      `INSERT INTO diagnosticos (id, planta_id, fecha, hallazgos, confianza, en_cola, correccion, foto_uri)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         confianza = excluded.confianza,
         en_cola = excluded.en_cola,
         correccion = excluded.correccion`,
      [
        diagnostico.id,
        diagnostico.plantaId,
        diagnostico.fecha,
        JSON.stringify(diagnostico.hallazgos),
        diagnostico.confianza,
        diagnostico.enColaDeConfirmacion ? 1 : 0,
        diagnostico.correccion ? JSON.stringify(diagnostico.correccion) : null,
        diagnostico.fotoUri ?? null,
      ],
    );
  },

  async ultimoDiagnostico(plantaId) {
    const db = await bd();
    const fila = await db.getFirstAsync<FilaDiagnostico>(
      'SELECT * FROM diagnosticos WHERE planta_id = ? ORDER BY fecha DESC LIMIT 1',
      [plantaId],
    );
    return fila ? aDiagnostico(fila) : null;
  },

  async colaDeConfirmacion() {
    const db = await bd();
    const filas = await db.getAllAsync<FilaDiagnostico>(
      'SELECT * FROM diagnosticos WHERE en_cola = 1 ORDER BY fecha ASC',
    );
    return filas.map(aDiagnostico);
  },

  async guardarAjuste(clave, valor) {
    const db = await bd();
    await db.runAsync(
      `INSERT INTO ajustes (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      [clave, valor],
    );
  },

  async leerAjuste(clave) {
    const db = await bd();
    const fila = await db.getFirstAsync<{ valor: string }>(
      'SELECT valor FROM ajustes WHERE clave = ?',
      [clave],
    );
    return fila?.valor ?? null;
  },

  async guardarClimaEnCache(clave, serie) {
    const db = await bd();
    await db.runAsync(
      `INSERT INTO clima_cache (clave, serie, actualizado_en) VALUES (?, ?, ?)
       ON CONFLICT(clave) DO UPDATE SET serie = excluded.serie, actualizado_en = excluded.actualizado_en`,
      [clave, JSON.stringify(serie), new Date().toISOString()],
    );
  },

  async leerClimaDeCache(clave) {
    const db = await bd();
    const fila = await db.getFirstAsync<{ serie: string }>(
      'SELECT serie FROM clima_cache WHERE clave = ?',
      [clave],
    );
    if (!fila) return null;
    const serie = JSON.parse(fila.serie) as SerieClima;
    return { ...serie, fuente: 'cache' };
  },

  async borrarTodo() {
    const db = await bd();
    await db.execAsync(
      'DELETE FROM eventos; DELETE FROM diagnosticos; DELETE FROM plantas; DELETE FROM clima_cache; DELETE FROM ajustes;',
    );
  },
};
