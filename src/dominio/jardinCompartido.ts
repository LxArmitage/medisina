/**
 * Un jardín que se comparte: lo que viaja en el código QR y cómo se califica.
 *
 * SIN SERVIDOR. La app es gratis y funciona sin internet, así que no hay una
 * base central donde juntar los jardines de todos. Se comparten de teléfono
 * a teléfono: tu jardín cabe en un código QR (o en un texto que se manda por
 * WhatsApp), la otra persona lo escanea y lo puede visitar. El ranking es de
 * los jardines que te han compartido.
 *
 * QUÉ VIAJA Y QUÉ NO. Viaja tu nombre de pila, tu ciudad, tu racha y, por
 * planta, su especie, su apodo, en qué zona vive, cómo anda de agua y su
 * tamaño. No viajan fotos, ni la bitácora, ni tu correo: nada que no se vea
 * al visitar el jardín.
 *
 * LO QUE LLEGA NO SE CREE. Un código lo pudo escribir cualquiera: todo se
 * revisa al leerlo (especies que existen, textos cortos, números en rango), y
 * lo que no pasa se descarta.
 */

import { buscarEspecie } from './catalogo';
import type { Zona } from './lugares';

export type NivelCompartido = 'encharcado' | 'humedo' | 'optimo' | 'seco' | 'critico';

export interface PlantaCompartida {
  especieId: string;
  apodo: string;
  zona: Zona;
  nivel: NivelCompartido;
  /** Alto en cm, si se midió. */
  alturaCm?: number;
  /** Hojas o brazos, si se contaron. */
  elementos?: number;
  /** El verde de su foto, si se midió. */
  hoja?: string;
}

export interface JardinCompartido {
  /** Estable por persona: compartir de nuevo actualiza, no duplica. */
  id: string;
  dueno: string;
  ciudad?: string;
  racha: number;
  mejorRacha: number;
  /** YYYY-MM-DD: de cuándo es la foto del jardín. */
  fecha: string;
  plantas: PlantaCompartida[];
  /**
   * El jardín de muestra que trae la app, para que Jardines no arranque vacío.
   * No viaja en los códigos: sólo existe en este teléfono.
   */
  ejemplo?: boolean;
}

/** Lo que cabe en un QR que se escanea sin batallar desde otra pantalla. */
export const MAXIMO_PLANTAS = 24;
const PREFIJO = 'MEDISINA1:';
const ZONAS: Zona[] = ['patio', 'casa', 'sombra'];
const NIVELES: NivelCompartido[] = ['encharcado', 'humedo', 'optimo', 'seco', 'critico'];

// ---------------------------------------------------------------------------
// Codificar y leer
// ---------------------------------------------------------------------------

/**
 * A texto, compacto: arreglos en vez de objetos con nombres de campo. Así un
 * jardín de 24 plantas cabe en un QR que una cámara lee a medio metro.
 */
export function codificarJardin(j: JardinCompartido): string {
  const plantas = j.plantas.slice(0, MAXIMO_PLANTAS).map((p) => {
    const fila: Array<string | number> = [
      p.especieId,
      p.apodo.slice(0, 18),
      ZONAS.indexOf(p.zona),
      NIVELES.indexOf(p.nivel),
      p.alturaCm ?? 0,
      p.elementos ?? 0,
    ];
    if (p.hoja) fila.push(p.hoja.replace('#', ''));
    // Sin medidas, los ceros del final sobran: al leer, lo que falta es cero.
    else while (fila.length > 4 && fila[fila.length - 1] === 0) fila.pop();
    return fila;
  });
  return (
    PREFIJO +
    JSON.stringify([j.id, j.dueno.slice(0, 24), j.ciudad?.slice(0, 32) ?? '', j.racha, j.mejorRacha, j.fecha, plantas])
  );
}

function texto(v: unknown, maximo: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, maximo) : '';
}

function entero(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.max(min, Math.min(max, n));
}

/**
 * El mensaje que se manda por WhatsApp: una frase y el código. Quien lo recibe
 * copia el mensaje entero y lo pega; `leerJardin` encuentra el código adentro.
 */
export function mensajeDeJardin(j: JardinCompartido): string {
  return `Mira mi jardín en MEDISINA 🌿 Abre Jardines, toca el código QR y pega este mensaje:\n\n${codificarJardin(j)}`;
}

/**
 * De texto a jardín, o `null` si no es un código de MEDISINA válido.
 *
 * El código puede venir solo o en medio de un mensaje (lo que se pega de
 * WhatsApp trae la frase de arriba, y a veces un salto de línea al final).
 */
export function leerJardin(codigo: string): JardinCompartido | null {
  const inicio = codigo.indexOf(PREFIJO);
  const fin = codigo.lastIndexOf(']');
  if (inicio < 0 || fin < inicio || fin - inicio > 6000) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(codigo.slice(inicio + PREFIJO.length, fin + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(datos) || datos.length < 7 || !Array.isArray(datos[6])) return null;
  const [id, dueno, ciudad, racha, mejor, fecha, filas] = datos as [unknown, unknown, unknown, unknown, unknown, unknown, unknown[]];
  const idLimpio = texto(id, 40);
  const duenoLimpio = texto(dueno, 24);
  if (!/^[\w-]{4,40}$/.test(idLimpio) || !duenoLimpio) return null;

  const plantas: PlantaCompartida[] = [];
  for (const f of filas.slice(0, MAXIMO_PLANTAS)) {
    if (!Array.isArray(f)) continue;
    const especieId = texto(f[0], 40);
    if (!buscarEspecie(especieId)) continue;
    const hoja = typeof f[6] === 'string' && /^[0-9a-fA-F]{6}$/.test(f[6]) ? `#${f[6]}` : undefined;
    const alturaCm = entero(f[4], 0, 2000);
    const elementos = entero(f[5], 0, 200);
    plantas.push({
      especieId,
      apodo: texto(f[1], 18) || buscarEspecie(especieId)!.nombresComunes[0],
      zona: ZONAS[entero(f[2], 0, 2)],
      nivel: NIVELES[entero(f[3], 0, 4)],
      alturaCm: alturaCm || undefined,
      elementos: elementos || undefined,
      hoja,
    });
  }
  const fechaLimpia = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : new Date().toISOString().slice(0, 10);
  return {
    id: idLimpio,
    dueno: duenoLimpio,
    ciudad: texto(ciudad, 32) || undefined,
    racha: entero(racha, 0, 10000),
    mejorRacha: Math.max(entero(mejor, 0, 10000), entero(racha, 0, 10000)),
    fecha: fechaLimpia,
    plantas,
  };
}

// ---------------------------------------------------------------------------
// El de ejemplo
// ---------------------------------------------------------------------------

/**
 * El jardín de Mariana: inventado, para que Jardines no arranque vacío y se
 * vea cómo es visitar el de un amigo. Se agrega una sola vez; si lo quitas,
 * no regresa. Va marcado como ejemplo y así se dice en pantalla.
 */
export function jardinDeEjemplo(hoy = new Date()): JardinCompartido {
  return {
    id: 'ejemplo-mariana',
    dueno: 'Mariana',
    ciudad: 'Mazatlán',
    racha: 23,
    mejorRacha: 41,
    fecha: hoy.toISOString().slice(0, 10),
    ejemplo: true,
    plantas: [
      { especieId: 'citrus-limon', apodo: 'Limonero', zona: 'patio', nivel: 'optimo', alturaCm: 120 },
      { especieId: 'plumeria-rubra', apodo: 'Cacalosúchil', zona: 'patio', nivel: 'optimo', alturaCm: 150 },
      { especieId: 'aloe-vera', apodo: 'Sábila', zona: 'patio', nivel: 'optimo', alturaCm: 40 },
      { especieId: 'echeveria-elegans', apodo: 'Rosita', zona: 'patio', nivel: 'humedo' },
      { especieId: 'ocimum-basilicum', apodo: 'Albahaca', zona: 'patio', nivel: 'seco' },
      { especieId: 'monstera-deliciosa', apodo: 'Monstruo', zona: 'casa', nivel: 'optimo', alturaCm: 90, elementos: 9 },
      { especieId: 'phalaenopsis', apodo: 'Orquídea', zona: 'casa', nivel: 'optimo' },
      { especieId: 'epipremnum-aureum', apodo: 'Potos', zona: 'casa', nivel: 'humedo' },
      { especieId: 'anthurium-andraeanum', apodo: 'Anturio', zona: 'sombra', nivel: 'optimo' },
      { especieId: 'nephrolepis-exaltata', apodo: 'Helecho', zona: 'sombra', nivel: 'optimo' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Qué tan top es
// ---------------------------------------------------------------------------

export interface Calificacion {
  /** 0-100. */
  total: number;
  partes: { salud: number; constancia: number; variedad: number; tamano: number };
  insignias: Array<{ clave: string; titulo: string }>;
}

/**
 * La calificación de un jardín, sobre 100.
 *
 * Pesa más lo que cuesta: que estén sanas (40) y la constancia (30, con la
 * racha en escala logarítmica: de 0 a 7 días se nota mucho; de 200 a 300,
 * poco). Luego la variedad de especies (20) y el tamaño (10). Un jardín de
 * tres plantas bien cuidadas le gana a uno de veinte abandonadas.
 */
export function calificar(j: JardinCompartido): Calificacion {
  const n = j.plantas.length;
  const sanas = j.plantas.filter((p) => p.nivel === 'optimo' || p.nivel === 'humedo').length;
  const especies = new Set(j.plantas.map((p) => p.especieId)).size;
  const salud = n === 0 ? 0 : (sanas / n) * 40;
  const constancia = Math.min(1, Math.log(1 + j.racha) / Math.log(31)) * 30;
  const variedad = Math.min(1, especies / 12) * 20;
  const tamano = Math.min(1, n / 15) * 10;
  const insignias: Calificacion['insignias'] = [];
  if (j.racha >= 30) insignias.push({ clave: 'mes', titulo: 'Un mes sin fallar' });
  else if (j.racha >= 7) insignias.push({ clave: 'semana', titulo: 'Semana completa' });
  if (n >= 3 && sanas === n) insignias.push({ clave: 'verde', titulo: 'Todas en su punto' });
  if (especies >= 10) insignias.push({ clave: 'coleccion', titulo: 'Coleccionista' });
  if (ZONAS.every((z) => j.plantas.some((p) => p.zona === z))) insignias.push({ clave: 'tres', titulo: 'Patio, casa y sombra' });
  return {
    total: Math.round(salud + constancia + variedad + tamano),
    partes: {
      salud: Math.round(salud),
      constancia: Math.round(constancia),
      variedad: Math.round(variedad),
      tamano: Math.round(tamano),
    },
    insignias,
  };
}

/** Del más top al menos; empate: la racha más larga, luego el más reciente. */
export function ordenarTop<T extends { jardin: JardinCompartido }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const d = calificar(b.jardin).total - calificar(a.jardin).total;
    if (d !== 0) return d;
    if (b.jardin.racha !== a.jardin.racha) return b.jardin.racha - a.jardin.racha;
    return b.jardin.fecha.localeCompare(a.jardin.fecha);
  });
}
